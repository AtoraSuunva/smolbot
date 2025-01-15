import type { ActionLogConfig } from '@prisma/client'
import {
  ApplicationCommandOptionType,
  type ChatInputCommandInteraction,
  Constants,
} from 'discord.js'
import { SleetSlashSubcommand, getGuild } from 'sleetcord'
import { getOptionCount } from 'sleetcord-common'
import { prisma } from '../../util/db.js'
import { channelFormatter, formatConfig } from '../../util/format.js'
import { markActionlogArchiveDirty } from './utils.js'

export const actionlog_config = new SleetSlashSubcommand(
  {
    name: 'config',
    description: 'View or edit the action logging system config',
    options: [
      {
        name: 'log_bans',
        description: 'If bans should be logged (default: false)',
        type: ApplicationCommandOptionType.Boolean,
      },
      {
        name: 'log_kicks',
        description: 'If kicks should be logged (default: false)',
        type: ApplicationCommandOptionType.Boolean,
      },
      {
        name: 'log_unbans',
        description: 'If unbans should be logged (default: false)',
        type: ApplicationCommandOptionType.Boolean,
      },
      {
        name: 'log_timeouts',
        description: 'If timeouts should be logged (default: false)',
        type: ApplicationCommandOptionType.Boolean,
      },
      {
        name: 'log_timeout_removals',
        description: 'If timeout removals should be logged (default: false)',
        type: ApplicationCommandOptionType.Boolean,
      },
      {
        name: 'log_channel',
        description: 'The channel to log to (default: none)',
        type: ApplicationCommandOptionType.Channel,
        channel_types: Constants.GuildTextBasedChannelTypes,
      },
      {
        name: 'archive_enabled',
        description:
          'Enable or disable action log archiving, you also need to set the archive_channel (default: false)',
        type: ApplicationCommandOptionType.Boolean,
      },
      {
        name: 'archive_channel',
        description:
          'Set the channel where actions will be archived as a csv file, if enabled (default: none)',
        type: ApplicationCommandOptionType.Channel,
        channel_types: Constants.GuildTextBasedChannelTypes,
      },
    ],
  },
  {
    run: runActionlogConfig,
  },
)

async function runActionlogConfig(interaction: ChatInputCommandInteraction) {
  const guild = await getGuild(interaction, true)

  const oldConfig = await prisma.actionLogConfig.findUnique({
    where: {
      guildID: guild.id,
    },
  })

  // No options specified, show the current config
  if (getOptionCount(interaction) === 0) {
    if (!oldConfig) {
      return interaction.reply({
        content:
          "You don't have an existing action log config, use `/actionlog_config` with options to create one.",
      })
    }
    return interaction.reply({
      content: `Current config:\n${formatConfig({
        config: oldConfig,
        guild,
        formatters: {
          archiveChannel: channelFormatter,
        },
      })}`,
      allowedMentions: { parse: [] },
    })
  }

  const { options } = interaction

  const logBans = options.getBoolean('log_bans')
  const logKicks = options.getBoolean('log_kicks')
  const logUnbans = options.getBoolean('log_unbans')
  const logTimeouts = options.getBoolean('log_timeouts')
  const logTimeoutRemovals = options.getBoolean('log_timeout_removals')
  const logChannel = options.getChannel('log_channel')
  const archiveEnabled = options.getBoolean('archive_enabled')
  const archiveChannel = options.getChannel('archive_channel')

  const mergedConfig: Omit<ActionLogConfig, 'updatedAt'> = {
    guildID: guild.id,
    logBans: logBans ?? oldConfig?.logBans ?? false,
    logKicks: logKicks ?? oldConfig?.logKicks ?? false,
    logUnbans: logUnbans ?? oldConfig?.logUnbans ?? false,
    logTimeouts: logTimeouts ?? oldConfig?.logTimeouts ?? false,
    logTimeoutRemovals:
      logTimeoutRemovals ?? oldConfig?.logTimeoutRemovals ?? false,
    logChannelID: logChannel?.id ?? oldConfig?.logChannelID ?? null,
    archiveEnabled: archiveEnabled ?? oldConfig?.archiveEnabled ?? false,
    archiveChannel: archiveChannel?.id ?? oldConfig?.archiveChannel ?? null,
  }

  await prisma.actionLogConfig.upsert({
    where: {
      guildID: guild.id,
    },
    update: mergedConfig,
    create: mergedConfig,
  })

  if (oldConfig && !oldConfig.archiveEnabled && archiveEnabled) {
    await markActionlogArchiveDirty(guild.id, true)
  }

  const warning =
    mergedConfig.archiveEnabled && mergedConfig.archiveChannel === null
      ? '⚠️ You enabled archiving, but did not specify an archive channel. Actions will NOT be archived!!!\n'
      : ''

  return interaction.reply({
    content: `New config:\n${warning}${formatConfig({
      config: mergedConfig,
      oldConfig,
      guild,
      formatters: {
        archiveChannel: channelFormatter,
      },
    })}`,
    allowedMentions: { parse: [] },
  })
}
