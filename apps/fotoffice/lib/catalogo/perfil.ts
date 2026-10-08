import "server-only";
import { prisma } from "@repo/db";
import { normalizarRubro, PERFIL_VACIO, type PerfilCatalogo } from "./reglas";
import { listarRubros } from "@/lib/rubros/repositorio";
import { agruparRubros } from "@/lib/rubros/rubros";

/**
 * "Para presupuestos": el perfil 1:1 de un producto (en lista de precios y rubro de ingreso).
 *
 * El `workspaceId` sale siempre de la sesión: un producto de otro negocio es, para éste, un
 * producto que no existe. El permiso (`sales.catalog`) lo pide la acción que llama.
 */

export type ResultadoCatalogo = { ok: true } | { ok: false; error: string };

export const NO_EXISTE: ResultadoCatalogo = { ok: false, error: "Ese producto no existe." };

export async function productoDelWorkspace(workspaceId: string, productId: string): Promise<boolean> {
  if (typeof productId !== "string" || productId === "") return false;
  return (await prisma.product.findFirst({ where: { id: productId, workspaceId }, select: { id: true } })) !== null;
}

export async function leerPerfil(workspaceId: string, productId: string): Promise<PerfilCatalogo> {
  const p = await prisma.fotofficeProductoCatalogo.findFirst({
    where: { productId, workspaceId },
    select: { inPriceList: true, incomeLabel: true, incomeCategoryId: true, isCombo: true },
  });
  return p ?? { ...PERFIL_VACIO };
}

/**
 * Guarda el perfil. `incomeLabel` sólo se toca si llega (`undefined` = no cambiar): desde la
 * etapa 3 la ficha ya no lo edita, y borrarlo perdería la sugerencia.
 *
 * `incomeCategoryId` tiene que ser una categoría de INGRESO de este workspace. No se exige que
 * esté activa: un producto que ya tenía un rubro dado de baja se puede volver a guardar sin
 * perderlo (la ficha sólo ofrece las activas más la actual).
 */
export async function guardarPerfil(
  workspaceId: string,
  productId: string,
  datos: { inPriceList: unknown; incomeLabel?: unknown; incomeCategoryId?: unknown },
): Promise<ResultadoCatalogo> {
  if (!(await productoDelWorkspace(workspaceId, productId))) return NO_EXISTE;

  let incomeLabel: string | null | undefined;
  if (datos.incomeLabel !== undefined) {
    const rubro = normalizarRubro(datos.incomeLabel);
    if (!rubro.ok) return rubro;
    incomeLabel = rubro.valor;
  }

  let incomeCategoryId: string | null | undefined;
  if (datos.incomeCategoryId !== undefined) {
    const raw = datos.incomeCategoryId;
    if (raw === null || raw === "") {
      incomeCategoryId = null;
    } else if (typeof raw !== "string") {
      return RUBRO_INVALIDO;
    } else {
      const ok = await prisma.cashCategory.findFirst({
        where: { id: raw, workspaceId, kind: "INGRESO" },
        select: { id: true },
      });
      if (!ok) return RUBRO_INVALIDO;
      incomeCategoryId = raw;
    }
  }

  const valores = {
    inPriceList: datos.inPriceList === true,
    ...(incomeLabel !== undefined ? { incomeLabel } : {}),
    ...(incomeCategoryId !== undefined ? { incomeCategoryId } : {}),
  };
  await prisma.fotofficeProductoCatalogo.upsert({
    where: { productId },
    create: { workspaceId, productId, ...valores },
    update: valores,
  });
  return { ok: true };
}

export const RUBRO_INVALIDO: ResultadoCatalogo = { ok: false, error: "Elegí un rubro de ingreso de la lista." };

export type RubroIngresoOpcion = { id: string; name: string; code: string | null; isActive: boolean; esHijo: boolean };

/**
 * Los rubros de ingreso para el selector de la ficha: los activos del workspace, más el que el
 * producto ya tenga aunque esté dado de baja (si no, guardar lo cambiaría sin querer). Con el
 * código y agrupados por padre (`agruparRubros`) para que el padre quede arriba de sus hijos.
 */
export async function rubrosDeIngreso(workspaceId: string, productId: string): Promise<RubroIngresoOpcion[]> {
  const [todos, actual] = await Promise.all([
    listarRubros(workspaceId, { kind: "INGRESO", includeInactive: true }),
    prisma.fotofficeProductoCatalogo.findFirst({ where: { productId, workspaceId }, select: { incomeCategoryId: true } }),
  ]);
  const actualId = actual?.incomeCategoryId ?? null;
  const visibles = todos.filter((r) => r.isActive || r.id === actualId);
  return agruparRubros(visibles).flatMap(({ rubro, hijos }) =>
    [rubro, ...hijos].map((r) => ({ id: r.id, name: r.name, code: r.code, isActive: r.isActive, esHijo: r !== rubro })),
  );
}

/** Rubros ya usados en el workspace, para sugerirlos al escribir. */
export async function rubrosUsados(workspaceId: string): Promise<string[]> {
  const filas = await prisma.fotofficeProductoCatalogo.findMany({
    where: { workspaceId, incomeLabel: { not: null } },
    select: { incomeLabel: true },
  });
  return [...new Set(filas.map((f) => f.incomeLabel).filter((x): x is string => !!x))].sort((a, b) => a.localeCompare(b, "es"));
}
