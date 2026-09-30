import { prisma } from "@repo/db";
import { CIRCUITOS_DNX, MOTIVOS_INICIALES, type SemillaCircuito } from "./dnx";
import { CIRCUITO_MINIMO } from "./minimo";

export { CIRCUITOS_DNX, MOTIVOS_INICIALES } from "./dnx";
export type { SemillaCircuito } from "./dnx";
export { CIRCUITO_MINIMO } from "./minimo";

/** La carga inicial de DNX son ~21 circuitos, ~100 etapas y ~50 tareas modelo: el tope por defecto (5 s) no alcanza en Neon. */
export const OPCIONES_TRANSACCION = { timeout: 30_000, maxWait: 10_000 };

function datosCircuito(workspaceId: string, c: SemillaCircuito) {
  return {
    workspaceId,
    name: c.name,
    kind: c.kind,
    isDefault: c.isDefault ?? false,
    stages: {
      create: c.stages.map((s, i) => ({
        name: s.name,
        order: i,
        days: s.days,
        color: s.color ?? "gris",
        leadStatus: s.leadStatus ?? null,
        templates: {
          create: (s.tasks ?? []).map((t, j) => ({ title: t.title, days: t.days ?? 0, required: t.required ?? false, order: j })),
        },
      })),
    },
  };
}

/**
 * Crea los circuitos iniciales del workspace si todavía no tiene ninguno.
 * DNX Estudio recibe sus 21 circuitos; el resto, un circuito de ventas mínimo.
 */
export async function asegurarCircuitos(workspaceId: string, slug: string): Promise<void> {
  try {
    await prisma.$transaction(async (tx) => {
      if ((await tx.fotofficeCircuit.count({ where: { workspaceId } })) > 0) return;
      const circuitos = slug === "dnx-estudio" ? CIRCUITOS_DNX : [CIRCUITO_MINIMO];
      for (const c of circuitos) {
        await tx.fotofficeCircuit.create({ data: datosCircuito(workspaceId, c) });
      }
      if ((await tx.fotofficeLossReason.count({ where: { workspaceId } })) === 0) {
        await tx.fotofficeLossReason.createMany({
          data: MOTIVOS_INICIALES.map((name, order) => ({ workspaceId, name, order })),
        });
      }
    }, OPCIONES_TRANSACCION);
  } catch (error) {
    // Otra petición se adelantó y creó los mismos circuitos: no hay nada que hacer.
    if ((error as { code?: string } | null)?.code === "P2002") return;
    throw error;
  }
}
