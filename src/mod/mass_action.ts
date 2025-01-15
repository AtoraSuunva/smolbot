import {
  type APIApplicationCommandOption,
  ApplicationCommandOptionType,
  ApplicationIntegrationType,
  type Attachment,
  type AttachmentPayload,
  type ChatInputCommandInteraction,
  type CommandInteraction,
  type Guild,
  GuildMember,
  InteractionContextType,
  MessageFlags,
  User,
  codeBlock,
} from 'discord.js'
import {
  SleetSlashCommand,
  formatUser,
  getAllIDs,
  getGuild,
  inGuildGuard,
  isLikelyID,
  partitionArray,
} from 'sleetcord'
import { DAY, SECOND } from 'sleetcord-common'
import { capitalize, plural } from '../util/format.js'

const commonOptions: APIApplicationCommandOption[] = [
  {
    name: 'users',
    description: 'The users to action, space-separated user IDs or mentions',
    type: ApplicationCommandOptionType.String,
  },
  {
    name: 'users_file',
    description:
      'A text file containing a list of user IDs to action, newline- and/or space-separated',
    type: ApplicationCommandOptionType.Attachment,
  },
  {
    name: 'id_only',
    description:
      "Output only user IDs, don't include resolved display names/usernames (default: false)",
    type: ApplicationCommandOptionType.Boolean,
  },
]

const reasonOption: APIApplicationCommandOption = {
  name: 'reason',
  description: 'The reason for the action',
  type: ApplicationCommandOptionType.String,
}

export const mass_ban = new SleetSlashCommand(
  {
    name: 'mass_ban',
    description:
      'Mass ban a list of users, can ban only users in-guild or ban everyone on the list',
    default_member_permissions: ['BanMembers'],
    contexts: [InteractionContextType.Guild],
    integration_types: [ApplicationIntegrationType.GuildInstall],
    options: [
      ...commonOptions,
      reasonOption,
      {
        name: 'delete_days',
        description: 'The number of days of messages to delete (default: 0)',
        type: ApplicationCommandOptionType.Integer,
        min_value: 0,
        max_value: 7,
      },
      {
        name: 'force_ban',
        description:
          'Force ban users even if they are not in the guild (default: True)',
        type: ApplicationCommandOptionType.Boolean,
      },
    ],
  },
  {
    run: runMassBan,
  },
)

export const mass_kick = new SleetSlashCommand(
  {
    name: 'mass_kick',
    description: 'Mass kick a list of users',
    default_member_permissions: ['KickMembers'],
    contexts: [InteractionContextType.Guild],
    integration_types: [ApplicationIntegrationType.GuildInstall],
    options: [...commonOptions, reasonOption],
  },
  {
    run: runMassKick,
  },
)

export const mass_find = new SleetSlashCommand(
  {
    name: 'mass_find',
    description: 'Check which users in a list are members of this guild',
    default_member_permissions: ['ModerateMembers'],
    contexts: [InteractionContextType.Guild],
    integration_types: [ApplicationIntegrationType.GuildInstall],
    options: commonOptions,
  },
  {
    run: runMassFind,
  },
)

export const mass_unban = new SleetSlashCommand(
  {
    name: 'mass_unban',
    description: 'Mass unban a list of users',
    default_member_permissions: ['BanMembers'],
    contexts: [InteractionContextType.Guild],
    integration_types: [ApplicationIntegrationType.GuildInstall],
    options: [...commonOptions, reasonOption],
  },
  {
    run: runMassUnban,
  },
)

export const mass_softban = new SleetSlashCommand(
  {
    name: 'mass_softban',
    description:
      'Softbans a user (ban + unban). Unbans + bans already-banned users. Useful to purge messages.',
    default_member_permissions: ['BanMembers'],
    contexts: [InteractionContextType.Guild],
    integration_types: [ApplicationIntegrationType.GuildInstall],
    options: [
      ...commonOptions,
      reasonOption,
      {
        name: 'delete_days',
        description: 'The number of days of messages to delete (default: 1)',
        type: ApplicationCommandOptionType.Integer,
        min_value: 0,
        max_value: 7,
      },
    ],
  },
  {
    run: runMassSoftban,
  },
)

