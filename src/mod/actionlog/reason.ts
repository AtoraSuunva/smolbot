import type { ActionLog, ActionLogConfig } from '@prisma/client'
import {
  ApplicationCommandOptionType,
  ApplicationIntegrationType,
  type ChatInputCommandInteraction,
  type Guild,
  InteractionContextType,
  MessageFlags,
  type User,
} from 'discord.js'
import {
  type AutocompleteHandler,
  SleetSlashCommand,
  formatUser,
  getGuild,
} from 'sleetcord'
import { prisma } from '../../util/db.js'
import { capitalize, plural } from '../../util/format.js'
import { sleep } from '../../util/functions.js'
import {
  type ActionLogEntry,
  collapseSequence,
  fetchActionLogConfigFor,
  formatToLog,
  markActionlogArchiveDirty,
  resolveIDs,
} from './utils.js'

const MAX_IDS = 50

const actionIDAutocomplete: AutocompleteHandler<string> = async ({
  interaction,
  value,
}) => {
  const { guild, client } = interaction

  if (!guild) {
    return []
  }

  try {
    if (value === '') {
      const latestActions = await prisma.actionLog.findMany({
        where: {
          guildID: guild.id,
          validUntil: null,
        },
        orderBy: {
          actionID: 'desc',
        },
        take: 5,
      })

      return (
        await Promise.all(
          latestActions.map(async (action) => ({
            name: `#${action.actionID} [${capitalize(action.action)}] — ${
              action.userID
                ? formatUser(await client.users.fetch(action.userID), {
                    markdown: false,
                    mention: false,
                    escapeMarkdown: false,
                  })
                : 'unknown user'
            }`.slice(0, 100),
            value: action.actionID.toString(),
          })),
        )
      ).filter((option) => option.value.length <= 100)
    }

    const ids = await resolveIDs(guild, value, MAX_IDS)

    if (ids.length > MAX_IDS) {
      return [
        {
          name: `Too many IDs to reason at once, try <= ${MAX_IDS}`,
          value: '',
        },
      ]
    }

    const collapsed = collapseSequence(ids)

    if (collapsed.length > 100) {
      return [
        {
          name: 'Result is too long to display!',
          value: '',
        },
      ]
    }

    return [
      {
        name: collapsed,
        value: collapsed,
      },
    ]
  } catch (error) {
    return []
  }
}

export const actionReason = new SleetSlashCommand(
  {
    name: 'reason',
    description: 'Reason an action',
    contexts: [InteractionContextType.Guild],
    integration_types: [ApplicationIntegrationType.GuildInstall],
    default_member_permissions: [
      'BanMembers',
      'KickMembers',
      'ModerateMembers',
    ],
    options: [
      {
        name: 'action_id',
        type: ApplicationCommandOptionType.String,
        description: 'The ID of the action to edit',
        autocomplete: actionIDAutocomplete,
        required: true,
      },
      {
        name: 'reason',
        type: ApplicationCommandOptionType.String,
        description: 'The reason for the action',
        max_length: 1500,
      },
      {
        name: 'redact_username',
        type: ApplicationCommandOptionType.Boolean,
        description:
          'Redact the username from the log (e.g. if they have a slur), preserves ID (default: False)',
      },
      {
        name: 'repost',
        type: ApplicationCommandOptionType.Boolean,
        description:
          'Ignore all changes, instead only re-edit or re-post the latest version (default: False)',
      },
      {
        name: 'ephemeral',
        type: ApplicationCommandOptionType.Boolean,
        description: 'Only show the result to you (default: False)',
      },
    ],
  },
  {
    run: reasonRun,
  },
)

