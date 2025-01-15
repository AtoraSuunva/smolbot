import type {
  Guild,
  GuildMember,
  GuildTextBasedChannel,
  MessageReaction,
  PartialMessageReaction,
  PartialUser,
  User,
} from 'discord.js'
import { SleetModule, formatUser } from 'sleetcord'
import { getValidatedConfigFor } from '../utils.js'

export const modlogMessageReactionAdd = new SleetModule(
  {
    name: 'modlogMessageReactionAdd',
  },
  {
    messageReactionAdd: handleMessageReactionAdd,
  },
)

const logRegex =
  /^(?<emoji>.*?) `\[(?<time>(?:\d{2}:){2}\d{2})\]` `\[(?<type>.*?)\]`: (?:\(\d{17,20}\) from )?\*\*(?<username>.*?)\*\*\u200E#(?<discrim>\d{4}) \((?<id>\d{17,20})\)/

interface LogMatchGroups {
  emoji: string
  time: string
  type: string
  username: string
  discrim: string
  id: string
}

type TextBasedChannelSendArg = Parameters<GuildTextBasedChannel['send']>['0']

type ReactionAction = (
  guild: Guild,
  userId: string,
  executor: User,
) => Promise<TextBasedChannelSendArg>

async function kickMember(
  guild: Guild,
  userId: string,
  executor: User,
): Promise<TextBasedChannelSendArg> {
  let member: GuildMember | null = null

  try {
    member = await guild.members.fetch(userId)
  } catch (e) {
    return `Could not kick '${userId}' requested by ${formatUser(
      executor,
    )} (Did they leave?)`
  }

  if (!member.kickable) {
    return `Could not kick '${userId}' requested by ${formatUser(
      executor,
    )} (Missing permissions)`
  }

  await member.kick(
    `Kicked by ${formatUser(executor, { markdown: false, escapeMarkdown: false })}`,
  )
  return `Kicked '${userId}' requested by ${formatUser(executor)}`
}

export const actions = {
  '🔨': async (guild, userId, executor) => {
    try {
      await guild.bans.create(userId, {
        reason: `Banned by ${formatUser(executor, {
          markdown: false,
          escapeMarkdown: false,
        })}`,
      })
    } catch (e) {
      return `Could not ban '${userId}' requested by ${formatUser(
        executor,
      )} (Missing permissions?)`
    }

    return `Banned '${userId}' requested by ${formatUser(executor)}`
  },
  '👢': kickMember,
  '🥾': kickMember,
  ℹ️: (_guild, userId) => Promise.resolve(userId),
  '📝': (_guild, userId) => Promise.resolve(`<@${userId}>`),
} satisfies Record<string, ReactionAction>

async function handleMessageReactionAdd(
  messageReaction: MessageReaction | PartialMessageReaction,
  user: User | PartialUser,
) {
  if (user.bot) return
  if (!messageReaction.message.guildId) return

  // TODO: tryFetchGuild
  const guild = messageReaction.client.guilds.cache.get(
    messageReaction.message.guildId,
  )
  if (!guild) return

  const conf = await getValidatedConfigFor(
    guild,
    '',
    (config) => config.reactionActions,
  )
  if (!conf) return

  const { channel } = conf
  if (messageReaction.message.channelId !== channel.id) return

  const message = messageReaction.message.partial
    ? await messageReaction.message.fetch()
    : messageReaction.message

  if (message.author.id !== message.client.user.id) return

  const logMatch = message.content.match(logRegex)
  if (!logMatch) return

  const { id } = logMatch.groups as unknown as LogMatchGroups

  if (!messageReaction.emoji.name) return
  if (!(messageReaction.emoji.name in actions)) return

  const action = actions[messageReaction.emoji.name as keyof typeof actions]

  const resolvedUser = user.partial ? await user.fetch() : user
  const result = await action(guild, id, resolvedUser)

  await channel.send(result)
}
