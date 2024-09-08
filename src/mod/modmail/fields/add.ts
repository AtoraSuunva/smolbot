import type { ModMailTicketModalField } from '@prisma/client'
import { type ChatInputCommandInteraction, TextInputStyle } from 'discord.js'
import { SleetSlashSubcommand, getGuild } from 'sleetcord'
import { prisma } from '../../../util/db.js'
import { FIELD_OPTIONS } from './utils.js'
import { formatField } from './view.js'

const REQUIRED_FIELDS = ['custom_id', 'label']

export const modmail_fields_add = new SleetSlashSubcommand(
  {
    name: 'add',
    description: 'Add a field to the modmail ticket modal',
    options: FIELD_OPTIONS.map((option) => ({
      ...option,
      required: option.required ?? REQUIRED_FIELDS.includes(option.name),
    })),
  },
  {
    run: runAdd,
  },
)

async function runAdd(interaction: ChatInputCommandInteraction) {
  const guild = await getGuild(interaction, true)

  const modmail_id = interaction.options.getString('modmail_id', true)
  const custom_id = interaction.options.getString('custom_id', true)
  const order = interaction.options.getInteger('order')
  const label = interaction.options.getString('label', true)
  const style = interaction.options.getInteger('style') ?? TextInputStyle.Short
  const placeholder = interaction.options.getString('placeholder')
  const required = interaction.options.getBoolean('required')
  const min_length = interaction.options.getInteger('min_length') ?? 0
  const max_length = interaction.options.getInteger('max_length') ?? 4000

  const existingFields = await prisma.modMailTicketModalField.findMany({
    where: {
      guildID: guild.id,
      modmailID: modmail_id,
      customID: {
        not: custom_id,
      },
    },
    orderBy: {
      order: 'asc',
    },
  })

  if (existingFields.length >= 5) {
    await interaction.reply({
      content:
        'You can only have up to 5 fields in a modmail ticket modal! You need to remove a field first.',
      ephemeral: true,
    })
    return
  }

  const previousField = await prisma.modMailTicketModalField.findFirst({
    where: {
      guildID: guild.id,
      modmailID: modmail_id,
      customID: custom_id,
    },
  })

  const lastField = existingFields[existingFields.length - 1]

  const mergedField: Omit<ModMailTicketModalField, 'updatedAt'> = {
    modmailID: modmail_id,
    guildID: guild.id,
    customID: custom_id,
    order:
      order ?? previousField?.order ?? (lastField ? lastField.order + 1 : 0),
    label: label ?? previousField?.label,
    style: style ?? previousField?.style,
    placeholder: placeholder ?? previousField?.placeholder ?? null,
    required: required ?? previousField?.required ?? null,
    minLength: min_length ?? previousField?.minLength ?? null,
    maxLength: max_length ?? previousField?.maxLength ?? null,
  }

  const newField = await prisma.modMailTicketModalField.upsert({
    where: {
      modmailID_guildID_customID: {
        modmailID: modmail_id,
        guildID: guild.id,
        customID: custom_id,
      },
    },
    create: mergedField,
    update: mergedField,
  })

  await interaction.reply({
    content: `Field added to modmail ticket modal \`${modmail_id}\`\n> ${formatField(newField)}`,
    allowedMentions: { parse: [] },
  })
}