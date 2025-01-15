import type { LockThreadConfig } from '@prisma/client'
import {
  ApplicationCommandOptionType,
  ChannelType,
  type ChatInputCommandInteraction,
  Constants,
} from 'discord.js'
import { SleetSlashSubcommand, getGuild } from 'sleetcord'
import { getOptionCount } from 'sleetcord-common'
import { prisma } from '../../util/db.js'
import { formatConfig } from '../../util/format.js'

export const lock_thread_config_set = new SleetSlashSubcommand(
  {
    name: 'set',
    description: 'Set the config for a specific forum',
    options: [
      {
        name: 'source_channel',
        description: 'Channel to configure, where threads are being locked',
        type: ApplicationCommandOptionType.Channel,
        channel_types: [
          ChannelType.GuildForum,
          ChannelType.GuildText,
          ChannelType.GuildAnnouncement,
          ChannelType.GuildMedia,
        ],
        required: true,
      },
      {
        name: 'log_channel',
        description: 'Channel to log lock reasons in',
        type: ApplicationCommandOptionType.Channel,
        channel_types: Constants.GuildTextBasedChannelTypes,
      },
    ],
  },
  {
    run: runLockThreadConfig,
  },
)

async function runLockThreadConfig(interaction: ChatInputCommandInteraction) {
  const guild = await getGuild(interaction, true)
  const sourceChannel = interaction.options.getChannel('source_channel', true)

  const oldConfig = await prisma.lockThreadConfig.findFirst({
    where: {
      sourceChannelID: sourceChannel.id,
    },
  })

  if (getOptionCount(interaction) === 1) {
    // Only source channel id specified, show the current config
    if (!oldConfig) {
      return interaction.reply({
        content:
          "You don't have an existing lock thread config, use `/lock_thread_config` with options to create one.",
      })
    }

    return interaction.reply({
      content: `Current config:\n${formatConfig({
        config: oldConfig,
        guild,
      })}`,
    })
  }

  const { options } = interaction
  const logChannel = options.getChannel('log_channel')

  const mergedConfig: Omit<LockThreadConfig, 'updatedAt'> = {
    sourceChannelID: sourceChannel.id,
    logChannelID: logChannel?.id ?? oldConfig?.logChannelID ?? null,
  }

  await prisma.lockThreadConfig.upsert({
    where: {
      sourceChannelID: sourceChannel.id,
    },
    update: mergedConfig,
    create: mergedConfig,
  })

  return interaction.reply({
    content: `Lock Thread Config:\n${formatConfig({
      config: mergedConfig,
      oldConfig,
      guild,
    })}`,
    allowedMentions: { parse: [] },
  })
}
