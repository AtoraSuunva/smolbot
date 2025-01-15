import type { Warning } from '@prisma/client'
import {
  ApplicationCommandOptionType,
  type ChatInputCommandInteraction,
  EmbedBuilder,
  MessageFlags,
} from 'discord.js'
import { SleetSlashSubcommand, getGuild } from 'sleetcord'
import { prisma } from '../../util/db.js'
import {
  fetchWarningConfigFor,
  formatWarningToField,
  markWarningArchiveDirty,
} from './utils.js'

export const warningsEdit = new SleetSlashSubcommand(
  {
    name: 'edit',
    description: 'Edit a warning',
    options: [
      {
        name: 'warning_id',
        description: 'The ID of the warning to edit',
        type: ApplicationCommandOptionType.Integer,
        required: true,
      },
      {
        name: 'reason',
        description: 'The reason for the warning',
        type: ApplicationCommandOptionType.String,
      },
      {
        name: 'mod_note',
        description:
          'A note for moderators, will not be shown to the user if they lookup warnings',
        type: ApplicationCommandOptionType.String,
      },
      {
        name: 'permanent',
        description: 'Whether the warning should be permanent',
        type: ApplicationCommandOptionType.Boolean,
      },
      {
        name: 'void',
        description: 'Whether the warning should be void',
        type: ApplicationCommandOptionType.Boolean,
      },
    ],
  },
  {
    run: warningsEditRun,
  },
)

async function warningsEditRun(interaction: ChatInputCommandInteraction) {
  const guild = await getGuild(interaction, true)

  const warningID = interaction.options.getInteger('warning_id', true)
  const reason = interaction.options.getString('reason', false)
  const modNote = interaction.options.getString('mod_note', false)
  const permanent = interaction.options.getBoolean('permanent', false)
  const voidWarning = interaction.options.getBoolean('void', false)

  const config = await fetchWarningConfigFor(guild.id, true)

  const oldWarning = await prisma.warning.findFirst({
    where: {
      guildID: guild.id,
      warningID,
      validUntil: null,
    },
  })

  if (!oldWarning) {
    await interaction.reply({
      content: 'That warning does not exist',
      flags: MessageFlags.Ephemeral,
    })
    return
  }

  const mergedWarning: Warning = {
    guildID: guild.id,
    warningID,
    version: oldWarning.version + 1,
    user: oldWarning.user,
    userID: oldWarning.userID,
    reason: reason ?? oldWarning.reason,
    modNote: modNote ?? oldWarning.modNote,
    permanent: permanent ?? oldWarning.permanent,
    void: voidWarning ?? oldWarning.void,
    moderatorID: interaction.user.id,
    createdAt: oldWarning.createdAt,
    validUntil: null,
  }

  const newWarning = await updateWarning(guild.id, mergedWarning)

  await markWarningArchiveDirty(guild.id)

  const embed = new EmbedBuilder().setTitle('Edited Warning').addFields([
    formatWarningToField(newWarning, config, {
      showModNote: true,
      showUserOnWarning: true,
      showResponsibleMod: true,
      showVersion: true,
    }),
  ])

  await interaction.reply({
    embeds: [embed],
  })
}

/**
 * Create a new warning version by marking the old ones as all now invalid and creating a new one that's valid
 * @param guildID The guild ID that the warning belongs to
 * @param newWarning The new warning to create
 * @returns The newly created warning entry
 */
export async function updateWarning(
  guildID: string,
  newWarning: Warning,
): Promise<Warning> {
  // Transaction since we shouldn't be able to mark the old warning as expired while erroring on the new warning
  return await prisma.$transaction(async (tx) => {
    // Mark the old warning as having expired just now
    await tx.warning.updateMany({
      where: {
        guildID,
        warningID: newWarning.warningID,
        validUntil: null,
      },
      data: {
        validUntil: new Date(),
      },
    })

    // Then make the new warning
    return tx.warning.create({
      data: newWarning,
    })
  })
}
