import "server-only";
import { prisma } from "@repo/db";
import { MENSAJES_PRESUPUESTO, puedeConfigurarPresupuestos, type CtxPresupuestos } from "@/lib/presupuestos/acceso";
import { AJUSTES_COBRO_DE_FABRICA, validarAjustesCobro, type AjustesCobro } from "./datos";

/**
 * Ajustes de cobro (etapa B), una fila por organización (`FotofficeCobroAjustes`). Se configuran en
 * Configuración → Presupuestos (quien tiene `configurar`).
 *
 * Si la tabla todavía no está en la base (la migración se aplica a mano), se leen los de fábrica:
 * todo apagado. Así el resto de FOTOFFICE no se entera.
 */

type Lector = { fotofficeCobroAjustes: Pick<typeof prisma.fotofficeCobroAjustes, "findUnique"> };

export async function leerAjustesCobro(workspaceId: string, cliente: Lector = prisma): Promise<AjustesCobro> {
  try {
    const f = await cliente.fotofficeCobroAjustes.findUnique({
      where: { workspaceId },
      select: { autoConfirmarPedido: true, alias: true, cbuCvu: true, titular: true, cuit: true, banco: true, montoUnico: true },
    });
    return f ? { ...f } : { ...AJUSTES_COBRO_DE_FABRICA };
  } catch (e) {
    const codigo = (e as { code?: unknown } | null)?.code;
    console.error("[cobro-ajustes] no se pudieron leer: van los de fábrica", { codigo: typeof codigo === "string" ? codigo : null });
    return { ...AJUSTES_COBRO_DE_FABRICA };
  }
}

export async function guardarAjustesCobro(ctx: CtxPresupuestos, raw: unknown): Promise<{ ok: true } | { ok: false; error: string }> {
  if (!puedeConfigurarPresupuestos(ctx)) return { ok: false, error: MENSAJES_PRESUPUESTO.sinPermisoAjustes };
  const v = validarAjustesCobro(raw);
  if (!v.ok) return v;
  try {
    await prisma.fotofficeCobroAjustes.upsert({
      where: { workspaceId: ctx.workspaceId },
      create: { workspaceId: ctx.workspaceId, ...v.valor, updatedByUserId: ctx.userId },
      update: { ...v.valor, updatedByUserId: ctx.userId },
    });
    return { ok: true };
  } catch {
    return { ok: false, error: "No pudimos guardar los datos de cobro. Probá de nuevo en un rato." };
  }
}
