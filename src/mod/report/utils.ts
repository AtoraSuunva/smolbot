import type { UserReport } from '@prisma/client'
import {
  type ActionRow,
  ActionRowBuilder,
  ButtonBuilder,
  type ButtonInteraction,
  ButtonStyle,
  Colors,
  ComponentType,
  DiscordjsError,
  type EmbedAuthorOptions,
  EmbedBuilder,
  type EmbedFooterOptions,
  type Interaction,
  type MessageActionRowComponent,
  MessageFlags,
  type ModalActionRowComponentBuilder,
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle,
  type User,
  blockQuote,
  codeBlock,
  hyperlink,
} from 'discord.js'
import { formatUser, getGuild } from 'sleetcord'
import { MINUTE, notNullish } from 'sleetcord-common'
import { prisma } from '../../util/db.js'
import { responseMessageLink } from '../../util/format.js'
import type { ReportConfigResolved } from './manage/config.js'

const REPORT = 'report'

function createBlockButton(reportID: string): ButtonBuilder {
  return new ButtonBuilder()
    .setCustomId(`${REPORT}:${reportID}:block`)
    .setEmoji('🛑')
    .setLabel('Block')
    .setStyle(ButtonStyle.Danger)
}

function createUnblockButton(reportID: string): ButtonBuilder {
  return new ButtonBuilder()
    .setCustomId(`${REPORT}:${reportID}:unblock`)
    .setEmoji('🔓')
    .setLabel('Unblock')
    .setStyle(ButtonStyle.Secondary)
}

export async function sendReport(
  resolved: ReportConfigResolved,
  user: User,
  embeds: EmbedBuilder[],
) {
  const { reportID } = await prisma.userReport.create({
    select: {
      reportID: true,
    },
    data: {
      guildID: resolved.config.guildID,
      userID: user.id,
    },
  })

  const idPrefix = `${REPORT}:${reportID}`

  const row = new ActionRowBuilder<ButtonBuilder>().addComponents([
    new ButtonBuilder()
      .setCustomId(`${idPrefix}:reply`)
      .setEmoji('📝')
      .setLabel('Reply')
      .setStyle(ButtonStyle.Primary),
    createBlockButton(reportID),
  ])

  const actionLog = new EmbedBuilder()
    .setColor(Colors.DarkGold)
    .setTitle('Action Log')

  return resolved.reportChannel.send({
    content: resolved.config.message,
    embeds: [...embeds, actionLog],
    components: [row],
  })
}

export async function handleReportButtonInteraction(interaction: Interaction) {
  if (!interaction.isButton()) {
    return
  }

  const [cid, reportID, command] = interaction.customId.split(':')

  if (cid !== REPORT) {
    return
  }

  if (!interaction.inGuild()) {
    await interaction.reply({
      content: 'You can only use report buttons in servers.',
      flags: MessageFlags.Ephemeral,
    })
    return
  }

  const report = await prisma.userReport.findUnique({
    where: {
      reportID,
    },
  })

  if (!report || report.guildID !== interaction.guildId) {
    await interaction.reply({
      content: 'That report does not exist.',
      flags: MessageFlags.Ephemeral,
    })
    return
  }

  const user = await interaction.client.users
    .fetch(report.userID)
    .catch(() => null)

  if (!user) {
    await interaction.reply({
      content: 'That user is invalid or does not exist.',
      flags: MessageFlags.Ephemeral,
    })
    return
  }

  switch (command) {
    case 'reply':
      return replyToReport(interaction, report, user)

    case 'block':
      return blockReportUser(interaction, report, user)

    case 'unblock':
      return unblockReportUser(interaction, report, user)

    default:
      return interaction.reply({
        content: 'Somehow you sent an invalid command. Good job.',
        flags: MessageFlags.Ephemeral,
      })
  }
}

