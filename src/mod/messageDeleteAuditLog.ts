import {
  AuditLogEvent,
  type GuildAuditLogsEntry,
  type GuildTextBasedChannel,
  LimitedCollection,
  type Message,
  type PartialMessage,
  type ReadonlyCollection,
} from 'discord.js'
import { SleetModule } from 'sleetcord'
import { SECOND } from 'sleetcord-common'
import { EventEmitter } from 'tseep'

export const messageDeleteAuditLog = new SleetModule(
  {
    name: 'messageDeleteAuditLog',
  },
  {
    messageDelete,
    messageDeleteBulk,
  },
)

const previousDeletes = new LimitedCollection<string, MessageDeleteAuditLog>({
  maxSize: 500,
})

const WITHIN_TIME = 5 * SECOND

async function messageDelete(message: Message | PartialMessage) {
  if (
    (message.partial && message.author === null) ||
    !message.inGuild() ||
    message.guild.members.me?.permissions.has('ViewAuditLog') === false ||
    !(await deleteEvents.singleNeedsAuditLog(message))
  ) {
    // Not a guild, we can't fetch audit log, or nobody needs audit log
    deleteEvents.emit('messageDeleteWithAuditLog', message, null)
    return
  }

  // We are:
  // - in a guild
  // - have the ViewAuditLog permission
  // - have a subscriber that needs audit logs
  // Time to figure it out
  // We can't just listen to events because deleting multiple messages from the same author in the same channel
  // doesn't create new events, it emits the first delete but then edits that audit log for future deletes
  // without re-emitting it, so you would only catch the first event

  const { guild } = message

  // Audit logs only let us search by event type, and *executor* user
  // The returned logs only have:
  // - target (user who's message was deleted)
  // - channel (channel where the message was deleted)
  // - executor (user who deleted the message)
  // - count (number of messages from target in channel that executor has deleted)
  // so we need to match the relevant log to the message by:
  // - match target
  // - match channel
  // - count is either:
  //   - equal to 1 and created within the last 5 seconds
  //   - greater than 1 (meaning old entry might have been edited to increase count)

  const auditLogs = await guild.fetchAuditLogs({
    type: AuditLogEvent.MessageDelete,
  })

  const now = Date.now()
  const timeLimit = now - WITHIN_TIME

  const possibleEntries = auditLogs.entries.filter((entry) => {
    if (
      // Not our target
      entry.target.id !== message.author.id ||
      // Not the same channel
      entry.extra.channel.id !== message.channel.id ||
      // Count === 1 and not created within the last 5 seconds
      !(entry.extra.count > 1 || entry.createdTimestamp > timeLimit)
    ) {
      return false
    }

    // Compare against our history
    const previousEntry = previousDeletes.get(entry.id)

    // If we have it cached and it's the same count, it can't be it
    if (previousEntry && previousEntry.extra.count === entry.extra.count) {
      return false
    }

    previousDeletes.set(entry.id, entry)
    // If we have a previous entry then we're good
    // If not, check that the count is greater than 1 otherwise we might be taking uncached data
    // (if user A deletes 2+ messages from B, the bot logs it, then the bot restarts,
    // then user B deletes their own message, the bot would see that count > 1
    // and be unable to use the creation time to tell and incorrectly blame user A again)
    // If user A *did* delete another message between bot restarts, the bot *would* then miss it
    // But it's better to fail to attribute a deleted message than to falsely blame someone
    return previousEntry ?? entry.extra.count === 1
  })

  // Grab the latest viable entry
  const entry = possibleEntries.first() ?? null
  deleteEvents.emit('messageDeleteWithAuditLog', message, entry)
}

const previousBulkDeletes = new LimitedCollection<
  string,
  MessageBulkDeleteAuditLog
>({
  maxSize: 500,
})

