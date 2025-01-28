import {
  ApplicationCommandOptionType,
  ApplicationIntegrationType,
  type AttachmentPayload,
  type ChatInputCommandInteraction,
  type CommandInteraction,
  InteractionContextType,
  type Message,
  type MessageContextMenuCommandInteraction,
  MessageFlags,
  cleanCodeBlockContent,
  codeBlock,
  inlineCode,
} from 'discord.js'
import { languages, translate } from 'google-translate-api-x'
import {
  type AutocompleteHandler,
  SleetMessageCommand,
  SleetSlashCommand,
  escapeAllMarkdown,
} from 'sleetcord'
import { notNullish } from 'sleetcord-common'

type Language = typeof languages
type LanguageKey = keyof Language

const languageEntries = Object.entries(languages).map(([iso, name]) => ({
  original: {
    iso,
    name,
  },
  lowerCase: {
    iso: iso.toLowerCase(),
    name: name.toLowerCase(),
  },
}))

const autocompleteLanguage: AutocompleteHandler<string> = ({ value }) => {
  const lowerValue = value.toLowerCase()

  return (
    languageEntries
      .filter(
        ({ lowerCase }) =>
          lowerCase.iso.includes(lowerValue) ||
          lowerCase.name.includes(lowerValue),
      )
      .map(({ original }) => ({
        name: `${original.name} (${original.iso})`,
        value: original.iso,
      }))
      // Prioritize exact ISO matches, i.e. show "French (fr)" as the first result for "fr"
      .sort((a, b) => {
        if (a.value === value) {
          return -1
        }

        if (b.value === value) {
          return 1
        }

        return a.name.localeCompare(b.name)
      })
      .slice(0, 25)
  )
}

export const translateSlash = new SleetSlashCommand(
  {
    name: 'translate',
    description:
      'Translate text into your Discord language or into a language of your choice',
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
        name: 'text',
        description: 'Text to translate',
        type: ApplicationCommandOptionType.String,
        required: true,
        min_length: 1,
        max_length: 5000,
      },
      {
        name: 'from',
        description: 'Language to translate from (default: auto)',
        type: ApplicationCommandOptionType.String,
        autocomplete: autocompleteLanguage,
      },
      {
        name: 'to',
        description:
          'Language to translate to (default: your locale, or English)',
        type: ApplicationCommandOptionType.String,
        autocomplete: autocompleteLanguage,
      },
      {
        name: 'autocorrect',
        description: 'Apply autocorrect to the provided text (default: False)',
        type: ApplicationCommandOptionType.Boolean,
      },
      {
        name: 'ephemeral',
        description:
          'Send the translation result as an ephemeral message (default: False)',
        type: ApplicationCommandOptionType.Boolean,
      },
    ],
  },
  {
    run: runTranslateSlash,
  },
)

export const translateMessage = new SleetMessageCommand(
  {
    name: 'Translate',
    contexts: [
      InteractionContextType.Guild,
      InteractionContextType.BotDM,
      InteractionContextType.PrivateChannel,
    ],
    integration_types: [
      ApplicationIntegrationType.GuildInstall,
      ApplicationIntegrationType.UserInstall,
    ],
  },
  {
    run: runTranslateMessage,
  },
)

const intlList = new Intl.ListFormat('en', {
  style: 'long',
  type: 'conjunction',
})

async function runTranslateSlash(interaction: ChatInputCommandInteraction) {
  const text = interaction.options.getString('text', true)
  const fromInput = interaction.options.getString('from') ?? 'auto'
  const toInput = interaction.options.getString('to') ?? interaction.locale
  const autoCorrect = interaction.options.getBoolean('autocorrect') ?? false
  const ephemeral = interaction.options.getBoolean('ephemeral') ?? false

  await runTranslate(interaction, {
    text,
    fromInput,
    toInput,
    autoCorrect,
    ephemeral,
  })
}

