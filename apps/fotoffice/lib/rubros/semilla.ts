import "server-only";
import { prisma } from "@repo/db";
import { esSlugDnx } from "@/lib/slug-dnx";
import { mismoNombre, type LadoRubro } from "./rubros";

/**
 * Plan de cuentas de DNX Estudio (el que usaba en Alboom): ingresos 3.1.x por tipo de trabajo y
 * costos 4.0/4.1. Sólo para DNX (`esSlugDnx`).
 *
 * Idempotente y sin pisar nada: crea las categorías que faltan (buscándolas por lado y nombre,
 * sin mirar mayúsculas ni tildes) y a las que ya existen sólo les completa el código y el padre
 * si están vacíos. Si alguien ya les puso otro código u otro padre, se respeta.
 */

export type ItemPlan = { kind: LadoRubro; code: string; name: string; parentCode: string | null };

function padre(kind: LadoRubro, code: string, name: string, hijos: [string, string][]): ItemPlan[] {
  return [
    { kind, code, name, parentCode: null },
    ...hijos.map(([c, n]) => ({ kind, code: c, name: n, parentCode: code })),
  ];
}

/** Padres primero: al crear un hijo, su padre ya existe. */
export const PLAN_DNX: readonly ItemPlan[] = [
  ...padre("INGRESO", "3.1", "Estudio Fotográfico", [
    ["3.1.1", "Bodas"],
    ["3.1.2", "Eventos Gral"],
    ["3.1.3", "Sesión fotográfica"],
    ["3.1.4", "Álbumes"],
    ["3.1.5", "Impresiones/ampliaciones"],
    ["3.1.6", "Cumpleaños de 15"],
    ["3.1.7", "Cumpleaños Infantiles"],
  ]),
  ...padre("EGRESO", "4.0", "La Isla", [
    ["4.0.1", "Fotolibros"],
    ["4.0.2", "Impresiones"],
    ["4.0.3", "Cuadros"],
  ]),
  ...padre("EGRESO", "4.1", "Costos Directos", [
    ["4.1.1", "Alquiler de Equipamientos"],
    ["4.1.3", "Videógrafos Freelancers"],
    ["4.1.5", "Fotógrafos Freelancers"],
    ["4.1.7", "Maquillaje/Cabellos"],
    ["4.1.8", "Modelos"],
    ["4.1.9", "Viajes"],
  ]),
];

/** Después de las categorías que ya tenga el negocio (las sembradas van de 0 a 90). */
const ORDEN_INICIAL = 100;

export type ResultadoSemilla =
  | { ok: true; creadas: number; completadas: number; respetadas: number }
  | { ok: false; error: string };

type Categoria = { id: string; name: string; kind: string };

function buscar(categorias: readonly Categoria[], item: { kind: string; name: string }): Categoria | undefined {
  const delLado = categorias.filter((c) => c.kind === item.kind);
  return delLado.find((c) => c.name === item.name) ?? delLado.find((c) => mismoNombre(c.name, item.name));
}

export async function sembrarPlanDnx(workspaceId: string, slug: string | null | undefined): Promise<ResultadoSemilla> {
  if (!esSlugDnx(slug)) return { ok: false, error: "El plan de cuentas de DNX es sólo para DNX Estudio." };

  try {
    return await sembrarEnTransaccion(workspaceId);
  } catch (e) {
    // Dos clics a la vez: las dos transacciones ven "sin perfil" y la segunda choca con el único
    // `categoryId` de `FotofficeRubro` (P2002). Postgres sólo lo informa cuando la otra ya se
    // confirmó, así que el plan quedó cargado: se trata como hecho en vez de mostrar un error.
    if ((e as { code?: unknown } | null)?.code === "P2002") return { ok: true, creadas: 0, completadas: 0, respetadas: 0 };
    throw e;
  }
}

function sembrarEnTransaccion(workspaceId: string): Promise<ResultadoSemilla> {
  return prisma.$transaction(async (tx) => {
    // 1. Categorías: crea las que faltan. `skipDuplicates` cubre dos clics a la vez (el único es
    //    por workspace, lado y nombre exacto).
    const antes = await tx.cashCategory.findMany({ where: { workspaceId }, select: { id: true, name: true, kind: true } });
    const faltan = PLAN_DNX.filter((item) => !buscar(antes, item));
    if (faltan.length > 0) {
      await tx.cashCategory.createMany({
        data: faltan.map((item) => ({
          workspaceId,
          name: item.name,
          kind: item.kind,
          order: ORDEN_INICIAL + PLAN_DNX.indexOf(item),
        })),
        skipDuplicates: true,
      });
    }
    const categorias = await tx.cashCategory.findMany({ where: { workspaceId }, select: { id: true, name: true, kind: true } });

    // 2. Perfiles: crea los que faltan y completa los vacíos, sin pisar lo que alguien cargó.
    const perfiles = new Map(
      (
        await tx.fotofficeRubro.findMany({
          where: { workspaceId },
          select: { categoryId: true, parentCategoryId: true, code: true },
        })
      ).map((p) => [p.categoryId, { parentCategoryId: p.parentCategoryId, code: p.code }]),
    );
    const tieneHijos = (id: string) => [...perfiles.values()].some((p) => p.parentCategoryId === id);

    let completadas = 0;
    let respetadas = 0;
    const idPorCodigo = new Map<string, string>();

    for (const item of PLAN_DNX) {
      const cat = buscar(categorias, item);
      if (!cat) continue; // No debería pasar: se acaba de crear.
      idPorCodigo.set(item.code, cat.id);

      // El padre sólo se pone si deja un solo nivel: el padre no tiene padre y este rubro no es
      // padre de otros.
      let parentCategoryId: string | null = null;
      if (item.parentCode) {
        const padreId = idPorCodigo.get(item.parentCode) ?? null;
        const perfilPadre = padreId ? perfiles.get(padreId) : undefined;
        if (padreId && padreId !== cat.id && !perfilPadre?.parentCategoryId && !tieneHijos(cat.id)) {
          parentCategoryId = padreId;
        }
      }

      const actual = perfiles.get(cat.id);
      if (!actual) {
        await tx.fotofficeRubro.create({ data: { workspaceId, categoryId: cat.id, code: item.code, parentCategoryId } });
        perfiles.set(cat.id, { code: item.code, parentCategoryId });
        continue;
      }

      const cambios: { code?: string; parentCategoryId?: string } = {};
      if (actual.code === null) cambios.code = item.code;
      if (actual.parentCategoryId === null && parentCategoryId !== null) cambios.parentCategoryId = parentCategoryId;
      const otroCodigo = actual.code !== null && actual.code !== item.code;
      const otroPadre = item.parentCode !== null && actual.parentCategoryId !== null && actual.parentCategoryId !== parentCategoryId;
      if (otroCodigo || otroPadre) respetadas++;

      if (Object.keys(cambios).length > 0) {
        await tx.fotofficeRubro.update({ where: { categoryId: cat.id }, data: cambios });
        perfiles.set(cat.id, { ...actual, ...cambios });
        completadas++;
      }
    }

    return { ok: true as const, creadas: faltan.length, completadas, respetadas };
  });
}
