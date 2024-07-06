import { ActionLogConfig, ActionLogDirtyTracker } from '@prisma/client'
import { Guild, GuildMember, User, time } from 'discord.js'
import { PreRunError, formatUser } from 'sleetcord'
import { MINUTE } from 'sleetcord-common'
import { prisma } from '../../util/db.js'
import { capitalize } from '../../util/format.js'

export interface ActionLogEntry {
  id: number
  version?: number
  action: 'ban' | 'unban' | 'kick' | 'timeout' | 'timeout removed'
  user: User | GuildMember | null
  redactUser: boolean
  reason: string | null
  reasonBy?: User | GuildMember | null
  responsibleModerator: User | GuildMember | null
  createdAt: Date
}

const userLog = async (user: User | GuildMember): Promise<string> =>
  // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
  formatUser(user.partial ? await user.fetch() : user, {
    mention: true,
  })

export interface LogFormatOptions {
  headerLine?: boolean
  user?: boolean
  reason?: boolean
  reasonBy?: boolean
  responsibleModerator?: boolean
}

export async function formatToLog(
  entry: ActionLogEntry,
  options: LogFormatOptions = {
    headerLine: true,
    user: true,
    reason: true,
    reasonBy: true,
    responsibleModerator: true,
  },
): Promise<string> {
  const log: string[] = []

  if (options.headerLine) {
    log.push(
      `**${capitalize(entry.action)}** | Case ${entry.id} | ${time(entry.createdAt, 'f')}`,
    )
  }

  if (options.user) {
    if (entry.redactUser) {
      log.push(
        `**User:** \`[Username Redacted by Moderators]\` (${entry.user?.id ?? 'unknown user'})`,
      )
    } else {
      log.push(
        `**User:** ${entry.user ? await userLog(entry.user) : 'unknown user'}`,
      )
    }
  }

  if (options.reason) {
    log.push(`**Reason:** ${entry.reason ?? '*No reason provided.*'}`)
  }

  if (
    options.reasonBy &&
    entry.reasonBy &&
    entry.reasonBy.id !== entry.responsibleModerator?.id
  ) {
    log.push(`**Reason by:** ${await userLog(entry.reasonBy)}`)
  }

  if (options.responsibleModerator) {
    log.push(
      `**Responsible Moderator**: ${
        entry.responsibleModerator
          ? await userLog(entry.responsibleModerator)
          : '*Unknown moderator*'
      }`,
    )
  }

  return log.join('\n')
}

export async function fetchActionLogConfigFor(
  guildID: string,
  required: true,
): Promise<ActionLogConfig>
export async function fetchActionLogConfigFor(
  guildID: string,
  required?: false,
): Promise<ActionLogConfig | null>
export async function fetchActionLogConfigFor(
  guildID: string,
  required = false,
): Promise<ActionLogConfig | null> {
  const config = await prisma.actionLogConfig.findUnique({
    where: {
      guildID,
    },
  })

  if (!config && required) {
    throw new PreRunError(
      `No actionlog config found for this guild. Please run \`/actionlog manage\` to set one up.`,
    )
  }

  return config
}

const DIRTY_WAIT_FOR = 10 * MINUTE

/**
 * Sets a flag indicating that the warning archive is dirty for a guild if the guild is not already marked dirty
 *
 * Also updates the last-set-dirty flag
 * @param guildID The guild to update for
 * @param force Forcefully set a new dirty date
 * @param isDirty Whether the guild is dirty or not (default: false)
 * @returns The new dirty date if updated, null if not
 */
export async function markActionlogArchiveDirty(
  guildID: string,
  force = false,
  isDirty = true,
) {
  const newDirty: ActionLogDirtyTracker = {
    guildID,
    lastSetDirty: new Date(),
    isDirty,
  }

  const updateDirty = async () =>
    await prisma.actionLogDirtyTracker.upsert({
      where: {
        guildID,
      },
      create: newDirty,
      update: newDirty,
    })

  if (force) {
    return updateDirty()
  }

  const lastDirty = await prisma.actionLogDirtyTracker.findUnique({
    where: {
      guildID,
    },
  })

  if (!lastDirty?.isDirty) {
    return updateDirty()
  }

  return null
}

export async function fetchActionlogPendingArchive() {
  const dirty = await prisma.actionLogDirtyTracker.findMany({
    where: {
      isDirty: true,
      lastSetDirty: {
        lte: new Date(Date.now() - DIRTY_WAIT_FOR),
      },
    },
  })

  return dirty.map((d) => d.guildID)
}

/**
 * Returns an array of integers from start to end, inclusive
 * @param start The start of the range
 * @param end The end of the range
 * @param maxSize The maximum size of the range, defaults to Infinity. Ranges are cut off at this size
 * @returns An array of integers from start to end, inclusive
 */
