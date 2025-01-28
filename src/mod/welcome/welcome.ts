import { stripVTControlCharacters } from 'node:util'
import type { WelcomeSettings } from '@prisma/client'
import {
  ApplicationIntegrationType,
  type AttachmentPayload,
  type Guild,
  type GuildMember,
  type GuildTextBasedChannel,
  InteractionContextType,
  type Message,
  type PartialGuildMember,
  codeBlock,
} from 'discord.js'
import { SleetSlashCommand, formatUser, tryFetchMember } from 'sleetcord'
import { prisma } from '../../util/db.js'
import { messageToLog } from '../modlog/handlers/messageDelete.js'
import { type SendPayload, formatLog, sendToModLog } from '../modlog/utils.js'
import { welcomeCache } from './cache.js'
import { config } from './config.js'
import { deleteCommand } from './delete.js'
import { fields } from './fields.js'
import { mark_joined } from './mark_joined.js'
import { formatMessage, message } from './message.js'

export const welcome = new SleetSlashCommand(
  {
    name: 'welcome',
    description: 'Manage the welcome message',
    contexts: [InteractionContextType.Guild],
    integration_types: [ApplicationIntegrationType.GuildInstall],
    default_member_permissions: ['ManageGuild'],
    options: [fields, message, deleteCommand, config, mark_joined],
  },
  {
    guildMemberAdd: handleGuildMemberAdd,
    guildMemberUpdate: handleGuildMemberUpdate,
    messageCreate: handleMessageCreate,
  },
)

/** Guild ID -> Set of member IDs */
const newMembers = new Map<string, Set<string>>()

async function handleGuildMemberAdd(member: GuildMember) {
  if (member.user.bot) return
  if (member.pending) return

  return handleJoin(member)
}

async function handleGuildMemberUpdate(
  oldMember: GuildMember | PartialGuildMember,
  newMember: GuildMember,
) {
  if (oldMember.pending && !newMember.pending) {
    return handleJoin(newMember)
  }
}

async function handleMessageCreate(message: Message) {
  if (message.author.bot || !message.inGuild() || message.system) return

  const member =
    message.member ?? (await tryFetchMember(message.guild, message.author.id))

  if (member === null) {
    return // Failed to fetch member
  }

  const newJoins = newMembers.get(member.guild.id)

  // Check if this member is new before trying to welcome them
  // We can't just rely on welcome joins since someone might want to welcome rejoins but only when
  // they send a message, but someone leaving doesn't clear the welcome joins.
  // We need to know who is "new" (including rejoins) and we should try to welcome on message
  // This could be another table for persistence (ie. someone joins, bot dies, bot comes back,
  // they send a message), but for now, meh, it's fine, and I'd need to cache it anyway.
  if (!newJoins?.has(member.id)) return

  return handleJoin(member, message.channel, message)
}

async function handleJoin(
  member: GuildMember,
  channel?: GuildTextBasedChannel,
  message?: Message,
) {
  if (member.user.bot) return

  const welcomeSettings = await getSettingsFor(member.guild.id)

  // No settings for this guild
  if (welcomeSettings === null) return

  const {
    rejoins,
    ignoreRoles,
    channel: welcomeChannel,
    message: welcomeMessage,
    instant,
    reactWith,
  } = welcomeSettings

  if (!instant && !channel) {
    // Don't instantly welcome people and the user didn't post a message
    // Instead note down the join for later
    const set = newMembers.get(member.guild.id) ?? new Set()
    set.add(member.id)
    newMembers.set(member.guild.id, set)
    return
  }

  // probably should auto do this somewhere lol
  const roleIDs = ignoreRoles.split(',')

  if (member.roles.cache.some((r) => roleIDs.includes(r.id))) {
    return // Ignore them because of their roles
  }

  if (!rejoins && (await hasJoinedBefore(member.guild.id, member.id))) {
    // Ignore them because they've joined before
    return
  }

  const sendChannel =
    (welcomeChannel
      ? await resolveTextBasedChannel(member.guild, welcomeChannel)
      : null) ?? channel

  let sentMessage: Message | null = null

  if (sendChannel) {
    const msg = formatMessage(welcomeMessage, {
      member,
      origin: channel,
      welcome: sendChannel,
      message,
    })
    sentMessage = await sendChannel.send(msg)
  }

  const firstMessage = message ? ` first message at ${message.url}` : ''
  const messagePreview = message
    ? await messageToLog(message, {
        includeAttachments: true,
        includeEmbeds: true,
        includeInteraction: true,
        includePoll: true,
        includeReference: true,
        includeStickers: true,
        includeTimestamp: true,
        includeUser: true,
      })
    : ''

  const logMessage = formatLog(
    '👋',
    'Member Welcome',
    `${formatUser(member)}${sentMessage ? ` at ${sentMessage.url}` : ''}${firstMessage}`,
  )

  let content = logMessage
  const files: AttachmentPayload[] = []

  if (messagePreview) {
    const formattedPreview = `${messagePreview.header}\n${messagePreview.content || '┊'}\n${messagePreview.footer}`

    // 1850 to give us some headroom
    if (formattedPreview.length + logMessage.length <= 1850) {
      content = `${logMessage}\n${codeBlock('ansi', formattedPreview)}`
    } else {
      files.push({
        name: 'first_message.txt',
        attachment: Buffer.from(
          stripVTControlCharacters(formattedPreview),
          'utf-8',
        ),
      })
    }
  }

  const modLogMsg: SendPayload = {
    content,
    files,
    allowedMentions: { parse: [] },
  }

  await sendToModLog(
    member.guild,
    modLogMsg,
    'memberWelcome',
    (config) => config.memberWelcome,
  )

  if (reactWith && message) {
    // ignore errors, not my problem really
    message.react(reactWith).catch(() => {
      /* ignore */
    })
  }

  await addJoin(member.guild.id, member.id)
}

async function resolveTextBasedChannel(
  guild: Guild,
  channelID: string,
): Promise<GuildTextBasedChannel | null> {
  const cachedChannel = guild.channels.cache.get(channelID)

  if (cachedChannel?.isTextBased()) {
    return cachedChannel
  }

  const channel = await guild.channels.fetch(channelID)

  if (channel?.isTextBased()) {
    return channel
  }

  return null
}

async function addJoin(guildID: string, userID: string) {
  const set = newMembers.get(guildID) ?? new Set()
  set.delete(userID)
  newMembers.set(guildID, set)

  return await prisma.welcomeJoins.upsert({
    where: {
      guildID_userID: {
        guildID,
        userID,
      },
    },
    create: {
      guildID,
      userID,
    },
    update: {},
  })
}

async function hasJoinedBefore(
  guildID: string,
  userID: string,
): Promise<boolean> {
  return await prisma.welcomeJoins
    .findFirst({
      where: {
        guildID,
        userID,
      },
      select: { userID: true },
    })
    .then((row) => row !== null)
}

async function getSettingsFor(
  guildID: string,
): Promise<WelcomeSettings | null> {
  const settings = welcomeCache.get(guildID)

  // null means they don't exist
  if (settings === null) return null
  if (settings !== undefined) return settings

  // undefined means not cached
  const dbSettings = await prisma.welcomeSettings.findUnique({
    where: {
      guildID,
    },
  })

  welcomeCache.set(guildID, dbSettings)
  return dbSettings
}
