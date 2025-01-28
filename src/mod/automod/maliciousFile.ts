import type { Attachment, Message } from 'discord.js'
import { SleetModule, escapeAllMarkdown, formatUser } from 'sleetcord'
import { HOUR } from 'sleetcord-common'

export const maliciousFile = new SleetModule(
  {
    name: 'maliciousFile',
  },
  {
    messageCreate: runMessageCreate,
  },
)

const DAY = 24 * HOUR

const inGuilds: string[] = []

async function runMessageCreate(message: Message) {
  if (
    message.guildId === null ||
    message.guild === null ||
    message.attachments.size === 0 ||
    !inGuilds.includes(message.guildId) ||
    message.author.createdTimestamp < Date.now() - 3 * DAY
  ) {
    return
  }

  const malicious = message.attachments.filter(isMalicious)

  if (malicious.size > 0) {
    try {
      await Promise.all([
        message.delete(),
        message.member?.timeout(7 * DAY, 'Malicious file'),
      ])

      const logChannel = message.guild.channels.cache.get('797336365284065300')

      const loggedMalicious = malicious
        .map((a) => escapeAllMarkdown(a.name))
        .join(', ')

      if (logChannel?.isTextBased()) {
        await logChannel.send({
          content: `Malicious file deleted in ${
            message.channel
          } by ${formatUser(message.author)}:\n> ${loggedMalicious}`,
        })
      }
    } catch {
      // ignore
    }
  }
}

const regexes: RegExp[] = [/copy_.*\.mov/i]

function isMalicious(attach: Attachment): boolean {
  return regexes.some((regex) => regex.test(attach.name))
}