async function messageDeleteBulk(
  messages: ReadonlyCollection<string, Message | PartialMessage>,
  channel: GuildTextBasedChannel,
) {
  // The same logic applies here, but we have some differences:
  //   - We are always in a guild
  //   - We only get messages deleted count + channel
  //   - New entries aren't guaranteed to have count = 1 (Once again, updating audit logs prevent us from just listening to creates)
  if (
    channel.guild.members.me?.permissions.has('ViewAuditLog') === false ||
    !(await deleteEvents.bulkNeedsAuditLog(messages, channel))
  ) {
    // Not a guild, we can't fetch audit log, or nobody needs audit log
    deleteEvents.emit('messageBulkDeleteWithAuditLog', messages, channel, null)
    return
  }

  const { guild } = channel

  const auditLogs = await guild.fetchAuditLogs({
    type: AuditLogEvent.MessageBulkDelete,
  })

  const possibleEntries = auditLogs.entries.filter((entry) => {
    if (
      // Not the same channel
      entry.targetId !== channel.id
    ) {
      return false
    }

    // Compare against our history
    const previousEntry = previousBulkDeletes.get(entry.id)

    // If we have it cached and it's the same count, it can't be it
    if (previousEntry && previousEntry.extra.count === entry.extra.count) {
      return false
    }

    previousBulkDeletes.set(entry.id, entry)

    // Multiple bulk deletes will update the count of the old one
    // We know by now that either:
    //   - This is an updated entry with a new count
    //     - Check previous + just deleted = entry count
    //   - This is a new entry
    //     - Check count matches
    return previousEntry
      ? previousEntry.extra.count + messages.size === entry.extra.count
      : entry.extra.count === messages.size
  })

  // Grab the latest viable entry
  const entry = possibleEntries.first() ?? null
  deleteEvents.emit('messageBulkDeleteWithAuditLog', messages, channel, entry)
}

export type MessageDeleteAuditLog =
  GuildAuditLogsEntry<AuditLogEvent.MessageDelete>

export type MessageBulkDeleteAuditLog =
  GuildAuditLogsEntry<AuditLogEvent.MessageBulkDelete>

type SingleNeedsAuditLog = (
  message: Message | PartialMessage,
) => Promise<boolean>
type BulkNeedsAuditLog = (
  messages: ReadonlyCollection<string, Message | PartialMessage>,
  channel: GuildTextBasedChannel,
) => Promise<boolean>

// It would be nice to have the type param as an interface instead, but the index signature makes TS unhappy
// extending DefaultEventMap works fine, but TS then doesn't catch invalid event names
class MessageDeleteWithAuditLog extends EventEmitter<{
  messageDeleteWithAuditLog: (
    message: Message | PartialMessage,
    auditLog: MessageDeleteAuditLog | null,
  ) => Awaited<void>
  messageBulkDeleteWithAuditLog: (
    messages: ReadonlyCollection<string, Message | PartialMessage>,
    channel: GuildTextBasedChannel,
    auditLog: MessageBulkDeleteAuditLog | null,
  ) => Awaited<void>
}> {
  #singleSubscribers: SingleNeedsAuditLog[] = []
  #bulkSubscribers: BulkNeedsAuditLog[] = []

  registerSingle(subscriber: SingleNeedsAuditLog) {
    this.#singleSubscribers.push(subscriber)
  }

  unregisterSingle(subscriber: SingleNeedsAuditLog) {
    this.#singleSubscribers = this.#singleSubscribers.filter(
      (sub) => sub !== subscriber,
    )
  }

  registerBulk(subscriber: BulkNeedsAuditLog) {
    this.#bulkSubscribers.push(subscriber)
  }

  unregisterBulk(subscriber: BulkNeedsAuditLog) {
    this.#bulkSubscribers = this.#bulkSubscribers.filter(
      (sub) => sub !== subscriber,
    )
  }

  async singleNeedsAuditLog(
    message: Message | PartialMessage,
  ): Promise<boolean> {
    const results = await Promise.all(
      this.#singleSubscribers.map((sub) => sub(message)),
    )

    return results.some(Boolean)
  }

  async bulkNeedsAuditLog(
    messages: ReadonlyCollection<string, Message | PartialMessage>,
    channel: GuildTextBasedChannel,
  ): Promise<boolean> {
    const results = await Promise.all(
      this.#bulkSubscribers.map((sub) => sub(messages, channel)),
    )

    return results.some(Boolean)
  }
}

export const deleteEvents = new MessageDeleteWithAuditLog()
