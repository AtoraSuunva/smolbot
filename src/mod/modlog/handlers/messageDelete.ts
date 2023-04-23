import { SleetModule, formatUser } from 'sleetcord'
import { formatLog, formatTime, getValidatedConfigFor } from '../utils.js'
import {
  Message,
  PartialMessage,
  AuditLogEvent,
  GuildAuditLogsFetchOptions,
  escapeMarkdown,
  AttachmentPayload,
} from 'discord.js'
import { basename } from 'node:path'
import { editStore } from '../../unedit.js'

export const logMessageDelete = new SleetModule(
  {
    name: 'logMessageDelete',
  },
  {
    messageDelete,
  },
)

const lastDeleteEntry = new Map<string, string>()

async function messageDelete(message: Message | PartialMessage) {
  if (!message.guild) return

  const conf = await getValidatedConfigFor(message.guild)
  if (!conf) return

  const { config, channel } = conf

  if (!config.messageDelete) return

  if (message.partial) {
    const msg = `(${message.id}) (uncached) in ${
      message.channel
    } at ${formatTime(message.createdAt)}`

    channel.send(formatLog('🗑️', 'Message deleted', msg))
    return
  }

  let executor, reason

  if (message.guild.members.me?.permissions.has('ViewAuditLog')) {
    const fetchOpts: GuildAuditLogsFetchOptions<AuditLogEvent.MessageDelete> = {
      type: AuditLogEvent.MessageDelete,
      limit: 1,
    }

    const lastEntry = lastDeleteEntry.get(message.guild.id)

    if (lastEntry) {
      fetchOpts.after = lastEntry
    }

    const auditLog = await message.guild.fetchAuditLogs(fetchOpts)
    const auditEntry = auditLog.entries.first()

    if (
      auditEntry?.target?.id === message.author.id &&
      auditEntry.extra.channel.id === message.channel.id &&
      auditEntry.extra.count === 1 &&
      auditEntry.id !== lastEntry
    ) {
      executor = auditEntry.executor
      reason = auditEntry.reason
      lastDeleteEntry.set(message.guild.id, auditEntry.id)
    }
  }

  const edits = editStore.get(message.id)?.edits ?? []
  const editsLog = [...edits.slice(0, -1), message].map((m, i) =>
    messageToLog(m, {
      username: false,
      id: false,
      includeAttachments: i === 0,
    }),
  )
  const attachProxy = message.attachments.map(
    (a) =>
      a.url.replace(
        'https://cdn.discordapp.com',
        '<https://media.discordapp.net',
      ) + '>',
  )

  const stickers = message.stickers.map((s) => `${s.name} (<${s.url}>)`)

  const messageContent = editsLog.join('\n')
  const isTooLong = messageContent.length > 2000

  const msg =
    `(${message.id}) from ${formatUser(message.author)} in ${message.channel}` +
    (executor ? ` by ${formatUser(executor)}` : '') +
    (reason ? ` for "${reason}"` : '') +
    (edits.length > 1 ? `, **${edits.length}** revisions` : '') +
    '\n' +
    (attachProxy.length > 0
      ? `Attachment Proxies: ${attachProxy.join(', ')}\n`
      : '') +
    (stickers.length > 0 ? `Stickers: ${stickers.join(', ')}\n` : '') +
    (isTooLong ? '' : '```\n' + messageContent + '\n```')

  const files: AttachmentPayload[] = []

  if (isTooLong) {
    files.push({
      name: 'message.txt',
      attachment: Buffer.from(messageContent),
      description: `Deleted Message by ${message.author.tag}`,
    })
  }

  channel.send({ content: formatLog('🗑️', 'Message Deleted', msg), files })
}

function messageToLog(
  message: Message,
  { username = true, id = true, includeAttachments = true } = {},
): string {
  return (
    `[${formatTime(message.editedAt ?? message.createdAt)}]` +
    (id ? '(' + message.id + ') ' : '') +
    `${username ? message.author.tag + ' :' : ''} ${escapeMarkdown(
      message.content,
    )}` +
    `${
      includeAttachments && message.attachments.size > 0
        ? ' | Attachments: ' +
          message.attachments.map((a) => basename(a.url)).join(', ')
        : ''
    }`
  )
}
