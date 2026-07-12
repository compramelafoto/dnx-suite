import { INFO_SPOT_TZ } from "@/lib/dates";

export function editorialGreeting(now = new Date()): "Buen día" | "Buenas tardes" | "Buenas noches" {
  const hourRaw = new Intl.DateTimeFormat("en-US", {
    timeZone: INFO_SPOT_TZ,
    hour: "numeric",
    hour12: false,
  }).format(now);
  const hour = Number(hourRaw);
  if (hour < 12) return "Buen día";
  if (hour < 19) return "Buenas tardes";
  return "Buenas noches";
}

export function editorialFirstName(user: { name: string | null; email: string }): string {
  const name = user.name?.trim();
  if (name) return name.split(/\s+/)[0] ?? name;
  const local = user.email.split("@")[0]?.trim();
  return local || "redacción";
}
