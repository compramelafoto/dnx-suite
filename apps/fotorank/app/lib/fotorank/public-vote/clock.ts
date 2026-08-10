/**
 * Reloj virtual seguro para Test Mode / E2E 17A.
 * Solo vía inyección explícita o env FOTORANK_PUBLIC_VOTE_NOW_ISO.
 * Nunca altera reloj del sistema. Rondas comerciales (provider ≠ TEST_PROVIDER)
 * deben ignorar este reloj en callers (ver getPublicVoteNowForRound).
 */
let injectedNow: Date | null = null;

export function setPublicVoteVirtualNow(isoOrDate: string | Date | null) {
  if (isoOrDate == null) {
    injectedNow = null;
    return;
  }
  injectedNow = typeof isoOrDate === "string" ? new Date(isoOrDate) : isoOrDate;
}

export function getPublicVoteNow(): Date {
  if (injectedNow) return new Date(injectedNow.getTime());
  const envIso = process.env.FOTORANK_PUBLIC_VOTE_NOW_ISO?.trim();
  if (envIso) {
    const d = new Date(envIso);
    if (!Number.isNaN(d.getTime())) return d;
  }
  return new Date();
}

/** Reloj efectivo: virtual solo si provider === TEST_PROVIDER. */
export function getPublicVoteNowForRound(provider: string): Date {
  if (provider === "TEST_PROVIDER") return getPublicVoteNow();
  return new Date();
}