/** Instead of outputting as a message, instead output as a file after this many successes/fails */
const OUTPUT_LIMIT = 15

type UserOrId = User | string

interface ActionFail {
  user: UserOrId
  reason: string
}

type ActionUser = (
  guild: Guild,
  user: User | string,
  reason: string,
) => Promise<string | User | GuildMember | undefined | null>

interface BulkActionResult {
  success: readonly UserOrId[]
  failure: readonly ActionFail[]
}

type BulkActionUsers = (
  guild: Guild,
  users: UserOrId[],
  reason: string,
) => Promise<BulkActionResult>

type CheckMember = (member: GuildMember) => boolean

enum UserType {
  Everyone = 0,
  MembersOnly = 1,
  NonMembersOnly = 2,
}

export const createMassBanOptions: (
  deleteMessageSeconds: number,
  forceBan: boolean,
) => ChatInputMassActionOptions = (deleteMessageSeconds, forceBan) => ({
  action: 'ban',
  actioned: 'banned',
  actionUser: (g, u, reason) =>
    g.bans.create(typeof u === 'string' ? u : u.id, {
      reason,
      deleteMessageSeconds,
    }),
  bulkActionUsers: async (g, users, reason) => {
    try {
      const { bannedUsers, failedUsers } = await g.bans.bulkCreate(users, {
        reason,
        deleteMessageSeconds,
      })

      return {
        success: bannedUsers,
        failure: failedUsers.map((fail) => ({
          user: fail,
          reason: 'Failed to bulk ban',
        })),
      }
    } catch (e: unknown) {
      return {
        success: [],
        failure: users.map((user) => ({
          user,
          reason: String(e),
        })),
      }
    }
  },
  bulkActionBatchSize: 200,
  checkMember: (m) => m.bannable,
  actionUserType: forceBan ? UserType.Everyone : UserType.MembersOnly,
})

async function runMassBan(interaction: ChatInputCommandInteraction) {
  const deleteDays = interaction.options.getInteger('delete_days') ?? 0
  const forceBan = interaction.options.getBoolean('force_ban') ?? true

  const deleteMessageSeconds = (deleteDays * DAY) / 1000

  await chatInputMassAction(
    interaction,
    createMassBanOptions(deleteMessageSeconds, forceBan),
  )
}

export const massKickOptions: ChatInputMassActionOptions = {
  action: 'kick',
  actioned: 'kicked',
  actionUser: (g, u, reason) =>
    g.members.kick(typeof u === 'string' ? u : u.id, reason),
  checkMember: (m) => m.kickable,
  actionUserType: UserType.MembersOnly,
}

async function runMassKick(interaction: ChatInputCommandInteraction) {
  await chatInputMassAction(interaction, massKickOptions)
}

export const massFindOptions: ChatInputMassActionOptions = {
  action: 'find',
  actioned: 'found',
  actionUser: async () => Promise.resolve(undefined),
  checkMember: () => true,
  actionUserType: UserType.MembersOnly,
  checkRoleHierarchy: false,
}

async function runMassFind(interaction: ChatInputCommandInteraction) {
  await chatInputMassAction(interaction, massFindOptions)
}

export const massUnbanOptions: ChatInputMassActionOptions = {
  action: 'unban',
  actioned: 'unbanned',
  actionUser: (g, u, reason) => g.members.unban(u, reason),
  checkMember: () => true,
  actionUserType: UserType.NonMembersOnly,
}

async function runMassUnban(interaction: ChatInputCommandInteraction) {
  await chatInputMassAction(interaction, massUnbanOptions)
}

