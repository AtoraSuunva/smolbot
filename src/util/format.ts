import {
  type BaseInteraction,
  type ForumChannel,
  type Guild,
  type InteractionCallbackResponse,
  type Snowflake,
  cleanCodeBlockContent,
  codeBlock,
  messageLink,
} from 'discord.js'
import pluralize from 'pluralize'
import { notNullish } from 'sleetcord-common'
import stringWidth from 'string-width'

type Value = string | number | boolean | Date | null | undefined
type Formatter = (value: Value, guild?: Guild) => string

interface FormatConfigOptions<Config extends Record<string, Value>> {
  /** The configuration to format into text */
  config: Config
  /** Formatters for keys */
  formatters?: Partial<Record<keyof Config, Formatter>>
  /** Whether to use the default formatters, for `*<guild|channel|role>_id` keys */
  useDefaultFormatters?: boolean
  /** The guild to use for formatting guild, channel, and role IDs */
  guild?: Guild
  /** Map keys to something else, usually `internalName` => `Display Name` */
  mapKeys?: Partial<Record<keyof Config, string>>
  /** The old configuration to compare to, to show what has changed */
  oldConfig?: Config | null
  /** Keys to omit from the formatted config */
  omit?: (keyof Config)[]
  /** Whether to snake_case the keys */
  snakeCase?: boolean
}

export const guildFormatter: Formatter = (value: Value, guild?: Guild) =>
  `${guild && value === guild.id ? guild.name : 'unknown-guild'} (${String(
    value,
  )})`

export const channelFormatter: Formatter = (value: Value, guild?: Guild) =>
  `#${
    guild?.channels.cache.get(value as string)?.name ?? 'unknown-channel'
  } (${String(value)})`

export const roleFormatter: Formatter = (value: Value, guild?: Guild) =>
  `@${
    guild?.roles.cache.get(value as string)?.name ?? 'unknown-role'
  } (${String(value)})`

export const makeForumTagFormatter: (forum: ForumChannel) => Formatter =
  (forum: ForumChannel) => (value: Value) => {
    const tag = forum.availableTags.find((t) => t.id === value)

    if (!tag) {
      return `unknown-tag (${String(value)})`
    }

    return `${tag.emoji?.name ? `${tag.emoji.name} ` : ''}${tag.name} (${String(value)})`
  }

const defaultFormatters: Record<string, Formatter> = {
  guild_id: guildFormatter,
  channel_id: channelFormatter,
  role_id: roleFormatter,
}

/**
 * Format a configuration object into a string, with appropriate formatting
 * @param options The options for formatting the config
 * @returns The formatted config, as a string
 */
export function formatConfig<Config extends Record<string, Value>>(
  options: FormatConfigOptions<Config>,
): string {
  const {
    config,
    formatters = {} as NonNullable<FormatConfigOptions<Config>['formatters']>,
    useDefaultFormatters = true,
    guild,
    mapKeys = {} as NonNullable<FormatConfigOptions<Config>['mapKeys']>,
    oldConfig,
    omit = ['guildid', 'updatedat', 'createdat'],
    snakeCase = true,
  } = options

  let longest = 0

  const formatterEntries = Object.entries(defaultFormatters)

  const formatted = Object.entries(config)
    .sort(([key1], [key2]) => key1.localeCompare(key2))
    .filter(([key]) => !omit.includes(key.toLowerCase()))
    .map(([key, value]): [string, Value] => {
      const isNew = oldConfig && oldConfig[key] !== value
      let displayKey = mapKeys[key as keyof Config] ?? key
      displayKey = snakeCase ? toSnakeCase(displayKey) : displayKey
      displayKey = isNew ? `*${displayKey}` : displayKey

      if (displayKey.length > longest) longest = displayKey.length

      value = formatters[key as keyof Config]?.(value, guild) ?? value

      if (useDefaultFormatters && notNullish(value)) {
        for (const [key, formatter] of formatterEntries) {
          if (displayKey.toLowerCase().endsWith(key)) {
            value = formatter(value, guild)
            break
          }
        }
      }

      return [displayKey, value]
    })
    .map(([key, value]) => {
      return `${key.padEnd(longest, ' ')} = ${String(value)}`
    })
    .join('\n')

  return codeBlock('ini', cleanCodeBlockContent(formatted))
}

/**
 * Converts a string from camelCase to snake_case
 * @param str The string to make snake case
 * @returns The snake cased string
 */
