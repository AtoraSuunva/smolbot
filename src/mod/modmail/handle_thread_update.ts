import type { AnyThreadChannel, Client, ForumThreadChannel } from 'discord.js'
import { SleetModule } from 'sleetcord'
import { prisma } from '../../util/db.js'
import { getWebhookFor } from './handle_ticket_message.js'

export const handle_thread_update = new SleetModule(
  {
    name: 'handle_thread_update',
  },
  {
    threadUpdate: handleThreadUpdate,
    threadDelete: handleThreadDelete,
  },
)

interface ThreadStateChange {
  archived: boolean | null
  locked: boolean | null
}

const CHANGE_WORD = {
  archived: {
    true: 'archived',
    false: 'unarchived',
  },
  locked: {
    true: 'locked',
    false: 'unlocked',
  },
}

const CHANGE_ADDENDUM = {
  archived: {
    true: 'You can reply to this thread to re-open the ticket.',
    false: '',
  },
  locked: {
    true: 'You can no longer reply to this ticket.',
    false: 'You can reply to this ticket again.',
  },
}

const CHANGE_ADDENDUM_MOD = {
  archived: {
    true: 'Members can reply to their thread to re-open the ticket.',
    false: '',
  },
  locked: {
    true: 'Members can no longer reply to this ticket.',
    false: 'Members can reply to this ticket again.',
  },
}

const intlList = new Intl.ListFormat('en', {
  style: 'long',
  type: 'conjunction',
})

const updatingThreads = new Set<string>()

async function handleThreadUpdate(
  oldThread: AnyThreadChannel,
  newThread: AnyThreadChannel,
) {
  if (updatingThreads.has(newThread.id)) {
    return
  }

  const ticket = await findTicket(newThread)

  if (!ticket || ticket.userThreadID === newThread.id) {
    // If it's not a ticket or if the user ticket thread was modified, ignore it
    // We only mirror changes to the mod ticket channel, for "avoiding infinite loop" reasons
    return
  }

  const { client } = newThread
  const userChannel = await client.channels
    .fetch(ticket.userChannelID)
    .catch(() => null)

  if (!userChannel || !('threads' in userChannel)) {
    return
  }

  const userThread = await userChannel.threads
    .fetch(ticket.userThreadID)
    .catch(() => null)

  if (!userThread) {
    return
  }

  let newState = false
  const threadChange: ThreadStateChange = {
    archived: null,
    locked: null,
  }

  if (
    newThread.archived !== null &&
    oldThread.archived !== newThread.archived
  ) {
    newState = true
    threadChange.archived = newThread.archived
  }

  if (
    newThread.locked !== null &&
    oldThread.locked !== newThread.locked &&
    userThread.locked !== newThread.locked
  ) {
    newState = true
    threadChange.locked = newThread.locked
  }

  if (!newState) {
    return
  }

  const webhook = await getWebhookFor(userChannel).catch(() => null)

  if (!webhook) {
    return
  }

  const changes = Object.entries(threadChange)
    .filter((e): e is [keyof typeof CHANGE_WORD, boolean] => e[1] !== null)
    .map(([key, value]) => CHANGE_WORD[key][String(value) as 'true' | 'false'])

  const addendum = Object.entries(threadChange)
    .filter((e): e is [keyof typeof CHANGE_ADDENDUM, boolean] => e[1] !== null)
    .map(
      ([key, value]) => CHANGE_ADDENDUM[key][String(value) as 'true' | 'false'],
    )
    .filter((v) => v)

  const addendumMod = Object.entries(threadChange)
    .filter((e): e is [keyof typeof CHANGE_ADDENDUM, boolean] => e[1] !== null)
    .map(
      ([key, value]) =>
        CHANGE_ADDENDUM_MOD[key][String(value) as 'true' | 'false'],
    )
    .filter((v) => v)

  // If the ticket was locked and still is locked, don't send any update
  if (userThread.locked && threadChange.locked !== false) {
    return
  }

  const isTicketOpen = !threadChange.locked && !threadChange.archived

  await prisma.modMailTicket.update({
    where: {
      ticketID: ticket.ticketID,
    },
    data: {
      open: isTicketOpen,
    },
  })

  try {
    updatingThreads.add(newThread.id)

    const ticketMessage = intlList.format(changes)

    await webhook.send({
      content: `This ticket was ${ticketMessage}.\n${addendum.join('\n')}`,
      threadId: userThread.id,
    })

    await newThread.send({
      content: `This ticket was ${ticketMessage}.\n${addendumMod.join('\n')}`,
    })

    if (threadChange.locked !== null || newThread.locked !== null) {
      // Synching the archived state hides it from the channel list and prevents the user from seeing the "new message" indicator
      // So the user might never know it was archived

      // if (threadChange.archived !== null || newThread.archived !== null) {
      //   await userThread.setArchived(
      //     (threadChange.archived ?? newThread.archived)!,
      //   )
      // }

      // biome-ignore lint/style/noNonNullAssertion: we just checked at least one state wasn't null
      await userThread.setLocked((threadChange.locked ?? newThread.locked)!)
    }

    const config = await findForumConfig(ticket.modChannelID)

    if (config) {
      const newTags = newThread.appliedTags.filter(
        (t) => t !== config.openTag && t !== config.closedTag,
      )

      if (newTags.length < 5) {
        if (isTicketOpen && config.openTag) {
          newTags.push(config.openTag)
        } else if (!isTicketOpen && config.closedTag) {
          newTags.push(config.closedTag)
        }
      }

      await newThread.edit({
        appliedTags: newTags,
        archived: false,
        locked: false,
      })

      if (!isTicketOpen || newThread.archived || newThread.locked) {
        await newThread.edit({
          archived:
            threadChange.archived ?? (newThread.archived || !isTicketOpen),
          locked: threadChange.locked ?? newThread.locked ?? false,
        })
      }
    }
  } catch {
    // ignore
  } finally {
    updatingThreads.delete(newThread.id)
  }
}

