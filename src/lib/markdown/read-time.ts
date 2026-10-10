export const WORDS_PER_MINUTE = 225;

/** Reading time in whole minutes, floored at 1. */
export function estimateReadTime(text: string, wordsPerMinute: number = WORDS_PER_MINUTE): number {
  const words = text.trim().split(/\s+/u).filter(Boolean).length;
  return Math.max(1, Math.ceil(words / wordsPerMinute));
}