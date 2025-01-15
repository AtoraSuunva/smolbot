import type { Message } from 'discord.js'
import { BaseRepeatRule, type RepeatInfractionInfo } from './BaseRepeatRule.js'

/**
 * Filter out message content repeats
 *
 * Counts if a non-empty message has the same content, case-insensitive
 */
export class ContentRepeatRule extends BaseRepeatRule<string> {
  type = 'content-repeat'

  override isRepeat(
    message: Message<true>,
    info: RepeatInfractionInfo<string>,
    newIdentifier: string,
  ): boolean {
    const { lastIdentifier } = info

    return (
      // Not empty (means it's an embed)
      message.content !== '' &&
      // Same content
      lastIdentifier === newIdentifier
    )
  }

  override getIdentifier(message: Message<true>): string {
    return message.content.toLowerCase()
  }
}
