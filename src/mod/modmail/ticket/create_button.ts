import type { Prisma } from '@prisma/client'
import {
  ActionRowBuilder,
  ApplicationCommandOptionType,
  type AttachmentPayload,
  ButtonBuilder,
  type ButtonInteraction,
  ButtonStyle,
  ChannelType,
  type ChatInputCommandInteraction,
  EmbedBuilder,
  type Interaction,
  MessageFlags,
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle,
  ThreadAutoArchiveDuration,
  type ThreadChannel,
  escapeInlineCode,
  time,
} from 'discord.js'
import {
  type AutocompleteHandler,
  SleetSlashSubcommand,
  formatUser,
  getGuild,
  inGuildGuard,
} from 'sleetcord'
import { MINUTE, SECOND, notNullish } from 'sleetcord-common'
import { prisma } from '../../../util/db.js'
import { modmailIdAutocomplete } from './../fields/utils.js'

type AutocompleteCreator = (
  channelOption: string,
) => AutocompleteHandler<string>

export const createTagAutocomplete: AutocompleteCreator =
  (channelOption: string) =>
  async ({ interaction, value }) => {
    if (!interaction.inGuild()) {
      return []
    }

    const forumChannel = interaction.options.get(channelOption)

    if (!forumChannel || !(typeof forumChannel.value === 'string')) {
      return [
        {
          name: 'No forum channel selected, unable to suggest tags',
          value: '',
        },
      ]
    }

    const guild = await getGuild(interaction, true)
    const channel = await guild.channels.fetch(forumChannel.value)

    if (!channel?.isThreadOnly()) {
      return [
        {
          name: 'Invalid forum channel selected, unable to suggest tags',
          value: '',
        },
      ]
    }

    if (channel.availableTags.length === 0) {
      return [
        {
          name: 'No tags available in the forum channel',
          value: '',
        },
      ]
    }

    const lowerValue = value.toLowerCase()

    return channel.availableTags
      .filter((tag) => tag.name.toLowerCase().includes(lowerValue))
      .map((tag) => ({
        name: `${tag.emoji?.name ? `${tag.emoji.name} ` : ''}${tag.name}`,
        value: tag.id,
      }))
  }

export const modmail_ticket_create_button = new SleetSlashSubcommand(
  {
    name: 'create_button',
    description: 'Create a button users can use to open a modmail ticket',
    options: [
      {
        name: 'modmail_id',
        description:
          'Id used to identify this button for configuration (ex: "appeal")',
        type: ApplicationCommandOptionType.String,
        autocomplete: modmailIdAutocomplete,
        required: true,
        max_length: 25,
      },
      {
        name: 'message',
        description: 'The message to send with the button',
        type: ApplicationCommandOptionType.String,
        required: true,
        max_length: 2000,
      },
      {
        name: 'button_label',
        description: 'The label for the button',
        type: ApplicationCommandOptionType.String,
        required: true,
        max_length: 80,
      },
      {
        name: 'modmail_forum',
        description: 'The forum channel to send new modmail tickets to',
        type: ApplicationCommandOptionType.Channel,
        channel_types: [ChannelType.GuildForum],
        required: true,
      },
      {
        name: 'button_emoji',
        description: 'The emoji for the button (default: no emoji)',
        type: ApplicationCommandOptionType.String,
      },
      {
        name: 'button_style',
        description: 'The style for the button (default: Primary/Blurple)',
        type: ApplicationCommandOptionType.Integer,
        choices: [
          { name: 'Primary (Blurple)', value: ButtonStyle.Primary },
          { name: 'Secondary (Grey)', value: ButtonStyle.Secondary },
          { name: 'Success (Green)', value: ButtonStyle.Success },
          { name: 'Danger (Red)', value: ButtonStyle.Danger },
        ],
      },
      {
        name: 'forum_tag',
        description:
          'The tag to apply to the forum post on creation (default: none)',
        type: ApplicationCommandOptionType.String,
        autocomplete: createTagAutocomplete('modmail_forum'),
        max_length: 20,
      },
    ],
  },
  {
    run: runCreateModMailButton,
    interactionCreate: handleModMailButtonInteraction,
  },
)

const THREADABLE_CHANNEL_TYPES = [
  ChannelType.GuildText,
  ChannelType.GuildAnnouncement,
  ChannelType.GuildForum,
  ChannelType.GuildMedia,
]
const MODMAIL = 'modmail'
const CREATE_TICKET = 'create_ticket'
const TICKET_MODAL = 'ticket_modal'

