import type { Prisma } from '@prisma/client'
import {
  type APIEmbed,
  type AttachmentPayload,
  type ForumChannel,
  type JSONEncodable,
  LimitedCollection,
  type MediaChannel,
  type Message,
  type NewsChannel,
  type PartialMessage,
  type TextChannel,
  type User,
  type Webhook,
  type WebhookMessageCreateOptions,
  type WebhookMessageEditOptions,
  type WebhookType,
} from 'discord.js'
import { SleetModule, formatUser } from 'sleetcord'
import { prisma } from '../../util/db.js'
import { quoteMessage } from '../../util/quoteMessage.js'

export const handle_ticket_message = new SleetModule(
  {
    name: 'handle_ticket_message',
  },
  {
    messageCreate: handleMessageCreate,
    messageUpdate: handleMessageUpdate,
  },
)

async function handleMessageUpdate(
  _oldMessage: Message | PartialMessage,
  newMessage: Message,
) {
  await syncMessage(newMessage, true)
}

async function handleMessageCreate(message: Message) {
  await syncMessage(message)
}

async function syncMessage(message: Message, isEdit = false) {
  if (
    !message.inGuild() ||
    (message.webhookId !== null && message.interaction === null) ||
    !message.channel.isThread()
  ) {
    // It's a webhook (probably us forwarding) or can't possibly be a modmail ticket, so just skip
    return
  }

  const ticket = await prisma.modMailTicket.findFirst({
    where: {
      OR: [
        {
          userThreadID: message.channel.id,
        },
        {
          modThreadID: message.channel.id,
        },
      ],
    },
  })

  if (!ticket || ticket.linkDeleted) {
    // Not a modmail ticket or a channel/thread was deleted
    return
  }

  const config = await prisma.modMailConfig.upsert({
    where: {
      guildID: message.guildId,
    },
    create: {
      guildID: message.guildId,
    },
    update: {},
  })

  const { client } = message
  const isUserMessage = ticket.userThreadID === message.channel.id
  const forwardChannelID = isUserMessage
    ? ticket.modChannelID
    : ticket.userChannelID

  const replyType = isUserMessage
    ? ReplyType.User
    : getReplyType(message, config)

  if (replyType === ReplyType.None) {
    return
  }

  const existingWebhookMessage = !isEdit
    ? null
    : await prisma.modMailTicketMessage.findFirst({
        select: {
          webhookMessageID: true,
        },
        where: {
          userMessageID: message.id,
        },
      })

  const forwardChannel = await client.channels
    .fetch(forwardChannelID)
    .catch(() => null)

  if (!forwardChannel || !('threads' in forwardChannel)) {
    // Channel was deleted, so we can't forward the message
    await message.channel
      .send(
        `The ${isUserMessage ? 'mod' : 'user'} channel was deleted, so I can't forward this message.`,
      )
      .catch(() => {
        /* ignore */
      })

    await prisma.modMailTicket.update({
      where: {
        ticketID: ticket.ticketID,
      },
      data: {
        linkDeleted: true,
      },
    })

    return
  }

  const forwardThreadID = isUserMessage
    ? ticket.modThreadID
    : ticket.userThreadID
  const forwardThread = await forwardChannel.threads
    .fetch(forwardThreadID)
    .catch(() => null)

  if (!forwardThread) {
    // Thread was deleted, so we can't forward the message

    if (message.author.id !== client.user.id) {
      await message.channel
        .send(
          `The ${isUserMessage ? 'mod' : 'user'} thread was deleted, so I can't forward this message.`,
        )
        .catch(() => {
          /* ignore */
        })
    }

    await prisma.modMailTicket.update({
      where: {
        ticketID: ticket.ticketID,
      },
      data: {
        linkDeleted: true,
      },
    })

    return
  }

  let webhook: Webhook<WebhookType.Incoming>

  try {
    webhook = await getWebhookFor(forwardChannel)
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)

    await message.channel
      .send(
        `Failed to get webhook for the ${
          isUserMessage ? 'mod' : 'user'
        } thread.\nError: ${msg}`,
      )
      .catch(() => {
        /* ignore */
      })
    return
  }

  let content = getMessageContent(message, config, replyType)
  const files: (AttachmentPayload | string)[] = message.attachments.map(
    (attachment) => attachment.url,
  )
  const embeds: (JSONEncodable<APIEmbed> | APIEmbed)[] = message.embeds.slice()

  if (content.length > 2000) {
    files.unshift({
      name: 'message.txt',
      attachment: Buffer.from(content, 'utf-8'),
    })
    content = ''
  }

  const quote = await quoteMessage(message, {
    includeAttachments: false,
    includeAuthor: false,
    includeChannel: false,
    includeEmbeds: false,
    includeTimestamp: false,
  })

  if (
    quote[0].data.fields?.length ||
    quote[0].data.image ||
    quote[0].data.title
  ) {
    quote[0].setDescription(null)
    embeds.unshift(quote[0])
  }

  const mainOptions = {
    threadId: forwardThread.id,
    allowedMentions: { parse: isUserMessage ? [] : ['users'] },
    content,
    files,
    embeds,
  } satisfies WebhookMessageCreateOptions | WebhookMessageEditOptions

  try {
    if (isEdit) {
      if (!existingWebhookMessage?.webhookMessageID) {
        return
      }

      const webhookMessage = await webhook.fetchMessage(
        existingWebhookMessage?.webhookMessageID,
        { threadId: forwardThread.id },
      )

      await webhook.editMessage(webhookMessage, mainOptions)
    } else {
      const options: WebhookMessageCreateOptions = mainOptions

      if (replyType === ReplyType.Anonymous) {
        options.username = config.modTeamName

        if (message.guild.icon) {
          // biome-ignore lint/style/noNonNullAssertion: we just tested for an icon url
          options.avatarURL = message.guild.iconURL()!
        }
      } else {
        options.username = formatWebhookUser(message.author)
        options.avatarURL = message.author.displayAvatarURL()
      }

      const webhookMessage = await webhook.send(options)

      await prisma.modMailTicketMessage.create({
        data: {
          userMessageID: message.id,
          webhookMessageID: webhookMessage.id,
        },
      })
    }
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)

    await message.channel
      .send(
        `I couldn't forward the message to the ${
          isUserMessage ? 'mod' : 'user'
        } thread.\nError: ${msg}`,
      )
      .catch(() => {
        /* ignore */
      })
    return
  }

  if (!isEdit) {
    await message.react('📨').catch(() => {
      /* ignore */
    })
  }
}

