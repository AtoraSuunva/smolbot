import type { ModMailTicketModalField } from '@prisma/client'
import { type ChatInputCommandInteraction, MessageFlags } from 'discord.js'
import { SleetSlashSubcommand, getGuild } from 'sleetcord'
import { prisma } from '../../../util/db.js'
import { FIELD_OPTIONS } from './utils.js'
import { formatField } from './view.js'

const REQUIRED_FIELDS = ['custom_id']

export const modmail_fields_edit = new SleetSlashSubcommand(
  {
    name: 'edit',
    description: 'Edit a field in the modmail ticket modal',
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
  const label = interaction.options.getString('label')
  const style = interaction.options.getInteger('style')
  const placeholder = interaction.options.getString('placeholder')
  const required = interaction.options.getBoolean('required')
  const min_length = interaction.options.getInteger('min_length')
  const max_length = interaction.options.getInteger('max_length')
  const use_as_title = interaction.options.getBoolean('use_as_title')

  const previousField = await prisma.modMailTicketModalField.findFirst({
    where: {
      guildID: guild.id,
      modmailID: modmail_id,
      customID: custom_id,
    },
  })

  if (!previousField) {
    await interaction.reply({
      content: 'No field found for that modmail and custom ID pair.',
      flags: MessageFlags.Ephemeral,
    })

    return
  }

  const mergedField: Omit<ModMailTicketModalField, 'updatedAt'> = {
    modmailID: modmail_id,
    guildID: guild.id,
    customID: custom_id,
    order: order ?? previousField?.order,
    label: label ?? previousField?.label,
    style: style ?? previousField?.style,
    placeholder: placeholder ?? previousField?.placeholder ?? null,
    required: required ?? previousField?.required ?? null,
    minLength: min_length ?? previousField?.minLength ?? null,
    maxLength: max_length ?? previousField?.maxLength ?? null,
    useAsTitle: use_as_title ?? previousField?.useAsTitle ?? null,
  }

  const newField = await prisma.modMailTicketModalField.update({
    where: {
      modmailID_guildID_customID: {
        modmailID: modmail_id,
        guildID: guild.id,
        customID: custom_id,
      },
    },
    data: mergedField,
  })

  await interaction.reply({
    content: `Field edited in modmail ticket modal \`${modmail_id}\`\n> ${formatField(newField)}`,
    allowedMentions: { parse: [] },
  })
}
