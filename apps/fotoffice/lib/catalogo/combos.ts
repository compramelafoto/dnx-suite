import "server-only";
import { prisma } from "@repo/db";
import { decimalArsToMinor } from "@/lib/membership/money";
import { NO_EXISTE, type ResultadoCatalogo } from "./perfil";
import { formaCiclo, normalizarComponentes, resumenCombo, type ComponenteEntrada, type ResumenCombo } from "./reglas";

/**
 * Combos: un producto del catálogo que agrupa otros, con precio propio. La ficha muestra la suma
 * de los componentes y el ahorro (spec §2 A.1, §3.1).
 *
 * Reglas (las que el SQL no puede ver):
 * - todos los componentes son productos del MISMO workspace;
 * - sin ciclos: A contiene B que contiene A (un combo puede tener otro combo adentro, mientras
 *   no se vuelva sobre sí mismo);
 * - un combo no se contiene a sí mismo (esto también lo frena un CHECK).
 *
 * Guardar reemplaza la lista entera, adentro de una transacción con un candado por workspace:
 * dos personas guardando A→B y B→A a la vez no pueden pasar las dos el control de ciclos.
 */

export type ComponenteCombo = {
  productId: string;
  name: string;
  isActive: boolean;
  quantity: number;
  priceMinor: number;
};

export type ComboDetalle = {
  componentes: ComponenteCombo[];
  resumen: ResumenCombo;
};

export async function leerCombo(workspaceId: string, comboProductId: string, precioComboMinor: number): Promise<ComboDetalle> {
  const filas = await prisma.fotofficeComboItem.findMany({
    where: { workspaceId, comboProductId },
    orderBy: [{ order: "asc" }],
    select: { componentProductId: true, quantity: true },
  });
  const productos = filas.length
    ? await prisma.product.findMany({
        where: { workspaceId, id: { in: filas.map((f) => f.componentProductId) } },
        select: { id: true, name: true, isActive: true, priceArs: true },
      })
    : [];
  const porId = new Map(productos.map((p) => [p.id, p]));
  const componentes: ComponenteCombo[] = [];
  for (const f of filas) {
    const p = porId.get(f.componentProductId);
    // Un componente de otro workspace (fila mal cargada) no se muestra ni suma.
    if (!p) continue;
    componentes.push({ productId: p.id, name: p.name, isActive: p.isActive, quantity: f.quantity, priceMinor: decimalArsToMinor(p.priceArs) });
  }
  return { componentes, resumen: resumenCombo(precioComboMinor, componentes) };
}

/** Lo que se ofrece para agregar a un combo: los productos activos del workspace, menos él mismo. */
export async function productosParaCombo(workspaceId: string, comboProductId: string): Promise<{ id: string; name: string; priceMinor: number }[]> {
  const filas = await prisma.product.findMany({
    where: { workspaceId, isActive: true, id: { not: comboProductId } },
    orderBy: [{ name: "asc" }],
    select: { id: true, name: true, priceArs: true },
    take: 500,
  });
  return filas.map((p) => ({ id: p.id, name: p.name, priceMinor: decimalArsToMinor(p.priceArs) }));
}

export async function guardarComponentes(
  workspaceId: string,
  comboProductId: string,
  entrada: readonly ComponenteEntrada[],
): Promise<ResultadoCatalogo> {
  const normal = normalizarComponentes(comboProductId, entrada);
  if (!normal.ok) return normal;
  const componentes = normal.valor;

  return prisma.$transaction(async (tx) => {
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`fotoffice-combos:${workspaceId}`}))`;

    const combo = await tx.product.findFirst({ where: { id: comboProductId, workspaceId }, select: { id: true } });
    if (!combo) return NO_EXISTE;

    const ids = componentes.map((c) => c.productId);
    if (ids.length > 0) {
      const propios = await tx.product.findMany({ where: { workspaceId, id: { in: ids } }, select: { id: true } });
      if (propios.length !== new Set(ids).size) return { ok: false, error: "Uno de los componentes no es un producto de tu catálogo." };

      const existentes = await tx.fotofficeComboItem.findMany({
        where: { workspaceId },
        select: { comboProductId: true, componentProductId: true },
      });
      const aristas = new Map<string, string[]>();
      for (const e of existentes) {
        if (e.comboProductId === comboProductId) continue;
        aristas.set(e.comboProductId, [...(aristas.get(e.comboProductId) ?? []), e.componentProductId]);
      }
      if (formaCiclo(comboProductId, ids, aristas)) {
        return { ok: false, error: "Ese componente ya contiene a este combo: se formaría un círculo." };
      }
    }

    await tx.fotofficeComboItem.deleteMany({ where: { workspaceId, comboProductId } });
    if (componentes.length > 0) {
      await tx.fotofficeComboItem.createMany({
        data: componentes.map((c, order) => ({
          workspaceId,
          comboProductId,
          componentProductId: c.productId,
          quantity: c.quantity,
          order,
        })),
      });
    }
    const isCombo = componentes.length > 0;
    await tx.fotofficeProductoCatalogo.upsert({
      where: { productId: comboProductId },
      create: { workspaceId, productId: comboProductId, isCombo },
      update: { isCombo },
    });
    return { ok: true } as const;
  });
}
