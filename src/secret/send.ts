import {
  ApplicationCommandOptionType,
  type ChatInputCommandInteraction,
  InteractionContextType,
  MessageFlags,
} from 'discord.js'
import { SleetSlashCommand, getTextBasedChannel, inGuildGuard } from 'sleetcord'

export const send = new SleetSlashCommand(
  {
    name: 'send',
    description: 'Send a message as the bot',
    contexts: [InteractionContextType.Guild],
    options: [
      {
        name: 'message',
        description: 'The message to send',
        type: ApplicationCommandOptionType.String,
        required: true,
      },
      {
        name: 'channel',
        description:
          'The channel to send the message to (default: same channel)',
        type: ApplicationCommandOptionType.Channel,
      },
    ],
    registerOnlyInGuilds: [],
  },
  {
    run: runSend,
  },
)

async function runSend(interaction: ChatInputCommandInteraction) {
  inGuildGuard(interaction)

  const message = interaction.options.getString('message', true)
  const channel =
    (await getTextBasedChannel(interaction, 'channel')) ?? interaction.channel

  if (channel === null) {
    return interaction.reply({
      content: 'Failed to get the channel to send a message in.',
      flags: MessageFlags.Ephemeral,
    })
  }

  if (!channel.permissionsFor(interaction.user)?.has('SendMessages')) {
    return interaction.reply({
      content: `You do not have permission to send messages in ${channel}`,
      flags: MessageFlags.Ephemeral,
    })
  }

  if (!channel.permissionsFor(interaction.client.user)?.has('SendMessages')) {
    return interaction.reply({
      content: `I do not have permission to send messages in ${channel}`,
      flags: MessageFlags.Ephemeral,
    })
  }

  await channel.send(message)
  return interaction.reply(`Sent message in ${channel}`)
}
