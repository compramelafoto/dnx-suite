type RateLimitRecord = {
  count: number;
  resetAt: number;
};

const store = new Map<string, RateLimitRecord>();

function cleanupStore(now: number) {
  if (store.size < 500) return;
  for (const [key, record] of store.entries()) {
    if (record.resetAt <= now) {
      store.delete(key);
    }
  }
}

export function checkRateLimit(params: {
  key: string;
  limit: number;
  windowMs: number;
}) {
  const { key, limit, windowMs } = params;
  const now = Date.now();
  cleanupStore(now);

  const record = store.get(key);
  if (!record || record.resetAt <= now) {
    const next: RateLimitRecord = { count: 1, resetAt: now + windowMs };
    store.set(key, next);
    return { allowed: true, remaining: limit - 1, resetAt: next.resetAt };
  }

  if (record.count >= limit) {
    return { allowed: false, remaining: 0, resetAt: record.resetAt };
  }

  record.count += 1;
  store.set(key, record);
  return { allowed: true, remaining: Math.max(0, limit - record.count), resetAt: record.resetAt };
}
