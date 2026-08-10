/**
 * ETAPA 17B — Estado de rate limit Meta (x-app-usage / x-business-use-case-usage).
 */
export type MetaRateLimitState = {
  callCount?: number;
  totalCpuTime?: number;
  totalTime?: number;
  backoffUntil?: string | null;
  lastUpdatedAt?: string;
};

export function parseUsageHeader(header: string | null | undefined): MetaRateLimitState | null {
  if (!header?.trim()) return null;
  try {
    const parsed = JSON.parse(header) as Record<string, number>;
    return {
      callCount: parsed.call_count,
      totalCpuTime: parsed.total_cputime,
      totalTime: parsed.total_time,
      lastUpdatedAt: new Date().toISOString(),
    };
  } catch {
    return null;
  }
}

export function applyThrottle(state: MetaRateLimitState | null): MetaRateLimitState | null {
  if (!state) return null;
  const callCount = state.callCount ?? 0;
  if (callCount >= 90) {
    return {
      ...state,
      backoffUntil: new Date(Date.now() + 60_000).toISOString(),
    };
  }
  if (callCount >= 75) {
    return {
      ...state,
      backoffUntil: new Date(Date.now() + 15_000).toISOString(),
    };
  }
  return { ...state, backoffUntil: null };
}

export function isBackoffActive(state: MetaRateLimitState | null | undefined): boolean {
  if (!state?.backoffUntil) return false;
  return new Date(state.backoffUntil).getTime() > Date.now();
}
