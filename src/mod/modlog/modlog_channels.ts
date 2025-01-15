import { type ModLogChannels, Prisma } from '@prisma/client'
import {
  ApplicationCommandOptionType,
  type ChatInputCommandInteraction,
  Constants,
} from 'discord.js'
import { SleetSlashSubcommand, getGuild } from 'sleetcord'
import { getOptionCount } from 'sleetcord-common'
import { prisma } from '../../util/db.js'
import { formatConfig, toSnakeCase } from '../../util/format.js'
import { type LoggedAction, getValidatedConfigFor } from './utils.js'

type CamelToSnakeCase<S extends string> = S extends `${infer T}${infer U}`
  ? `${T extends Capitalize<T> ? '_' : ''}${Lowercase<T>}${CamelToSnakeCase<U>}`
  : S

const actions = (
  Object.keys(Prisma.ModLogChannelsScalarFieldEnum) as unknown as Array<
    keyof typeof Prisma.ModLogChannelsScalarFieldEnum
  >
)
  .filter((a) => a !== 'guildID' && a !== 'updatedAt')
  .map((a) => toSnakeCase(a)) as CamelToSnakeCase<LoggedAction>[]

export const modlog_channels = new SleetSlashSubcommand(
  {
    name: 'channels',
    description: 'Redirect certain modlog messages to specific channels',
    options: actions.map((a) => ({
      name: a,
      description:
        'Redirect log messages to another channel, set to the same log channel as the main config to sync',
      type: ApplicationCommandOptionType.Channel,
      channel_types: Constants.GuildTextBasedChannelTypes,
    })),
  },
  {
    run: runModlogChannels,
  },
)

async function runModlogChannels(interaction: ChatInputCommandInteraction) {
  const guild = await getGuild(interaction, true)

  const oldConfig = await prisma.modLogChannels.findFirst({
    where: {
      guildID: guild.id,
    },
  })

  if (getOptionCount(interaction) === 0) {
    // No options specified, show the current config
    if (!oldConfig) {
      return interaction.reply({
        content:
          "You don't have any log channel overrides, use `/modlog channels` with options to create one.",
      })
    }

    return interaction.reply({
      content: `Current channel overrides:\n${formatConfig({
        config: oldConfig,
        guild,
      })}`,
      allowedMentions: { parse: [] },
    })
  }

  const mainConfig = await getValidatedConfigFor(guild, '')

  const { options } = interaction
  const memberAdd = options.getChannel('member_add')
  const memberWelcome = options.getChannel('member_welcome')
  const memberRemove = options.getChannel('member_remove')
  const memberBan = options.getChannel('member_ban')
  const memberUnban = options.getChannel('member_unban')
  const userUpdate = options.getChannel('user_update')
  const messageDelete = options.getChannel('message_delete')
  const channelUpdate = options.getChannel('channel_update')
  const messageDeleteBulk = options.getChannel('message_delete_bulk')
  const channelCreate = options.getChannel('channel_create')
  const channelDelete = options.getChannel('channel_delete')
  const automodAction = options.getChannel('automod_action')
  const reactionRemove = options.getChannel('reaction_remove')

  const mainChannel = mainConfig?.channel ?? null

  const mergedConfig: Omit<ModLogChannels, 'updatedAt'> = {
    guildID: guild.id,
    memberAdd: mergedChannel(memberAdd, oldConfig?.memberAdd, mainChannel),
    memberWelcome: mergedChannel(
      memberWelcome,
      oldConfig?.memberWelcome,
      mainChannel,
    ),
    memberRemove: mergedChannel(
      memberRemove,
      oldConfig?.memberRemove,
      mainChannel,
    ),
    memberBan: mergedChannel(memberBan, oldConfig?.memberBan, mainChannel),
    memberUnban: mergedChannel(
      memberUnban,
      oldConfig?.memberUnban,
      mainChannel,
    ),
    userUpdate: mergedChannel(userUpdate, oldConfig?.userUpdate, mainChannel),
    messageDelete: mergedChannel(
      messageDelete,
      oldConfig?.messageDelete,
      mainChannel,
    ),
    messageDeleteBulk: mergedChannel(
      messageDeleteBulk,
      oldConfig?.messageDeleteBulk,
      mainChannel,
    ),
    channelCreate: mergedChannel(
      channelCreate,
      oldConfig?.messageDeleteBulk,
      mainChannel,
    ),
    channelDelete: mergedChannel(
      channelDelete,
      oldConfig?.channelDelete,
      mainChannel,
    ),
    channelUpdate: mergedChannel(
      channelUpdate,
      oldConfig?.channelUpdate,
      mainChannel,
    ),
    automodAction: mergedChannel(
      automodAction,
      oldConfig?.automodAction,
      mainChannel,
    ),
    reactionRemove: mergedChannel(
      reactionRemove,
      oldConfig?.reactionRemove,
      mainChannel,
    ),
  }

  await prisma.modLogChannels.upsert({
    where: {
      guildID: guild.id,
    },
    update: mergedConfig,
    create: mergedConfig,
  })

  return interaction.reply({
    content: `Modlog channel overrides:\n${formatConfig({
      config: mergedConfig,
      oldConfig,
      guild,
    })}`,
    allowedMentions: { parse: [] },
  })
}

interface MaybeChannel {
  id?: string
}

function mergedChannel(
  newChannel: MaybeChannel | null,
  oldChannel: string | null | undefined,
  mainChannel: MaybeChannel | null,
): string | null {
  if (newChannel?.id === mainChannel?.id) {
    // Reset to null to sync it
    return null
  }

  // Otherwise use the new channel, fallback to the old config, or set it null as default
  return newChannel?.id ?? oldChannel ?? null
}
