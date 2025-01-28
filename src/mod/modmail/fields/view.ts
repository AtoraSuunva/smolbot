import type { ModMailTicketModalField } from '@prisma/client'
import {
  type ChatInputCommandInteraction,
  MessageFlags,
  TextInputStyle,
} from 'discord.js'
import { SleetSlashSubcommand, escapeAllMarkdown, getGuild } from 'sleetcord'
import { prisma } from '../../../util/db.js'
import { FIELD_MODMAIL_ID } from './utils.js'

export const modmail_fields_view = new SleetSlashSubcommand(
  {
    name: 'view',
    description: 'View the modmail ticket modal fields',
    options: [FIELD_MODMAIL_ID],
  },
  {
    run: runView,
  },
)

async function runView(interaction: ChatInputCommandInteraction) {
  const guild = await getGuild(interaction, true)
  const modmail_id = interaction.options.getString('modmail_id', true)

  const fields = await prisma.modMailTicketModalField.findMany({
    where: {
      guildID: guild.id,
      modmailID: modmail_id,
    },
    orderBy: {
      order: 'asc',
    },
  })

  if (fields.length === 0) {
    await interaction.reply({
      content: 'No fields found for that modmail ID',
      flags: MessageFlags.Ephemeral,
    })
    return
  }

  const formattedFields = fields.map(formatField)

  await interaction.reply({
    content: formattedFields.join('\n'),
    allowedMentions: { parse: [] },
  })
}

export function formatField(field: ModMailTicketModalField): string {
  return `\`${escapeAllMarkdown(field.customID)}\`: "${escapeAllMarkdown(field.label)}"${
    field.required ? ' (required)' : ''
  }${field.useAsTitle ? ' (title)' : ''}, ${TextInputStyle[field.style]} (${field.minLength ?? 0}-${field.maxLength ?? 4000} characters)${
    field.placeholder
      ? `, Placeholder: "${escapeAllMarkdown(field.placeholder)}"`
      : ''
  }`
}