export function toSnakeCase(str: string): string {
  return str
    .replace(/([a-z])([A-Z])/g, '$1_$2')
    .replace(/\s+/g, '_')
    .toLowerCase()
    .trim()
}

interface PluralOptions {
  includeCount?: boolean
  boldNumber?: boolean
}

/**
 * A simple wrapper around the npm pluralize package, to include the count by default and to use `toLocaleString` for the count
 * @param str The string to pluralize
 * @param count The count of the string there is
 * @param includeCount Whether to include the count in the string as `<count> string`
 * @returns A pluralized string, depending on the count
 */
export function plural(
  str: string,
  count: number,
  { includeCount = true, boldNumber = true }: PluralOptions = {},
): string {
  let numberFormat = (n: number) => n.toLocaleString()

  if (boldNumber) {
    numberFormat = (num) => `**${num.toLocaleString()}**`
  }

  return `${includeCount ? `${numberFormat(count)} ` : ''}${pluralize(
    str,
    count,
  )}`
}

/**
 * Capitalizes a string from "this" => "This" or "hello world" => "Hello World"
 * @param str The string to capitalize
 * @returns The string, capitalized
 */
export function capitalize(str: string): string {
  return str
    .split(' ')
    .map((s) => s[0].toLocaleUpperCase() + s.slice(1))
    .join(' ')
}

export interface TableFormatOptions<T> {
  /** The keys to show, by default all keys of the first object */
  keys?: (keyof T)[]
  /** Map column names (taken from keys) to something else, usually `keyName` => `Key Name` */
  columnsNames?: Partial<Record<keyof T, string>>
  /** Whether to show "nullish" (null | undefined) values as-is or as empty cells, default true (show as-is) */
  showNullish?: boolean
  /** Truncate the table if it would go over this amount of characters (extra rows are dropped) */
  characterLimit?: number
}

/**
 * Format an array of objects as a markdown table, with the keys (configurable) as the columns
 * and with appropriate padding
 * @param data The data to format
 * @param options Options for formatting
 * @returns A formatted table, as a string
 */
export function tableFormat<T extends object>(
  data: T[],
  options?: TableFormatOptions<T>,
): string {
  const keys = options?.keys ?? (Object.keys(data[0]) as (keyof T)[])
  const columnNames =
    options?.columnsNames ?? ({} as Record<keyof T, string | undefined>)
  const showNullish = options?.showNullish ?? true
  const characterLimit = options?.characterLimit ?? Number.POSITIVE_INFINITY

  const header: string[] = []
  const separator: string[] = []
  const rows: string[] = []

  for (const key of keys) {
    const name: string = columnNames[key] ?? String(key)
    // TODO: truncated rows still count towards longest, is there an easy way to solve that?
    const longest = Math.max(
      stringWidth(name),
      ...data.map((d) => stringWidth(String(d[key]))),
    )
    header.push(name.padEnd(longest, ' '))
    separator.push('─'.repeat(longest))
  }

  const joinedHeader = header.join(' │ ')
  const joinedSeparator = separator.join('─┼─')

  const head = `${joinedHeader}\n${joinedSeparator}\n`
  // +20 for headroom for "Truncated ..." in case that needs to be added
  let currentLength = head.length + 20

  for (const row of data) {
    const newRow = keys
      .map((k) => {
        let value: unknown = row[k]

        if (!showNullish && (value === null || value === undefined)) {
          value = ''
        }

        return padEndTo(String(value), stringWidth(header[keys.indexOf(k)]))
      })
      .join(' │ ')

    currentLength += newRow.length + 1 // +1 for the newline
    if (currentLength > characterLimit) break

    rows.push(newRow)
  }

  const removed =
    rows.length < data.length
      ? `\nTruncated ${plural('row', data.length - rows.length)}.`
      : ''

  return `${head}${rows.join('\n')}${removed}`.substring(0, characterLimit)
}

function padEndTo(str: string, length: number, character = ' '): string {
  const offset = str.length - stringWidth(str)

  return str.padEnd(length + offset, character)
}

export function responseMessageLink(
  interaction: BaseInteraction & { channelId: Snowflake },
  response: InteractionCallbackResponse,
) {
  if (!response.interaction.responseMessageId) {
    return '<missing response message id>'
  }

  return interaction.inGuild()
    ? messageLink(
        interaction.channelId,
        response.interaction.responseMessageId,
        interaction.guildId,
      )
    : messageLink(interaction.channelId, response.interaction.responseMessageId)
}
