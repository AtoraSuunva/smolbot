import type {
  Prisma,
  Warning,
  WarningConfig,
  WarningDirtyTracker,
} from '@prisma/client'
import { type APIEmbedField, time } from 'discord.js'
import { DAY, MINUTE } from 'sleetcord-common'
import { prisma } from '../../util/db.js'

export const MAX_PER_PAGE = 5

export interface WarningCount {
  total: number
  expired: number
  voided: number
}

/**
 * A limited (to `MAX_PER_PAGE`) array of warnings to display plus counts for total and expired warnings
 *
 * You will need to paginate in order to actually display or process all warnings, this is meant for pagination
 */
export interface PaginatedWarnings {
  warnings: Warning[]
  counts: WarningCount
}

export interface WarningFilters extends Prisma.WarningWhereInput {
  expired?: boolean
}

/**
 * Gets a (paginated) array of warnings that can be displayed without breaking embed limits, plus counts so you can still
 * tell how many warnings someone has (total and expired)
 * @param guildID The guild to search in
 * @param userID The user to search for
 * @param config The guild config to use
 * @param page The page to start at
 * @returns A (limited) set of warnings to display plus counts for total and expired warnings
 */
export async function fetchPaginatedWarnings(
  guildID: string,
  config: WarningConfig,
  page: number,
  filters: WarningFilters,
  reverse = false,
): Promise<PaginatedWarnings> {
  const expirationFilter = getExpirationWhereFilter(config.expiresAfter)

  const { expired: filterExpired, ...prismaFilters } = filters

  const whereExpired: Prisma.WarningWhereInput =
    filterExpired !== undefined
      ? filterExpired
        ? expirationFilter
        : { NOT: [expirationFilter] }
      : {}

  const counts = await fetchWarningCount(guildID, config.expiresAfter, {
    ...prismaFilters,
    ...whereExpired,
  })

  const warnings = await prisma.warning.findMany({
    where: {
      ...prismaFilters,
      ...whereExpired,
      guildID,
      validUntil: null,
    },
    orderBy: {
      createdAt: reverse ? 'asc' : 'desc',
    },
    skip: (page - 1) * MAX_PER_PAGE,
    take: MAX_PER_PAGE,
  })

  return {
    warnings,
    counts,
  }
}

async function fetchWarningCount(
  guildID: string,
  days: number,
  filters: Prisma.WarningWhereInput,
): Promise<WarningCount> {
  const total = await prisma.warning.count({
    where: {
      ...filters,
      guildID,
      validUntil: null,
    },
  })

  const expired =
    days === 0 || filters.void === true || filters.permanent === true
      ? 0
      : await prisma.warning.count({
          where: {
            ...getExpirationWhereFilter(days),
            ...filters,
            guildID,
            validUntil: null,
          },
        })

  const voided = await prisma.warning.count({
    where: {
      ...filters,
      guildID,
      validUntil: null,
      void: true,
    },
  })

  return {
    total,
    expired,
    voided,
  }
}

export async function fetchPaginatedWarningHistory(
  guildID: string,
  warningID: number,
  page: number,
): Promise<PaginatedWarnings> {
  const total = await fetchWarningHistoryCount(guildID, warningID)

  const warnings = await prisma.warning.findMany({
    where: {
      guildID,
      warningID,
    },
    orderBy: {
      version: 'desc',
    },
    skip: (page - 1) * MAX_PER_PAGE,
    take: MAX_PER_PAGE,
  })

  return {
    warnings,
    counts: {
      total,
      expired: 0,
      voided: 0,
    },
  }
}

export async function fetchWarningHistoryCount(
  guildID: string,
  warningID: number,
): Promise<number> {
  return await prisma.warning.count({
    where: {
      guildID,
      warningID,
    },
  })
}

