/**
 * Cursor estable para paginación del feed rankeado.
 */

export type FeedCursorPayload = {
  v: 1;
  score: number;
  publishedAt: string;
  id: string;
};

export function encodeFeedCursor(payload: FeedCursorPayload): string {
  const json = JSON.stringify(payload);
  return Buffer.from(json, "utf8").toString("base64url");
}

export function decodeFeedCursor(raw: string | null | undefined): FeedCursorPayload | null {
  if (!raw || typeof raw !== "string") return null;
  try {
    const json = Buffer.from(raw, "base64url").toString("utf8");
    const data = JSON.parse(json) as Partial<FeedCursorPayload>;
    if (data.v !== 1) return null;
    if (typeof data.score !== "number" || !Number.isFinite(data.score)) return null;
    if (typeof data.publishedAt !== "string" || !data.publishedAt) return null;
    if (typeof data.id !== "string" || !data.id) return null;
    const publishedAt = new Date(data.publishedAt);
    if (Number.isNaN(publishedAt.getTime())) return null;
    return {
      v: 1,
      score: data.score,
      publishedAt: publishedAt.toISOString(),
      id: data.id,
    };
  } catch {
    return null;
  }
}

/** True si `item` va después del cursor en el orden del feed. */
export function isAfterFeedCursor(
  item: { rankingScore: number; publishedAt: Date; id: string },
  cursor: FeedCursorPayload,
): boolean {
  if (item.rankingScore < cursor.score) return true;
  if (item.rankingScore > cursor.score) return false;
  const cursorPub = new Date(cursor.publishedAt).getTime();
  const itemPub = item.publishedAt.getTime();
  if (itemPub < cursorPub) return true;
  if (itemPub > cursorPub) return false;
  return item.id > cursor.id;
}
