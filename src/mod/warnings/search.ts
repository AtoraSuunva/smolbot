import type { Prisma } from '@prisma/client'
import {
  ApplicationCommandOptionType,
  type ChatInputCommandInteraction,
} from 'discord.js'
import { SleetSlashSubcommand, formatUser } from 'sleetcord'
import {
  type WarningFetcher,
  respondWithPaginatedWarnings,
} from './pagination.js'
import { fetchPaginatedWarnings } from './utils.js'

export const warningsSearch = new SleetSlashSubcommand(
  {
    name: 'search',
    description: 'Search for warnings',
    options: [
      {
        name: 'user',
        description: 'Filter warnings for this user',
        type: ApplicationCommandOptionType.User,
      },
      {
        name: 'warning_id',
        description: 'Get warning by ID',
        type: ApplicationCommandOptionType.Integer,
      },
      {
        name: 'reason',
        description: 'Filter warnings containing this in the reason',
        type: ApplicationCommandOptionType.String,
      },
      {
        name: 'mod_note',
        description: 'Filter warnings containing this in the mod note',
        type: ApplicationCommandOptionType.String,
      },
      {
        name: 'permanent',
        description: 'Filter warnings that are permanent or not',
        type: ApplicationCommandOptionType.Boolean,
      },
      {
        name: 'void',
        description: 'Filter warnings that are void or not',
        type: ApplicationCommandOptionType.Boolean,
      },
      {
        name: 'expired',
        description: 'Filter warnings that are expired or not',
        type: ApplicationCommandOptionType.Boolean,
      },
      {
        name: 'reverse',
        description: 'Show the results in reverse order (oldest first)',
        type: ApplicationCommandOptionType.Boolean,
      },
      {
        name: 'ephemeral',
        description: 'Only show the results to you (default: false)',
        type: ApplicationCommandOptionType.Boolean,
      },
    ],
  },
  {
    run: warningsViewRun,
  },
)

async function warningsViewRun(interaction: ChatInputCommandInteraction) {
  const user = interaction.options.getUser('user')
  const warningID = interaction.options.getInteger('warning_id')
  const reason = interaction.options.getString('reason')
  const modNote = interaction.options.getString('mod_note')
  const permanent = interaction.options.getBoolean('permanent')
  const voidWarning = interaction.options.getBoolean('void')
  const expired = interaction.options.getBoolean('expired')
  const reverse = interaction.options.getBoolean('reverse') ?? false
  const ephemeral = interaction.options.getBoolean('ephemeral') ?? false

  const filters = {
    ...(user ? { userID: user.id } : {}),
    ...(warningID ? { warningID } : {}),
    ...(reason ? { reason: { contains: reason } } : {}),
    ...(modNote ? { modNote: { contains: modNote } } : {}),
    ...(permanent !== null ? { permanent } : {}),
    ...(voidWarning !== null ? { void: voidWarning } : {}),
    ...(expired !== null ? { expired } : {}),
  } satisfies Prisma.WarningWhereInput

  const fetchWarnings: WarningFetcher = (guildID, config, currentPage) =>
    fetchPaginatedWarnings(guildID, config, currentPage, filters, reverse)

  const formattedUser = user
    ? {
        name: formatUser(user, { markdown: false, escapeMarkdown: false }),
        iconURL: user.displayAvatarURL(),
      }
    : null

  await respondWithPaginatedWarnings(interaction, fetchWarnings, {
    formatAuthor: () => formattedUser,
    showUserOnWarning: !user,
    modView: true,
    ephemeral,
  })
}
