import {
  APIAuditLogChange,
  AttachmentPayload,
  AuditLogEvent,
  AutoModerationActionType,
  BaseChannel,
  ChannelType,
  DMChannel,
  GuildAuditLogsEntry,
  GuildBasedChannel,
  LimitedCollection,
  NonThreadGuildBasedChannel,
  OverwriteType,
  TextBasedChannel,
} from 'discord.js'
import { escapeAllMarkdown, formatUser } from 'sleetcord'
import { formatLog, getValidatedConfigFor } from '../../utils.js'
import { messageDeleteBulkWithAuditLog } from '../messageDeleteBulk.js'
import { AuditInfo, resolveUser } from './index.js'

export type ChannelAuditLog = GuildAuditLogsEntry<
  AuditLogEvent,
  'Create' | 'Delete' | 'Update',
  'Channel',
  | AuditLogEvent.ChannelCreate
  | AuditLogEvent.ChannelDelete
  | AuditLogEvent.ChannelUpdate
>

const tempStoredChannels = new LimitedCollection<
  string,
  NonThreadGuildBasedChannel & TextBasedChannel
>({
  maxSize: 10,
})

export async function channelDelete(
  channel: DMChannel | NonThreadGuildBasedChannel,
) {
  if (channel.isDMBased()) return
  const conf = await getValidatedConfigFor(channel.guild)
  if (!conf) return

  if (
    conf.config.channelDelete &&
    conf.config.messageDeleteBulk &&
    channel.isTextBased()
  ) {
    tempStoredChannels.set(channel.id, channel)
  }
}

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
    auditLogEntry.target instanceof BaseChannel
      ? // If target is a channel
        (auditLogEntry.target as NonThreadGuildBasedChannel | TargetChannel)
      : auditLogEntry.targetId
        ? // Use our cache or try to fetch the channel from discord
          (tempStoredChannels.get(auditLogEntry.targetId) ??
          (auditLogEntry.action !== AuditLogEvent.ChannelDelete
            ? await guild.channels.fetch(auditLogEntry.targetId)
            : null))
        : // Give up and use just the ID
          auditLogEntry.targetId

  const executor = await resolveUser(
    auditLogEntry.executor,
    auditLogEntry.executorId,
    guild.client,
  )
  const channelText = formatChannel(modifiedChannel)
  const verb = LogVerb[auditLogEntry.action]
  const execUser = executor ? formatUser(executor) : 'Unknown User'
  const changelog = auditLogEntry.changes
    .map((change) => {
      const log = [`=== ${change.key}:`]
      if (change.old !== undefined) {
        log.push(`- ${formatChange(change.old).replace(/\n/g, '\n- ')}`)
      }

      if (change.new !== undefined) {
        log.push(`+ ${formatChange(change.new).replace(/\n/g, '\n+ ')}`)
      }

      return log.join('\n')
    })
    .join('\n')

  const headline = `${channelText} ${verb} by ${execUser}`

  let message = ''
  let files: AttachmentPayload[] = []

  if (changelog.length <= 1800) {
    message = `${headline}${
      changelog ? '\n```diff\n' + changelog + '\n```' : ''
    }`
  } else {
    message = `${headline}\nChangelog is too long to display here, see attached file for details.`

    files = [
      {
        attachment: Buffer.from(changelog),
        name: `changelog.txt`,
      },
    ]
  }

  const content = formatLog(
    LogEmoji[auditLogEntry.action],
    LogName[auditLogEntry.action],
    message,
  )

  await channel.send({
    content,
    files,
    allowedMentions: { parse: [] },
  })

  if (
    auditLogEntry.action === AuditLogEvent.ChannelDelete &&
    modifiedChannel instanceof BaseChannel &&
    modifiedChannel.isTextBased()
  ) {
    await messageDeleteBulkWithAuditLog(
      modifiedChannel.messages.cache,
      modifiedChannel,
      auditLogEntry,
    )
  }

  if (
    auditLogEntry.targetId &&
    tempStoredChannels.has(auditLogEntry.targetId)
  ) {
    tempStoredChannels.delete(auditLogEntry.targetId)
  }
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
  [ChannelType.GuildMedia]: 'Media',
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

  return `**${escapeAllMarkdown(channel.name)}** (${channel.id}) [\`${
    ChannelTypeNames[channel.type]
  }\`]${parent}`
}

type AuditLogChange = APIAuditLogChange['old_value']

function formatChange(change: AuditLogChange): string {
  if (typeof change !== 'object') return String(change)

  if (Array.isArray(change)) {
    return formatChangeArray(change)
  }

  if ('emoji_id' in change) {
    return `<Emoji:${change.emoji_name ?? change.emoji_id}>`
  } else {
    return '<AutoModerationRuleTriggerMetadata>'
  }
}

type AuditLogChangeArray = Extract<APIAuditLogChange['old_value'], unknown[]>

function formatChangeArray(change: AuditLogChangeArray): string {
  return change
    .map((c) => {
      if (typeof c !== 'object') return String(change)

      if ('position' in c) {
        return `<Role:${c.name} (${c.id}) [p:${c.permissions}]>`
      } else if ('allow' in c) {
        return `<Overwrite:${OverwriteType[c.type]} (${c.id}) [a:${c.allow}/d:${c.deny}]>`
      } else if ('type' in c) {
        return `<AutoModerationAction:${AutoModerationActionType[c.type]}>`
      } else if ('moderated' in c) {
        return `<ForumTag:${c.name} (${c.id})>`
      }

      return `<unknown:${c}>`
    })
    .join(', ')
}
