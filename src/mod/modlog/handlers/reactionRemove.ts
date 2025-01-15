import {
  type APIEmbed,
  type Emoji,
  LimitedCollection,
  type MessageReaction,
  type MessageReactionEventDetails,
  type PartialMessageReaction,
  type PartialUser,
  type User,
} from 'discord.js'
import prettyMilliseconds from 'pretty-ms'
import { SleetModule, escapeAllMarkdown, formatUser } from 'sleetcord'
import { SECOND } from 'sleetcord-common'
import { formatLog, getValidatedConfigFor } from '../utils.js'

export const logReactionRemove = new SleetModule(
  {
    name: 'logReactionRemove',
  },
  {
    messageReactionAdd,
    messageReactionRemove,
  },
)

const reactionTimes = new LimitedCollection<string, number>({
  maxSize: 500,
})

async function messageReactionAdd(
  reaction: MessageReaction | PartialMessageReaction,
  user: User | PartialUser,
) {
  if (!reaction.message.inGuild()) {
    return
  }

  const { guild } = reaction.message
  const conf = await getValidatedConfigFor(
    guild,
    'reactionRemove',
    (config) => config.reactionRemove && config.reactionTime > 0,
  )

  if (!conf) return

  reactionTimes.set(reactionKey(reaction, user), Date.now())
}

async function messageReactionRemove(
  reaction: MessageReaction | PartialMessageReaction,
  user: User | PartialUser,
  details: MessageReactionEventDetails,
) {
  if (!reaction.message.inGuild()) {
    return
  }

  const { guild } = reaction.message
  const conf = await getValidatedConfigFor(
    guild,
    'reactionRemove',
    (config) => config.reactionRemove,
  )

  if (!conf) return

  const { config, channel } = conf

  let timeBetween = 0

  if (config.reactionTime > 0) {
    const timeLimit = config.reactionTime * SECOND
    const key = reactionKey(reaction, user)
    const addedAt = reactionTimes.get(key)
    reactionTimes.delete(key)

    if (addedAt) {
      timeBetween = Date.now() - addedAt

      if (timeBetween >= timeLimit) {
        return
      }
    }
  }

  const msg = `${formatEmoji(reaction.emoji)}${details.burst ? ' (Super!)' : ''} by ${formatUser(user, { mention: true })} on ${reaction.message.url}${timeBetween > 0 ? ` in ${prettyMilliseconds(timeBetween)}` : ''}`
  const embeds: APIEmbed[] = []

  if (reaction.emoji.id) {
    embeds.push({
      thumbnail: {
        // biome-ignore lint/style/noNonNullAssertion: imageURL is only null if emoji.id is null
        url: reaction.emoji.imageURL({
          extension: reaction.emoji.animated ? 'gif' : 'png',
        })!,
      },
    })
  }

  await channel.send({
    content: formatLog('💀', 'Reaction Removed', msg),
    embeds,
    allowedMentions: { parse: [] },
  })
}

function formatEmoji(emoji: Emoji): string {
  return `${escapeAllMarkdown(emoji.name ?? '?')}${emoji.id ? ` (${emoji.id})` : ''}`
}

function reactionKey(
  reaction: MessageReaction | PartialMessageReaction,
  user: User | PartialUser,
): string {
  return `${reaction.message.id}:${user.id}:${reaction.emoji.id ?? reaction.emoji.name}`
}
