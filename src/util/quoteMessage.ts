import {
  type Attachment,
  EmbedBuilder,
  InteractionType,
  Message,
  MessageReferenceType,
  type MessageSnapshot,
  MessageType,
  escapeInlineCode,
  hyperlink,
  inlineCode,
  time,
} from 'discord.js'
import { escapeAllMarkdown, formatUser } from 'sleetcord'
import { plural } from './format.js'

/** Number of lines before quote content becomes cut */
const MAX_QUOTE_LINES = 10
/** Number of characters before replied message content becomes cut */
const MAX_REPLY_LENGTH = 100

interface QuoteOptions {
  includeAuthor?: boolean
  includeChannel?: boolean
  includeTimestamp?: boolean
  includeAttachments?: boolean
  includeStickers?: boolean
  includeEmbeds?: boolean
  isSnapshot?: boolean
}

export async function quoteMessage(
  message: Message<true> | MessageSnapshot,
  {
    includeAuthor = true,
    includeChannel = true,
    includeTimestamp = true,
    includeAttachments = true,
    includeStickers = true,
    includeEmbeds = true,
    isSnapshot = false,
  }: QuoteOptions = {},
): Promise<EmbedBuilder[]> {
  const embeds: EmbedBuilder[] = []

  const quoteContent = formatQuoteContent(message.content)

  const authorLine =
    includeAuthor && message.author
      ? formatUser(message.author, {
          markdown: false,
          id: false,
          escapeMarkdown: false,
        })
      : ''

  const channelLine =
    includeChannel && message.channel && 'name' in message.channel
      ? `#${message.channel.name}`
      : ''

  const embed = new EmbedBuilder()
    .setURL(message.url)
    .setDescription(quoteContent)

  embeds.push(embed)

  if (!isSnapshot && (includeAuthor || includeChannel)) {
    const url = message.url ?? message.channel?.url ?? ''

    if (includeAuthor && message.author) {
      embed.setAuthor({
        name: [authorLine, channelLine].join(' ∙ '),
        iconURL: message.author.displayAvatarURL(),
        url,
      })
    } else if (channelLine) {
      embed.setAuthor({
        name: channelLine,
        url,
      })
    }
  }

  if (includeTimestamp) {
    embed.setTimestamp(message.createdTimestamp)
  }

  if (message.interaction) {
    const { interaction } = message

    const commandName =
      (interaction.type === InteractionType.ApplicationCommand ? '/' : '') +
      interaction.commandName

    embed.setTitle(
      `${formatUser(interaction.user, {
        markdown: false,
        id: false,
        escapeMarkdown: false,
      })} used ${commandName}`,
    )
  }

  if (message.member) {
    embed.setColor(message.member.displayColor)
  }

  if (
    message.reference?.type === MessageReferenceType.Forward &&
    message.messageSnapshots
  ) {
    const snapshot = message.messageSnapshots.first()
    if (snapshot) {
      embeds.push(...(await quoteMessage(snapshot, { isSnapshot: true })))
    }
  }

  // There's some interesting properties based on the message type
  // We can show better detail than just copy-pasting the message by actually parsing it
  // https://discord.com/developers/docs/resources/channel#message-object-message-types
  if (!isSnapshot && message instanceof Message) {
    // Snapshots don't currently support any of the interesting message types
    // so it's not worth the effort of adding support
    await addToEmbed(message, embed)
  } else {
    embed.setTitle('╭→ Forwarded')
  }

  // Can't have more than 4 images tiled together in a single embed, so any more than that we just add into a field
  let attachedImagesCount = 0

  if (includeAttachments) {
    const listedAttachments: Attachment[] = []

    for (const [, attachment] of message.attachments) {
      if (attachedImagesCount < 4 && isImageAttachment(attachment)) {
        attachedImagesCount++
        // You can embed multiple (up to 4) images in a single embed by sending multiple embeds with the same URL
        if (!embed.data.image) {
          embed.setImage(attachment.url)
        } else {
          embeds.push(
            new EmbedBuilder().setURL(message.url).setImage(attachment.url),
          )
        }
      } else {
        // For non-image attachments (or additional images after 4), we can just add them as fields
        listedAttachments.push(attachment)
      }
    }

    if (listedAttachments.length > 0) {
      embed.addFields([
        {
          name: `+${plural('Attachment', listedAttachments.length)}`,
          value: listedAttachments
            .map((a) =>
              hyperlink(inlineCode(escapeInlineCode(a.name)), a.proxyURL),
            )
            .join(', '),
        },
      ])
    }
  }

  if (includeStickers) {
    for (const [, sticker] of message.stickers) {
      if (attachedImagesCount < 4) {
        attachedImagesCount++
        if (!embed.data.image) {
          embed.setImage(sticker.url)
        } else {
          embeds.push(
            new EmbedBuilder().setURL(message.url).setImage(sticker.url),
          )
        }
      }
    }

    if (message.stickers.size > 0) {
      embed.addFields([
        {
          name: 'Stickers:',
          value: message.stickers
            .map((s) => hyperlink(inlineCode(escapeInlineCode(s.name)), s.url))
            .join(', '),
        },
      ])
    }
  }

  if (includeEmbeds) {
    embeds.push(...message.embeds.map((e) => EmbedBuilder.from(e)))
  }

  // Discord caps embeds to 10
  return embeds.slice(0, 10)
}