export async function fetchWarningConfigFor(
  guildID: string,
  required: true,
): Promise<WarningConfig>
export async function fetchWarningConfigFor(
  guildID: string,
  required?: false,
): Promise<WarningConfig | null>
export async function fetchWarningConfigFor(
  guildID: string,
  required = false,
): Promise<WarningConfig | null> {
  const config = await prisma.warningConfig.findUnique({
    where: {
      guildID,
    },
  })

  if (!config && required) {
    const defaultConfig: Omit<WarningConfig, 'updatedAt'> = {
      guildID,
      expiresAfter: DEFAULT_WARNING_CONFIG.expiresAfter,
      archiveEnabled: DEFAULT_WARNING_CONFIG.archiveEnabled,
      archiveChannel: DEFAULT_WARNING_CONFIG.archiveChannel,
    }

    return await prisma.warningConfig.upsert({
      where: {
        guildID,
      },
      update: defaultConfig,
      create: defaultConfig,
    })
  }

  return config
}

export const DEFAULT_WARNING_CONFIG: Omit<
  WarningConfig,
  'guildID' | 'updatedAt'
> = {
  expiresAfter: 0,
  archiveEnabled: false,
  archiveChannel: null,
}

export interface WarningFieldFormatOptions {
  showModNote: boolean
  showUserOnWarning: boolean
  showVersion: boolean
  showResponsibleMod: boolean
}

export function formatWarningToField(
  warning: Warning,
  config: WarningConfig,
  options: Partial<WarningFieldFormatOptions> = {},
): APIEmbedField {
  const {
    showModNote = false,
    showUserOnWarning = false,
    showVersion = false,
    showResponsibleMod = false,
  } = options

  const expireDate = getExpirationDate(config.expiresAfter)

  const w = warning
  const version = showVersion && w.version > 1 ? ` (v${w.version})` : ''
  const permaText = w.permanent ? ' (Permanent)' : ''
  const warningUser = showUserOnWarning ? ` — ${w.user} (${w.userID})` : ''
  const timestamp = time(w.createdAt, 'R')
  const expiredText = warningIsExpired(w, config, expireDate)
    ? ' (Expired)'
    : ''
  const voidOrExpired = w.void ? ' (Void)' : expiredText
  const modNote = showModNote && w.modNote ? `\n**Note:** ${w.modNote}` : ''
  const responsibleMod =
    showResponsibleMod && w.moderatorID ? `\n**By:** <@${w.moderatorID}>` : ''

  return {
    name: `#${w.warningID}${version}${warningUser}${permaText}${voidOrExpired}`,
    value: `> ${w.reason} (${timestamp})${modNote}${responsibleMod}`,
  }
}

function warningIsExpired(
  warning: Warning,
  config: WarningConfig,
  expireDate: Date,
): boolean {
  return (
    config.expiresAfter > 0 &&
    !warning.permanent &&
    warning.createdAt <= expireDate
  )
}

export function getExpirationWhereFilter(
  days: number,
): Prisma.WarningWhereInput {
  return {
    void: false,
    permanent: false,
    createdAt: {
      lte: getExpirationDate(days),
    },
  }
}

function getExpirationDate(days: number): Date {
  return new Date(Date.now() - days * DAY)
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
export async function markWarningArchiveDirty(
  guildID: string,
  force = false,
  isDirty = true,
) {
  const newDirty: WarningDirtyTracker = {
    guildID,
    lastSetDirty: new Date(),
    isDirty,
  }

  const updateDirty = async () =>
    await prisma.warningDirtyTracker.upsert({
      where: {
        guildID,
      },
      create: newDirty,
      update: newDirty,
    })

  if (force) {
    return updateDirty()
  }

  const lastDirty = await prisma.warningDirtyTracker.findUnique({
    where: {
      guildID,
    },
  })

  if (!lastDirty?.isDirty) {
    return updateDirty()
  }

  return null
}

export async function fetchGuildsPendingArchive() {
  const dirty = await prisma.warningDirtyTracker.findMany({
    where: {
      isDirty: true,
      lastSetDirty: {
        lte: new Date(Date.now() - DIRTY_WAIT_FOR),
      },
    },
  })

  return dirty.map((d) => d.guildID)
}