async function replyToReport(
  interaction: ButtonInteraction,
  report: UserReport,
  user: User,
) {
  const originalMessage = interaction.message
  const customId = `report:${report.reportID}:reply_prompt:${interaction.id}`

  const messageInput = new TextInputBuilder()
    .setCustomId('message')
    .setLabel('Message')
    .setRequired(true)
    .setPlaceholder('Message to send to the user')
    .setMaxLength(2048)
    .setStyle(TextInputStyle.Paragraph)

  const messageRow =
    new ActionRowBuilder<ModalActionRowComponentBuilder>().addComponents(
      messageInput,
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
    .setTitle('Reply to Report')
    .addComponents([messageRow, isAnonRow])

  await interaction.showModal(modal)
  const modalInteraction = await interaction
    .awaitModalSubmit({
      filter: (i) => i.customId === customId,
      time: 30 * MINUTE,
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

  const defer = modalInteraction.deferReply()

  const message = modalInteraction.fields.getTextInputValue('message')
  const isAnonString =
    modalInteraction.fields.getTextInputValue('anon') || 'yes'
  const isAnon = isAnonString.toLowerCase() === 'yes'

  const guild = await getGuild(interaction, true)

  const footer: EmbedFooterOptions = {
    text: `Reply from ${
      isAnon
        ? guild.name
        : formatUser(interaction.user, {
            markdown: false,
            escapeMarkdown: false,
          })
    }`,
  }

  const guildIcon = guild.iconURL()

  const footerIcon = isAnon ? guildIcon : interaction.user.displayAvatarURL()

  if (footerIcon) {
    footer.iconURL = footerIcon
  }

  const author: EmbedAuthorOptions = {
    name: `Guild: ${guild.name}`,
  }

  if (guildIcon) {
    author.iconURL = guildIcon
  }

  const embed = new EmbedBuilder()
    .setAuthor(author)
    .setTitle('Report Reply')
    .setDescription(message)
    .setFooter(footer)
    .setColor(Colors.Blurple)

  const originalReportEmbeds = interaction.message.embeds.slice(0, -1)

  try {
    await user.send({
      content: 'You have received a reply to your report:',
      embeds: [...originalReportEmbeds, embed],
    })
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)

    await defer
    return modalInteraction.editReply({
      content: `Failed to send reply to user.\n${codeBlock('js', msg)}`,
    })
  }

  await defer
  const reply = await modalInteraction.editReply({
    content: "Sent reply to user! Here's a copy of the reply:",
    embeds: [embed],
  })

  const newLog = `${interaction.user} ${hyperlink('Replied', reply.url)}`

  const actionLog = new EmbedBuilder(originalMessage.embeds.at(-1)?.data)

  actionLog.setDescription(
    `${actionLog.data.description ?? ''}\n${newLog}`.trim(),
  )

  return originalMessage.edit({
    embeds: [...originalMessage.embeds.slice(0, -1), actionLog],
  })
}

async function blockReportUser(
  interaction: ButtonInteraction,
  report: UserReport,
  user: User,
) {
  const guild = await getGuild(interaction, true)
  const originalMessage = interaction.message

  const previousBlock = await prisma.reportBan.findUnique({
    where: {
      guildID_userID: {
        guildID: guild.id,
        userID: user.id,
      },
    },
  })

  if (previousBlock) {
    const newComponents = changeBlockButtonTo(
      'unblock',
      report.reportID,
      originalMessage.components,
    )

    originalMessage
      .edit({
        components: newComponents,
      })
      .catch(() => {
        /* ignore */
      })

    return interaction.reply({
      content: 'This user is already blocked from reporting.',
      flags: MessageFlags.Ephemeral,
    })
  }

  const customId = `report:${report.reportID}:block_prompt:${interaction.id}`

  const reasonInput = new TextInputBuilder()
    .setCustomId('reason')
    .setLabel('Reason')
    .setRequired(true)
    .setPlaceholder('Why are you blocking this user?')
    .setMaxLength(2048)
    .setStyle(TextInputStyle.Paragraph)

  const messageRow =
    new ActionRowBuilder<ModalActionRowComponentBuilder>().addComponents(
      reasonInput,
    )

  const modal = new ModalBuilder()
    .setCustomId(customId)
    .setTitle('Block User From Reporting')
    .addComponents([messageRow])

  await interaction.showModal(modal)

  const modalInteraction = await interaction
    .awaitModalSubmit({
      filter: (i) => i.customId === customId,
      time: 30 * MINUTE,
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

  await prisma.reportBan.create({
    data: {
      guildID: guild.id,
      userID: user.id,
      reason,
      moderator: interaction.user.id,
    },
  })

  const response = await modalInteraction.reply({
    content: `Blocked user from reporting. Reason:\n${blockQuote(reason)}`,
    withResponse: true,
  })

  const url = responseMessageLink(interaction, response)
  const newLog = `${interaction.user} ${hyperlink('Blocked the user', url)}`
  const actionLog = new EmbedBuilder(originalMessage.embeds.at(-1)?.data)

  actionLog.setDescription(
    `${actionLog.data.description ?? ''}\n${newLog}`.trim(),
  )

  const newComponents = changeBlockButtonTo(
    'unblock',
    report.reportID,
    originalMessage.components,
  )

  return originalMessage.edit({
    embeds: [...originalMessage.embeds.slice(0, -1), actionLog],
    components: newComponents,
  })
}

async function unblockReportUser(
  interaction: ButtonInteraction,
  report: UserReport,
  user: User,
) {
  const guild = await getGuild(interaction, true)
  const originalMessage = interaction.message

  const previousBlock = await prisma.reportBan.findUnique({
    where: {
      guildID_userID: {
        guildID: guild.id,
        userID: user.id,
      },
    },
  })

  if (!previousBlock) {
    const newComponents = changeBlockButtonTo(
      'block',
      report.reportID,
      originalMessage.components,
    )

    originalMessage
      .edit({
        components: newComponents,
      })
      .catch(() => {
        /* ignore */
      })

    return interaction.reply({
      content: 'This user is not blocked from reporting.',
      flags: MessageFlags.Ephemeral,
    })
  }

  await prisma.reportBan.delete({
    where: {
      guildID_userID: {
        guildID: guild.id,
        userID: user.id,
      },
    },
  })

  const reply = await interaction.reply({
    content: 'Unblocked user, they can report again.',
    fetchReply: true,
  })

  const newLog = `${interaction.user} ${hyperlink(
    'Unblocked the user',
    reply.url,
  )}`

  const actionLog = new EmbedBuilder(originalMessage.embeds.at(-1)?.data)

  actionLog.setDescription(
    `${actionLog.data.description ?? ''}\n${newLog}`.trim(),
  )

  const newComponents = changeBlockButtonTo(
    'block',
    report.reportID,
    originalMessage.components,
  )

  return originalMessage.edit({
    embeds: [...originalMessage.embeds.slice(0, -1), actionLog],
    components: newComponents,
  })
}

/**
 * Changes the block (or unblock) button(s) in a set of components to a specific desired state.
 *
 * ie. when called with `to: 'block'` it will change all `unblock` buttons to `block` buttons and vice versa
 * @param to What to change the (un)block button to
 * @param reportID The report ID related to the button
 * @param from The components to change
 * @returns A new set of components with the (un)block button changed
 */
function changeBlockButtonTo(
  to: 'block' | 'unblock',
  reportID: string,
  from: ActionRow<MessageActionRowComponent>[],
): ActionRowBuilder<ButtonBuilder>[] {
  const newButton =
    to === 'block' ? createBlockButton(reportID) : createUnblockButton(reportID)
  const oldCommand = to === 'block' ? ':unblock' : ':block'

  return from.map((row) =>
    new ActionRowBuilder<ButtonBuilder>().addComponents(
      row.components
        .map((component) =>
          component.customId?.endsWith(oldCommand) &&
          component.type === ComponentType.Button
            ? newButton
            : component.data.type === ComponentType.Button
              ? new ButtonBuilder(component.data)
              : null,
        )
        .filter(notNullish),
    ),
  )
}
