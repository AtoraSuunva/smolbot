import { default as converter } from 'convert-units'
import {
  ApplicationCommandOptionType,
  ApplicationIntegrationType,
  type ChatInputCommandInteraction,
  InteractionContextType,
  MessageFlags,
} from 'discord.js'
import { type AutocompleteHandler, SleetSlashCommand } from 'sleetcord'

const units = converter().list()

type Unit = ReturnType<converter.Convert['list']>[number]

function autocompleteForUnits(
  value: string,
  validUnits: Unit[],
): ReturnType<AutocompleteHandler<string>> {
  const lVal = value.toLowerCase()

  return validUnits
    .filter(
      (unit) =>
        unit.abbr.toLowerCase().includes(lVal) ||
        unit.singular.toLowerCase().includes(lVal) ||
        unit.plural.toLowerCase().includes(lVal),
    )
    .map((unit) => ({
      name: `${unit.singular} (${unit.abbr})`,
      value: unit.abbr,
    }))
    .sort((a, b) => a.name.localeCompare(b.name))
    .slice(0, 25)
}

const autocompleteFrom: AutocompleteHandler<string> = ({ value }) => {
  return autocompleteForUnits(value, units)
}

const autocompleteTo: AutocompleteHandler<string> = ({
  interaction,
  value,
}) => {
  const from = interaction.options.getString('from', true)
  const fromUnit = units.find((unit) => unit.abbr === from)

  if (!fromUnit) {
    return []
  }

  const possibilities = converter()
    .from(fromUnit.abbr)
    .possibilities()
    .filter((unit) => unit !== fromUnit.abbr)

  return autocompleteForUnits(
    value,
    units.filter((unit) => possibilities.includes(unit.abbr)),
  )
}

export const convert = new SleetSlashCommand(
  {
    name: 'convert',
    description: 'Converts a value from one unit to another',
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
        name: 'value',
        type: ApplicationCommandOptionType.Number,
        description: 'The value to convert',
        required: true,
      },
      {
        name: 'from',
        type: ApplicationCommandOptionType.String,
        description: 'The unit to convert from',
        required: true,
        autocomplete: autocompleteFrom,
      },
      {
        name: 'to',
        type: ApplicationCommandOptionType.String,
        description: 'The unit to convert to (default: Best guess)',
        autocomplete: autocompleteTo,
      },
      {
        name: 'ephemeral',
        type: ApplicationCommandOptionType.Boolean,
        description: 'Only show the result to you (default: True)',
      },
    ],
  },
  {
    run: runConvert,
  },
)

async function runConvert(interaction: ChatInputCommandInteraction) {
  const value = interaction.options.getNumber('value', true)
  const from = interaction.options.getString('from', true)
  const to = interaction.options.getString('to')
  const ephemeral = interaction.options.getBoolean('ephemeral') ?? true

  const fromUnit = units.find((unit) => unit.abbr === from)?.abbr

  if (!fromUnit) {
    await interaction.reply({
      content: `Invalid \`from\` unit "${from}"`,
      allowedMentions: { parse: [] },
    })
    return
  }

  const possibleUnits = converter().from(fromUnit).possibilities()
  const toUnit = possibleUnits.find((unit) => unit === to)

  if (to && !toUnit) {
    await interaction.reply({
      content: `Invalid \`to\` unit "${to}"\nPossible units: ${possibleUnits.join(
        ', ',
      )}`,
      allowedMentions: { parse: [] },
    })
    return
  }

  const { val, unit } =
    to && toUnit
      ? { val: converter(value).from(fromUnit).to(toUnit), unit: toUnit }
      : converter(value).from(fromUnit).toBest()

  await interaction.reply({
    content: `${value.toLocaleString()}${fromUnit} = ${val.toLocaleString()}${unit}`,
    flags: ephemeral ? MessageFlags.Ephemeral : '0',
    allowedMentions: { parse: [] },
  })
}
