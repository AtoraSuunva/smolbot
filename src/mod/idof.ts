import {
  ApplicationCommandOptionType,
  ChatInputCommandInteraction,
  codeBlock,
  Guild,
  GuildMember,
} from 'discord.js'
import { AutocompleteHandler, getGuild, SleetSlashCommand } from 'sleetcord'

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
    dm_permission: false,
    options: [
      {
        name: 'user',
        description: 'The user to get the ID of.',
        type: ApplicationCommandOptionType.String,
        autocomplete: userAutocomplete,
        required: true,
      },
    ],
  },
  {
    run: runIdof,
  },
)

async function runIdof(interaction: ChatInputCommandInteraction) {
  const user = interaction.options.getString('user', true)
  const guild = await getGuild(interaction, true)
  const matches = await matchMembers(guild, user, true)

  if (matches.length === 0) {
    return interaction.reply(`No users found matching "${user}"`)
  } else if (matches.length === 1) {
    return interaction.reply(matches[0].id)
  } else {
    const formattedMatches = codeBlock(
      matches.map((m) => `${m.name} (${m.id})`).join('\n'),
    )

    return interaction.reply(
      `Multiple users found matching "${user}":\n${formattedMatches}`,
    )
  }
}

async function fetchMembers(guild: Guild) {
  if (guild.memberCount === guild.members.cache.size) {
    return guild.members.cache
  }

  // TODO: cache invalidation strategy? if joins/leaves not accounted for
  return guild.members.fetch()
}

// Limit the number of autocomplete options returned
const MAX_MATCHES = 10

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
  tryExactMatch = false,
) {
  const lowerValue = query.toLowerCase()
  const members = await fetchMembers(guild)

  const matches: GuildMember[] = []

  for (const m of members.values()) {
    if (tryExactMatch && m.user.tag === query) {
      return [
        {
          name: `${m.user.tag}${
            m.nickname ? ` (Nickname: ${m.nickname})` : ''
          }`,
          value: m.user.tag,
          id: m.user.id,
        },
      ]
    }

    if (
      m.user.tag.toLowerCase().includes(lowerValue) ||
      !!m.nickname?.toLowerCase().includes(lowerValue)
    ) {
      matches.push(m)
      if (matches.length >= MAX_MATCHES) break
    }
  }

  return matches.map((m) => ({
    name: `${m.user.tag}${m.nickname ? ` (Nickname: ${m.nickname})` : ''}`,
    value: m.user.tag,
    id: m.user.id,
  }))
}
