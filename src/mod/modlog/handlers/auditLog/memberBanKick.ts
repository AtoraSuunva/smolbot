import { AuditLogEvent, type GuildAuditLogsEntry } from 'discord.js'
import { formatUser } from 'sleetcord'
import { type LoggedAction, formatLog, getChannelFor } from '../../utils.js'
import { type AuditInfo, resolveUser } from './index.js'

export type BanAuditLog = GuildAuditLogsEntry<
  AuditLogEvent,
  'Create' | 'Delete',
  'User',
  | AuditLogEvent.MemberBanAdd
  | AuditLogEvent.MemberBanRemove
  | AuditLogEvent.MemberKick
>

/**
 * Log when a member is removed forcefully by a mod from a guild (or let back in). Ban, unban, and kick.
 */
export async function logMemberBanKick(
  auditLogEntry: BanAuditLog,
  { channel, config, guild }: AuditInfo,
) {
  if (
    (auditLogEntry.action === AuditLogEvent.MemberBanAdd &&
      !config.memberBan) ||
    (auditLogEntry.action === AuditLogEvent.MemberBanRemove &&
      !config.memberUnban) ||
    (auditLogEntry.action === AuditLogEvent.MemberKick && !config.memberRemove)
  ) {
    return
  }

  let loggedAction: LoggedAction

  switch (auditLogEntry.action) {
    case AuditLogEvent.MemberBanAdd:
      loggedAction = 'memberBan'
      break

    case AuditLogEvent.MemberBanRemove:
      loggedAction = 'memberUnban'
      break

    case AuditLogEvent.MemberKick:
      loggedAction = 'memberRemove'
      break
  }

  const logChannel =
    (await getChannelFor(guild, loggedAction, false)) ?? channel

  const executor = await resolveUser(
    auditLogEntry.executor,
    auditLogEntry.executorId,
    guild.client,
  )
  const execUser = executor ? formatUser(executor) : 'Unknown User'

  const target = await resolveUser(
    auditLogEntry.target,
    auditLogEntry.targetId,
    guild.client,
  )
  const targetUser = target ? formatUser(target) : 'Unknown User'

  const reason = auditLogEntry.reason ? ` for "${auditLogEntry.reason}"` : ''
  const verb = LogVerb[auditLogEntry.action]

  const message = `${targetUser} ${verb} by ${execUser}${reason}`

  await logChannel.send({
    content: formatLog(
      LogEmoji[auditLogEntry.action],
      LogName[auditLogEntry.action],
      message,
    ),
    allowedMentions: { parse: [] },
  })
}

const LogEmoji = {
  [AuditLogEvent.MemberBanAdd]: '🔨',
  [AuditLogEvent.MemberBanRemove]: '👼',
  [AuditLogEvent.MemberKick]: '👢',
}

const LogName = {
  [AuditLogEvent.MemberBanAdd]: 'Member Ban',
  [AuditLogEvent.MemberBanRemove]: 'Member Unban',
  [AuditLogEvent.MemberKick]: 'Member Kick',
}

const LogVerb = {
  [AuditLogEvent.MemberBanAdd]: 'banned',
  [AuditLogEvent.MemberBanRemove]: 'unbanned',
  [AuditLogEvent.MemberKick]: 'kicked',
}
