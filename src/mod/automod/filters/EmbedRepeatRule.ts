import type { Message } from 'discord.js'
import { hashEmbeds } from '../hashEmbeds.js'
import { BaseRepeatRule, type RepeatInfractionInfo } from './BaseRepeatRule.js'

/**
 * Filter out message embed repeats
 *
 * Counts if a message has at least 1 embed identical to the previous message
 */
export class EmbedRepeatRule extends BaseRepeatRule<string[]> {
  type = 'embed-repeat'

  override isRepeat(
    _message: Message<true>,
    info: RepeatInfractionInfo<string[]>,
    newIdentifier: string[],
  ): boolean {
    const { lastIdentifier } = info

    return (
      // Has at least 1 embed
      newIdentifier.length > 0 &&
      // Has at least 1 identical embed
      newIdentifier.some((hash) => lastIdentifier.includes(hash))
    )
  }

  override getIdentifier(message: Message<true>): Promise<string[]> {
    return hashEmbeds(message)
  }
}