export async function addToEmbed(message: Message, embed: EmbedBuilder) {
  switch (message.type) {
    // Crosspost flag...
    case MessageType.ChannelPinnedMessage:
      quoteChannelPinnedMessage(message, embed)
      break
    case MessageType.UserJoin:
      quoteUserJoin(message, embed)
      break
    case MessageType.GuildBoost:
      quoteGuildBoost(message, embed)
      break
    case MessageType.GuildBoostTier1:
      quoteGuildBoostTier(message, embed, 1)
      break
    case MessageType.GuildBoostTier2:
      quoteGuildBoostTier(message, embed, 2)
      break
    case MessageType.GuildBoostTier3:
      quoteGuildBoostTier(message, embed, 3)
      break
    case MessageType.ChannelFollowAdd:
      quoteChannelFollowAdd(message, embed)
      break
    case MessageType.GuildDiscoveryDisqualified:
      quoteGuildDiscoveryDisqualified(message, embed)
      break
    case MessageType.GuildDiscoveryRequalified:
      quoteGuildDiscoveryRequalified(message, embed)
      break
    case MessageType.GuildDiscoveryGracePeriodInitialWarning:
      quoteGuildDiscoveryGracePeriodInitialWarning(message, embed)
      break
    case MessageType.GuildDiscoveryGracePeriodFinalWarning:
      quoteGuildDiscoveryGracePeriodFinalWarning(message, embed)
      break
    case MessageType.Reply:
      await quoteReply(message, embed)
      break
    case MessageType.ThreadCreated:
    case MessageType.ThreadStarterMessage:
      quoteThreadCreateMessage(message, embed)
      break
    case MessageType.AutoModerationAction:
      quoteAutoModerationAction(message, embed)
      break
  }

  if (message.poll != null) {
    quotePoll(message, embed)
  }
}

function isImageAttachment(attachment: Attachment): boolean {
  return attachment.contentType?.startsWith('image/') ?? false
}

type PathPart<T extends string | undefined> = T extends string ? `/${T}` : ''

function optionalPathPart<T extends string | undefined>(
  pathPart: T,
): PathPart<T> {
  return (typeof pathPart === 'string' ? `/${pathPart}` : '') as PathPart<T>
}

function quoteChannelPinnedMessage(message: Message, embed: EmbedBuilder) {
  let messageLink = 'a message'

  if (message.reference) {
    const { guildId, channelId, messageId } = message.reference
    messageLink = hyperlink(
      'a message',
      `https://discordapp.com/channels${optionalPathPart(
        guildId,
      )}/${channelId}${optionalPathPart(messageId)}`,
    )
  }

  embed.setDescription(
    `${message.author} pinned ${messageLink} to this channel.`,
  )
}

function quoteUserJoin(message: Message, embed: EmbedBuilder) {
  embed.setDescription(`${message.author} has joined the server.`)
}

function quoteGuildBoost(message: Message, embed: EmbedBuilder) {
  embed.setDescription(`${message.author} just boosted the server!`)
}

