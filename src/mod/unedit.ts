import { stripVTControlCharacters } from 'node:util'
import {
  ApplicationCommandOptionType,
  ApplicationIntegrationType,
  type AttachmentPayload,
  type ChatInputCommandInteraction,
  Collection,
  type CommandInteraction,
  InteractionContextType,
  type Message,
  type MessageContextMenuCommandInteraction,
  MessageFlags,
  type PartialMessage,
  cleanCodeBlockContent,
  codeBlock,
} from 'discord.js'
import { SleetMessageCommand, SleetSlashCommand, isLikelyID } from 'sleetcord'
import { HOUR } from 'sleetcord-common'
import { messageArrayToLog } from './modlog/handlers/messageDelete.js'

export const unedit = new SleetSlashCommand(
  {
    name: 'unedit',
    description: 'Unedits a message',
    default_member_permissions: ['ManageMessages'],
    contexts: [InteractionContextType.Guild],
    integration_types: [ApplicationIntegrationType.GuildInstall],
    options: [
      {
        name: 'message_link',
        type: ApplicationCommandOptionType.String,
        description: 'A message link or message id of the message to unedit',
        required: true,
      },
    ],
  },
  {
    messageUpdate: handleMessageUpdate,
    run: runUneditSlashCommand,
  },
)

export const unedit_message = new SleetMessageCommand(
  {
    name: 'Unedit',
    default_member_permissions: ['ManageMessages'],
    contexts: [InteractionContextType.Guild],
    integration_types: [ApplicationIntegrationType.GuildInstall],
  },
  {
    run: runUneditContextMenu,
  },
)

interface EditStoreEntry {
  lastEditTimestamp: number
  edits: Message[]
}

export const editStore = new Collection<string, EditStoreEntry>()

/** 3 hours in ms */
const SWEEP_LIFETIME = 3 * HOUR

const editSweeper = (value: EditStoreEntry) =>
  Date.now() - value.lastEditTimestamp > SWEEP_LIFETIME

function handleMessageUpdate(
  oldMessage: Message | PartialMessage,
  newMessage: Message,
) {
  const previousEdits = editStore.get(newMessage.id) ?? {
    lastEditTimestamp: 0,
    edits: [],
  }

  previousEdits.edits.pop()

  if (!oldMessage.partial) {
    previousEdits.edits.push(oldMessage)
  }

  previousEdits.edits.push(newMessage)
  previousEdits.lastEditTimestamp =
    newMessage.editedTimestamp ?? newMessage.createdTimestamp

  editStore.set(newMessage.id, previousEdits)

  // Remove all older entries to keep memory from endlessly growing
  editStore.sweep(editSweeper)
}

function runUneditSlashCommand(interaction: ChatInputCommandInteraction) {
  const messageLink = interaction.options.getString('message_link', true)
  const messageID = getMessageId(messageLink)

  if (messageID === null) {
    return interaction.reply({
      flags: MessageFlags.Ephemeral,
      content: 'Invalid message link or message ID.',
    })
  }

  return runUnedit(interaction, messageID, false)
}

async function runUneditContextMenu(
  interaction: MessageContextMenuCommandInteraction,
  message: Message,
) {
  await runUnedit(interaction, message.id, true)
}

async function runUnedit(
  interaction: CommandInteraction,
  messageID: string,
  ephemeral: boolean,
) {
  const edits = editStore.get(messageID)?.edits ?? []

  if (edits.length === 0) {
    return interaction.reply({
      flags: MessageFlags.Ephemeral,
      content: 'That message has no cached edits, or was never edited',
    })
  }

  const messageContent = await messageArrayToLog(edits)
  const codeContent = codeBlock('ansi', cleanCodeBlockContent(messageContent))
  let content = ''
  const files: AttachmentPayload[] = []

  if (codeContent.length > 2000) {
    files.push({
      name: 'message-edits.txt',
      attachment: Buffer.from(
        stripVTControlCharacters(messageContent),
        'utf-8',
      ),
    })
  } else {
    content = codeContent
  }

  return interaction.reply({
    content,
    files,
    flags: ephemeral ? MessageFlags.Ephemeral : '0',
    allowedMentions: { parse: [] },
  })
}

const messageLinkRegex =
  /https?:\/\/(?:ptb\.|canary\.)?discord(?:app)?\.com\/channels\/(?<guildId>\d+)\/(?<channelId>\d+)\/(?<messageId>\d+)/i

interface MessageLinkMatches {
  guildId: string
  channelId: string
  messageId: string
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
  }
}

function getMessageId(str: string): string | null {
  if (isLikelyID(str)) {
    return str
  }

  return getMessageLinkIds(str)?.messageId ?? null
}
