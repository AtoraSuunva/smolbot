declare module 'parse-human-relative-time' {
  import type { DateTime } from 'luxon'

  function createParse(
    createDateTime: typeof DateTime,
  ): typeof parseHumanRelativeTime
  function parseHumanRelativeTime(str: string, now: DateTime): DateTime

  export = createParse
}
