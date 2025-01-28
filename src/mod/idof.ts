import {
  type APIGuildMember,
  ActionRowBuilder,
  ApplicationCommandOptionType,
  ApplicationIntegrationType,
  ButtonBuilder,
  type ButtonInteraction,
  ButtonStyle,
  type ChatInputCommandInteraction,
  ComponentType,
  type Guild,
  type GuildMember,
  type Interaction,
  InteractionContextType,
  MessageFlags,
  type RestOrArray,
  type Snowflake,
  UserSelectMenuBuilder,
  type UserSelectMenuInteraction,
  cleanCodeBlockContent,
  codeBlock,
} from 'discord.js'
import {
  type AutocompleteHandler,
  SleetSlashCommand,
  escapeAllMarkdown,
  formatUser,
  getGuild,
} from 'sleetcord'
import { tableFormat } from '../util/format.js'

interface MemberMatch {
  name: string
  value: string
  globalName: string | null
  username: string
  nickname: string | null
  id: string
  member: GuildMember | APIGuildMember
}

const userAutocomplete: AutocompleteHandler<string> = async ({
  interaction,
  value,
}) => {
  if (!interaction.inGuild()) {
    return []
  }

  const guild = await getGuild(interaction, true)
  return (await matchMembers(guild, value)).map((m) => ({
    name: m.name,
    value: m.value,
  }))
}

export const idof = new SleetSlashCommand(
  {
    name: 'idof',
    description: 'Get the ID of a user.',
    contexts: [InteractionContextType.Guild],
    integration_types: [ApplicationIntegrationType.GuildInstall],
    options: [
      {
        name: 'user',
        description: 'The user to get the ID of.',
        type: ApplicationCommandOptionType.String,
        autocomplete: userAutocomplete,
        required: true,
      },
      {
        name: 'exact_match',
        description:
          'Short-circuit on exact match if the user has a matching global name or username (default: False)',
        type: ApplicationCommandOptionType.Boolean,
      },
      {
        name: 'ephemeral',
        description: 'Only show the result to you (default: False)',
        type: ApplicationCommandOptionType.Boolean,
      },
    ],
  },
  {
    run: runIdof,
    interactionCreate: handleInteractionCreate,
  },
)

const USER_SELECT_ID = 'idof:user'
const MENTION_ID = 'idof:mention'
const ID_ID = 'idof:id'

const MENTION_BUTTON = new ButtonBuilder()
  .setCustomId(MENTION_ID)
  .setEmoji('🪪')
  .setLabel('Mention')
  .setStyle(ButtonStyle.Secondary)
const ID_BUTTON = new ButtonBuilder()
  .setCustomId(ID_ID)
  .setEmoji('🆔')
  .setLabel('ID')
  .setStyle(ButtonStyle.Secondary)
const ACTION_BUTTON_ROW = new ActionRowBuilder<ButtonBuilder>().addComponents([
  MENTION_BUTTON,
  ID_BUTTON,
])

function createUserSelect(...users: RestOrArray<Snowflake>) {
  const userSelect = new UserSelectMenuBuilder()
    .setCustomId(USER_SELECT_ID)
    .setMinValues(1)
    .setMaxValues(25)
    .setPlaceholder('Members to action')
    .addDefaultUsers(...users)

  return new ActionRowBuilder<UserSelectMenuBuilder>().addComponents(userSelect)
}

async function runIdof(interaction: ChatInputCommandInteraction) {
  const user = interaction.options.getString('user', true)
  const exactMatch = interaction.options.getBoolean('exact_match') ?? false
  const ephemeral = interaction.options.getBoolean('ephemeral') ?? false

  await interaction.deferReply({ ephemeral })

  const guild = await getGuild(interaction, true)
  const matches = await matchMembers(guild, user, {
    shortCircuitOnExactMatch: exactMatch,
  })

  if (matches.length === 0) {
    return interaction.editReply({
      content: `No members found matching "${escapeAllMarkdown(user)}"`,
      allowedMentions: { parse: [] },
    })
  }

  if (matches.length === 1) {
    return interaction.editReply({
      content: formatUser(matches[0].member),
      allowedMentions: { parse: [] },
    })
  }

  const selectRow = createUserSelect(
    matches
      .sort((a, b) => a.username.localeCompare(b.username))
      .slice(0, 25)
      .map((m) => m.member.user.id),
  )

  return interaction.editReply({
    content: `Multiple members found matching "${escapeAllMarkdown(
      user,
    )}":\n${resultFormat(matches)}`,
    allowedMentions: { parse: [] },
    components: [ACTION_BUTTON_ROW, selectRow],
  })
}

function handleInteractionCreate(interaction: Interaction) {
  if (
    interaction.isUserSelectMenu() &&
    interaction.customId === USER_SELECT_ID
  ) {
    handleUserSelectInteraction(interaction)
  } else if (interaction.isButton()) {
    switch (interaction.customId) {
      case MENTION_ID:
        handleMentionButton(interaction)
        break
      case ID_ID:
        handleIDButton(interaction)
        break
    }
  }
}

