import type { Message } from 'discord.js'
import { hashEmbeds } from '../hashEmbeds.js'
import { BaseRepeatRule, type RepeatInfractionInfo } from './BaseRepeatRule.js'

interface AcrossChannelsIdentifier {
  channel: string
  content: string
  embeds: string[]
}

/**
 * Filter out message content repeats across channels
 *
 * Counts if a message posted by the same user in 2 different channels has:
 *   - The same non-empty content, or
 *   - Any identical embeds (uses hashes)
 */
export class AcrossChannelsRule extends BaseRepeatRule<AcrossChannelsIdentifier> {
  type = 'across-channels'

  override isRepeat(
    _message: Message<true>,
    info: RepeatInfractionInfo<AcrossChannelsIdentifier>,
    newIdentifier: AcrossChannelsIdentifier,
  ): boolean {
    const { lastIdentifier } = info

    return (
      // Not the same channel
      lastIdentifier.channel !== newIdentifier.channel &&
      // Same content
      ((lastIdentifier.content !== '' &&
        lastIdentifier.content === newIdentifier.content) ||
        // Or same embeds
        newIdentifier.embeds.some((hash) =>
          lastIdentifier.embeds.includes(hash),
        ))
    )
  }

  override async getIdentifier(
    message: Message<true>,
  ): Promise<AcrossChannelsIdentifier> {
    return {
      channel: message.channel.id,
      content: message.content.toLowerCase(),
      embeds: await hashEmbeds(message),
    }
  }
}
