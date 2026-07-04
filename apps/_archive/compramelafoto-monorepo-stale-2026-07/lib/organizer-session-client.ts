export type OrganizerSession = {
  organizerId: number;
  name?: string | null;
  email?: string | null;
};

export async function ensureOrganizerSession(): Promise<OrganizerSession | null> {
  if (typeof window === "undefined") return null;

  const saved = sessionStorage.getItem("organizer");
  if (saved) {
    try {
      const data = JSON.parse(saved);
      if (Number.isFinite(Number(data?.id))) {
        return {
          organizerId: Number(data.id),
          name: data?.name ?? null,
          email: data?.email ?? null,
        };
      }
    } catch {}
  }

  try {
    const res = await fetch("/api/organizer/me", {
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
      email: data?.email ?? null,
    };
    sessionStorage.setItem("organizer", JSON.stringify(sessionData));
    sessionStorage.setItem("organizerId", String(id));

    return { organizerId: id, ...sessionData };
  } catch (err) {
    console.error("Error verificando sesión de organizador:", err);
    return null;
  }
}
