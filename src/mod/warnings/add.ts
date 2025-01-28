import type { Prisma } from '@prisma/client'
import {
  ApplicationCommandOptionType,
  type ChatInputCommandInteraction,
} from 'discord.js'
import { SleetSlashSubcommand, formatUser, getGuild } from 'sleetcord'
import { prisma } from '../../util/db.js'
import {
  type WarningFetcher,
  respondWithPaginatedWarnings,
} from './pagination.js'
import { fetchPaginatedWarnings } from './utils.js'

export const warningsAdd = new SleetSlashSubcommand(
  {
    name: 'add',
    description: 'Add a warning to a user',
    options: [
      {
        name: 'user',
        description: 'The user to warn',
        type: ApplicationCommandOptionType.User,
        required: true,
      },
      {
        name: 'reason',
        description: 'The reason for the warning',
        type: ApplicationCommandOptionType.String,
        required: true,
        max_length: 256,
      },
      {
        name: 'mod_note',
        description:
          'A note for moderators, will not be shown to the user if they lookup warnings (default: none)',
        type: ApplicationCommandOptionType.String,
        max_length: 256,
      },
      {
        name: 'permanent',
        description: 'Whether the warning should be permanent (default: false)',
        type: ApplicationCommandOptionType.Boolean,
      },
      {
        name: 'void',
        description: 'Whether the warning should be void (default: false)',
        type: ApplicationCommandOptionType.Boolean,
      },
    ],
  },
  {
    run: warningsAddRun,
  },
)

async function warningsAddRun(interaction: ChatInputCommandInteraction) {
  const guild = await getGuild(interaction, true)
  const user = interaction.options.getUser('user', true)
  const reason = interaction.options.getString('reason', true)
  const modNote = interaction.options.getString('mod_note', false) ?? ''
  const permanent = interaction.options.getBoolean('permanent', false) ?? false
  const voidWarning = interaction.options.getBoolean('void', false) ?? false

  await prisma.$transaction(async (tx) => {
    // So to create a new warning, we need to:
    // 0. Figure out the next warning ID to use in this guild
    // 1. Create a new warning that's warningID + 1

    // 0.
    const latestWarningIDInGuild = await tx.warning.findFirst({
      select: {
        warningID: true,
      },
      where: {
        guildID: guild.id,
      },
      orderBy: {
        warningID: 'desc',
      },
    })

    const nextWarningID = (latestWarningIDInGuild?.warningID ?? 0) + 1

    // 1.
    await tx.warning.create({
      data: {
        guildID: guild.id,
        warningID: nextWarningID,
        version: 1,
        user: formatUser(user, { markdown: false, id: false }),
        userID: user.id,
        reason,
        permanent,
        void: voidWarning,
        modNote,
        moderatorID: interaction.user.id,
        // This specifically needs to be null, it's how we tell which version of the warning is the latest
        validUntil: null,
      },
    })
  })

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
    modView: true,
  })
}