async function runTranslateMessage(
  interaction: MessageContextMenuCommandInteraction,
) {
  const text = getTranslateText(interaction.targetMessage)

  if (!text) {
    await interaction.reply({
      content:
        "The message you're trying to translate doesn't have any text content to translate.",
      flags: MessageFlags.Ephemeral,
    })

    return
  }

  await runTranslate(interaction, {
    text,
    fromInput: 'auto',
    toInput: interaction.locale,
    autoCorrect: false,
    // Ephemeral responses if the bot is being called via a user-installed app context
    // i.e. you add the bot to your account and then translate a message on a random server
    ephemeral: !(
      ApplicationIntegrationType.GuildInstall in
      interaction.authorizingIntegrationOwners
    ),
  })
}

interface TranslateOptions {
  text: string
  fromInput: string
  toInput: string
  autoCorrect: boolean
  ephemeral: boolean
}

async function runTranslate(
  interaction: CommandInteraction,
  { text, fromInput, toInput, autoCorrect, ephemeral }: TranslateOptions,
) {
  const from = validateLanguage(fromInput)

  if (!from) {
    interaction.reply({
      content: `${inlineCode(escapeAllMarkdown(fromInput))} is not a valid language to translate from.`,
      flags: MessageFlags.Ephemeral,
    })
    return
  }

  const to = validateLanguage(toInput)

  if (!to) {
    interaction.reply({
      content: `${inlineCode(escapeAllMarkdown(toInput))} is not a valid language to translate to.`,
      flags: MessageFlags.Ephemeral,
    })
    return
  }

  await interaction.deferReply({
    flags: ephemeral ? MessageFlags.Ephemeral : '0',
  })

  let res: Awaited<ReturnType<typeof translate<string>>>

  try {
    res = await translate(text, { from, to, autoCorrect })
  } catch (e) {
    await interaction.editReply({
      content: `Failed to translate, try again later. Received an error:\n${codeBlock(cleanCodeBlockContent(String(e)))}`,
      allowedMentions: { parse: [] },
    })

    return
  }

  const lines = []

  if (res.from.text.didYouMean || res.from.text.autoCorrected) {
    const added = [
      res.from.text.didYouMean ? 'Did you mean?' : null,
      res.from.text.autoCorrected ? 'an autocorrection' : null,
    ].filter(notNullish)

    lines.push(
      `-# Google added ${intlList.format(added)} to your query:`,
      `> -# ${res.from.text.value}`,
      '',
    )
  }

  lines.push(
    // Google Translate replaces `\n` with `\n ` in the final translation for some reason, adding in extra whitespace
    // The replacer function makes sure there's at least 1 whitespace
    `> ${escapeAllMarkdown(res.text).replaceAll(/\n(\s*)/g, (_, p1) => `\n>${p1 || ' '}`)}`,
  )

  if (res.pronunciation) {
    lines.push(`> -# ${res.pronunciation}`)
  }

  lines.push(
    `> -# ${languages[res.from.language.iso as LanguageKey] ?? res.from.language.iso ?? '<unknown language>'} → ${languages[to]}`,
  )

  const formatted = lines.join('\n')

  let content: string
  let files: AttachmentPayload[] = []

  if (formatted.length <= 2000) {
    content = formatted
  } else {
    content = `The output was too long for a message, see the attachment for the result:\n${lines.pop()}`
    files = [
      {
        name: 'translation.txt',
        attachment: Buffer.from(res.text, 'utf-8'),
      },
    ]
  }

  await interaction.editReply({
    content,
    files,
    allowedMentions: { parse: [] },
  })
}

function getTranslateText(message: Message): string | null {
  if (message.content) return message.content

  const possibleEmbed = message.embeds.find((e) => e.description)
  if (possibleEmbed) return possibleEmbed.description

  return null
}

const formattedLanguage = /.*\((\w{2,4}(?:-\w{2,4})?)\)/

function validateLanguage(lang: string): LanguageKey | null {
  const isoLang = lang.match(formattedLanguage)?.[1] ?? lang

  if (isoLang in languages) {
    return isoLang as LanguageKey
  }

  // We might be using the user's Discord locale (since it's default), and it might be something like en-US or en-CA
  // Which aren't *officially* supported, but `en` alone is
  const split = isoLang.split('-')[0]

  if (split in languages) {
    return split as LanguageKey
  }

  return null
}
