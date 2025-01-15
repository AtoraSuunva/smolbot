import {
  type APIApplicationCommandOptionChoice,
  ApplicationCommandOptionType,
  TextInputStyle,
} from 'discord.js'
import {
  type AutocompleteHandler,
  type SleetSlashSubcommandBody,
  getGuild,
} from 'sleetcord'
import { prisma } from '../../../util/db.js'

export const TEXT_INPUT_STYLES: APIApplicationCommandOptionChoice<number>[] = [
  {
    name: 'Short (Single-line)',
    value: TextInputStyle.Short,
  },
  {
    name: 'Paragraph (Multi-line)',
    value: TextInputStyle.Paragraph,
  },
]

const MAX_MODMAIL_ID_LENGTH = 25

export const modmailIdAutocomplete: AutocompleteHandler<string> = async ({
  interaction,
  value,
}) => {
  if (!interaction.inGuild()) {
    return []
  }

  const guild = await getGuild(interaction, true)

  const results = await Promise.all([
    prisma.modMailTicket.findMany({
      distinct: ['modmailID'],
      select: {
        modmailID: true,
      },
      where: {
        guildID: guild.id,
        modmailID: {
          startsWith: value,
        },
      },
    }),
    prisma.modMailTicketModalField.findMany({
      distinct: ['modmailID'],
      select: {
        modmailID: true,
      },
      where: {
        guildID: guild.id,
        modmailID: {
          startsWith: value,
        },
      },
    }),
  ])

  const possibleMatches = Array.from(
    new Set(results.flat().map((m) => m.modmailID)),
  )

  if (possibleMatches.length === 0 && value.length === 0) {
    return []
  }

  const matches = possibleMatches.map((match) => ({
    name: match,
    value: match,
  }))

  if (value.length > 0 && !possibleMatches.includes(value)) {
    const cutValue = value.slice(0, MAX_MODMAIL_ID_LENGTH)
    matches.unshift({
      name: `${cutValue} (create new)`,
      value: cutValue,
    })
  }

  return matches.slice(0, 25)
}

type SleetCommandOption = NonNullable<SleetSlashSubcommandBody['options']>[0]

export const FIELD_MODMAIL_ID: SleetCommandOption = {
  name: 'modmail_id',
  description: 'The modmail ID of the field',
  type: ApplicationCommandOptionType.String,
  autocomplete: modmailIdAutocomplete,
  required: true,
  max_length: MAX_MODMAIL_ID_LENGTH,
}

export const customIdAutocomplete: AutocompleteHandler<string> = async ({
  interaction,
  value,
}) => {
  if (!interaction.inGuild()) {
    return []
  }

  const guild = await getGuild(interaction, true)
  const modmailID = interaction.options.getString('modmail_id')

  if (!modmailID) {
    return []
  }

  const results = await prisma.modMailTicketModalField.findMany({
    distinct: ['customID'],
    select: {
      customID: true,
    },
    where: {
      guildID: guild.id,
      modmailID,
      customID: {
        startsWith: value,
      },
    },
  })

  const possibleMatches = results.flat()

  if (possibleMatches.length === 0) {
    if (value.length === 0) {
      return []
    }

    return [
      {
        name: value,
        value,
      },
    ]
  }

  return possibleMatches.map((match) => ({
    name: match.customID,
    value: match.customID,
  }))
}

export const FIELD_CUSTOM_ID: SleetCommandOption = {
  name: 'custom_id',
  description: 'The custom ID of the field',
  type: ApplicationCommandOptionType.String,
  autocomplete: customIdAutocomplete,
  max_length: 100,
}

export const FIELD_OPTIONS: SleetCommandOption[] = [
  FIELD_MODMAIL_ID,
  FIELD_CUSTOM_ID,
  {
    name: 'label',
    description: 'The label of the field',
    type: ApplicationCommandOptionType.String,
    max_length: 45,
  },
  {
    name: 'style',
    description: 'The style of the field (default: Short)',
    type: ApplicationCommandOptionType.Integer,
    choices: TEXT_INPUT_STYLES,
  },
  {
    name: 'placeholder',
    description: 'The placeholder of the field (default: none)',
    type: ApplicationCommandOptionType.String,
    max_length: 100,
  },
  {
    name: 'required',
    description: 'If the field is required to be filled out (default: false)',
    type: ApplicationCommandOptionType.Boolean,
  },
  {
    name: 'min_length',
    description: 'The minimum length of the field (default: 0)',
    type: ApplicationCommandOptionType.Integer,
    min_value: 0,
    max_value: 4000,
  },
  {
    name: 'max_length',
    description: 'The maximum length of the field (default: 4000)',
    type: ApplicationCommandOptionType.Integer,
    min_value: 1,
    max_value: 4000,
  },
  {
    name: 'order',
    description: 'The order of the field (default: automatic)',
    type: ApplicationCommandOptionType.Integer,
    min_value: 0,
    max_value: 25,
  },
  {
    name: 'use_as_title',
    description:
      "Use the user's input for the post title (only 1 field per modmail ID)",
    type: ApplicationCommandOptionType.Boolean,
  },
]
