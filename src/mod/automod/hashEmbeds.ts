import { createHash } from 'node:crypto'
import { Readable } from 'node:stream'
import type { ReadableStream } from 'node:stream/web'
import type { Message } from 'discord.js'

const hashCache = new WeakMap<Message, Promise<string[]>>()

/** Discord doesn't seem to embed images over this size */
export const MAX_IMAGE_SIZE = 100 * 1024 * 1024

/**
 * Hashes the attachments and embeds for a message, with a cache to avoid re-calculating hashes several times for the same messages
 *
 * @param message The message to hash embeds & attachments for
 * @returns A promise that resolves to an array of hashes (or filenames, if that's more efficient or if hashes aren't possible)
 */
export function hashEmbeds(message: Message): Promise<string[]> {
  const cached = hashCache.get(message)

  if (cached) {
    return cached
  }

  const promise = new Promise<string[]>((resolve, reject) => {
    const { attachments, embeds } = message

    // We cheat a little and just use the embed url as a "hash" instead of downloading the image/video ourself
    // Users *shouldn't* typically be sending embeds anyway without using URLs (unless they selfbot), which can be detected by other means
    const embedHashes: string[] = Array.from(
      new Set(
        embeds
          .map((embed) => embed.url)
          .filter((e): e is string => typeof e === 'string'),
      ),
    )

    Promise.all(
      attachments.map<Promise<string>>(async (attachment) => {
        if (attachment.size === 0 || attachment.size >= MAX_IMAGE_SIZE) {
          return attachment.name
        }

        const response = await fetch(attachment.url).catch(() => null)

        if (!response?.ok || response.body === null) {
          return attachment.name
        }

        return hashStream(response.body)
      }),
    )
      .then((attachmentHashes) => {
        resolve([...embedHashes, ...attachmentHashes])
      })
      .catch(reject)
  })

  hashCache.set(message, promise)
  return promise
}

/**
 * Hashes a stream using SHA256
 *
 * @param stream The stream to hash
 * @returns A promise that resolves to the hash (hex-encoded string)
 */
function hashStream(stream: ReadableStream): Promise<string> {
  const hash = createHash('sha256')

  return new Promise((resolve, reject) => {
    Readable.fromWeb(stream)
      .pipe(hash)
      .on('error', reject)
      .on('finish', () => {
        resolve(hash.digest('hex'))
      })
  })
}
