import {
  ApplicationCommandOptionType,
  type ChatInputCommandInteraction,
  type Guild,
  type GuildBan,
  type Invite,
  type User,
  time,
} from 'discord.js'
import {
  SleetSlashSubcommand,
  botHasPermissionsGuard,
  formatUser,
  getGuild,
  inGuildGuard,
} from 'sleetcord'
import { prisma } from '../../util/db.js'

export const revoke_invites = new SleetSlashSubcommand(
  {
    name: 'invites',
    description: 'Revoke all invites from a specific user',
    options: [
      {
        name: 'from',
        type: ApplicationCommandOptionType.User,
        description: 'Revoke invites from this user',
        required: true,
      },
    ],
  },
  {
    run: runRevoke,
    guildBanAdd: runBanRevoke,
  },
)

async function runRevoke(
  interaction: ChatInputCommandInteraction,
): Promise<unknown> {
  inGuildGuard(interaction)
  await botHasPermissionsGuard(interaction, ['ManageGuild'])

  await interaction.deferReply()

  const guild = await getGuild(interaction, true)
  const user = interaction.options.getUser('from', true)

  const revoked = await revokeInvitesFor(guild, user)
  const content = formatInviteList(user, revoked)

  return interaction.editReply({ content, allowedMentions: { parse: [] } })
}

async function runBanRevoke(ban: GuildBan): Promise<void> {
  if (
    await ban.guild.members
      .fetchMe()
      .then((me) => !me.permissions.has('ManageGuild'))
  ) {
    return
  }

  const { guild, user } = ban

  const config = await prisma.revokeConfig.findFirst({
    where: { guildID: guild.id },
  })

  if (!config || !config.enabled) return

  const logChannel = config.channelID
    ? guild.channels.cache.get(config.channelID)
    : undefined

  const revoked = await revokeInvitesFor(guild, user)

  if (revoked.length === 0) return

  const content = formatInviteList(user, revoked)

  if (logChannel?.isTextBased()) {
    await logChannel.send({ content, allowedMentions: { parse: [] } })
  }
}

/**
 * Fetches all invites from a guild and then revokes the ones created by the specified user
 * @param guild The guild to revoke invites in
 * @param user The user to revoke invites for
 * @returns An array of revoked invites
 */
async function revokeInvitesFor(guild: Guild, user: User): Promise<Invite[]> {
  const invites = await guild.invites.fetch()
  const toRevoke = invites.filter((i) => i.inviterId === user.id)

  if (toRevoke.size === 0) {
    return []
  }

  const revoked: Invite[] = []

  for (const i of toRevoke.values()) {
    if (!i.deletable) continue
    await i.delete()
    revoked.push(i)
  }

  return revoked
}

/**
 * Formats data into a pretty embed to send respond with
 * @param user The user that had their invites revoked
 * @param invites The invites that were revoked
 * @returns String that can be sent detailing the revoked invites
 */
function formatInviteList(user: User, invites: Invite[]): string {
  const inviteList: string[] = [
    `Revoked Invites for ${formatUser(user, { mention: true })}:`,
  ]

  if (invites.length > 0) {
    for (const i of invites) {
      inviteList.push(
        [
          `> \`${i.code}\``,
          `${i.channel ?? '<unknown channel>'} `,
          i.uses !== null && i.maxUses !== null
            ? `\n> -# Uses: **${i.uses}**/${i.maxUses === 0 ? '\u{221E}' : i.maxUses}, `
            : '',
          i.createdAt ? `Created: ${time(i.createdAt, 'f')},` : '',
          i.expiresAt
            ? `Expires: ${time(i.expiresAt, 'f')}`
            : 'Expires: *Never*',
        ].join(' '),
      )
    }
  } else {
    inviteList.push('No invites found or revoked.')
  }

  return inviteList.join('\n')
}
