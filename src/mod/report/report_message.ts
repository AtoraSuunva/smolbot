import {
  ActionRowBuilder,
  DiscordjsError,
  type EmbedFooterOptions,
  InteractionContextType,
  type Message,
  type MessageContextMenuCommandInteraction,
  MessageFlags,
  type ModalActionRowComponentBuilder,
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle,
  time,
} from 'discord.js'
import { SleetMessageCommand, formatUser, getGuild } from 'sleetcord'
import { MINUTE } from 'sleetcord-common'
import { quoteMessage } from '../../util/quoteMessage.js'
import { fetchConfig } from './manage/config.js'
import { sendReport } from './utils.js'

export const report_message = new SleetMessageCommand(
  {
    name: 'Report to Mods',
    contexts: [InteractionContextType.Guild],
  },
  {
    run: runReportMessage,
  },
)

async function runReportMessage(
  interaction: MessageContextMenuCommandInteraction,
  message: Message,
) {
  const guild = await getGuild(interaction, true)

  if (!message.inGuild()) {
    await interaction.reply({
      content: 'You can only report messages from servers.',
      flags: MessageFlags.Ephemeral,
    })
    return
  }

  const config = await fetchConfig(guild, interaction.user).catch(
    (err: unknown) => (err instanceof Error ? err.message : String(err)),
  )

  if (typeof config === 'string') {
    await interaction.reply({
      content: config,
      flags: MessageFlags.Ephemeral,
    })
    return
  }

  const customId = `report_message:${message.id}:${interaction.id}`

  const reasonInput = new TextInputBuilder()
    .setCustomId('reason')
    .setLabel('Reason (Optional)')
    .setRequired(false)
    .setPlaceholder('Any extra info you want to add to this report?')
    .setMaxLength(1024)
    .setStyle(TextInputStyle.Paragraph)

  const reasonRow =
    new ActionRowBuilder<ModalActionRowComponentBuilder>().addComponents(
      reasonInput,
    )

  const isAnonInput = new TextInputBuilder()
    .setCustomId('anon')
    .setLabel('Send report anonymously? (Optional)')
    .setRequired(false)
    .setPlaceholder('"yes" or "no" (default "yes")')
    .setMaxLength(3)
    .setStyle(TextInputStyle.Short)

  const isAnonRow =
    new ActionRowBuilder<ModalActionRowComponentBuilder>().addComponents(
      isAnonInput,
    )

  const modal = new ModalBuilder()
    .setCustomId(customId)
    .setTitle('Report Message')
    .addComponents([reasonRow, isAnonRow])

  await interaction.showModal(modal)
  const modalInteraction = await interaction
    .awaitModalSubmit({
      filter: (i) => i.customId === customId,
      time: 15 * MINUTE,
    })
    .catch((err: unknown) => {
      if (err instanceof DiscordjsError) {
        return null // time ran out
      }
      throw err
    })

  if (modalInteraction === null) {
    return
  }

  const reason = modalInteraction.fields.getTextInputValue('reason')
  const isAnonString =
    modalInteraction.fields.getTextInputValue('anon') || 'yes'
  const isAnon = isAnonString.toLowerCase() === 'yes'

  const footer: EmbedFooterOptions = {
    text: `Reported by ${
      isAnon
        ? 'Anonymous'
        : formatUser(interaction.user, {
            markdown: false,
            escapeMarkdown: false,
          })
    }`,
  }

  if (!isAnon) {
    footer.iconURL = interaction.user.displayAvatarURL()
  }

  const [report, ...extraEmbeds] = await quoteMessage(message)

  const createdAt = time(message.createdAt, 'F')
  const editedAt = message.editedAt ? time(message.editedAt, 'F') : ''

  report.setFooter(footer).addFields([
    {
      name: `Posted${editedAt ? ' & Edited' : ''} at`,
      value: `${createdAt}${editedAt ? `\n${editedAt}` : ''}`,
    },
  ])

  if (reason) {
    report.addFields([
      {
        name: 'Reason',
        value: reason,
      },
    ])
  }

  const embeds = [report, ...extraEmbeds]

  try {
    await sendReport(config, interaction.user, embeds)

    await modalInteraction.reply({
      content:
        "Your report has been sent to the moderators.\nHere's a copy of your report:",
      embeds,
      flags: MessageFlags.Ephemeral,
    })
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    await modalInteraction.reply({
      content: `Failed to send report: ${msg}`,
      flags: MessageFlags.Ephemeral,
    })
  }
}
