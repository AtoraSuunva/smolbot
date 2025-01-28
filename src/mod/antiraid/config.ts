import type { Prisma } from '@prisma/client'
import {
  ApplicationCommandOptionType,
  type ChatInputCommandInteraction,
} from 'discord.js'
import { SleetSlashSubcommand, getGuild } from 'sleetcord'
import { prisma } from '../../util/db.js'
import { formatConfig } from '../../util/format.js'
import { antiRaidOptions, getAntiRaidConfigOrDefault } from './utils.js'

export const antiraid_config = new SleetSlashSubcommand(
  {
    name: 'config',
    description: 'Configure the antiraid module',
    options: [
      {
        name: 'enabled',
        description:
          'Whether the antiraid module should be enabled to automatically check joins',
        type: ApplicationCommandOptionType.Boolean,
      },
      ...antiRaidOptions,
    ],
  },
  {
    run: handleRunConfig,
  },
)

async function handleRunConfig(interaction: ChatInputCommandInteraction) {
  const guild = await getGuild(interaction, true)

  const enabled = interaction.options.getBoolean('enabled', false)
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
    enabled: enabled ?? config.enabled,
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

  const updatedConfig = await prisma.antiRaidConfig.upsert({
    where: {
      guildID: guild.id,
    },
    update: mergedConfig,
    create: mergedConfig,
  })

  const formattedConfig = formatConfig({
    config: updatedConfig,
    guild,
  })

  await interaction.editReply({
    content: `Updated antiraid config:\n${formattedConfig}`,
    allowedMentions: { parse: [] },
  })
}