async function reasonRun(interaction: ChatInputCommandInteraction) {
  const guild = await getGuild(interaction, true)

  const actionString = interaction.options.getString('action_id', true)
  const reason = interaction.options.getString('reason')?.trim() ?? null
  const redactUser = interaction.options.getBoolean('redact_username')
  const repost = interaction.options.getBoolean('repost')
  const ephemeral = interaction.options.getBoolean('ephemeral') ?? false

  if (reason === null && redactUser === null && repost === null) {
    await interaction.reply({
      content: 'You did not provide any changes to make, so nothing was done',
      flags: MessageFlags.Ephemeral,
    })
    return
  }

  await interaction.deferReply({
    flags: ephemeral ? MessageFlags.Ephemeral : '0',
  })

  let actionIDs: number[]

  try {
    actionIDs = await resolveIDs(guild, actionString, MAX_IDS)
  } catch (err) {
    await interaction.editReply({
      content: `Failed to parse action ID: ${err}`,
    })
    return
  }

  if (actionIDs.length === 0) {
    await interaction.editReply({
      content: 'No actions to update found',
    })
    return
  }

  const config = await fetchActionLogConfigFor(guild.id, true)

  const results: EditActionLog[] = []

  for (const id of actionIDs) {
    results.push(
      await editAction(
        guild,
        config,
        id,
        reason,
        redactUser,
        repost,
        interaction.user,
      ),
    )
    if (results.length !== actionIDs.length) {
      // Add a small delay before doing the next one to avoid ratelimiting as hard
      await sleep(250)
    }
  }

  if (results.length === 0) {
    await interaction.editReply({
      content: 'Somehow, nothing managed to be updated',
    })
    return
  }

  const log: string[] = []
  const successes = results.filter((result) => result.success)

  if (successes.length > 0) {
    const formattedAction =
      successes.length === 1
        ? `action #${successes[0].id}`
        : plural('action', successes.length)

    if (repost) {
      log.push(`Reposted ${formattedAction}`)
    } else if (reason) {
      log.push(
        `Changed reason for ${formattedAction} to${formatReason(reason)}`,
      )
    } else {
      log.push(`Updated ${formattedAction}`)
    }
    await markActionlogArchiveDirty(guild.id)
  }

  const failures = results.length - successes.length

  if (failures > 0) {
    log.push(
      `Failed to update ${plural('action', failures)}:\n> ${results
        .filter((result): result is EditActionLogFailure => !result.success)
        .map((result) => `**${result.id}**: ${result.message}`)
        .join('\n> ')}`,
    )
  }

  const formattedContent = log.join('\n\n')
  let content = formattedContent
  const files = []

  if (formattedContent.length > 2000) {
    content = 'See attached file for update log'
    files.push({
      name: 'update-log.txt',
      attachment: Buffer.from(formattedContent),
    })
  }

  await interaction.editReply({
    content,
    files,
    allowedMentions: { parse: [] },
  })
}

function formatReason(reason: string): string {
  if (reason.includes('\n')) {
    return `:\n> ${reason.replace(/\n/g, '\n> ')}`
  }

  return ` "${reason}"`
}

interface EditActionLogSuccess {
  id: number
  success: true
}

interface EditActionLogFailure {
  id: number
  success: false
  message: string
}

type EditActionLog = EditActionLogSuccess | EditActionLogFailure

