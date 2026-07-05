function canUseSessionStorage(): boolean {
  return typeof window !== "undefined" && typeof window.sessionStorage !== "undefined";
}

/** Lee userId desde sessionStorage (login CC / CLF). */
export function resolveWizardStorageUserId(): number | null {
  if (!canUseSessionStorage()) return null;

  try {
    const fromId = window.sessionStorage.getItem("photographerId");
    const parsedId = Number(fromId);
    if (Number.isFinite(parsedId) && parsedId > 0) {
      return parsedId;
    }

    const photographerRaw = window.sessionStorage.getItem("photographer");
    if (photographerRaw) {
      const photographer = JSON.parse(photographerRaw) as { id?: unknown };
      const fromPhotographer = Number(photographer?.id);
      if (Number.isFinite(fromPhotographer) && fromPhotographer > 0) {
        return fromPhotographer;
      }
    }
  } catch {
    /* ignore */
  }

  return null;
}

/**
 * Hidrata photographerId en sessionStorage si el usuario ya tiene cookie de sesión
 * (p. ej. entró a /cuantocobro/app sin pasar por el login de CC).
 */
export async function hydrateWizardStorageUserId(): Promise<number | null> {
  const existing = resolveWizardStorageUserId();
  if (existing) return existing;

  if (!canUseSessionStorage()) return null;

  try {
    const res = await fetch("/api/auth/me", { credentials: "include", cache: "no-store" });
    if (!res.ok) return null;
    const data = (await res.json()) as { user?: { id?: unknown; role?: string } };
    const id = Number(data?.user?.id);
    const role = data?.user?.role;
    if (!Number.isFinite(id) || id <= 0) return null;

    if (role === "PHOTOGRAPHER" || role === "LAB_PHOTOGRAPHER" || role === "ADMIN") {
      window.sessionStorage.setItem("photographerId", String(id));
      if (data.user) {
        window.sessionStorage.setItem("photographer", JSON.stringify(data.user));
      }
      return id;
    }
  } catch {
    /* ignore */
  }

  return null;
}
