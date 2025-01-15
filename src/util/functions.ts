/**
 * Sleepytime, but in a promise
 * @param ms The time to sleep in ms
 * @returns A promise that resolves after the given time
 */
export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}
