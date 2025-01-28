import { stripVTControlCharacters } from 'node:util'
import {
  UnicodeCategory,
  uniGetBlock,
  uniGetCategories,
  uniGetScripts,
} from 'char-info'
import {
  ApplicationCommandOptionType,
  ApplicationIntegrationType,
  type ChatInputCommandInteraction,
  InteractionContextType,
  MessageFlags,
  codeBlock,
} from 'discord.js'
import { SleetSlashCommand } from 'sleetcord'
import { unicodeName } from 'unicode-name'
import { TextColor, ansiFormat } from '../util/ansiColors.js'

const DOTTED_CIRCLE = '◌'

export const char_info = new SleetSlashCommand(
  {
    name: 'char_info',
    description: 'Get information about a string of characters',
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
        name: 'string',
        type: ApplicationCommandOptionType.String,
        description: 'The string of characters to get information about',
        required: true,
      },
      {
        name: 'details',
        type: ApplicationCommandOptionType.Boolean,
        description:
          'Include block, script, and category info (default: False)',
      },
      {
        name: 'ephemeral',
        type: ApplicationCommandOptionType.Boolean,
        description: 'Only show the result to you (default: False)',
      },
    ],
  },
  {
    run: runCharInfo,
  },
)

async function runCharInfo(interaction: ChatInputCommandInteraction) {
  const string = interaction.options.getString('string', true)
  const details = interaction.options.getBoolean('details') ?? false
  const ephemeral = interaction.options.getBoolean('ephemeral') ?? false

  if (string.length === 0) {
    await interaction.reply({
      content: "You didn't give me any string to get information about!",
      flags: ephemeral ? MessageFlags.Ephemeral : '0',
    })
    return
  }

  const characters: string[] = []

  for (const char of string) {
    characters.push(...characterInfo(char, details))
  }

  const output = characters.join('\n')

  if (output.length > 1950) {
    await interaction.reply({
      files: [
        {
          name: 'char_info.txt',
          attachment: Buffer.from(stripVTControlCharacters(output), 'utf-8'),
        },
      ],
      flags: ephemeral ? MessageFlags.Ephemeral : '0',
    })
  } else {
    await interaction.reply({
      content: codeBlock('ansi', output),
      flags: ephemeral ? MessageFlags.Ephemeral : '0',
      allowedMentions: { parse: [] },
    })
  }
}

function characterInfo(char: string, details = false): string[] {
  let i = 0
  const info: string[] = []

  while (true) {
    const codePoint = char.codePointAt(i)
    const charCode = char.charCodeAt(i)

    if (codePoint === undefined || Number.isNaN(charCode)) {
      break
    }

    const unicodePoint = `U+${codePoint
      .toString(16)
      .toUpperCase()
      .padStart(4, '0')}`

    const name = unicodeName(codePoint)
    const categories = uniGetCategories.code(charCode)

    const isMark = categories.some((c) => c.name === UnicodeCategory.Mark)

    const basicInfo = `${ansiFormat(TextColor.Pink, unicodePoint)} ${ansiFormat(TextColor.Green, name)}`

    const prelude =
      i === 0 ? `│ ${isMark ? DOTTED_CIRCLE : ''}${char} │` : '│   ├─'

    let charDetails = ''

    if (details) {
      const block = uniGetBlock.code(charCode)
      const scripts = uniGetScripts.code(charCode)

      charDetails = ` (${renderGroup(
        block,
      )}; ${renderGroupArray(scripts)}; ${renderGroupArray(categories)})`
    }

    info.push(
      `${ansiFormat(TextColor.Blue, prelude)} ${basicInfo}${charDetails}`,
    )

    i++
  }

  return info
}

// unfortunately internal, but we can just pull it out like this
type UnicodeCharGroup = ReturnType<(typeof uniGetCategories)['code']>[0]

function renderGroupArray(group: UnicodeCharGroup[]): string {
  return group.map(renderGroup).join(', ')
}

function renderGroup(group: UnicodeCharGroup): string {
  if (group.displayName === group.name) {
    return group.displayName
  }

  return `${group.displayName} (${group.name})`
}
