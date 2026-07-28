import { prisma, withClickatonDb, type ClickatonDbResult } from "@/lib/admin/db";
import type { PricePhaseRecord } from "@/lib/pricing/domain/types";
import { resolveCurrentPricePhase } from "@/lib/pricing/domain/resolve-price-phase";

function mapPhase(row: {
  id: string;
  editionId: string;
  name: string;
  description: string | null;
  amount: number;
  currency: string;
  startsAt: Date;
  endsAt: Date;
  capacity: number | null;
  priority: number;
  isActive: boolean;
}): PricePhaseRecord {
  return row;
}

export async function listPricePhasesByEdition(
  editionId: string,
): Promise<ClickatonDbResult<PricePhaseRecord[]>> {
  return withClickatonDb(async () => {
    const rows = await prisma.clickatonRegistrationPricePhase.findMany({
      where: { editionId },
      orderBy: [{ startsAt: "asc" }, { priority: "asc" }],
    });
    return rows.map(mapPhase);
  });
}

export async function getPricePhaseById(
  phaseId: string,
): Promise<ClickatonDbResult<PricePhaseRecord | null>> {
  return withClickatonDb(async () => {
    const row = await prisma.clickatonRegistrationPricePhase.findUnique({
      where: { id: phaseId },
    });
    return row ? mapPhase(row) : null;
  });
}

export async function getEditionPriceSnapshot(
  editionId: string,
  now: Date = new Date(),
): Promise<
  ClickatonDbResult<{
    phases: PricePhaseRecord[];
    current: PricePhaseRecord | null;
    next: PricePhaseRecord | null;
  }>
> {
  return withClickatonDb(async () => {
    const rows = await prisma.clickatonRegistrationPricePhase.findMany({
      where: { editionId },
      orderBy: [{ startsAt: "asc" }, { priority: "asc" }],
    });
    const phases = rows.map(mapPhase);
    const resolved = resolveCurrentPricePhase(phases, now);
    return {
      phases,
      current: resolved?.phase ?? null,
      next: resolved?.nextPhase ?? null,
    };
  });
}