export const createMassSoftbanOptions: (
  deleteMessageSeconds: number,
) => ChatInputMassActionOptions = (deleteMessageSeconds) => ({
  action: 'softban',
  actioned: 'softbanned',
  actionUser: async (g, u, reason) => {
    try {
      await g.members.unban(u, reason)
      // Success = they were banned before, just re-ban them
      return g.members.ban(u, {
        reason,
        deleteMessageSeconds,
      })
    } catch {
      // Failure = they weren't banned before, ban then unban them
      await g.members.ban(u, {
        reason,
        deleteMessageSeconds,
      })

      return g.members.unban(u, reason)
    }
  },
  checkMember: (m) => m.bannable,
  actionUserType: UserType.Everyone,
})

async function runMassSoftban(interaction: ChatInputCommandInteraction) {
  const deleteDays = interaction.options.getInteger('delete_days') ?? 1
  const deleteMessageSeconds = (deleteDays * DAY) / 1000

  await chatInputMassAction(
    interaction,
    createMassSoftbanOptions(deleteMessageSeconds),
  )
}

interface RunMassActionOptions {
  interaction: CommandInteraction
  /** Verb to describe the action: "Mass {action} by..." */
  action: string
  /** Past tense of the verb: "{actioned} user for" */
  actioned: string
  /** Function to apply the action on the user */
  actionUser: ActionUser
  /**
   * Optional function to bulk action users, if given it'll be used instead of action user for batches of users
   *
   * Useful for cases where Discord accepts bulk actions, like bans
   */
  bulkActionUsers?: BulkActionUsers
  /**
   * The number of users to action in a single batch, if bulkActionUsers is provided.
   *
   * bulkActionUsers will be called with up to, but not more, than this many users.
   *
   * @default 100
   */
  bulkActionBatchSize?: number
  /**
   * Check if the member can be actioned by the bot
   */
  checkMember: CheckMember
  /**
   * The type of users that should be actioned, can be everyone, members-only, or non-members only
   */
  actionUserType: UserType
  /**
   * If user roles should be checked, meaning that the actioned user must have a lower role than the interaction user
   *
   * @default true
   */
  checkRoleHierarchy?: boolean
  /**
   * User-provided reason to add
   *
   * @default 'No reason provided'
   */
  userReason?: string
  /**
   * Only output the user ID instead of full username + id
   *
   * @default false
   */
  idOnly?: boolean
  /**
   * The users to action, as a space separated list of IDs
   */
  users?: string | null
  /**
   * The users to action, as a space separated list of IDs in an attachment
   */
  usersFile?: Attachment | null
  /**
   * If responses should be ephemeral
   *
   * @default false
   */
  ephemeral?: boolean
}

type ChatInputMassActionOptions = Omit<
  RunMassActionOptions,
  'interaction' | 'userReason' | 'idOnly' | 'users' | 'usersFile'
>

function chatInputMassAction(
  interaction: ChatInputCommandInteraction,
  options: ChatInputMassActionOptions,
) {
  return runMassAction({
    ...options,
    interaction,
    userReason: interaction.options.getString('reason') ?? 'No reason provided',
    idOnly: interaction.options.getBoolean('id_only') ?? false,
    users: interaction.options.getString('users'),
    usersFile: interaction.options.getAttachment('users_file'),
  })
}

const MAX_MEMBER_FETCH = 100
const TIME_BETWEEN_PROGRESS_UPDATES = 5 * SECOND

