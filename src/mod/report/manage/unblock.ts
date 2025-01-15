import {
  ApplicationCommandOptionType,
  type ChatInputCommandInteraction,
  MessageFlags,
} from 'discord.js'
import { SleetSlashSubcommand, formatUser, getGuild } from 'sleetcord'
import { prisma } from '../../../util/db.js'

export const report_manage_unblock = new SleetSlashSubcommand(
  {
    name: 'unblock',
    description: 'Unblock a user from using the report command.',
    options: [
      {
        name: 'user',
        description: 'The user to unblock.',
        type: ApplicationCommandOptionType.User,
        required: true,
      },
    ],
  },
  {
    run: runReportUnblock,
  },
)

async function runReportUnblock(interaction: ChatInputCommandInteraction) {
  const guild = await getGuild(interaction, true)
  const user = interaction.options.getUser('user', true)

  const guildID_userID = {
    guildID: guild.id,
    userID: user.id,
  }

  const reportBlock = await prisma.reportBan.findUnique({
    where: {
      guildID_userID,
    },
  })

  if (!reportBlock) {
    await interaction.reply({
      content: `${formatUser(
        user,
      )} is not blocked from using the report command.`,
      flags: MessageFlags.Ephemeral,
    })
    return
  }

  await prisma.reportBan.delete({
    where: {
      guildID_userID,
    },
  })

  await interaction.reply({
    content: `${formatUser(user)} was unblocked from using the report command.`,
  })
}
