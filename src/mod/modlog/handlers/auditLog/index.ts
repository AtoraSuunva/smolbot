import type { ModLogConfig } from '@prisma/client'
import {
  AuditLogEvent,
  type Client,
  type Guild,
  type GuildAuditLogsEntry,
  type GuildTextBasedChannel,
  type User,
} from 'discord.js'
import { SleetModule } from 'sleetcord'
import { getValidatedConfigFor } from '../../utils.js'
import {
  type ChannelAuditLog,
  channelDelete,
  logChannelModified,
} from './channelModify.js'
import { type BanAuditLog, logMemberBanKick } from './memberBanKick.js'

export const logAuditLog = new SleetModule(
  {
    name: 'logAuditLog',
  },
  {
    guildAuditLogEntryCreate,
    channelDelete,
  },
)

export interface AuditInfo {
  channel: GuildTextBasedChannel
  config: ModLogConfig
  guild: Guild
}

async function guildAuditLogEntryCreate(
  auditLogEntry: GuildAuditLogsEntry,
  guild: Guild,
) {
  const conf = await getValidatedConfigFor(guild, '')
  if (!conf) return

  const { config, channel } = conf
  const auditInfo: AuditInfo = { channel, config, guild }

  switch (auditLogEntry.action) {
    case AuditLogEvent.ChannelCreate:
    case AuditLogEvent.ChannelDelete:
    case AuditLogEvent.ChannelUpdate:
      await logChannelModified(auditLogEntry as ChannelAuditLog, auditInfo)
      break

    case AuditLogEvent.MemberBanAdd:
    case AuditLogEvent.MemberBanRemove:
    case AuditLogEvent.MemberKick:
      await logMemberBanKick(auditLogEntry as BanAuditLog, auditInfo)
      break
  }
}

export async function resolveUser(
  maybeUser: User | null,
  maybeUserId: string | null,
  client: Client,
): Promise<User | null> {
  // Against all odds, username **can** be null!!!
  // I was receiving errors due to users that looked like this:
  // User {
  //   id: '509179566783332353',
  //   bot: null,
  //   system: null,
  //   flags: null,
  //   username: null,
  //   globalName: null,
  //   discriminator: null,
  //   avatar: null,
  //   banner: undefined,
  //   accentColor: undefined,
  //   avatarDecoration: null
  // }
  if (maybeUser === null || (maybeUser.username as unknown) === null) {
    return maybeUserId
      ? await client.users.fetch(maybeUserId).catch(() => null)
      : null
  }

  return maybeUser
}
