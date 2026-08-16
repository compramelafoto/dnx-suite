/**
 * Política de keys R2 propias de FotoOffice.
 * Mismo patrón que `apps/infospot/lib/r2-key-policy.ts`: bucket compartido
 * entre apps del monorepo, namespaced por prefijo — FotoOffice nunca debe
 * poder tocar keys de otra app (`infospot/`, `albums/`, etc.).
 */
export const FOTOFFICE_R2_PREFIXES = {
  workspaceLogo: "fotoffice/workspace-logos",
  workspaceCover: "fotoffice/workspace-covers",
  memberAvatar: "fotoffice/member-avatars",
  photographerAvatar: "fotoffice/photographer-avatars",
  courseCover: "fotoffice/course-covers",
} as const;

export const FOTOFFICE_R2_DELETABLE_PREFIXES = Object.values(FOTOFFICE_R2_PREFIXES).map(
  (p) => `${p}/`,
);

/** Solo keys relativas del bucket (sin http/https, sin ..). */
export function assertSafeFotofficeR2Key(key: string): string {
  const trimmed = key.trim().replace(/^\/+/, "");
  if (!trimmed) throw new Error("Key R2 vacía");
  if (/^https?:\/\//i.test(trimmed)) {
    throw new Error("No se permiten URLs externas como key R2");
  }
  if (trimmed.includes("..") || trimmed.includes("\\")) {
    throw new Error("Key R2 inválida");
  }
  return trimmed;
}

export function isFotofficeOwnedR2Key(key: string): boolean {
  try {
    const safe = assertSafeFotofficeR2Key(key);
    return FOTOFFICE_R2_DELETABLE_PREFIXES.some((prefix) => safe.startsWith(prefix));
  } catch {
    return false;
  }
}

/** Valida que la key sea borrable por FotoOffice (fuera de su namespace: rechazada). */
export function assertFotofficeDeletableR2Key(key: string): string {
  const safe = assertSafeFotofficeR2Key(key);
  if (!FOTOFFICE_R2_DELETABLE_PREFIXES.some((prefix) => safe.startsWith(prefix))) {
    throw new Error("Key R2 fuera del namespace de FotoOffice");
  }
  return safe;
}
