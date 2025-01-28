import {
  ApplicationCommandOptionType,
  ApplicationIntegrationType,
  type ChatInputCommandInteraction,
  InteractionContextType,
  MessageFlags,
  TimestampStyles,
  time,
} from 'discord.js'
import { DateTime } from 'luxon'
import createParse from 'parse-human-relative-time'
import { SleetSlashCommand } from 'sleetcord'
import { dateTimeFrom } from '../util/time.js'

const parseHumanRelativeTime = createParse(DateTime)
const timezones = Intl.supportedValuesOf('timeZone')

export const timestamp = new SleetSlashCommand(
  {
    name: 'timestamp',
    description: 'Generate <t:{timestamp}:{format}> timestamps',
    contexts: [
      InteractionContextType.Guild,
      InteractionContextType.BotDM,
      InteractionContextType.PrivateChannel,
    ],
    integration_types: [
      ApplicationIntegrationType.GuildInstall,
      ApplicationIntegrationType.UserInstall,
    ],
    options: [
      {
        name: 'date_time',
        description:
          'The date & time to use as reference (ISO 8601 YYYY-MM-DDTHH:MM:SS or unix ms) (default: now)',
        type: ApplicationCommandOptionType.String,
      },
      {
        name: 'relative',
        description:
          'An expression like "in 3 hours" or "next Thursday" to offset "date_time" by',
        type: ApplicationCommandOptionType.String,
      },
      {
        name: 'timezone',
        description: 'The timezone to use (default: UTC)',
        type: ApplicationCommandOptionType.String,
        autocomplete: ({ value }) =>
          timezones
            .filter((tz) => tz.toLowerCase().includes(value.toLowerCase()))
            .map((tz) => ({ name: tz, value: tz }))
            .slice(0, 25),
      },
      {
        name: 'ephemeral',
        description: 'Only show the result to you (default: False)',
        type: ApplicationCommandOptionType.Boolean,
      },
    ],
  },
  {
    run: runTimestamp,
  },
)

const timestampStyles = [
  TimestampStyles.ShortTime,
  TimestampStyles.LongTime,
  TimestampStyles.ShortDate,
  TimestampStyles.LongDate,
  TimestampStyles.ShortDateTime,
  TimestampStyles.LongDateTime,
  TimestampStyles.RelativeTime,
]

async function runTimestamp(interaction: ChatInputCommandInteraction) {
  const dateTime = interaction.options.getString('date_time')
  const relative = interaction.options.getString('relative')
  const timezone = interaction.options.getString('timezone') ?? 'UTC'
  const ephemeral = interaction.options.getBoolean('ephemeral') ?? false

  const anchor = dateTime
    ? dateTimeFrom(dateTime, timezone)
    : DateTime.now().setZone(timezone)

  if (!anchor.isValid) {
    await interaction.reply({
      content: `Invalid date time:\n> ${anchor.invalidExplanation}`,
      flags: MessageFlags.Ephemeral,
      allowedMentions: { parse: [] },
    })
    return
  }

  const result = relative ? parseHumanRelativeTime(relative, anchor) : anchor
  const unixInt = result.toUnixInteger()

  const header = `Timestamps for \`${result.toISO()}\` - \`${result.zoneName}\``

  const content = timestampStyles
    .map((style) => time(unixInt, style))
    .map((t) => `\`${t}\` • ${t}`)
    .join('\n')

  await interaction.reply({
    content: `${header}\n${content}\nUnix: \`${result.toMillis()}\``,
    flags: ephemeral ? MessageFlags.Ephemeral : '0',
  })
}
