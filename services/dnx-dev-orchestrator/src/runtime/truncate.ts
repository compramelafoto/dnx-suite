export type TruncateResult = {
  text: string;
  truncated: boolean;
  originalLength: number;
};

/**
 * Preserve head + tail when truncating large Cursor output.
 */
export function truncateOutput(text: string, maxChars: number): TruncateResult {
  const originalLength = text.length;
  if (!Number.isFinite(maxChars) || maxChars < 64) {
    return {
      text: "[OUTPUT_LIMIT_INVALID]",
      truncated: true,
      originalLength,
    };
  }
  if (originalLength <= maxChars) {
    return { text, truncated: false, originalLength };
  }

  const marker = `\n\n...[OUTPUT TRUNCATED originalChars=${originalLength} maxChars=${maxChars}]...\n\n`;
  const budget = maxChars - marker.length;
  const headLen = Math.floor(budget * 0.7);
  const tailLen = Math.max(0, budget - headLen);
  const textOut = `${text.slice(0, headLen)}${marker}${text.slice(originalLength - tailLen)}`;
  return { text: textOut, truncated: true, originalLength };
}
