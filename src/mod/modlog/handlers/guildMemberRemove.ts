import {
  EmbedBuilder,
  type GuildMember,
  type PartialGuildMember,
} from 'discord.js'
import prettyMilliseconds from 'pretty-ms'
import { SleetModule, formatUser } from 'sleetcord'
import { EVENT_COLORS, formatLog, getValidatedConfigFor } from '../utils.js'

export const logGuildMemberRemove = new SleetModule(
  {
    name: 'logGuildMemberRemove',
  },
  {
    guildMemberRemove: handleGuildMemberRemove,
  },
)

async function handleGuildMemberRemove(
  member: GuildMember | PartialGuildMember,
) {
  const conf = await getValidatedConfigFor(
    member.guild,
    'memberRemove',
    (config) => config.memberRemove,
  )
  if (!conf) return

  const { config, channel } = conf

  const roles = config.memberRemoveRoles
    ? member.roles.cache
        .filter((r) => r.id !== member.guild.id)
        .sort((a, b) => b.position - a.position)
        .map((r) => r.toString())
        .join(', ')
    : ''

  const joinedAgo =
    member.joinedTimestamp !== null
      ? prettyMilliseconds(Date.now() - member.joinedTimestamp, {
          unitCount: 3,
        })
      : 'some unknown time'

  const embed = new EmbedBuilder()
    .setDescription(
      `**${member.guild.memberCount.toLocaleString()}** Members\n${
        roles ? `**Roles:** ${roles}` : ''
      }`,
    )
    .setColor(EVENT_COLORS.memberRemove)
    .setFooter({
      text: `Joined ${joinedAgo} ago`,
    })
    .setTimestamp(new Date())

  await channel.send({
    content: formatLog(
      '📤',
      'Member Remove',
      formatUser(member.user, { mention: true }),
    ),
    embeds: [embed],
    allowedMentions: { parse: [] },
  })
}
