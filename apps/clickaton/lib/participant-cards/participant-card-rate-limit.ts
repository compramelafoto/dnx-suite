type RateLimitBucket = {
  timestamps: number[];
};

const buckets = new Map<string, RateLimitBucket>();

const WINDOW_MS = 60_000;
const PARTICIPANT_LIMIT = 5;
const ADMIN_LIMIT = 10;

function pruneBucket(bucket: RateLimitBucket, now: number): void {
  bucket.timestamps = bucket.timestamps.filter((t) => now - t < WINDOW_MS);
}

function bucketKey(actorKind: "participant" | "admin", userId?: number, email?: string): string {
  if (typeof userId === "number") return `${actorKind}:uid:${userId}`;
  const normalized = email?.trim().toLowerCase();
  if (normalized) return `${actorKind}:email:${normalized}`;
  return `${actorKind}:anonymous`;
}

export type ParticipantCardRateLimitResult =
  | { allowed: true; remaining: number }
  | { allowed: false; retryAfterMs: number };

export function checkParticipantCardRateLimit(input: {
  actorKind: "participant" | "admin";
  userId?: number;
  email?: string;
  now?: number;
}): ParticipantCardRateLimitResult {
  const now = input.now ?? Date.now();
  const limit = input.actorKind === "admin" ? ADMIN_LIMIT : PARTICIPANT_LIMIT;
  const key = bucketKey(input.actorKind, input.userId, input.email);
  let bucket = buckets.get(key);
  if (!bucket) {
    bucket = { timestamps: [] };
    buckets.set(key, bucket);
  }
  pruneBucket(bucket, now);

  if (bucket.timestamps.length >= limit) {
    const oldest = bucket.timestamps[0] ?? now;
    return { allowed: false, retryAfterMs: Math.max(WINDOW_MS - (now - oldest), 1) };
  }

  bucket.timestamps.push(now);
  return { allowed: true, remaining: limit - bucket.timestamps.length };
}

/** Solo para tests — resetea el store in-memory. */
export function __resetParticipantCardRateLimitForTests(): void {
  buckets.clear();
}
