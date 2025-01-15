import type { WarningConfig } from '@prisma/client'
import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  type CommandInteraction,
  ComponentType,
  type EmbedAuthorOptions,
  EmbedBuilder,
  type InteractionEditReplyOptions,
  MessageFlags,
} from 'discord.js'
import { getGuild } from 'sleetcord'
import { MINUTE } from 'sleetcord-common'
import { plural } from '../../util/format.js'
import {
  MAX_PER_PAGE,
  type PaginatedWarnings,
  fetchWarningConfigFor,
  formatWarningToField,
} from './utils.js'

export type WarningFetcher = (
  guildID: string,
  config: WarningConfig,
  currentPage: number,
) => Promise<PaginatedWarnings>

export type FormatAuthor = (
  result: PaginatedWarnings,
) => EmbedAuthorOptions | null
export type FormatTitle = (result: PaginatedWarnings) => string | null
export type FormatDescription = (result: PaginatedWarnings) => string | null

export interface RespondWithPaginationOptions {
  formatAuthor?: FormatAuthor
  formatTitle?: FormatTitle
  formatDescription?: FormatDescription
  modView?: boolean
  showUserOnWarning?: boolean
  ephemeral?: boolean
}

function defaultFormatAuthor(): EmbedAuthorOptions | null {
  return null
}

function defaultFormatTitle(result: PaginatedWarnings): string | null {
  const { total: warnings, expired, voided } = result.counts

  const expiredString =
    expired > 0 ? `, **${expired.toLocaleString()}** expired` : ''

  const voidedString = voided > 0 ? `, **${voided.toLocaleString()}** void` : ''

  return `${plural('warning', warnings)}${expiredString}${voidedString}`
}

function defaultFormatDescription(): string | null {
  return null
}

export async function respondWithPaginatedWarnings(
  interaction: CommandInteraction,
  fetchWarnings: WarningFetcher,
  options: RespondWithPaginationOptions = {},
) {
  const {
    formatAuthor = defaultFormatAuthor,
    formatTitle = defaultFormatTitle,
    formatDescription = defaultFormatDescription,
    modView = false,
    showUserOnWarning = false,
    ephemeral = false,
  } = options

  if (!interaction.deferred) {
    await interaction.deferReply({ ephemeral })
  }

  const guild = await getGuild(interaction, true)
  const config = await fetchWarningConfigFor(guild.id, true)
  let currentPage = 1

  async function searchPages(
    page: number,
  ): Promise<InteractionEditReplyOptions> {
    const res = await fetchWarnings(guild.id, config, currentPage)
    const totalPages = Math.ceil(res.counts.total / MAX_PER_PAGE)

    const row = new ActionRowBuilder<ButtonBuilder>().addComponents([
      new ButtonBuilder()
        .setCustomId('warnings:paginated:prev')
        .setLabel('Prev')
        .setStyle(ButtonStyle.Primary)
        .setDisabled(page === 1),
      new ButtonBuilder()
        .setCustomId('warnings:paginated:next')
        .setLabel('Next')
        .setStyle(ButtonStyle.Primary)
        .setDisabled(page === totalPages),
    ])

    const embed = new EmbedBuilder()
      .setAuthor(formatAuthor(res))
      .setTitle(formatTitle(res))
      .setDescription(formatDescription(res))
      .addFields(
        res.warnings.map((w) =>
          formatWarningToField(w, config, {
            showUserOnWarning,
            showModNote: modView,
            showResponsibleMod: modView,
            showVersion: modView,
          }),
        ),
      )
      .setFooter({
        text: totalPages > 0 ? `Page ${page} of ${totalPages}` : 'No results',
      })

    return {
      embeds: [embed],
      components: totalPages > 1 ? [row] : [],
    }
  }

  const reply = await searchPages(currentPage)
  const message = await interaction.editReply(reply)

  const collector = message.createMessageComponentCollector({
    componentType: ComponentType.Button,
    time: MINUTE * 20, // Always stop after 20 minutes
    idle: MINUTE * 5, // Stop if there's been no interaction in 5 minutes
  })

  collector.on('collect', async (buttonInteraction) => {
    if (buttonInteraction.user.id !== interaction.user.id) {
      await buttonInteraction.reply({
        content: 'Only the user who searched can use this button',
        flags: MessageFlags.Ephemeral,
      })
      return
    }

    if (buttonInteraction.customId === 'warnings:paginated:prev') {
      currentPage--
    } else if (buttonInteraction.customId === 'warnings:paginated:next') {
      currentPage++
    }

    const res = await searchPages(currentPage)
    await buttonInteraction.update(res)
  })

  collector.on('end', (_, reason) => {
    if (reason !== 'messageDelete') {
      interaction
        .editReply({
          components: [],
        })
        .catch(() => {
          /* ignore */
        })
    }
  })
}
