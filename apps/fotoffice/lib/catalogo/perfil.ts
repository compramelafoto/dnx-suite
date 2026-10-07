import "server-only";
import { prisma } from "@repo/db";
import { normalizarRubro, PERFIL_VACIO, type PerfilCatalogo } from "./reglas";

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
    select: { inPriceList: true, incomeLabel: true, isCombo: true },
  });
  return p ?? { ...PERFIL_VACIO };
}

export async function guardarPerfil(
  workspaceId: string,
  productId: string,
  datos: { inPriceList: unknown; incomeLabel: unknown },
): Promise<ResultadoCatalogo> {
  if (!(await productoDelWorkspace(workspaceId, productId))) return NO_EXISTE;
  const rubro = normalizarRubro(datos.incomeLabel);
  if (!rubro.ok) return rubro;
  const valores = { inPriceList: datos.inPriceList === true, incomeLabel: rubro.valor };
  await prisma.fotofficeProductoCatalogo.upsert({
    where: { productId },
    create: { workspaceId, productId, ...valores },
    update: valores,
  });
  return { ok: true };
}

/** Rubros ya usados en el workspace, para sugerirlos al escribir. */
export async function rubrosUsados(workspaceId: string): Promise<string[]> {
  const filas = await prisma.fotofficeProductoCatalogo.findMany({
    where: { workspaceId, incomeLabel: { not: null } },
    select: { incomeLabel: true },
  });
  return [...new Set(filas.map((f) => f.incomeLabel).filter((x): x is string => !!x))].sort((a, b) => a.localeCompare(b, "es"));
}