const formatWebhookUser = (user: User): string => {
  const formatted = formatUser(user, {
    escapeMarkdown: false,
    markdown: false,
    id: false,
  })

  return formatted.length > 32 ? user.tag : formatted
}

const webhookCache = new LimitedCollection<
  string,
  Webhook<WebhookType.Incoming>
>({
  maxSize: 50,
})

export async function getWebhookFor(
  channel: NewsChannel | TextChannel | ForumChannel | MediaChannel,
): Promise<Webhook<WebhookType.Incoming>> {
  const cached = webhookCache.get(channel.id)
  if (cached) {
    return cached
  }

  const webhooks = await channel.fetchWebhooks()
  const webhook = webhooks.find<Webhook<WebhookType.Incoming>>(
    (wh): wh is Webhook<WebhookType.Incoming> =>
      wh.isIncoming() && wh.owner?.id === channel.client.user.id,
  )

  if (webhook) {
    webhookCache.set(channel.id, webhook)
    return webhook
  }

  // Need to create a new webhook
  const newWebhook = await channel.createWebhook({
    name: 'ModMail',
    reason: 'Needed to forward messages',
  })

  webhookCache.set(channel.id, newWebhook)
  return newWebhook
}

enum ReplyType {
  /** Don't forward the message */
  None = 0,
  /** Forward the message for a user */
  User = 1,
  /** Forward the message for a mod (with their name) */
  Mod = 2,
  /** Forward the message anonymously */
  Anonymous = 3,
}

function getReplyType(
  message: Message,
  config: Prisma.ModMailConfigGetPayload<true>,
): ReplyType {
  const { modReplyPrefix, modAnonReplyPrefix } = config

  let replyType = ReplyType.None

  if (message.content.startsWith(modReplyPrefix)) {
    replyType = ReplyType.Mod
  }

  if (message.content.startsWith(modAnonReplyPrefix)) {
    // Longer prefix wins
    if (
      replyType === ReplyType.None ||
      modAnonReplyPrefix.length > modReplyPrefix.length
    ) {
      replyType = ReplyType.Anonymous
    }
  }

  return replyType
}

function getMessageContent(
  message: Message,
  config: Prisma.ModMailConfigGetPayload<true>,
  replyType: ReplyType,
): string {
  const { modReplyPrefix, modAnonReplyPrefix } = config

  switch (replyType) {
    case ReplyType.Mod:
      return message.content.slice(modReplyPrefix.length).trim()
    case ReplyType.Anonymous:
      return message.content.slice(modAnonReplyPrefix.length).trim()
    default:
      return message.content
  }
}