async function editAction(
  guild: Guild,
  config: ActionLogConfig,
  actionID: number,
  reason: string | null,
  redactUser: boolean | null,
  repost: boolean | null,
  reasonBy: User,
): Promise<EditActionLog> {
  const oldAction = await prisma.actionLog.findFirst({
    where: {
      guildID: guild.id,
      actionID,
      validUntil: null,
    },
  })

  if (!oldAction) {
    return {
      id: actionID,
      success: false,
      message: 'This action does not exist',
    }
  }

  const mergedAction: ActionLog = repost
    ? oldAction
    : {
        action: oldAction.action,
        guildID: guild.id,
        actionID: actionID,
        version: oldAction.version,
        userID: oldAction.userID,
        redactUser: redactUser ?? oldAction.redactUser,
        reason: reason ?? oldAction.reason,
        reasonByID: reason ? reasonBy.id : oldAction.reasonByID,
        moderatorID: oldAction.moderatorID ?? reasonBy.id,
        channelID: oldAction.channelID,
        messageID: oldAction.messageID,
        createdAt: oldAction.createdAt,
        validUntil: null,
      }

  if (!repost) {
    await updateActionLog(guild.id, mergedAction)
  }

  const entry: ActionLogEntry = {
    id: oldAction.actionID,
    action: mergedAction.action as ActionLogEntry['action'],
    user: mergedAction.userID
      ? await guild.client.users.fetch(mergedAction.userID)
      : null,
    reason: mergedAction.reason,
    redactUser: mergedAction.redactUser,
    reasonBy: mergedAction.reasonByID
      ? await guild.client.users.fetch(mergedAction.reasonByID)
      : null,
    responsibleModerator: mergedAction.moderatorID
      ? await guild.client.users.fetch(mergedAction.moderatorID)
      : null,
    createdAt: mergedAction.createdAt,
  }

  const sendMessage = async (): Promise<EditActionLog> => {
    if (config.logChannelID === null) {
      // If there is no log channel, we can't do anything
      return {
        id: actionID,
        success: false,
        message: 'This action was not logged and no log channel is configured',
      }
    }

    const logChannel = guild.channels.cache.get(config.logChannelID)

    if (!logChannel?.isTextBased()) {
      return {
        id: actionID,
        success: false,
        message: 'The log channel is not a text channel',
      }
    }

    const log = await formatToLog(entry)

    try {
      await logChannel
        .send({
          content: log,
          allowedMentions: {
            parse: [],
          },
        })
        .then((message) =>
          prisma.actionLog.update({
            where: {
              guildID_actionID_version: {
                guildID: guild.id,
                actionID: oldAction.actionID,
                version: oldAction.version + (repost ? 0 : 1),
              },
            },
            data: {
              messageID: message.id,
            },
          }),
        )
    } catch (e) {
      return {
        id: actionID,
        success: false,
        message: `Failed to log action to channel: ${e}`,
      }
    }

    return {
      id: actionID,
      success: true,
    }
  }

  if (oldAction.messageID === null) {
    // Either wasn't logged before or failed to log
    // In which case we should create a new log
    return await sendMessage()
  }

  const channel = guild.channels.cache.get(oldAction.channelID)

  if (!channel?.isTextBased()) {
    return {
      id: actionID,
      success: false,
      message:
        'The channel this action was logged to seems to have been deleted, or is not a text channel',
    }
  }

  if (
    guild.members.me &&
    !channel.permissionsFor(guild.members.me).has('SendMessages')
  ) {
    return {
      id: actionID,
      success: false,
      message:
        'I do not have permission to send messages in the channel this action was logged to',
    }
  }

  try {
    await channel.messages.edit(oldAction.messageID, {
      content: await formatToLog(entry),
      allowedMentions: {
        parse: [],
      },
    })
  } catch (e) {
    try {
      // If we failed to edit the message, try sending a new one
      return await sendMessage()
    } catch (e2) {
      return {
        id: actionID,
        success: false,
        message: `Failed to edit message or send a new one: [${e}] + [${e2}]`,
      }
    }
  }

  return {
    id: actionID,
    success: true,
  }
}

/**
 * Create a new action version by marking the old ones as all now invalid and creating a new one that's valid
 *
 * The newly inserted action automatically has a version 1 greater than the latest
 * @param guildID The guild ID that the action belongs to
 * @param newAction The new action to create
 * @returns The newly created action entry
 */
export async function updateActionLog(
  guildID: string,
  newAction: ActionLog,
): Promise<ActionLog> {
  // Transaction since we shouldn't be able to mark the old log as expired while erroring on the new log
  return await prisma.$transaction(async (tx) => {
    // Mark the old action as having expired just now
    await tx.actionLog.updateMany({
      where: {
        guildID,
        actionID: newAction.actionID,
        validUntil: null,
      },
      data: {
        validUntil: new Date(),
      },
    })

    // Get the latest version number
    const latestVersion = await tx.actionLog.findFirst({
      where: {
        guildID,
        actionID: newAction.actionID,
      },
      select: {
        version: true,
      },
      orderBy: {
        version: 'desc',
      },
    })

    const latestNumber = (latestVersion?.version ?? 0) + 1

    // Then make the new action
    return tx.actionLog.create({
      data: {
        ...newAction,
        version: latestNumber,
      },
    })
  })
}
