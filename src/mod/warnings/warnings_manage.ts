import type { WarningConfig } from '@prisma/client'
import {
  ApplicationCommandOptionType,
  ApplicationIntegrationType,
  type ChatInputCommandInteraction,
  Constants,
  InteractionContextType,
} from 'discord.js'
import { SleetSlashCommand, getGuild } from 'sleetcord'
import { getOptionCount } from 'sleetcord-common'
import { prisma } from '../../util/db.js'
import { channelFormatter, formatConfig } from '../../util/format.js'
import { markWarningArchiveDirty } from './utils.js'

export const warnings_manage = new SleetSlashCommand(
  {
    name: 'warnings_manage',
    description: 'View or edit the warnings system config',
    contexts: [InteractionContextType.Guild],
    integration_types: [ApplicationIntegrationType.GuildInstall],
    default_member_permissions: ['ManageGuild'],
    options: [
      {
        name: 'expires_after',
        description:
          'Set the time (in days) after which a warning expires. 0 to disable. (default: 0)',
        type: ApplicationCommandOptionType.Integer,
        min_value: 0,
      },
      {
        name: 'archive_enabled',
        description:
          'Enable or disable warning archiving, you also need to set the archive_channel (default: false)',
        type: ApplicationCommandOptionType.Boolean,
      },
      {
        name: 'archive_channel',
        description:
          'Set the channel where warnings will be archived as a csv file, if enabled (default: none)',
        type: ApplicationCommandOptionType.Channel,
        channel_types: Constants.GuildTextBasedChannelTypes,
      },
    ],
  },
  {
    run: runWarningsManage,
  },
)

async function runWarningsManage(interaction: ChatInputCommandInteraction) {
  const guild = await getGuild(interaction, true)

  const oldConfig = await prisma.warningConfig.findUnique({
    where: {
      guildID: guild.id,
    },
  })

  // No options specified, show the current config
  if (getOptionCount(interaction) === 0) {
    if (!oldConfig) {
      return interaction.reply({
        content:
          "You don't have an existing warning config, use `/warnings_manage` with options to create one.",
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
    })
  }

  const { options } = interaction

  const expiresAfter = options.getInteger('expires_after')
  const archiveEnabled = options.getBoolean('archive_enabled')
  const archiveChannel = options.getChannel('archive_channel')

  const mergedConfig: Omit<WarningConfig, 'updatedAt'> = {
    guildID: guild.id,
    expiresAfter: expiresAfter ?? oldConfig?.expiresAfter ?? 0,
    archiveEnabled: archiveEnabled ?? oldConfig?.archiveEnabled ?? false,
    archiveChannel: archiveChannel?.id ?? oldConfig?.archiveChannel ?? null,
  }

  await prisma.warningConfig.upsert({
    where: {
      guildID: guild.id,
    },
    update: mergedConfig,
    create: mergedConfig,
  })

  if (oldConfig && !oldConfig.archiveEnabled && archiveEnabled) {
    await markWarningArchiveDirty(guild.id, true)
  }

  const warning =
    mergedConfig.archiveEnabled && mergedConfig.archiveChannel === null
      ? '⚠️ You enabled archiving, but did not specify an archive channel. Warnings will NOT be archived!!!\n'
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
  })
}
