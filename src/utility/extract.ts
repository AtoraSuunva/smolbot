import {
  ApplicationCommandOptionType,
  ChatInputCommandInteraction,
  cleanCodeBlockContent,
  codeBlock,
  GuildMember,
  TextBasedChannel,
} from 'discord.js'
import { fetch } from 'undici'
import { SleetSlashCommand } from 'sleetcord'
import { setTimeout } from 'timers/promises'

export const extract = new SleetSlashCommand(
  {
    name: 'extract',
    description: 'Extracts all the text from a file/url and posts it in chat',
    options: [
      {
        name: 'url',
        description: 'The url to extract',
        type: ApplicationCommandOptionType.String,
      },
      {
        name: 'file',
        description: 'The file to extract',
        type: ApplicationCommandOptionType.Attachment,
      },
    ],
  },
  {
    run: runExtract,
  },
)

const limits = {
  '363821920854081539': 11000,
  '589650203498381314': 11000,
  '363821745590763520': 4000,
}

async function runExtract(interaction: ChatInputCommandInteraction) {
  const limit =
    interaction.member instanceof GuildMember
      ? getMemberLimit(interaction.member)
      : 2000

  let extractFrom: string | null = null
  const url = interaction.options.getString('url')
  const file = interaction.options.getAttachment('file')

  if (!interaction.channel) {
    return interaction.reply({
      ephemeral: true,
      content:
        "Failed to get the channel you're running this command in, try again later?\nIf this is a private thread, either give me `Manage Thread` permissions or `@`mention to add me to this thread.",
    })
  }

  if (url) {
    extractFrom = getRawUrl(url)
  }

  if (file) {
    extractFrom = file.url
  }

  if (!url && !file) {
    const latestFile = await getLatestFile(interaction.channel)
    if (latestFile) extractFrom = latestFile
  }

  if (!extractFrom) {
    return interaction.reply({
      ephemeral: true,
      content:
        'You did not provide a url, file, and I failed to find any file to extract',
    })
  }

  try {
    const text = (await fetch(extractFrom).then((r) => r.text())).trim()

    if (text.length === 0) {
      return interaction.reply({
        ephemeral: true,
        content: 'There was no text to extract',
      })
    }

    if (text.length > limit) {
      return interaction.reply({
        ephemeral: true,
        content: `The text is too long to extract (${text.length} characters of ${limit} max)`,
      })
    }

    await interaction.reply(
      `Extracting ${text.length} characters from <${extractFrom}>`,
    )
    await splitSend(interaction.channel, text, { code: true })
  } catch (e) {
    return interaction.reply({
      ephemeral: true,
      content: `Failed to extract text from the provided url.\n${
        e instanceof Error ? e.message : String(e)
      }`,
    })
  }

  return undefined
}

function getRawUrl(url: string): string {
  if (
    /https?:\/\/gist\.github\.com\/.+\/.+/.test(url) &&
    url
      .split('/')
      .filter((a) => !!a)
      .pop() !== 'raw'
  )
    return url.endsWith('/') ? `${url}raw` : `${url}/raw`

  if (/https?:\/\/pastebin.com\/(?!raw)/.test(url)) {
    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
    return `https://pastebin.com/raw/${url
      .split('/')
      .filter((a) => !!a)
      .pop()!}`
  }

  if (/https?:\/\/hastebin.com\/(?!raw)/.test(url)) {
    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
    return `https://hastebin.com/raw/${url
      .split('/')
      .filter((a) => !!a)
      .pop()!}`
  }

  return url
}

function getMemberLimit(member: GuildMember): number {
  return Object.entries(limits)
    .filter((v) => member.roles.cache.has(v[0]))
    .map((v) => v[1])
    .sort((a, b) => a - b)
    .reverse()[0]
}

async function getLatestFile(
  channel: TextBasedChannel,
): Promise<string | null> {
  const messages = await channel.messages.fetch({ limit: 100 })
  const sortedMessages = messages.sort(
    (a, b) => b.createdTimestamp - a.createdTimestamp,
  )

  for (const [, message] of sortedMessages) {
    const attachment = message.attachments.first()
    if (attachment) return attachment.url
  }

  return null
}

const whitespaceSplitRegex = /[\S\s]{1,1800}\S{0,50}/g

interface SplitSendOptions {
  code?: boolean
}

async function splitSend(
  channel: TextBasedChannel,
  content: string,
  { code = false }: SplitSendOptions = {},
) {
  const splits: string[] = []

  content.match(whitespaceSplitRegex)?.forEach((v) => splits.push(v))

  if (splits.length === 0) await channel.send('`[Empty Message]`')

  for (const split of splits) {
    const content = code ? codeBlock(cleanCodeBlockContent(split)) : split

    await channel.send({
      content,
      allowedMentions: { parse: [] },
    })
    await setTimeout(500)
  }
}
