import {
  ApplicationCommandOptionType,
  ApplicationIntegrationType,
  type ChatInputCommandInteraction,
  InteractionContextType,
  MessageFlags,
  SnowflakeUtil,
  time,
} from 'discord.js'
import { DateTime } from 'luxon'
import { SleetSlashCommand, SleetSlashSubcommand } from 'sleetcord'
import { SECOND } from 'sleetcord-common'
import { formatConfig } from '../util/format.js'
import { dateTimeFrom } from '../util/time.js'

const snowflakeParse = new SleetSlashSubcommand(
  {
    name: 'parse',
    description: 'Parse a Discord snowflake into its component parts',
    options: [
      {
        name: 'snowflake',
        description: 'A snowflake to parse into components',
        type: ApplicationCommandOptionType.String,
        required: true,
      },
      {
        name: 'ephemeral',
        description: 'Only show the result to you (default: False)',
        type: ApplicationCommandOptionType.Boolean,
      },
    ],
  },
  {
    run: runSnowflakeParse,
  },
)

const snowflakeGenerate = new SleetSlashSubcommand(
  {
    name: 'generate',
    description: 'Generate a Discord snowflake from component parts',
    options: [
      {
        name: 'increment',
        description: 'Increment for the snowflake (default: 0)',
        type: ApplicationCommandOptionType.Integer,
      },
      {
        name: 'process_id',
        description:
          'The process ID to use, will be truncated to 5 bits (0-31) (default: 1)',
        type: ApplicationCommandOptionType.Integer,
      },
      {
        name: 'timestamp',
        description:
          'The date & time to use as reference (ISO 8601 YYYY-MM-DDTHH:MM:SS or unix ms) (default: now)',
        type: ApplicationCommandOptionType.String,
      },
      {
        name: 'worker_id',
        description:
          'The worker ID to use, will be truncated to 5 bits (0-31) (default: 0)',
        type: ApplicationCommandOptionType.Integer,
      },
      {
        name: 'ephemeral',
        description: 'Only show the result to you (default: False)',
        type: ApplicationCommandOptionType.Boolean,
      },
    ],
  },
  {
    run: runSnowflakeGenerate,
  },
)

export const snowflake = new SleetSlashCommand({
  name: 'snowflake',
  description: 'Parse or generate snowflakes',
  contexts: [
    InteractionContextType.Guild,
    InteractionContextType.BotDM,
    InteractionContextType.PrivateChannel,
  ],
  integration_types: [
    ApplicationIntegrationType.GuildInstall,
    ApplicationIntegrationType.UserInstall,
  ],
  options: [snowflakeParse, snowflakeGenerate],
})

async function runSnowflakeParse(interaction: ChatInputCommandInteraction) {
  const snowflake = interaction.options.getString('snowflake', true)
  const ephemeral = interaction.options.getBoolean('ephemeral') ?? false

  const data = SnowflakeUtil.deconstruct(snowflake)
  const formatted = formatConfig({
    config: data as unknown as Record<string, string>,
    useDefaultFormatters: false,
  })

  await interaction.reply({
    content: `${time(Math.floor(SnowflakeUtil.timestampFrom(snowflake) / SECOND), 'F')}\n${formatted}`,
    flags: ephemeral ? MessageFlags.Ephemeral : '0',
  })
}

async function runSnowflakeGenerate(interaction: ChatInputCommandInteraction) {
  const increment = interaction.options.getInteger('increment') ?? 0
  const processId = interaction.options.getInteger('processId') ?? 1
  const timestamp = interaction.options.getString('timestamp')
  const workerId = interaction.options.getInteger('workerId') ?? 0
  const ephemeral = interaction.options.getBoolean('ephemeral') ?? false

  const parsedTimestamp = timestamp
    ? dateTimeFrom(timestamp)
    : DateTime.now().setZone('UTC')

  if (!parsedTimestamp.isValid) {
    await interaction.reply({
      content: `Invalid date time:\n> ${parsedTimestamp.invalidExplanation}`,
      flags: MessageFlags.Ephemeral,
      allowedMentions: { parse: [] },
    })
    return
  }

  const snowflake = SnowflakeUtil.generate({
    increment: BigInt(increment),
    processId: BigInt(processId),
    timestamp: parsedTimestamp.toJSDate(),
    workerId: BigInt(workerId),
  })

  await interaction.reply({
    content: snowflake.toString(),
    flags: ephemeral ? MessageFlags.Ephemeral : '0',
  })
}
