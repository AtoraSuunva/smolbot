import type { Prisma } from '@prisma/client'
import {
  ApplicationIntegrationType,
  type ChatInputCommandInteraction,
  InteractionContextType,
} from 'discord.js'
import { SleetSlashCommand, formatUser } from 'sleetcord'
import {
  type WarningFetcher,
  respondWithPaginatedWarnings,
} from './pagination.js'
import { fetchPaginatedWarnings } from './utils.js'

export const myWarnings = new SleetSlashCommand(
  {
    name: 'my_warnings',
    description: 'View your warnings',
    contexts: [InteractionContextType.Guild],
    integration_types: [ApplicationIntegrationType.GuildInstall],
  },
  {
    run: myWarningsRun,
  },
)

async function myWarningsRun(interaction: ChatInputCommandInteraction) {
  const user = interaction.user

  const filters = {
    userID: user.id,
  } satisfies Prisma.WarningWhereInput

  const fetchWarnings: WarningFetcher = (guildID, config, currentPage) =>
    fetchPaginatedWarnings(guildID, config, currentPage, filters)

  const formattedUser = {
    name: formatUser(user, { markdown: false, escapeMarkdown: false }),
    iconURL: user.displayAvatarURL(),
  }

  await respondWithPaginatedWarnings(interaction, fetchWarnings, {
    formatAuthor: () => formattedUser,
    modView: false,
    ephemeral: true,
  })
}
