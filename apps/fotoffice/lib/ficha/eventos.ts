import "server-only";
import type { prisma, Prisma } from "@repo/db";
import type { Dueno } from "./persona";

export type Actor = { userId: number | null; label: string };
type Db = Pick<typeof prisma, "fotofficePersonEvent"> | Prisma.TransactionClient;

/** Anota un hecho de la ficha (etiqueta, relación, adjunto, vínculo con socio...). */
export async function registrarEventoPersona(
  db: Db,
  e: { workspaceId: string; dueno: Dueno; kind: string; detail?: Prisma.InputJsonValue; actor: Actor },
): Promise<void> {
  await db.fotofficePersonEvent.create({
    data: {
      workspaceId: e.workspaceId,
      ...e.dueno,
      kind: e.kind,
      detail: e.detail,
      actorUserId: e.actor.userId,
      actorLabel: e.actor.label,
    },
  });
}

function normal(v: unknown): unknown {
  if (v === "" || v === undefined) return null;
  if (v instanceof Date) return v.getTime();
  return v;
}

/** Sólo los campos listados que cambiaron. Vacío y nulo cuentan como lo mismo. */
export function diffCampos(
  antes: Record<string, unknown>,
  despues: Record<string, unknown>,
  campos: readonly string[],
): Record<string, { before: unknown; after: unknown }> {
  const out: Record<string, { before: unknown; after: unknown }> = {};
  for (const c of campos) {
    if (normal(antes[c]) !== normal(despues[c])) out[c] = { before: antes[c] ?? null, after: despues[c] ?? null };
  }
  return out;
}
