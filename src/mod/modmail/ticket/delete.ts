import type { ChatInputCommandInteraction } from 'discord.js'
import { SleetSlashSubcommand, inGuildGuard } from 'sleetcord'
import { prisma } from '../../../util/db.js'
import { FIELD_MODMAIL_ID } from '../fields/utils.js'

export const modmail_ticket_delete = new SleetSlashSubcommand(
  {
    name: 'delete',
    description: 'Delete a full set of fields and config for a modmail ID',
    options: [FIELD_MODMAIL_ID],
  },
  {
    run: runDeleteModmailID,
  },
)

async function runDeleteModmailID(interaction: ChatInputCommandInteraction) {
  inGuildGuard(interaction)

  const modmailID = interaction.options.getString('modmail_id', true)

  // Delete all fields
  await prisma.modMailTicketModalField.deleteMany({
    where: {
      modmailID,
    },
  })

  // Delete ticket config
  await prisma.modMailTicketConfig.delete({
    where: {
      modmailID_guildID: {
        guildID: interaction.guildId,
        modmailID,
      },
    },
  })

  await interaction.reply(
    `Deleted all fields and config for modmail ID \`${modmailID}\``,
  )
}
