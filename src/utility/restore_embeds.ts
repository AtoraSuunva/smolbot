import {
  InteractionContextType,
  type MessageContextMenuCommandInteraction,
  MessageFlags,
  MessageFlagsBitField,
} from 'discord.js'
import { type InteractionMessage, SleetMessageCommand } from 'sleetcord'

export const restore_embeds = new SleetMessageCommand(
  {
    name: 'Restore Embeds',
    default_member_permissions: ['ManageMessages'],
    contexts: [InteractionContextType.Guild],
  },
  {
    run: runRestoreEmbeds,
  },
)

async function runRestoreEmbeds(
  interaction: MessageContextMenuCommandInteraction,
  message: InteractionMessage,
) {
  const flags = new MessageFlagsBitField(message.flags)

  if (!flags.has(MessageFlags.SuppressEmbeds)) {
    return interaction.reply({
      content: 'This message does not have suppressed embeds.',
      flags: MessageFlags.Ephemeral,
    })
  }

  flags.remove(MessageFlags.SuppressEmbeds)

  if (interaction.channel === null) {
    return interaction.reply({
      content: 'This message is not in a cached channel.',
      flags: MessageFlags.Ephemeral,
    })
  }

  await interaction.channel.messages.edit(message.id, { flags: flags.bitfield })

  return interaction.reply({
    content: 'Embeds restored.',
    flags: MessageFlags.Ephemeral,
  })
}