export function range(
  start: number,
  end: number,
  maxSize = Infinity,
): number[] {
  if (start > end) {
    return range(end, start, maxSize)
  }

  let size = end - start + 1

  if (size > maxSize) {
    size = maxSize
  }

  return [...Array(size).keys()].map((i) => i + start)
}

/**
 * Resolve a string to an array of IDs
 *
 * Supports:
 * - A single "ID resolvable", denoted `N` and `M`:
 *   - A literal number
 *   - `l` or `latest` to get the latest action
 * - A range:
 *   - `N..M` to get all cases between N and M, inclusive
 * - An offset:
 *   - `N~X` where X is a literal number, for N with a negative offset (`l~1` is the second latest case, ie. "go back one")
 * @param guildOrLatestActionId The guild to resolve IDs for, required for latest/l, or the latest action ID itself
 * @param idResolvable A string containing a format that can be resolved to an ID or an array of IDs
 * @param maxIDs The maximum number of IDs to resolve, defaults to 50
 * @returns The resolved IDs (already deduped), or an empty array if none were found
 */
export async function resolveIDs(
  guildOrLatestActionId: Guild | number,
  idResolvable: string,
  maxIDs = 50,
): Promise<number[]> {
  if (idResolvable === '') {
    return []
  }

  idResolvable = idResolvable.trim().toLowerCase()

  const autocompleteResult = idResolvable.match(/^#(\d+) \[\w+\] —.*$/)

  if (autocompleteResult) {
    return [parseInt(autocompleteResult[1], 10)]
  }

  if (idResolvable.match(/^\d+$/)) {
    const number = parseInt(idResolvable, 10)

    if (!isNaN(number)) {
      return [number]
    }
  }

  if (
    (idResolvable.includes('l') || idResolvable.includes('latest')) &&
    guildOrLatestActionId instanceof Guild
  ) {
    const latest = await prisma.actionLog.findFirst({
      where: {
        guildID: guildOrLatestActionId.id,
        validUntil: null,
      },
      orderBy: {
        actionID: 'desc',
      },
    })

    if (!latest) {
      throw new Error('Cannot find the latest action')
    }

    guildOrLatestActionId = latest.actionID
  }

  if (idResolvable.includes(',')) {
    return await Promise.all(
      idResolvable
        .split(',')
        .slice(0, maxIDs)
        .map((id) => resolveIDs(guildOrLatestActionId, id.trim())),
    ).then((ids) => [...new Set(ids.flat())])
  }

  idResolvable = idResolvable.toLowerCase()

  if (idResolvable.includes('..')) {
    const [startResolvable, endResolvable] = idResolvable.split('..')

    if (startResolvable.includes('..') || endResolvable.includes('..')) {
      throw new Error('Invalid range, you cannot chain ranges')
    }

    const [start, end] = await Promise.all([
      resolveIDs(guildOrLatestActionId, startResolvable),
      resolveIDs(guildOrLatestActionId, endResolvable),
    ])

    if (start.length !== 1 || end.length !== 1) {
      throw new Error('Invalid range, did you forget to specify the range?')
    }

    return range(start[0], end[0], maxIDs)
  }

  if (idResolvable.includes('~')) {
    const [startResolvable, endResolvable] = idResolvable.split('~')

    const end = parseInt(endResolvable, 10)

    if (isNaN(end)) {
      throw new Error('Invalid offset, you need a number ie. l~1')
    }

    const start = await resolveIDs(guildOrLatestActionId, startResolvable)

    if (start.length !== 1) {
      throw new Error('Invalid offset, is the initial id not a number?')
    }

    return [Math.max(start[0] - end, 1)]
  }

  if (
    ['l', 'latest'].includes(idResolvable) &&
    typeof guildOrLatestActionId === 'number'
  ) {
    return [guildOrLatestActionId]
  }

  throw new Error(
    'Failed to resolve an ID, use a number or try `l` or `latest`',
  )
}

/**
 * Collapses a sequence of numbers into a string. This method dedupes and sorts the provided numbers
 *
 * @example
 * collapseSequence([1, 2, 3, 4]) // '1-4'
 * collapseSequence([1, 2, 3, 5, 6, 7, 8, 9, 10]) // 1-3, 5-10
 * @param numbers The numbers to collapse
 */
export function collapseSequence(numbers: number[]): string {
  if (numbers.length === 0) {
    return ''
  } else if (numbers.length === 1) {
    return `${numbers[0]}`
  }

  const deduped = [...new Set(numbers)].sort((a, b) => a - b)
  const ranges = []

  let start = deduped[0]
  let end = deduped[0]

  for (const number of deduped) {
    if (number === end || number === end + 1) {
      end = number
    } else {
      ranges.push([start, end])
      start = number
      end = number
    }
  }

  ranges.push([start, end])

  return ranges
    .map(([start, end]) => (start === end ? `${start}` : `${start}..${end}`))
    .join(', ')
}
