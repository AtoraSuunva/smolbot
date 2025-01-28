import type { ModLogConfig, Prisma } from '@prisma/client'
import {
  type Guild,
  type GuildTextBasedChannel,
  type TextChannel,
  time,
} from 'discord.js'
import { prisma } from '../../util/db.js'

export enum EVENT_COLORS {
  memberAdd = 0x77b255,
  memberRemove = 0xdd2e44,
  userBan = 0xff0000,
  userUnban = 0x55acee,
}

const configCache = new Map<Guild, ModLogConfig>()

export async function getConfigFor(guild: Guild): Promise<ModLogConfig | null> {
  const cached = configCache.get(guild)

  if (cached) return cached

  const config = await prisma.modLogConfig.findFirst({
    where: {
      guildID: guild.id,
    },
  })

  if (config) configCache.set(guild, config)

  return config
}

export type ConfigChecker = (config: ModLogConfig) => boolean

export interface ValidConfig {
  config: ModLogConfig
  channel: GuildTextBasedChannel
}

export type LoggedAction = Exclude<
  keyof Prisma.ModLogChannelsCreateInput,
  'guildID' | 'updatedAt'
>

export async function getValidatedConfigFor(
  guild: Guild,
  loggedAction: LoggedAction | '',
  checker: ConfigChecker = () => true,
): Promise<ValidConfig | null> {
  const config = await getConfigFor(guild)

  if (!config?.enabled || !checker(config)) return null

  if (loggedAction) {
    const channel = await getChannelFor(guild, loggedAction, false)

    if (channel) {
      return { config, channel }
    }
  }

  const channel = guild.channels.cache.get(config.channelID)

  if (!channel?.isTextBased()) return null

  return { config, channel }
}

export async function getChannelFor(
  guild: Guild,
  loggedAction: LoggedAction,
  fallback = true,
): Promise<GuildTextBasedChannel | null> {
  const channels = await prisma.modLogChannels.findFirst({
    select: {
      [loggedAction]: true,
    },
    where: {
      guildID: guild.id,
    },
  })

  let channelID: string | undefined = channels?.[loggedAction]

  if (!channelID) {
    if (!fallback) return null

    const config = await prisma.modLogConfig.findFirst({
      select: {
        channelID: true,
      },
      where: {
        guildID: guild.id,
      },
    })

    if (!config) return null
    channelID = config.channelID
  }

  const channel = guild.channels.cache.get(channelID)

  if (!channel?.isTextBased()) return null

  return channel
}

export function clearCacheFor(guild: Guild) {
  configCache.delete(guild)
}

export function formatLog(
  emoji: string,
  type: string,
  message: string,
  timestamp = new Date(),
): string {
  return `${emoji} ${time(timestamp, 'T')} \`[${type}]\`: ${message}`
}

export function formatTime(timestamp: Date | null = new Date()): string {
  if (timestamp === null) return 'null'
  return padExpressions`${timestamp.getUTCHours()}:${timestamp.getUTCMinutes()}:${timestamp.getUTCSeconds()}`
}

export type SendPayload = Parameters<TextChannel['send']>[0]

export async function sendToModLog(
  guild: Guild,
  payload: SendPayload,
  loggedAction: LoggedAction,
  checker: ConfigChecker = () => true,
) {
  const config = await getValidatedConfigFor(guild, loggedAction, checker)

  if (!config) return

  return config.channel.send(payload)
}

/** Pads the expressions in tagged template literals */
function padExpressions(
  strings: TemplateStringsArray,
  ...expressions: unknown[]
) {
  return strings
    .map(
      (v, i) =>
        v +
        (expressions[i] !== undefined
          ? String(expressions[i]).padStart(2, '0')
          : ''),
    )
    .join('')
}
