import {
  type ChatInputCommandInteraction,
  EmbedBuilder,
  MessageFlags,
} from 'discord.js'
import { SleetSlashSubcommand } from 'sleetcord'

export const fields = new SleetSlashSubcommand(
  {
    name: 'fields',
    description: 'Get help about the fields.',
  },
  {
    run: runHelp,
  },
)

async function runHelp(interaction: ChatInputCommandInteraction) {
  const embed = new EmbedBuilder().setTitle('Welcome Help').addFields([
    {
      name: 'message',
      value:
        'The welcome message posted, use `/welcome message` to see what you can use.',
    },
    {
      name: 'channel',
      value:
        "The channel where the welcome message is posted, otherwise it's posted to the same channel the user posted in.",
    },
    {
      name: 'rejoins',
      value: 'Will the bot re-welcome people if they rejoin?',
    },
    {
      name: 'instant',
      value:
        'Will the bot instantly welcome people? Or wait for their first message?',
    },
    {
      name: 'ignore_roles',
      value: 'If a user has one of these roles, they will be ignored.',
    },
    {
      name: 'react_with',
      value: "An emoji, if any, to react to the user's first message with.",
    },
  ])

  await interaction.reply({
    embeds: [embed],
    flags: MessageFlags.Ephemeral,
  })
}
