import {
  AuditLogEvent,
  BaseChannel,
  ChannelType,
  GuildAuditLogsEntry,
  GuildBasedChannel,
  NonThreadGuildBasedChannel,
  escapeMarkdown,
} from 'discord.js'
import { formatLog } from '../../utils.js'
import { formatUser } from 'sleetcord'
import { AuditInfo, resolveUser } from './index.js'

export type ChannelAuditLog = GuildAuditLogsEntry<
  AuditLogEvent,
  'Create' | 'Delete' | 'Update',
  'Channel',
  | AuditLogEvent.ChannelCreate
  | AuditLogEvent.ChannelDelete
  | AuditLogEvent.ChannelUpdate
>

export async function logChannelModified(
  auditLogEntry: ChannelAuditLog,
  { channel, config, guild }: AuditInfo,
) {
  if (
    (auditLogEntry.action === AuditLogEvent.ChannelCreate &&
      !config.channelCreate) ||
    (auditLogEntry.action === AuditLogEvent.ChannelDelete &&
      !config.channelDelete) ||
    (auditLogEntry.action === AuditLogEvent.ChannelUpdate &&
      !config.channelUpdate)
  ) {
    return
  }

  const modifiedChannel =
    auditLogEntry.target instanceof BaseChannel ||
    auditLogEntry.action === AuditLogEvent.ChannelDelete
      ? (auditLogEntry.target as NonThreadGuildBasedChannel | TargetChannel) // If target is a channel or if the channel was deleted, use the target
      : auditLogEntry.targetId
      ? await guild.channels.fetch(auditLogEntry.targetId) // Try to fetch the channel
      : auditLogEntry.targetId // Give up and use just the ID

  const executor = await resolveUser(
    auditLogEntry.executor,
    auditLogEntry.executorId,
    guild,
  )
  const channelText = formatChannel(modifiedChannel)
  const verb = LogVerb[auditLogEntry.action]
  const execUser = executor ? formatUser(executor) : 'Unknown User'
  const changelog = auditLogEntry.changes
    .map((change) => {
      const log = [`** ${change.key}: **`]
      if (change.old !== undefined) {
        log.push(`- ${String(change.old).replace(/\n/g, '\n- ')}`)
      }

      if (change.new !== undefined) {
        log.push(`+ ${String(change.new).replace(/\n/g, '\n+ ')}`)
      }

      return log.join('\n')
    })
    .join('\n')

  const message = `${channelText} ${verb} by ${execUser}${
    changelog ? '\n```diff\n' + changelog.substring(0, 1800) + '\n```' : ''
  }`

  await channel.send(
    formatLog(
      LogEmoji[auditLogEntry.action],
      LogName[auditLogEntry.action],
      message,
    ),
  )
}

const LogEmoji = {
  [AuditLogEvent.ChannelCreate]: '🏠',
  [AuditLogEvent.ChannelDelete]: '🏚️',
  [AuditLogEvent.ChannelUpdate]: '🏡',
}

const LogName = {
  [AuditLogEvent.ChannelCreate]: 'Channel Created',
  [AuditLogEvent.ChannelDelete]: 'Channel Deleted',
  [AuditLogEvent.ChannelUpdate]: 'Channel Updated',
}

const LogVerb = {
  [AuditLogEvent.ChannelCreate]: 'created',
  [AuditLogEvent.ChannelDelete]: 'deleted',
  [AuditLogEvent.ChannelUpdate]: 'updated',
}

interface TargetChannel {
  id: string
  name: string
  type: ChannelType
  permission_overwrites: unknown[]
  nsfw: boolean
  rate_limit_per_user: number
  flags: number
}

function formatChannel(
  channel: GuildBasedChannel | TargetChannel | string | null,
): string {
  if (!channel) return 'Unknown Channel'

  if (typeof channel === 'string') return `<#${channel}>`

  const parent =
    'parent' in channel && channel.parent
      ? ` in ${formatChannel(channel.parent)}`
      : ''

  return `**${escapeMarkdown(channel.name)}** (${channel.id}) [\`${
    ChannelTypeNames[channel.type]
  }\`]${parent}`
}

const ChannelTypeNames: Record<ChannelType, string> = {
  [ChannelType.AnnouncementThread]: 'Announcement Thread',
  [ChannelType.DM]: 'DM',
  [ChannelType.GroupDM]: 'Group DM',
  [ChannelType.GuildAnnouncement]: 'Announcement',
  [ChannelType.GuildCategory]: 'Category',
  [ChannelType.GuildDirectory]: 'Directory',
  [ChannelType.GuildForum]: 'Forum',
  [ChannelType.GuildStageVoice]: 'Stage',
  [ChannelType.GuildText]: 'Text',
  [ChannelType.GuildVoice]: 'Voice',
  [ChannelType.PrivateThread]: 'Private Thread',
  [ChannelType.PublicThread]: 'Public Thread',
}
