import {
  ApplicationCommandOptionType,
  ApplicationIntegrationType,
  type ChatInputCommandInteraction,
  type Client,
  type EmbedBuilder,
  InteractionContextType,
  type Message,
  MessageFlags,
  type User,
} from 'discord.js'
import { SleetSlashCommand, formatUser } from 'sleetcord'
import { baseLogger } from 'sleetcord-common'
import { prisma } from '../../util/db.js'
import { quoteMessage } from '../../util/quoteMessage.js'

const quoteLogger = baseLogger.child({ module: 'quote' })

export const quote = new SleetSlashCommand(
  {
    name: 'quote',
    description: 'Quotes a message',
    contexts: [InteractionContextType.Guild],
    integration_types: [ApplicationIntegrationType.GuildInstall],
    options: [
      {
        name: 'message_link',
        type: ApplicationCommandOptionType.String,
        description: 'A message link to the message to quote',
        required: true,
      },
    ],
  },
  {
    messageCreate: handleMessageCreate,
    run: runQuote,
  },
)

async function handleMessageCreate(message: Message) {
  if (
    message.author.bot ||
    !message.inGuild() ||
    !message.guild.members.me ||
    !message.channel
      .permissionsFor(message.guild.members.me)
      .has(['SendMessages', 'EmbedLinks'])
  ) {
    return
  }

  const { enabled } = (await prisma.quoteConfig.findUnique({
    where: {
      guildID: message.guildId,
    },
    select: {
      enabled: true,
    },
  })) ?? { enabled: true }

  if (!enabled) {
    return
  }

  const quotedMessage = await getMessageFromLink(
    message.client,
    message.content,
    true, // ignore <bracketed links>
    message.guildId,
  ).catch(() => null)

  if (
    !quotedMessage ||
    !quotedMessage.channel
      .permissionsFor(message.author)
      ?.has(['ViewChannel', 'ReadMessageHistory'])
  ) {
    return
  }

  const embeds = await makeQuoteFrom(quotedMessage, message.author)

  message
    .reply({
      embeds,
      allowedMentions: { parse: [], repliedUser: false },
    })
    .catch((e) => {
      quoteLogger.warn(e, 'Failed to generate quote for %s', message.content)
    })
}

async function runQuote(interaction: ChatInputCommandInteraction) {
  const messageLink = interaction.options.getString('message_link', true)

  try {
    const message = await getMessageFromLink(
      interaction.client,
      messageLink,
      false,
      interaction.guildId,
    )
    const embeds = await makeQuoteFrom(message, interaction.user)
    return interaction.reply({ embeds })
  } catch (e) {
    return interaction.reply({
      content: e instanceof Error ? e.message : String(e),
      flags: MessageFlags.Ephemeral,
    })
  }
}

const messageLinkRegex =
  /(?<lBracket><)?https?:\/\/(?:ptb\.|canary\.)?discord(?:app)?\.com\/channels\/(?<guildId>\d+)\/(?<channelId>\d+)\/(?<messageId>\d+)(?<rBracket>>)?/i

interface MessageLinkMatches {
  guildId: string
  channelId: string
  messageId: string
  lBracket?: string
  rBracket?: string
}

function getMessageLinkIds(str: string): MessageLinkMatches | null {
  const matches = str.match(messageLinkRegex)

  if (matches?.groups === undefined) {
    return null
  }

  return {
    guildId: matches.groups.guildId,
    channelId: matches.groups.channelId,
    messageId: matches.groups.messageId,
    lBracket: matches.groups.lBracket,
    rBracket: matches.groups.rBracket,
  }
}

async function getMessageFromLink(
  client: Client,
  content: string,
  ignoreBracketedLinks = false,
  contextGuildId: string | null = null,
) {
  const matches = getMessageLinkIds(content)

  if (!matches) {
    throw new Error("Couldn't parse a message link")
  }

  if (ignoreBracketedLinks && matches.lBracket && matches.rBracket) {
    throw new Error('Link was surrounded by <brackets> and ignored')
  }

  const { guildId, channelId, messageId } = matches

  if (contextGuildId && contextGuildId !== guildId) {
    throw new Error('Tried to quote message from another guild')
  }

  const guild = await client.guilds.fetch(guildId).catch(() => null)

  if (!guild) {
    throw new Error('Guild not found')
  }

  const channel = await client.channels.fetch(channelId).catch(() => null)

  if (!channel) {
    throw new Error('Channel not found')
  }

  if (!channel.isTextBased()) {
    throw new Error('Channel is not a text channel')
  }

  const message = await channel.messages
    .fetch({
      message: messageId,
      force: true,
    })
    .catch(() => null)

  if (!message) {
    throw new Error('Message not found')
  }

  if (!message.inGuild()) {
    throw new Error('Message is not in a guild')
  }

  return message
}

async function makeQuoteFrom(
  message: Message<true>,
  quotedBy: User,
): Promise<EmbedBuilder[]> {
  const [quote, ...extraEmbeds] = await quoteMessage(message)

  quote.setFooter({
    text: `Quoted by ${formatUser(quotedBy, {
      markdown: false,
      id: false,
      escapeMarkdown: false,
    })}`,
  })

  return [quote, ...extraEmbeds]
}
