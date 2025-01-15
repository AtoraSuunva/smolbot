import type { ActionLog } from '@prisma/client'
import {
  type APIEmbedField,
  ActionRowBuilder,
  ApplicationCommandOptionType,
  ButtonBuilder,
  ButtonStyle,
  type ChatInputCommandInteraction,
  EmbedBuilder,
  type Guild,
  type InteractionEditReplyOptions,
  MessageFlags,
  StringSelectMenuBuilder,
} from 'discord.js'
import { SleetSlashSubcommand, getGuild } from 'sleetcord'
import { MINUTE } from 'sleetcord-common'
import { prisma } from '../../util/db.js'
import { updateActionLog } from './reason.js'
import { type ActionLogEntry, formatToLog } from './utils.js'

export const actionlog_history = new SleetSlashSubcommand(
  {
    name: 'history',
    description: 'View the history of an action',
    options: [
      {
        name: 'action_id',
        description: 'The ID of the action to view',
        type: ApplicationCommandOptionType.Integer,
        required: true,
      },
    ],
  },
  {
    run: actionlogHistoryRun,
  },
)

const MAX_PER_PAGE = 5
const BUTTON_NEXT = 'actionlog:paginated:next'
const BUTTON_PREV = 'actionlog:paginated:prev'
const SELECT_REVERT = 'actionlog:paginated:revert'

async function actionlogHistoryRun(interaction: ChatInputCommandInteraction) {
  const guild = await getGuild(interaction, true)
  const actionID = interaction.options.getInteger('action_id', true)

  await interaction.deferReply()

  let currentPage = 1

  const renderPage = async (
    page: number,
  ): Promise<InteractionEditReplyOptions> => {
    const currentPageData = await fetchPaginatedActionHistory(
      guild.id,
      actionID,
      page,
    )

    if (currentPageData.actions.length === 0) {
      return {
        content: `Action #${actionID} not found`,
      }
    }

    const { actions } = currentPageData
    const totalPages = Math.ceil(currentPageData.total / MAX_PER_PAGE)

    const currentEmbed = new EmbedBuilder()
    currentEmbed
      .setTitle('Action History')
      .setFields(await formatPageToFields(guild, actions))
      .setFooter({
        text: `Page ${page}/${totalPages}`,
      })

    const buttonRow = new ActionRowBuilder<ButtonBuilder>().addComponents([
      new ButtonBuilder()
        .setCustomId(BUTTON_PREV)
        .setLabel('Prev')
        .setStyle(ButtonStyle.Primary)
        .setDisabled(page <= 1),
      new ButtonBuilder()
        .setCustomId(BUTTON_NEXT)
        .setLabel('Next')
        .setStyle(ButtonStyle.Primary)
        .setDisabled(page >= totalPages),
    ])

    const selectRow =
      new ActionRowBuilder<StringSelectMenuBuilder>().addComponents([
        new StringSelectMenuBuilder()
          .setCustomId(SELECT_REVERT)
          .setPlaceholder('Revert to version')
          .addOptions(
            actions.map((al) => ({
              label: `Revert to version #${al.version}`,
              value: `${al.version}`,
            })),
          ),
      ])

    return {
      embeds: [currentEmbed],
      components: [buttonRow, selectRow],
    }
  }

  const reply = await renderPage(currentPage)
  const message = await interaction.editReply(reply)

  const collector = message.createMessageComponentCollector({
    time: MINUTE * 20, // Always stop after 20 minutes
    idle: MINUTE * 5, // Stop if there's been no interaction in 5 minutes
  })

  collector.on('collect', async (componentInteraction) => {
    if (componentInteraction.user.id !== interaction.user.id) {
      await componentInteraction.reply({
        content: 'Only the user who searched can use this button',
        flags: MessageFlags.Ephemeral,
      })
      return
    }

    if (componentInteraction.isButton()) {
      if (componentInteraction.customId === BUTTON_PREV) {
        currentPage--
      } else if (componentInteraction.customId === BUTTON_NEXT) {
        currentPage++
      }

      const res = await renderPage(currentPage)
      await componentInteraction.update(res)
    } else if (
      componentInteraction.isStringSelectMenu() &&
      componentInteraction.customId === SELECT_REVERT
    ) {
      const version = Number.parseInt(componentInteraction.values[0])

      const action = await prisma.actionLog.findFirst({
        where: {
          guildID: guild.id,
          actionID,
          version,
        },
      })

      if (!action) {
        await componentInteraction.reply({
          content: `Action #${actionID} version ${version} not found`,
          flags: MessageFlags.Ephemeral,
        })
        return
      }

      // Update version
      await updateActionLog(guild.id, action)

      // Update message
      if (action.messageID) {
        const channel = guild.channels.cache.get(action.channelID)

        if (channel?.isTextBased()) {
          await channel.messages
            .edit(action.messageID, {
              content: await formatToLog({
                id: action.actionID,
                version: action.version,
                action: action.action as ActionLogEntry['action'],
                user: action.userID
                  ? await guild.client.users.fetch(action.userID)
                  : null,
                redactUser: action.redactUser,
                reason: action.reason,
                reasonBy: action.reasonByID
                  ? await guild.client.users.fetch(action.reasonByID)
                  : null,
                responsibleModerator: action.moderatorID
                  ? await guild.client.users.fetch(action.moderatorID)
                  : null,
                createdAt: action.createdAt,
              }),
              allowedMentions: {
                parse: [],
              },
            })
            .catch(() => {
              // ignore
            })
        }
      }

      // Re-render the page
      currentPage = 1
      const res = await renderPage(currentPage)
      await componentInteraction.update(res)
    }
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

interface PaginatedActions {
  actions: ActionLog[]
  total: number
}

async function fetchPaginatedActionHistory(
  guildID: string,
  actionID: number,
  page: number,
): Promise<PaginatedActions> {
  const total = await prisma.actionLog.count({
    where: {
      guildID,
      actionID,
    },
  })

  const actions = await prisma.actionLog.findMany({
    where: {
      guildID,
      actionID,
    },
    orderBy: {
      version: 'desc',
    },
    skip: (page - 1) * MAX_PER_PAGE,
    take: MAX_PER_PAGE,
  })

  return {
    actions,
    total,
  }
}

async function formatPageToFields(
  guild: Guild,
  actionLogs: ActionLog[],
): Promise<APIEmbedField[]> {
  // TODO: some way to detect when the output would be too long and split it
  // but how? and how to do it without breaking pagination?
  return Promise.all(
    (
      await Promise.all(
        actionLogs.map(
          async (al): Promise<ActionLogEntry> => ({
            id: al.actionID,
            version: al.version,
            action: al.action as ActionLogEntry['action'],
            user: al.userID ? await guild.client.users.fetch(al.userID) : null,
            redactUser: al.redactUser,
            reason: al.reason,
            reasonBy: al.reasonByID
              ? await guild.client.users.fetch(al.reasonByID)
              : null,
            responsibleModerator: al.moderatorID
              ? await guild.client.users.fetch(al.moderatorID)
              : null,
            createdAt: al.createdAt,
          }),
        ),
      )
    ).map(async (al) => ({
      name: `Version #${al.version}`,
      value: await formatToLog(al, {
        reason: true,
        reasonBy: true,
      }),
    })),
  )
}
