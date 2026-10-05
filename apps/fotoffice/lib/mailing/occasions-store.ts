import "server-only";
import { prisma } from "@repo/db";
import { CUSTOM_OCCASION_PREFIX, mergeOccasions, OCCASION_CATALOG, type OccasionConfig, type OccasionRow } from "./occasions-catalog";

const ROW_SELECT = {
  key: true,
  kind: true,
  enabled: true,
  month: true,
  day: true,
  title: true,
  subject: true,
  message: true,
  imageUrl: true,
  specialties: true,
  milestonesOnly: true,
  offsetDays: true,
} as const;

/** Todas las fechas de la institución: el catálogo con sus cambios, más las propias. */
export async function loadOccasions(workspaceId: string): Promise<OccasionConfig[]> {
  const rows = await prisma.fotofficeMailingOccasion.findMany({ where: { workspaceId }, select: ROW_SELECT, orderBy: { createdAt: "asc" } });
  return mergeOccasions(rows as OccasionRow[]);
}

export async function loadOccasion(workspaceId: string, key: string): Promise<OccasionConfig | null> {
  return (await loadOccasions(workspaceId)).find((o) => o.key === key) ?? null;
}

export function isKnownOccasionKey(key: string): boolean {
  return OCCASION_CATALOG.some((c) => c.key === key) || key.startsWith(CUSTOM_OCCASION_PREFIX);
}

export async function saveOccasion(workspaceId: string, o: OccasionRow): Promise<void> {
  const data = {
    kind: o.kind,
    enabled: o.enabled,
    month: o.month,
    day: o.day,
    title: o.title,
    subject: o.subject,
    message: o.message,
    imageUrl: o.imageUrl,
    specialties: o.specialties,
    milestonesOnly: o.milestonesOnly,
    offsetDays: o.offsetDays,
  };
  await prisma.fotofficeMailingOccasion.upsert({
    where: { workspaceId_key: { workspaceId, key: o.key } },
    create: { workspaceId, key: o.key, ...data },
    update: data,
  });
}

export async function deleteCustomOccasion(workspaceId: string, key: string): Promise<void> {
  if (!key.startsWith(CUSTOM_OCCASION_PREFIX)) return;
  await prisma.fotofficeMailingOccasion.deleteMany({ where: { workspaceId, key } });
}
