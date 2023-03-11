import { Warning } from '@prisma/client'
import {
  ApplicationCommandOptionType,
  ChatInputCommandInteraction,
  EmbedBuilder,
} from 'discord.js'
import { getGuild, SleetSlashSubcommand } from 'sleetcord'
import { prisma } from '../../util/db.js'
import { updateWarning } from './edit.js'
import {
  formatWarningToField,
  fetchWarningConfigFor,
  markWarningArchiveDirty,
} from './utils.js'

export const warningsRevert = new SleetSlashSubcommand(
  {
    name: 'revert',
    description: 'Revert a warning to a previous version',
    options: [
      {
        name: 'warning_id',
        description: 'The ID of the warning to revert',
        type: ApplicationCommandOptionType.Integer,
        required: true,
      },
      {
        name: 'version',
        description: 'The version of the warning to revert to',
        type: ApplicationCommandOptionType.Integer,
        required: true,
      },
    ],
  },
  {
    run: warningsRevertRun,
  },
)

async function warningsRevertRun(interaction: ChatInputCommandInteraction) {
  const guild = await getGuild(interaction, true)

  const warningID = interaction.options.getInteger('warning_id', true)
  const version = interaction.options.getInteger('version', true)

  const config = await fetchWarningConfigFor(guild.id, true)

  const warningHistory = await prisma.warning.findMany({
    where: {
      guildID: guild.id,
      warningID,
    },
  })

  const revertTo = warningHistory.find((w) => w.version === version)

  if (!revertTo) {
    const versions = warningHistory.map((w) => w.version).join(', ')
    interaction.reply({
      content: `No version ${version} found for warning #${warningID} version ${version}\nAvailable versions: ${versions}`,
      ephemeral: true,
    })
    return
  }

  const newestVersion = warningHistory.reduce((a, b) =>
    a.version > b.version ? a : b,
  )

  const mergedWarning: Warning = {
    ...revertTo,
    version: newestVersion.version + 1,
    moderatorID: interaction.user.id,
    validUntil: null,
  }

  const newWarning = await updateWarning(guild.id, mergedWarning)

  markWarningArchiveDirty(guild.id)

  const embed = new EmbedBuilder()
    .setTitle('Reverted Warning')
    .setDescription(
      `Reverted warning #**${warningID}** to version **${version}**`,
    )
    .addFields([
      formatWarningToField(newWarning, config, {
        showModNote: true,
        showUserOnWarning: true,
        showResponsibleMod: true,
        showVersion: true,
      }),
    ])

  interaction.reply({
    embeds: [embed],
  })
}