async function handleUserSelectInteraction(
  interaction: UserSelectMenuInteraction,
) {
  const members = interaction.members.map(formatSuggestion)

  const selectRow = createUserSelect(
    interaction.members
      .sort((a, b) => a.user.username.localeCompare(b.user.username))
      .map((m) => m.user.id),
  )

  interaction.reply({
    content: resultFormat(members),
    flags: MessageFlags.Ephemeral,
    components: [ACTION_BUTTON_ROW, selectRow],
  })
}

async function handleMentionButton(interaction: ButtonInteraction) {
  const members = await getInteractionMembers(interaction)

  interaction.reply({
    flags: MessageFlags.Ephemeral,
    content: members.map((m) => `<@${m}>`).join('\n') || 'No members selected',
  })
}

async function handleIDButton(interaction: ButtonInteraction) {
  const members = await getInteractionMembers(interaction)

  interaction.reply({
    flags: MessageFlags.Ephemeral,
    content: members.join('\n') || 'No members selected',
  })
}

async function getInteractionMembers(interaction: ButtonInteraction) {
  for (const row of interaction.message.components) {
    for (const component of row.components) {
      if (
        component.type === ComponentType.UserSelect &&
        component.customId === USER_SELECT_ID
      ) {
        return component.data.default_values?.map((d) => d.id) ?? []
      }
    }
  }

  return []
}

function resultFormat(data: MemberMatch[]): string {
  return codeBlock(
    'm',
    cleanCodeBlockContent(
      tableFormat(data, {
        keys: ['username', 'id', 'globalName', 'nickname'],
        columnsNames: {
          username: 'Username',
          id: 'ID',
          globalName: 'Global Name',
          nickname: 'Nickname',
        },
        showNullish: false,
        characterLimit: 1900,
      }),
    ),
  )
}

async function fetchMembers(guild: Guild) {
  if (guild.memberCount === guild.members.cache.size) {
    return guild.members.cache
  }

  return guild.members.fetch()
}

// Limit the number of autocomplete options returned
const MAX_MATCHES = 25

type Matcher = (string: string, query: string) => boolean

interface MatchMemberOptions {
  matcher?: Matcher
  limit?: number
  caseSensitive?: boolean
  matchNickname?: boolean
  shortCircuitOnExactMatch?: boolean
}

function partialMatcher(string: string, query: string): boolean {
  return string.includes(query)
}

/**
 * Try to match a query against every member in a guild, returning possible matches
 * @param guild The guild to search
 * @param query The query to search with. It will be searched for case-insensitively in tag and nickname
 * @param tryExactMatch Try for an exact match. If an exact match with a tag is found, only return that
 * @returns
 */
async function matchMembers(
  guild: Guild,
  query: string,
  {
    matcher = partialMatcher,
    limit = MAX_MATCHES,
    caseSensitive = false,
    matchNickname = true,
    shortCircuitOnExactMatch = false,
  }: MatchMemberOptions = {},
): Promise<MemberMatch[]> {
  const matchQuery = caseSensitive ? query : query.toLowerCase()
  const members = await fetchMembers(guild)
  const matches: GuildMember[] = []

  limit = Math.min(limit, MAX_MATCHES)

  for (const m of members.values()) {
    const globalName = m.user.globalName
      ? caseSensitive
        ? m.user.globalName
        : m.user.globalName.toLowerCase()
      : null
    const tag = caseSensitive ? m.user.tag : m.user.tag.toLowerCase()
    const nickname = m.nickname
      ? caseSensitive
        ? m.nickname
        : m.nickname.toLowerCase()
      : null

    if (
      shortCircuitOnExactMatch &&
      (globalName === matchQuery || tag === matchQuery)
    ) {
      return [formatSuggestion(m)]
    }

    if (
      (!!globalName && matcher(globalName, matchQuery)) ||
      matcher(tag, matchQuery) ||
      (matchNickname && matcher(nickname ?? '', matchQuery))
    ) {
      matches.push(m)
      if (matches.length >= limit) break
    }
  }

  return matches
    .map(formatSuggestion)
    .sort((a, b) => a.username.localeCompare(b.username))
}

function formatSuggestion(m: GuildMember | APIGuildMember): MemberMatch {
  if ('joined_at' in m) {
    return formatAPISuggestion(m)
  }

  const formattedUser = formatUser(m.user, {
    id: false,
    markdown: false,
    escapeMarkdown: false,
  })

  return {
    name: `${formattedUser}${m.nickname ? ` (Nickname: ${m.nickname})` : ''}`,
    value: m.user.globalName ?? m.user.tag,
    globalName: m.user.globalName,
    username: m.user.tag,
    nickname: m.nickname,
    id: m.user.id,
    member: m,
  }
}

function formatAPISuggestion(m: APIGuildMember): MemberMatch {
  const formattedUser = formatUser(m.user, {
    id: false,
    markdown: false,
    escapeMarkdown: false,
  })

  const tag =
    m.user.username + (m.user.discriminator ? `#${m.user.discriminator}` : '')

  return {
    name: `${formattedUser}${m.nick ? ` (Nickname: ${m.nick})` : ''}`,
    value: m.user.global_name ?? tag,
    globalName: m.user.global_name,
    username: tag,
    nickname: m.nick ?? null,
    id: m.user.id,
    member: m,
  }
}
