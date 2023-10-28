import { Prisma } from '@prisma/client'
import {
  ApplicationCommandOptionType,
  ChatInputCommandInteraction,
  GuildMember,
} from 'discord.js'
import pluralize from 'pluralize'
import { SleetSlashSubcommand, getGuild } from 'sleetcord'
import { notNullish } from 'sleetcord-common'
import {
  AntiRaidActions,
  antiRaidOptions,
  getAntiRaidConfigOrDefault,
} from './utils.js'

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

  await interaction.deferReply()

  const config = await getAntiRaidConfigOrDefault(guild)

  const mergedConfig: Prisma.AntiRaidConfigCreateInput = {
    guildID: guild.id,
    enabled: true,
    action: action ?? config.action,
    threshold: threshold ?? config.threshold,
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
    .map((r) => `${r.member.user.tag} (${r.weight}) - ${r.action}`)
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
      async (e) => {
        console.error(e)

        await interaction.editReply({
          content: 'An error occurred while applying the actions',
        })
      },
    )

    await interaction.editReply({
      content: 'Applied actions',
    })
  }
}

async function handleGuildMemberAdd(member: GuildMember) {
  const config = await getAntiRaidConfigOrDefault(member.guild)

  if (!config.enabled) return

  const result = checkMembers([member], config)

  if (result.length === 0) return

  await applyAction(result[0], config)
}

async function applyAction(
  result: MemberCheckResult,
  config: Prisma.AntiRaidConfigCreateInput,
) {
  switch (result.action) {
    case AntiRaidActions.None:
      break
    case AntiRaidActions.Kick:
      return result.member.kick('Anti-raid')
    case AntiRaidActions.Ban:
      return result.member.ban({ reason: 'Anti-raid' })
    case AntiRaidActions.Timeout:
      return result.member.timeout(config.timeoutDuration, 'Anti-raid')
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
      let weight = 0
      const age = Date.now() - member.user.createdTimestamp
      const ageInMinutes = age / 1000 / 60

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
