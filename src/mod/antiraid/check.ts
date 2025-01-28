import type { Prisma } from '@prisma/client'
import {
  ApplicationCommandOptionType,
  type ChatInputCommandInteraction,
  type GuildMember,
} from 'discord.js'
import pluralize from 'pluralize'
import { SleetSlashSubcommand, formatUser, getGuild } from 'sleetcord'
import { MINUTE, baseLogger, notNullish } from 'sleetcord-common'
import {
  AntiRaidActionVerb,
  AntiRaidActions,
  antiRaidOptions,
  getAntiRaidConfigOrDefault,
} from './utils.js'

const antiraidLogger = baseLogger.child({ module: 'antiraid' })

export const antiraid_check = new SleetSlashSubcommand(
  {
    name: 'check',
    description:
      'Run a manual check on cached members, supplied options override your config for this check only',
    options: [
      {
        name: 'apply_actions',
        description:
          "Apply the actions instead of just displaying what would've happened",
        type: ApplicationCommandOptionType.Boolean,
        required: true,
      },
      ...antiRaidOptions,
    ],
  },
  {
    run: handleRun,
    guildMemberAdd: handleGuildMemberAdd,
  },
)

async function handleRun(interaction: ChatInputCommandInteraction) {
  const guild = await getGuild(interaction, true)

  const shouldApply = interaction.options.getBoolean('apply_actions', true)
  const action = interaction.options.getString('action', false)
  const threshold = interaction.options.getNumber('threshold', false)
  const timeoutDuration = interaction.options.getNumber(
    'timeout_duration',
    false,
  )
  const accountAgeLimitMin = interaction.options.getNumber(
    'account_age_limit_min',
    false,
  )
  const accountAgeLimitMax = interaction.options.getNumber(
    'account_age_limit_max',
    false,
  )
  const accountAgeWeight = interaction.options.getNumber(
    'account_age_weight',
    false,
  )
  const noProfilePictureWeight = interaction.options.getNumber(
    'no_profile_picture_weight',
    false,
  )
  const reason = interaction.options.getString('reason', false)
  const logChannel = interaction.options.getChannel('log_channel', false)
  const reset = interaction.options.getBoolean('reset', false)

  await interaction.deferReply()

  const config = await getAntiRaidConfigOrDefault(guild, reset === true)

  const mergedConfig: Prisma.AntiRaidConfigCreateInput = {
    guildID: guild.id,
    enabled: true,
    action: action ?? config.action,
    threshold: threshold ?? config.threshold,
    reason: reason ?? config.reason,
    logChannelID: logChannel?.id ?? config.logChannelID,
    timeoutDuration: timeoutDuration ?? config.timeoutDuration,
    accountAgeLimitMin: accountAgeLimitMin ?? config.accountAgeLimitMin,
    accountAgeLimitMax: accountAgeLimitMax ?? config.accountAgeLimitMax,
    accountAgeWeight: accountAgeWeight ?? config.accountAgeWeight,
    noProfilePictureWeight:
      noProfilePictureWeight ?? config.noProfilePictureWeight,
  }

  const results = checkMembers([...guild.members.cache.values()], mergedConfig)

  if (results.length === 0) {
    await interaction.editReply({
      content: 'No members would be affected',
    })

    return
  }

  const formattedResult = results
    .map(
      (r) =>
        `${formatUser(r.member, {
          id: true,
          markdown: false,
          escapeMarkdown: false,
        })} (${r.weight} weight >= ${config.threshold}) - ${r.action}`,
    )
    .join('\n')

  await interaction.editReply({
    content: `${pluralize('result', results.length)}${
      shouldApply ? ' (Applying actions now...)' : ''
    }:`,
    files: [
      {
        name: 'result.txt',
        attachment: Buffer.from(formattedResult),
      },
    ],
  })

  if (shouldApply) {
    await Promise.all(results.map((r) => applyAction(r, mergedConfig))).catch(
      async (e: unknown) => {
        antiraidLogger.error(e, 'Error applying actions')

        await interaction.editReply({
          content: `An error occurred while applying the actions:\n\`\`\`${String(
            e,
          )}\`\`\``,
        })
      },
    )

    await interaction.editReply({
      content: 'Applied actions',
    })

    const logChannel = config.logChannelID
      ? await guild.channels.fetch(config.logChannelID)
      : null

    if (logChannel?.isTextBased()) {
      await logChannel.send({
        content: `${formatUser(
          interaction.user,
        )} applied actions for ${pluralize('user', results.length)}`,
        files: [
          {
            name: 'result.txt',
            attachment: Buffer.from(formattedResult),
          },
        ],
      })
    }
  }
}

async function handleGuildMemberAdd(member: GuildMember) {
  if (member.user.bot) return

  const config = await getAntiRaidConfigOrDefault(member.guild)

  if (!config.enabled) return

  const result = checkMembers([member], config)

  if (result.length === 0) return

  await applyAction(result[0], config)

  const logChannel = config.logChannelID
    ? await member.guild.channels.fetch(config.logChannelID)
    : null

  if (logChannel?.isTextBased()) {
    await logChannel.send({
      content: `${formatUser(member, { id: true, mention: true })} got ${
        AntiRaidActionVerb[result[0].action]
      } for ${result[0].weight} weight (>= ${config.threshold})`,
    })
  }
}

const DEFAULT_REASON = 'Anti-raid triggered'

async function applyAction(
  result: MemberCheckResult,
  config: Prisma.AntiRaidConfigCreateInput,
) {
  switch (result.action) {
    case AntiRaidActions.None:
      break
    case AntiRaidActions.Kick:
      return result.member.kick(config.reason ?? DEFAULT_REASON)
    case AntiRaidActions.Ban:
      return result.member.ban({ reason: config.reason ?? DEFAULT_REASON })
    case AntiRaidActions.Timeout:
      return result.member.timeout(
        config.timeoutDuration,
        config.reason ?? DEFAULT_REASON,
      )
  }

  return null
}

interface MemberCheckResult {
  member: GuildMember
  weight: number
  action: AntiRaidActions
}

function checkMembers(
  members: GuildMember[],
  config: Prisma.AntiRaidConfigCreateInput,
): MemberCheckResult[] {
  return members
    .map((member) => {
      if (member.user.bot) return null

      let weight = 0
      const age = Date.now() - member.user.createdTimestamp
      const ageInMinutes = age / MINUTE

      if (ageInMinutes <= config.accountAgeLimitMin) {
        weight += config.accountAgeWeight
      } else if (ageInMinutes <= config.accountAgeLimitMax) {
        // See https://www.desmos.com/calculator/wsuey8s9yp
        const ageWeight =
          config.accountAgeWeight *
          (1 -
            (ageInMinutes - config.accountAgeLimitMin) /
              (config.accountAgeLimitMax - config.accountAgeLimitMin))
        weight += ageWeight
      }

      if (!member.user.avatar) {
        weight += config.noProfilePictureWeight
      }

      if (weight >= config.threshold) {
        return {
          member,
          weight,
          action: config.action as AntiRaidActions,
        }
      }

      return null
    })
    .filter(notNullish)
}