async function handleThreadDelete(thread: AnyThreadChannel) {
  const ticket = await findTicket(thread)

  if (!ticket) {
    return
  }

  const isUserThread = ticket.userThreadID === thread.id

  const otherThread = await fetchThread(
    thread.client,
    isUserThread ? ticket.modChannelID : ticket.userChannelID,
    isUserThread ? ticket.modThreadID : ticket.userThreadID,
  )

  if (!otherThread) {
    return
  }

  await otherThread
    .send(
      `The ${isUserThread ? 'user' : 'mod'} thread linked to this ticket was deleted. You cannot reply to this ticket anymore.`,
    )
    .catch(() => {
      /* ignore */
    })

  await prisma.modMailTicket.update({
    where: {
      ticketID: ticket.ticketID,
    },
    data: {
      open: false,
      linkDeleted: true,
    },
  })

  if (isUserThread) {
    // Tag the mod thread as closed
    const modThread = await fetchThread(
      thread.client,
      ticket.modChannelID,
      ticket.modThreadID,
    )

    if (modThread) {
      const config = await findForumConfig(ticket.modChannelID)

      if (config) {
        const newTags = modThread.appliedTags.filter(
          (t) => t !== config.openTag && t !== config.closedTag,
        )

        if (newTags.length < 5 && config.closedTag) {
          newTags.push(config.closedTag)
        }

        await modThread.setAppliedTags(newTags).catch(() => {
          /* ignore */
        })
      }
    }
  } else {
    // Mod thread was deleted, lock the user thread
    otherThread.setLocked(true)
  }
}

async function fetchThread(
  client: Client,
  channelId: string,
  threadId: string,
): Promise<ForumThreadChannel | null> {
  const channel = await client.channels.fetch(channelId).catch(() => null)

  if (!channel || !channel.isThreadOnly()) return null

  return channel.threads.fetch(threadId).catch(() => null)
}

async function findTicket(thread: AnyThreadChannel) {
  return prisma.modMailTicket.findFirst({
    where: {
      OR: [
        {
          userThreadID: thread.id,
        },
        {
          modThreadID: thread.id,
        },
      ],
    },
  })
}

async function findForumConfig(channelId: string) {
  return prisma.modMailForumConfig.findFirst({
    where: {
      channelID: channelId,
    },
  })
}
