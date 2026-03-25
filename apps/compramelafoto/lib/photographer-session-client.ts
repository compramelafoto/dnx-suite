export type PhotographerSession = {
  photographerId: number;
  name?: string | null;
  preferredLabId?: number | null;
  mpConnected?: boolean;
};

export async function ensurePhotographerSession(): Promise<PhotographerSession | null> {
  if (typeof window === "undefined") return null;

  const saved = sessionStorage.getItem("photographer");
  if (saved) {
    try {
      const data = JSON.parse(saved);
      if (Number.isFinite(Number(data?.id))) {
        return { photographerId: Number(data.id) };
      }
    } catch {}
  }

  try {
    const res = await fetch("/api/dashboard/photographer", {
      cache: "no-store",
      credentials: "include",
    });
    if (!res.ok) return null;
    const data = await res.json().catch(() => ({}));
    const id = Number(data?.id);
    if (!Number.isFinite(id)) return null;

    const sessionData = {
      id,
      name: data?.name ?? null,
      preferredLabId: data?.preferredLabId ?? null,
      mpConnected: Boolean(data?.mpConnected),
    };
    sessionStorage.setItem("photographer", JSON.stringify(sessionData));
    sessionStorage.setItem("photographerId", String(id));

    return { photographerId: id, ...sessionData };
  } catch (err) {
    console.error("Error verificando sesión de fotógrafo:", err);
    return null;
  }
}