function quoteGuildBoostTier(
  message: Message,
  embed: EmbedBuilder,
  tier: number,
) {
  embed.setDescription(
    `${message.author} just boosted the server! ${escapeAllMarkdown(
      message.guild?.name ?? '<Unknown Server>',
    )} has achieved **tier ${tier}**!`,
  )
}

function quoteChannelFollowAdd(message: Message, embed: EmbedBuilder) {
  let followLink = message.content

  if (message.reference) {
    const { guildId, channelId } = message.reference
    followLink = hyperlink(
      message.content,
      `https://discordapp.com/channels${optionalPathPart(
        guildId,
      )}/${channelId}`,
    )
  }

  embed.setDescription(
    `${message.author} has added ${followLink} to this channel. Its most important updates will show up here.`,
  )
}

function quoteGuildDiscoveryDisqualified(
  _message: Message,
  embed: EmbedBuilder,
) {
  embed.setDescription(
    'This server has been removed from Server Discovery because it no longer passes all the requirements. Check Server Settings on desktop for more details.',
  )
}

function quoteGuildDiscoveryRequalified(
  _message: Message,
  embed: EmbedBuilder,
) {
  embed.setDescription(
    'This server is eligible for Server Discovery again and has been automatically relisted!',
  )
}

function quoteGuildDiscoveryGracePeriodInitialWarning(
  _message: Message,
  embed: EmbedBuilder,
) {
  embed.setDescription(
    'This server has failed Discovery activity requirements for 1 week. If this server fails for 4 weeks in a row, it will be automatically removed from Discovery.',
  )
}

function quoteGuildDiscoveryGracePeriodFinalWarning(
  _message: Message,
  embed: EmbedBuilder,
) {
  embed.setDescription(
    'This server has failed Discovery activity requirements for 3 weeks in a row. If this server fails for 1 more week, it will be removed from Discovery.',
  )
}

async function quoteReply(message: Message, embed: EmbedBuilder) {
  if (!message.reference) {
    embed.addFields([
      {
        name: 'Reply to',
        value: 'Original message was deleted.',
      },
    ])
    return
  }

  let reference: Message

  try {
    reference = await message.fetchReference()
  } catch (e) {
    embed.addFields([
      {
        name: 'Reply to',
        value: 'Message could not be loaded.',
      },
    ])
    return
  }

  const content = reference.content.split('\n').join(' ')

  const shortContent =
    content.length > MAX_REPLY_LENGTH
      ? `${content.substring(0, MAX_REPLY_LENGTH)}...`
      : content

  embed.addFields([
    {
      name: `Reply to ${formatUser(reference.author, {
        markdown: false,
        id: false,
        escapeMarkdown: false,
      })}`,
      value: `${reference.url}\n${shortContent}`,
    },
  ])
}

function quoteThreadCreateMessage(message: Message, embed: EmbedBuilder) {
  let threadLink = message.content

  if (message.reference) {
    const { guildId, channelId } = message.reference
    threadLink = hyperlink(
      threadLink,
      `https://discordapp.com/channels${optionalPathPart(
        guildId,
      )}/${channelId}`,
    )
  }

  embed.setDescription(`${message.author} started a thread: ${threadLink}`)
}

function quoteAutoModerationAction(message: Message, embed: EmbedBuilder) {
  embed.setDescription(
    `${message.author} triggered AutoMod. Details follow below:`,
  )
}

function quotePoll(message: Message, embed: EmbedBuilder) {
  if (!message.poll) return

  const { poll } = message
  const totalVotes = poll.answers.reduce((acc, v) => acc + v.voteCount, 0)

  embed
    .setTitle(`${escapeAllMarkdown(poll.question.text).substring(0, 256)}`)
    .addFields(
      poll.answers.map((v) => ({
        name: `${v.emoji ? `${v.emoji} ` : ''}${v.text}`,
        value: plural('vote', v.voteCount),
      })),
    )
    .addFields({
      name: '\u200b',
      value: `${plural('Vote', totalVotes)} ∙ Ends ${time(poll.expiresAt, 'R')}`,
    })
}

function formatQuoteContent(content: string): string | null {
  if (content.trim() === '') return null

  const lines = content.split('\n')

  if (lines.length > MAX_QUOTE_LINES) {
    return `${lines.slice(0, MAX_QUOTE_LINES).join('\n')}...`
  }

  return lines.join('\n')
}