export async function runMassAction({
  interaction,
  action,
  actioned,
  actionUser,
  bulkActionUsers,
  bulkActionBatchSize = 100,
  checkMember,
  actionUserType,
  checkRoleHierarchy = true,
  userReason = 'No reason provided',
  idOnly = false,
  users,
  usersFile,
  ephemeral = false,
}: RunMassActionOptions) {
  inGuildGuard(interaction)

  const guild = await getGuild(interaction, true)
  const reason = `${capitalize(action)} by ${formatUser(interaction.user, {
    markdown: false,
  })}: ${userReason}`

  if (!users && !usersFile) {
    if (interaction.deferred || interaction.replied) {
      await interaction.editReply({
        content:
          'You must provide either a list of users or a file of user IDs',
      })
    } else {
      await interaction.reply({
        flags: ephemeral ? MessageFlags.Ephemeral : '0',
        content:
          'You must provide either a list of users or a file of user IDs',
      })
    }
    return
  }

  if (!interaction.deferred && !interaction.replied) {
    await interaction.deferReply({
      flags: ephemeral ? MessageFlags.Ephemeral : '0',
    })
  }

  const userList: string[] = []

  if (users) {
    // There's an optimization here to use resolved members to avoid needing to fetch them
    // But it's a lot of added code complexity and fetching in batches of 100 is fast enough
    // If you absolutely push the limit you get around ~220 members that fit into a single string option
    // (This also lags your client if you paste it in)
    // Which is a perfectly workable amount of users to batch fetch in groups of 100 imo

    const rawIds = getAllIDs(users)
    const resolvedDataUsers =
      'options' in interaction
        ? (interaction.options.resolved?.users
            ?.filter((u) => users.includes(u.id) && !rawIds.includes(u.id))
            .map((u) => u.id) ?? [])
        : []

    userList.push(...rawIds, ...resolvedDataUsers)
  }

  if (usersFile) {
    if (!usersFile.contentType?.startsWith('text/plain')) {
      await interaction.editReply('User ID file must be a text file!')
      return
    }

    const req = await fetch(usersFile.url)

    if (!req.ok) {
      await interaction.editReply('Failed to download user ID file')
      return
    }

    const text = await req.text()
    const userIds = text.split(/\n\r?|\s+/)
    for (const id of userIds) {
      const trimmed = id.trim()
      if (isLikelyID(trimmed)) {
        userList.push(trimmed)
      }
    }
  }

  // Dedupe the list
  const uniqueUsers = Array.from(new Set(userList))

  if (uniqueUsers.length === 0) {
    await interaction.editReply('Found no valid users to action')
    return
  }

  let progress = 0
  const total = userList.length
  const success: UserOrId[] = []
  const failure: ActionFail[] = []

  const interactionMember = await guild.members.fetch(interaction.user.id)
  const isOwner = interactionMember.id === guild.ownerId
  // Make sure I'm fetched
  await guild.members.fetchMe()
  const userHighestRole = interactionMember.roles.highest

  const bulkActionBatch: UserOrId[] = []

  let lastProgressUpdate = Date.now()
  const updateProgress = async (immediate = false) => {
    if (
      !immediate &&
      Date.now() - lastProgressUpdate < TIME_BETWEEN_PROGRESS_UPDATES
    ) {
      return
    }

    await interaction.editReply(
      `Checking user ${progress.toLocaleString()}/${total.toLocaleString()} (${(
        (progress / total) * 100
      ).toFixed(
        2,
      )}%)\n${capitalize(actioned)} ${plural('user', success.length)} so far...${bulkActionBatch.length > 0 ? ` (${bulkActionBatch.length} queued)` : ''}`,
    )
    lastProgressUpdate = Date.now()
  }

  await updateProgress(true)

  // Then handle it in batches of 100
  for await (const batch of partitionArray(uniqueUsers, MAX_MEMBER_FETCH)) {
    const members = await guild.members.fetch({ user: batch })

    if (
      actionUserType === UserType.Everyone ||
      actionUserType === UserType.MembersOnly
    ) {
      for (const [, member] of members) {
        progress++
        await updateProgress()

        let fail: string | null = null

        if (!checkMember(member)) {
          fail = `I'm missing permissions to ${action} this user or they have a role higher or equal to me`
        } else if (
          checkRoleHierarchy &&
          !isOwner &&
          member.roles.highest.position >= userHighestRole.position
        ) {
          fail = `You cannot ${action} someone with a higher or equal role to you`
        }

        if (fail) {
          failure.push({
            user: member.user,
            reason: fail,
          })
          continue
        }

        if (bulkActionUsers) {
          bulkActionBatch.push(member.user)
          continue
        }

        try {
          await actionUser(guild, member.user, reason)
          success.push(member.user)
        } catch (e: unknown) {
          failure.push({
            user: member.user,
            reason: String(e),
          })
        }
      }
    }

    if (
      actionUserType === UserType.Everyone ||
      actionUserType === UserType.NonMembersOnly
    ) {
      // Check which users are left in the list that aren't members
      const remaining = batch.filter((id) => !members.has(id))

      if (bulkActionUsers) {
        bulkActionBatch.push(...remaining)
        progress += remaining.length
        await updateProgress()
      } else {
        for (const id of remaining) {
          try {
            const possibleUser = await actionUser(guild, id, reason)
            success.push(actionResultToUserOrId(possibleUser) ?? id)
          } catch (e: unknown) {
            failure.push({
              user: id,
              reason: String(e),
            })
          }

          progress++
          await updateProgress()
        }
      }
    }

    await updateProgress()

    // Check if we're at enough users to bulk action
    if (
      bulkActionUsers &&
      bulkActionBatch.length > 0 &&
      bulkActionBatch.length >= bulkActionBatchSize
    ) {
      const toActionBatch = bulkActionBatch.splice(0, bulkActionBatchSize)

      const { success: bulkSuccess, failure: bulkFailure } =
        await bulkActionUsers(guild, toActionBatch, reason)

      success.push(...bulkSuccess)
      failure.push(...bulkFailure)

      await updateProgress()
    }
  }

  // Drain the rest of the batch
  if (bulkActionUsers && bulkActionBatch.length > 0) {
    while (bulkActionBatch.length > 0) {
      const toActionBatch = bulkActionBatch.splice(0, bulkActionBatchSize)

      const { success: bulkSuccess, failure: bulkFailure } =
        await bulkActionUsers(guild, toActionBatch, reason)

      success.push(...bulkSuccess)
      failure.push(...bulkFailure)

      await updateProgress()
    }
  }

  const shouldEscapeSuccesses = success.length <= OUTPUT_LIMIT
  const shouldEscapeFailures = failure.length <= OUTPUT_LIMIT

  const formattedSuccess = success
    .map((user) => formatUserOrId(idOnly, user, shouldEscapeSuccesses))
    .join('\n')

  const formattedFailure = failure
    .map(
      (fail) =>
        `${formatUserOrId(idOnly, fail.user, shouldEscapeFailures)}: ${fail.reason}`,
    )
    .join('\n')

  const content: string[] = []
  const files: AttachmentPayload[] = []

  if (success.length > 0) {
    content.push(`Successfully ${actioned} ${plural('user', success.length)}:`)

    if (success.length > OUTPUT_LIMIT) {
      files.push({
        name: `mass_${action}.txt`,
        attachment: Buffer.from(formattedSuccess, 'utf8'),
      })
    } else {
      content.push(codeBlock(formattedSuccess))
    }
  }

  if (failure.length > 0) {
    content.push(`Failed to ${action} ${plural('user', failure.length)}:`)

    if (failure.length > OUTPUT_LIMIT) {
      files.push({
        name: `mass_failed_${action}.txt`,
        attachment: Buffer.from(formattedFailure, 'utf8'),
      })
    } else {
      content.push(codeBlock(formattedFailure))
    }
  }

  if (content.length === 0) {
    content.push(`Successfully ${actioned} no users, and no errors happened.`)
  }

  await interaction.editReply({
    content: content.join('\n'),
    files,
    allowedMentions: { parse: [] },
  })
}

function formatUserOrId(
  idOnly: boolean,
  user: UserOrId,
  escapeMarkdown = false,
): string {
  return typeof user === 'string'
    ? user
    : idOnly
      ? user.id
      : formatUser(user, { markdown: false, escapeMarkdown })
}

function actionResultToUserOrId(
  result: Awaited<ReturnType<ActionUser>>,
): UserOrId | undefined | null {
  return result instanceof GuildMember
    ? result.user
    : result instanceof User
      ? result
      : result
}
