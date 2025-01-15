import type { Prisma } from '@prisma/client'
import {
  ApplicationCommandOptionType,
  ApplicationIntegrationType,
  ChannelType,
  type ChatInputCommandInteraction,
  Constants,
  InteractionContextType,
} from 'discord.js'
import { SleetSlashCommand, getGuild, makeChoices } from 'sleetcord'
import { getOptionCount } from 'sleetcord-common'
import { prisma } from '../../util/db.js'
import { formatConfig } from '../../util/format.js'

export const mute_manage = new SleetSlashCommand(
  {
    name: 'mute_manage',
    description: 'Configure the mute system',
    default_member_permissions: ['ManageGuild'],
    contexts: [InteractionContextType.Guild],
    integration_types: [ApplicationIntegrationType.GuildInstall],
    options: [
      {
        name: 'role',
        description: 'The role to give to muted users',
        type: ApplicationCommandOptionType.Role,
      },
      {
        name: 'log_channel',
        description: 'The channel to send mute logs to',
        type: ApplicationCommandOptionType.Channel,
        channel_types: Constants.GuildTextBasedChannelTypes,
      },
      {
        name: 'separate_users',
        description:
          'Whether to separate muted users from other users, requires `muted_category` (default: false)',
        type: ApplicationCommandOptionType.Boolean,
      },
      {
        name: 'muted_category',
        description:
          'The category to put muted user channels in, permissions are synced to this channel',
        type: ApplicationCommandOptionType.Channel,
        channel_types: [ChannelType.GuildCategory],
      },
      {
        name: 'name_template',
        description:
          'Template for naming muted user channels, supports {user}/{user_id}/{i} (default: muted-{user})',
        type: ApplicationCommandOptionType.String,
        max_length: 100,
      },
      {
        name: 'max_channels',
        description:
          'Max number of channels to create. An overflow channel is created for any extra users (default: 25)',
        type: ApplicationCommandOptionType.Integer,
      },
      {
        name: 'channel_topic',
        description: 'The topic to set on the channel',
        type: ApplicationCommandOptionType.String,
        max_length: 1024,
      },
      {
        name: 'starter_message',
        description:
          'The message to send on muted channel creation, supports {mention}/{executor}',
        type: ApplicationCommandOptionType.String,
        max_length: 2000,
      },
      {
        name: 'unset',
        description: 'Unset a config option',
        type: ApplicationCommandOptionType.String,
        choices: makeChoices(['role', 'log_channel']),
      },
    ],
  },
  {
    run: runMuteManage,
  },
)

async function runMuteManage(interaction: ChatInputCommandInteraction) {
  const guild = await getGuild(interaction, true)

  const oldConfig = await prisma.muteConfig.findUnique({
    where: {
      guildID: guild.id,
    },
  })

  // No options specified, show the current config
  if (getOptionCount(interaction) === 0) {
    if (!oldConfig) {
      return interaction.reply({
        content:
          "You don't have an existing mute config, use `/mute_manage` with options to create one.",
      })
    }

    return interaction.reply({
      content: `Current config:\n${formatConfig({
        config: oldConfig,
        guild,
      })}`,
      allowedMentions: { parse: [] },
    })
  }

  const role = interaction.options.getRole('role')
  const logChannel = interaction.options.getChannel('log_channel')
  const separateUsers = interaction.options.getBoolean('separate_users')
  const category = interaction.options.getChannel('muted_category')
  const nameTemplate = interaction.options.getString('name_template')
  const maxChannels = interaction.options.getInteger('max_channels')
  const channelTopic = interaction.options.getString('channel_topic')
  const starterMessage = interaction.options.getString('starter_message')
  const unset = interaction.options.getString('unset')

  const toUpsert: Omit<Prisma.MuteConfigCreateInput, 'guildID'> = {
    roleID: unset === 'role' ? null : (role?.id ?? oldConfig?.roleID ?? null),
    logChannelID:
      unset === 'log_channel'
        ? null
        : (logChannel?.id ?? oldConfig?.logChannelID ?? null),
    separateUsers: separateUsers ?? oldConfig?.separateUsers ?? false,
    categoryID: category?.id ?? oldConfig?.categoryID ?? null,
    nameTemplate: nameTemplate ?? oldConfig?.nameTemplate ?? 'muted-{user}',
    maxChannels: maxChannels ?? oldConfig?.maxChannels ?? 25,
    channelTopic: channelTopic ?? oldConfig?.channelTopic ?? null,
    starterMessage: starterMessage ?? oldConfig?.starterMessage ?? null,
  }

  const newConfig = await prisma.muteConfig.upsert({
    where: {
      guildID: guild.id,
    },
    create: {
      ...toUpsert,
      guildID: guild.id,
    },
    update: {
      ...toUpsert,
    },
  })

  const config = formatConfig({ config: newConfig, oldConfig, guild })

  return interaction.reply({
    content: `Mute config:\n${config}`,
    allowedMentions: { parse: [] },
  })
}