async function runCreateModMailButton(
  interaction: ChatInputCommandInteraction,
) {
  inGuildGuard(interaction)

  const channel = await interaction.client.channels
    .fetch(interaction.channelId)
    .catch(() => null)

  if (!channel || !THREADABLE_CHANNEL_TYPES.includes(channel.type)) {
    interaction.reply({
      content:
        'You cannot create threads in this channel type. Try a text channel, announcement channel, or forum channel.',
      flags: MessageFlags.Ephemeral,
    })
    return
  }

  const message = interaction.options.getString('message', true)

  const buttonLabel = interaction.options.getString('button_label', true)
  const buttonEmoji = interaction.options.getString('button_emoji')
  const buttonStyle =
    interaction.options.getInteger('button_style') ?? ButtonStyle.Primary

  const modmailForum = interaction.options.getChannel('modmail_forum', true)
  const modmailId = interaction.options.getString('modmail_id', true)

  const forumTag = interaction.options.getString('forum_tag') ?? ''

  await interaction.deferReply({ flags: MessageFlags.Ephemeral })

  // Create the button
  const button = new ButtonBuilder()
    .setLabel(buttonLabel)
    .setStyle(buttonStyle)
    .setCustomId(
      `${MODMAIL}:${CREATE_TICKET}:${modmailId}:${modmailForum.id}:${forumTag}`,
    )

  if (buttonEmoji) {
    button.setEmoji(buttonEmoji)
  }

  const row = new ActionRowBuilder<ButtonBuilder>().addComponents(button)

  // Send the message with the button
  try {
    const channel =
      interaction.channel ??
      (await interaction.guild?.channels.fetch(interaction.channelId))

    if (!channel) {
      throw new Error('Failed to find channel to send button to')
    }

    if (!channel.isTextBased()) {
      throw new Error('Cannot send buttons to non-text channels')
    }

    await channel.send({
      content: message,
      components: [row],
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    await interaction.editReply({
      content: `Failed to create the button:\nError: \`${escapeInlineCode(message)}\``,
      allowedMentions: { parse: [] },
    })
    return
  }

  await interaction.editReply({
    content: 'Button created successfully!',
  })
}

async function handleModMailButtonInteraction(interaction: Interaction) {
  if (!interaction.isButton()) return

  // `${MODMAIL}:${CREATE_TICKET}:${modmailId}:${modmailForum.id}:${forumTag}`
  const [id, action, modmailId, forumId, forumTag] =
    interaction.customId.split(':')

  if (id !== MODMAIL) return

  switch (action) {
    case CREATE_TICKET:
      await handleCreateTicketButton(interaction, {
        modmailId,
        forumId,
        forumTag,
      })
      break
    default:
      await interaction.reply({
        content: 'Unknown action',
        flags: MessageFlags.Ephemeral,
      })
  }
}

type TicketField = Prisma.ModMailTicketModalFieldGetPayload<true>

const DEFAULT_FIELDS: TicketField[] = [
  {
    modmailID: '0',
    guildID: '0',
    customID: 'ticket_body',
    order: 0,
    label: 'Message to send to the mods',
    style: TextInputStyle.Paragraph,
    placeholder: 'Type out your message here...',
    required: true,
    minLength: 1,
    maxLength: 2000,
    useAsTitle: false,
  },
]

interface CreateTicketData {
  modmailId: string
  forumId: string
  forumTag: string
}

const MAX_EMBED_LENGTH = 6000 - 50 // headroom for the "Ticket Truncated" field

async function handleCreateTicketButton(
  interaction: ButtonInteraction,
  { modmailId, forumId, forumTag }: CreateTicketData,
) {
  inGuildGuard(interaction)

  const config = await prisma.modMailTicketConfig.findFirst({
    where: { modmailID: modmailId, guildID: interaction.guildId },
  })

  if (config) {
    if (config.maxOpenTickets) {
      const tickets = await prisma.modMailTicket.count({
        where: {
          modmailID: modmailId,
          guildID: interaction.guildId,
          userID: interaction.user.id,
          open: true,
          linkDeleted: false,
        },
      })

      if (tickets >= config.maxOpenTickets) {
        await interaction.reply({
          content: `You have reached the maximum number of open tickets (${tickets}/${config.maxOpenTickets}).\nYou can create more tickets once a moderator closes some of your existing tickets.`,
          flags: MessageFlags.Ephemeral,
        })
        return
      }
    }

    if (config.ratelimit) {
      const delay = config.ratelimit * SECOND

      const lastTicket = await prisma.modMailTicket.findFirst({
        where: {
          modmailID: modmailId,
          guildID: interaction.guildId,
          AND: [
            {
              createdAt: {
                gte: new Date(Date.now() - delay),
              },
            },
            { userID: interaction.user.id },
          ],
        },
        orderBy: {
          createdAt: 'desc',
        },
      })

      if (lastTicket) {
        const nextTime = new Date(lastTicket.createdAt.getTime() + delay)

        await interaction.reply({
          content: `You are creating tickets too quickly, try again ${time(nextTime, 'R')}.`,
          flags: MessageFlags.Ephemeral,
        })
        return
      }
    }
  }

  const dbFields = await prisma.modMailTicketModalField.findMany({
    where: { modmailID: modmailId, guildID: interaction.guildId },
    orderBy: { order: 'asc' },
  })

  const fields = dbFields.length > 0 ? dbFields : DEFAULT_FIELDS

  const modal = new ModalBuilder()
    .setCustomId(
      `${MODMAIL}:${TICKET_MODAL}:${modmailId}:${forumId}:${forumTag}`,
    )
    .setTitle('Create a Modmail Ticket')

  modal.addComponents(
    fields.map((field) => {
      const textInput = new TextInputBuilder()
        .setCustomId(field.customID)
        .setLabel(field.label)
        .setStyle(field.style)
        .setRequired(field.required ?? false)
        .setPlaceholder(field.placeholder ?? '')
        .setMinLength(field.minLength ?? 0)
        .setMaxLength(field.maxLength ?? 4000)

      if (field.placeholder) {
        textInput.setPlaceholder(field.placeholder)
      }

      return new ActionRowBuilder<TextInputBuilder>().addComponents(textInput)
    }),
  )

  await interaction.showModal(modal)

  const filter = (i: Interaction) =>
    i.isModalSubmit() && i.customId === modal.data.custom_id

  const int = await interaction
    .awaitModalSubmit({ time: 10 * MINUTE, filter })
    .catch(() => {
      /* ignore */
    })

  if (!int) return

  await int.deferReply({ flags: MessageFlags.Ephemeral })

  // Create the modmail ticket
  const modChannel = interaction.guild?.channels.cache.get(forumId)

  if (!modChannel) {
    await int.editReply({
      content:
        'Could not find the modmail channel, contact the mod team to fix this.',
      components: [],
    })
    return
  }

  if (!modChannel.isThreadOnly()) {
    await int.editReply({
      content:
        'The modmail channel must be a forum channel, contact the mod team to fix this.',
      components: [],
    })
    return
  }

  const formattedUser = formatUser(interaction.user, {
    escapeMarkdown: false,
    markdown: false,
  })

  let title = ''
  let totalCharacters = formattedUser.length
  const fieldIDMap = new Map<string, (typeof fields)[number]>(
    fields.map((f) => [f.customID, f]),
  )

  const embed = new EmbedBuilder()
    .setAuthor({
      iconURL: interaction.user.displayAvatarURL(),
      name: formattedUser,
    })
    .addFields(
      int.fields.components.flatMap((v) => {
        if (
          totalCharacters > MAX_EMBED_LENGTH ||
          v.components[0].value === ''
        ) {
          return []
        }

        const name =
          fieldIDMap.get(v.components[0].customId)?.label ?? 'Unknown Field'
        const value = v.components[0].value
        const length = value.length + name.length

        if (fieldIDMap.get(v.components[0].customId)?.useAsTitle) {
          title = v.components[0].value
        }

        if (totalCharacters + length > MAX_EMBED_LENGTH) {
          totalCharacters += length
          return {
            name: 'Ticket Truncated',
            value: 'Ticket too long, see attachment',
          }
        }

        if (value.length < 1024) {
          totalCharacters += length
          return {
            name,
            value,
          }
        }

        return toChunksGenerator(value, 1024)
          .map((chunk, i) => {
            if (totalCharacters > MAX_EMBED_LENGTH) {
              return null
            }

            const length = chunk.length + (i === 0 ? name : 'Continued').length

            if (totalCharacters + length > MAX_EMBED_LENGTH) {
              totalCharacters += length
              return {
                name: 'Ticket Truncated',
                value: 'Ticket too long, see attachment',
              }
            }

            totalCharacters += length

            return {
              name: i === 0 ? name : 'Continued',
              value: chunk,
            }
          })
          .filter(notNullish)
          .toArray()
      }),
    )

  const files: AttachmentPayload[] = []

  if (totalCharacters > MAX_EMBED_LENGTH) {
    const fields = int.fields.fields
      .map((v, k) => `## ${fieldIDMap.get(k)?.label ?? k}\n\n${v.value}`)
      .join('\n\n')

    const string = `- Modmail ID: ${modmailId}\n- User: ${formattedUser}\n\n${fields}`

    files.push({
      name: 'ticket.md',
      attachment: Buffer.from(string, 'utf-8'),
    })
  }

  const forumConfig = await prisma.modMailForumConfig.findFirst({
    select: {
      openTag: true,
    },
    where: {
      guildID: interaction.guildId,
      channelID: modChannel.id,
    },
  })

  let modThread: ThreadChannel | undefined
  const appliedTags = [forumTag, forumConfig?.openTag].filter(
    (t): t is string => !!t,
  )

  // Max name length is 100
  const threadName = expandTo`${100}${modmailId} - ${formattedUser}${title ? `: ${title}` : ''}`

  try {
    modThread = await modChannel.threads.create({
      name: threadName,
      autoArchiveDuration: ThreadAutoArchiveDuration.OneWeek,
      appliedTags,
      reason: `Ticket created by ${interaction.user.tag}`,
      message: {
        content: embed.data.fields?.[0].value.slice(0, 256) ?? 'No Preview',
        embeds: [embed],
        files,
        allowedMentions: { parse: [] },
      },
    })
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    await int.editReply({
      content: `Failed to create user ticket, please try again later.\nError: \`${escapeInlineCode(msg)}\``,
    })
    return
  }

  const userChannel =
    interaction.channel ??
    (await interaction.guild?.channels.fetch(interaction.channelId))

  if (!userChannel) {
    throw new Error('Failed to find user channel for ticket threads')
  }

  if (
    !('threads' in userChannel) ||
    userChannel.isThreadOnly() ||
    userChannel.type === ChannelType.GuildAnnouncement
  ) {
    throw new Error('Cannot create threads in user channel type')
  }

  let userThread: ThreadChannel | undefined

  try {
    userThread = await userChannel.threads.create({
      name: threadName,
      autoArchiveDuration: ThreadAutoArchiveDuration.OneWeek,
      invitable: config?.invitable ?? false,
      type: ChannelType.PrivateThread,
      reason: `Ticket created by ${formattedUser}`,
    })
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    await int.editReply({
      content: `Failed to create mod ticket, please try again later.\nError: \`${escapeInlineCode(msg)}\``,
    })
    return
  }

  await userThread.members.add(interaction.user.id)
  await userThread.send({
    content:
      'This is your thread to see replies from and reply to moderators for this ticket. Any message you send here will be forwarded to the moderators. A copy of your ticket is below:',
    embeds: [embed],
    files,
  })

  await prisma.modMailTicket.create({
    data: {
      modmailID: modmailId,
      guildID: interaction.guildId,
      // User
      userID: interaction.user.id,
      userChannelID: userChannel.id,
      userThreadID: userThread.id,
      // Mod
      modChannelID: modChannel.id,
      modThreadID: modThread.id,
    },
  })

  await int.editReply({
    content: 'Ticket created successfully!',
  })
}

function* toChunksGenerator(
  str: string,
  size: number,
): Generator<string, void, void> {
  for (let i = 0; i < str.length; i += size) {
    yield str.slice(i, i + size)
  }
}

/**
 * "Expand" expressions within a template string up until a character limit.
 * The first expression must be a number to set the limit (and will be ignored in the output).
 * The expression that reaches the limit will be truncated and terminated with "…", and any further expressions will be omitted.
 *
 * If the strings themselves reach the limit, then no expressions will be output.
 *
 * @example
 * expandTo`${10}Hello ${'World'}!` // 'Hello wo…!'
 *
 * @param strings - A template string array containing the static parts of the string.
 * @param limit - The maximum length allowed for the resulting string.
 * @param expressions - Additional expressions to be included in the resulting string.
 * @returns A string that is the result of expanding the template string with the provided expressions, ensuring the total length does not exceed the given limit.
 */
function expandTo(
  strings: TemplateStringsArray,
  limit: number,
  ...expressions: unknown[]
): string {
  // Calculate the length of the provided strings first
  const stringsLength = strings.reduce((acc, s) => acc + s.length, 0)

  if (stringsLength >= limit) {
    return strings.join('')
  }

  // Add a "dummy" expression to the start since the limit "eats" one up
  expressions.unshift('')

  let budget = limit - stringsLength
  const out: string[] = []
  const longest = Math.max(strings.length, expressions.length)

  for (let i = 0; i < longest; i++) {
    if (i < strings.length) {
      out.push(strings[i])
    }

    if (budget && i < expressions.length) {
      const exp = String(expressions[i])
      if (exp.length < budget) {
        out.push(exp)
        budget -= exp.length
      } else {
        out.push(`${exp.substring(0, budget - 1)}…`)
        budget = 0
      }
    }
  }

  return out.join('')
}
