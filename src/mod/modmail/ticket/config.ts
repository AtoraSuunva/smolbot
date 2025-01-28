import type { Prisma } from '@prisma/client'
import {
  ApplicationCommandOptionType,
  type ChatInputCommandInteraction,
} from 'discord.js'
import { SleetSlashSubcommand, getGuild } from 'sleetcord'
import { prisma } from '../../../util/db.js'
import { formatConfig } from '../../../util/format.js'
import { FIELD_MODMAIL_ID } from '../fields/utils.js'

export const modmail_ticket_config = new SleetSlashSubcommand(
  {
    name: 'config',
    description: 'Configure settings for a ticket',
    options: [
      FIELD_MODMAIL_ID,
      {
        name: 'max_open_tickets',
        description:
          'The maximum amount of tickets a user can have open at a time (default: 100)',
        type: ApplicationCommandOptionType.Integer,
        min_value: 0,
        max_value: 100,
      },
      {
        name: 'ratelimit',
        description:
          'Time (in seconds) a user must wait between creating tickets (default: 0)',
        type: ApplicationCommandOptionType.Integer,
        min_value: 0,
      },
      {
        name: 'invitable',
        description:
          'If users should be allowed to invite other users by pinging them (default: false)',
        type: ApplicationCommandOptionType.Boolean,
      },
    ],
  },
  {
    run: runConfigTicket,
  },
)

async function runConfigTicket(interaction: ChatInputCommandInteraction) {
  const modmailID = interaction.options.getString('modmail_id', true)
  const maxOpenTickets = interaction.options.getInteger('max_open_tickets')
  const ratelimit = interaction.options.getInteger('ratelimit')
  const invitable = interaction.options.getBoolean('invitable')

  await interaction.deferReply()

  const guild = await getGuild(interaction, true)

  const mergedConfig: Omit<Prisma.ModMailTicketConfigCreateInput, 'updatedAt'> =
    {
      guildID: guild.id,
      modmailID,
    }

  if (maxOpenTickets !== null) {
    mergedConfig.maxOpenTickets = maxOpenTickets
  }

  if (ratelimit !== null) {
    mergedConfig.ratelimit = ratelimit
  }

  if (invitable !== null) {
    mergedConfig.invitable = invitable
  }

  const newConfig = await prisma.modMailTicketConfig.upsert({
    where: {
      modmailID_guildID: {
        guildID: guild.id,
        modmailID,
      },
    },
    update: mergedConfig,
    create: mergedConfig,
  })

  await interaction.editReply({
    content: `Ticket config updated:\n${formatConfig({
      config: newConfig,
      guild,
    })}`,
    allowedMentions: { parse: [] },
  })
}
