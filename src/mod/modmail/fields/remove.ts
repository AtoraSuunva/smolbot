import type { ChatInputCommandInteraction } from 'discord.js'
import { SleetSlashSubcommand, getGuild } from 'sleetcord'
import { prisma } from '../../../util/db.js'
import { FIELD_CUSTOM_ID, FIELD_MODMAIL_ID } from './utils.js'

export const modmail_fields_remove = new SleetSlashSubcommand(
  {
    name: 'remove',
    description: 'Remove a field from the modmail ticket modal',
    options: [
      FIELD_MODMAIL_ID,
      {
        ...FIELD_CUSTOM_ID,
        required: true,
      },
    ],
  },
  {
    run: runRemove,
  },
)

async function runRemove(interaction: ChatInputCommandInteraction) {
  const guild = await getGuild(interaction, true)
  const modmail_id = interaction.options.getString('modmail_id', true)
  const custom_id = interaction.options.getString('custom_id', true)

  await prisma.modMailTicketModalField.deleteMany({
    where: {
      guildID: guild.id,
      modmailID: modmail_id,
      customID: custom_id,
    },
  })

  await interaction.reply({
    content: 'Field removed',
  })
}
