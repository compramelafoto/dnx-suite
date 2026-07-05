export type SchoolOrganizerSession = {
  userId: number;
  name?: string | null;
  email?: string | null;
};

export async function ensureSchoolOrganizerSession(): Promise<SchoolOrganizerSession | null> {
  if (typeof window === "undefined") return null;

  const cached = sessionStorage.getItem("schoolOrganizer");
  if (cached) {
    try {
      const data = JSON.parse(cached);
      if (Number.isFinite(Number(data?.id))) {
        return {
          userId: Number(data.id),
          name: data?.name ?? null,
          email: data?.email ?? null,
        };
      }
    } catch {
      // noop
    }
  }

  try {
    const res = await fetch("/api/school-organizer/me", {
      cache: "no-store",
      credentials: "include",
    });
    if (!res.ok) return null;
    const data = await res.json().catch(() => ({}));
    const id = Number(data?.id);
    if (!Number.isFinite(id)) return null;

    const payload = {
      id,
      name: data?.name ?? null,
      email: data?.email ?? null,
    };
    sessionStorage.setItem("schoolOrganizer", JSON.stringify(payload));
    sessionStorage.setItem("schoolOrganizerId", String(id));
    return { userId: id, name: payload.name, email: payload.email };
  } catch {
    return null;
  }
}
