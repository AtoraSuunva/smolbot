import {
  ApplicationCommandOptionType,
  ApplicationIntegrationType,
  type ChatInputCommandInteraction,
  InteractionContextType,
  MessageFlags,
  codeBlock,
} from 'discord.js'
import { SleetSlashCommand, makeChoices } from 'sleetcord'
import { formatToLog } from './utils.js'

const actionChoices = makeChoices([
  'Ban',
  'Unban',
  'Kick',
  'Timeout',
  'Timeout Removed',
])

type ActionTypes = Lowercase<(typeof actionChoices)[number]['value']>

export const manual_log = new SleetSlashCommand(
  {
    name: 'manual_log',
    description:
      'Create a manual log for some action, which you can copy/paste',
    contexts: [InteractionContextType.Guild],
    integration_types: [ApplicationIntegrationType.GuildInstall],
    options: [
      {
        name: 'user',
        description: 'The user affected by the log',
        type: ApplicationCommandOptionType.User,
        required: true,
      },
      {
        name: 'reason',
        description: 'The reason for the log',
        type: ApplicationCommandOptionType.String,
        required: true,
      },
      {
        name: 'action',
        description: 'The action taken for the log (default: ban)',
        type: ApplicationCommandOptionType.String,
        choices: actionChoices,
      },
      {
        name: 'responsible',
        description: 'The responsible moderator for the log (default: you)',
        type: ApplicationCommandOptionType.User,
      },
    ],
  },
  {
    run: runManualLog,
  },
)

async function runManualLog(interaction: ChatInputCommandInteraction) {
  const user = interaction.options.getUser('user', true)
  const reason = interaction.options.getString('reason', true)
  const action = (
    interaction.options.getString('action', false) ?? 'ban'
  ).toLowerCase() as ActionTypes
  const responsibleModerator =
    interaction.options.getUser('responsible', false) ?? interaction.user

  const log = await formatToLog({
    id: -1,
    action,
    user,
    redactUser: false,
    reason,
    responsibleModerator,
    createdAt: new Date(),
  })

  await interaction.reply({
    flags: MessageFlags.Ephemeral,
    content: codeBlock(log),
  })
}
