import { InteractionContextType } from 'discord-api-types/v10'
import {
  ApplicationCommandOptionType,
  type ChatInputCommandInteraction,
  Constants,
  type PrivateThreadChannel,
  type PublicThreadChannel,
  type ThreadEditOptions,
} from 'discord.js'
import {
  SleetSlashCommand,
  escapeAllMarkdown,
  formatUser,
  getChannel,
} from 'sleetcord'

export const lock_thread = new SleetSlashCommand(
  {
    name: 'lock_thread',
    description: 'Locks a thread',
    contexts: [InteractionContextType.Guild],
    default_member_permissions: ['ManageThreads'],
    options: [
      {
        name: 'reason',
        type: ApplicationCommandOptionType.String,
        description: 'The reason for locking the thread',
        required: true,
      },
      {
        name: 'thread',
        type: ApplicationCommandOptionType.Channel,
        description: 'The thread to lock',
        channel_types: Constants.ThreadChannelTypes,
      },
      {
        name: 'ephemeral',
        type: ApplicationCommandOptionType.Boolean,
        description: 'Only show the result to you (default: True)',
      },
    ],
  },
  {
    run: runLockThread,
  },
)

const logToChannels: Record<string, string> = {
  // parent channel: log channel
  '969756986319183923': '982924658355625994',
  '986100624892514374': '982924658355625994',
}

async function logToChannel(
  interaction: ChatInputCommandInteraction<'cached' | 'raw'>,
  thread: PublicThreadChannel | PrivateThreadChannel,
  reason: string,
) {
  if (thread.parentId === null) return

  const logChannelId = logToChannels[thread.parentId]

  if (!logChannelId) return

  const formattedReason = [
    `**Locked Thread:** ${escapeAllMarkdown(thread.name)}`,
    `**Locked By:** ${formatUser(interaction.user)}`,
    thread.url,
    `**Reason:** ${reason}`,
  ].join('\n')

  const channel = await interaction.guild?.channels.fetch(logChannelId)

  if (!channel?.isTextBased()) {
    return
  }

  return channel.send({ content: formattedReason })
}

async function runLockThread(interaction: ChatInputCommandInteraction) {
  const thread =
    (await getChannel(interaction, 'thread')) ?? interaction.channel
  const reason = interaction.options.getString('reason', true)
  const formattedReason = `Locked by ${formatUser(interaction.user, {
    markdown: false,
    escape: false,
  })}: ${reason}`
  const ephemeral = interaction.options.getBoolean('ephemeral') ?? true

  if (interaction.channel?.isThread() && interaction.channel.locked) {
    // We can't reply to interactions in locked threads, it just doesn't work
    return
  }

  if (!thread) {
    return interaction.reply({
      content: 'Please provide a thread to lock',
      ephemeral: true,
    })
  }

  if (!interaction.inGuild()) {
    return interaction.reply({
      content: 'You can only use this command in a server',
      ephemeral: true,
    })
  }

  if (!thread.isThread()) {
    return interaction.reply({
      content: 'You can only lock threads & forum posts',
      ephemeral: true,
    })
  }

  if (thread.archived && thread.locked) {
    return interaction.reply({
      content: 'This thread is already archived & locked',
      ephemeral: true,
    })
  }

  if (!thread.editable) {
    return interaction.reply({
      content: 'I cannot edit this thread',
      ephemeral: true,
    })
  }

  const defer = interaction.deferReply({ ephemeral })

  if (!ephemeral) {
    await defer
    await interaction.editReply({
      content: `Locking thread ${thread} for "${reason}"...`,
    })
  }

  try {
    const threadEditData: ThreadEditOptions = {}

    if (!thread.archived) {
      threadEditData.archived = true
    }

    if (!thread.locked) {
      threadEditData.locked = true
    }

    await thread.edit({
      ...threadEditData,
      reason: formattedReason,
    })
  } catch (error) {
    await defer
    return interaction.editReply({
      content: `An error occurred while locking the thread: ${String(error)}`,
    })
  }

  await logToChannel(interaction, thread, reason)
  await defer

  return interaction.editReply({
    content: `Locked thread ${thread} for "${reason}"`,
  })
}
