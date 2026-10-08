import "server-only";
import { prisma } from "@repo/db";

/**
 * Los premiados de un concurso, para las imágenes de ganadores.
 *
 * Salen del último resultado FINALIZADO o PUBLICADO del jurado, con la misma regla que los
 * diplomas a ganadores (`diplomas/resolveRecipients.ts`): sin descalificados, con cobertura
 * completa y con un premio asignado. Los finalistas sin premio no entran.
 */

export const AWARD_LABEL: Record<string, string> = {
  FIRST_PLACE: "1.er premio",
  SECOND_PLACE: "2.º premio",
  THIRD_PLACE: "3.er premio",
  HONORABLE_MENTION: "Mención de honor",
  SPECIAL_MENTION: "Mención especial",
  PEOPLE_CHOICE: "Premio del público",
  SPONSOR_AWARD: "Premio sponsor",
  CUSTOM: "Premio",
};

/** Orden de los premios dentro de una categoría. */
const AWARD_ORDER = Object.keys(AWARD_LABEL);

export type Winner = {
  entryId: string;
  recipientName: string | null;
  entryTitle: string | null;
  prizeLabel: string;
  categoryName: string | null;
  /** Consigna (maratones), si el resultado se calculó por consigna. */
  promptExternalId: string | null;
  position: number | null;
};

export type WinnersResult =
  | { ok: true; winners: Winner[]; batchStatus: string }
  | { ok: false; reason: "NO_RESULTS" };

export async function listContestWinners(
  contestId: string,
): Promise<WinnersResult> {
  const lote = await prisma.fotorankResultBatch.findFirst({
    where: { contestId, status: { in: ["FINALIZED", "PUBLISHED"] } },
    orderBy: { finalizedAt: "desc" },
    select: {
      status: true,
      entries: {
        where: {
          resultStatus: { not: "DISQUALIFIED" },
          coverageStatus: "COMPLETE",
          awardType: { not: null },
        },
        select: {
          awardType: true,
          categoryId: true,
          promptExternalId: true,
          finalPosition: true,
          preliminaryPosition: true,
          juryEntrySnapshot: { select: { entryId: true } },
        },
      },
    },
  });
  if (!lote) return { ok: false, reason: "NO_RESULTS" };

  const premiados = lote.entries.filter(
    (r) => r.awardType && r.awardType in AWARD_LABEL,
  );
  const entryIds = premiados.map((r) => r.juryEntrySnapshot.entryId);
  const [obras, categorias] = await Promise.all([
    prisma.fotorankContestEntry.findMany({
      where: { id: { in: entryIds }, contestId },
      select: { id: true, title: true, author: { select: { name: true } } },
    }),
    prisma.fotorankContestCategory.findMany({
      where: { contestId },
      select: { id: true, name: true, sortOrder: true },
    }),
  ]);
  const obraPorId = new Map(obras.map((o) => [o.id, o]));
  const categoriaPorId = new Map(categorias.map((c) => [c.id, c]));

  const vistos = new Set<string>();
  const winners: Array<{
    winner: Winner;
    orden: [number, string, number, number];
  }> = [];
  for (const r of premiados) {
    const entryId = r.juryEntrySnapshot.entryId;
    const obra = obraPorId.get(entryId);
    // Una obra premiada en dos ámbitos sale una vez, con el primero que aparezca.
    if (!obra || vistos.has(entryId)) continue;
    vistos.add(entryId);
    const categoria = categoriaPorId.get(r.categoryId);
    const posicion = r.finalPosition ?? r.preliminaryPosition ?? null;
    winners.push({
      winner: {
        entryId,
        recipientName: obra.author?.name?.trim() || null,
        entryTitle: obra.title?.trim() || null,
        prizeLabel: AWARD_LABEL[r.awardType!] ?? "Premio",
        categoryName: categoria?.name ?? null,
        promptExternalId: r.promptExternalId,
        position: posicion,
      },
      orden: [
        categoria?.sortOrder ?? 9999,
        r.promptExternalId ?? "",
        AWARD_ORDER.indexOf(r.awardType!),
        posicion ?? 9999,
      ],
    });
  }

  winners.sort((a, b) => {
    const [ca, pa, ta, xa] = a.orden;
    const [cb, pb, tb, xb] = b.orden;
    return ca - cb || pa.localeCompare(pb) || ta - tb || xa - xb;
  });

  return {
    ok: true,
    batchStatus: lote.status,
    winners: winners.map((w) => w.winner),
  };
}
