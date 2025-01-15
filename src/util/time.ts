import { DateTime, type Zone } from 'luxon'

const unixMsRegex = /^\d+$/

/**
 *
 * @param input Input string as either unix milliseconds or ISO 8601 YYYY-MM-DDTHH:MM:SS
 * @param zone Timezone to interpret the input in if the input specifies none, defaults to UTC
 * @returns
 */
export function dateTimeFrom(
  input: string,
  zone: string | Zone = 'UTC',
): DateTime {
  return unixMsRegex.test(input)
    ? DateTime.fromMillis(Number.parseInt(input, 10), { zone })
    : DateTime.fromISO(input, { zone })
}
