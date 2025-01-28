import {
  ApplicationCommandOptionType,
  ApplicationIntegrationType,
  type ChatInputCommandInteraction,
  InteractionContextType,
  MessageFlags,
  time,
} from 'discord.js'
import prettyMilliseconds from 'pretty-ms'
import { SleetSlashCommand } from 'sleetcord'

export const time_since = new SleetSlashCommand(
  {
    name: 'time_since',
    description: 'Get the time since a given date',
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
        name: 'date',
        type: ApplicationCommandOptionType.String,
        description: 'The date to get the time since',
        required: true,
      },
      {
        name: 'ephemeral',
        type: ApplicationCommandOptionType.Boolean,
        description: 'Only show the result to you (default: True)',
      },
    ],
  },
  {
    run: runTimeSince,
  },
)

function runTimeSince(interaction: ChatInputCommandInteraction) {
  const date = interaction.options.getString('date', true)
  const ephemeral = interaction.options.getBoolean('ephemeral') ?? true

  const parsedDate = Date.parse(date)

  if (Number.isNaN(parsedDate)) {
    return interaction.reply({
      content: 'Could not parse date, try `yyyy-mm-dd`.',
      flags: MessageFlags.Ephemeral,
    })
  }

  const dateSeconds = parsedDate / 1_000
  const durationMs = Date.now() - parsedDate
  const duration = prettyMilliseconds(durationMs, { verbose: true })

  return interaction.reply({
    content: `The time since ${time(dateSeconds, 'F')} (${time(
      dateSeconds,
      'R',
    )}) is ${duration}`,
    flags: ephemeral ? MessageFlags.Ephemeral : '0',
  })
}
