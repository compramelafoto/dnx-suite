import "server-only";
import { prisma } from "@repo/db";
import { puede } from "@/lib/access/policy";
import { consultaSaneada } from "./consulta";
import type { ContextoListado, DefinicionListado } from "./tipos";

export function puedeEditarVista(ctx: ContextoListado, v: { ownerUserId: number; shared: boolean }): boolean {
  return v.shared ? puede(ctx.role, "configurar") : v.ownerUserId === ctx.userId;
}

export function normalizarNombreVista(raw: string | null | undefined): string | null {
  const n = (raw ?? "").trim().replace(/\s+/g, " ");
  return n.length >= 1 && n.length <= 60 ? n : null;
}

export function sanearQuery<F>(def: DefinicionListado<F>, raw: string): string {
  return consultaSaneada(def, new URLSearchParams(raw));
}

/**
 * Recordar filtros y vistas es una comodidad: si la tabla falla (p. ej. el SQL todavía no se
 * aplicó en esa base, o la base está caída un instante) la lista se dibuja igual, sin última
 * consulta, sin vistas y sin guardar. Al registro va sólo la lista y el tipo de error, nunca la
 * consulta ni datos de la persona.
 */
function avisarFallaDeVistas(operacion: string, clave: string, e: unknown) {
  const codigo = e && typeof e === "object" && "code" in e ? String((e as { code: unknown }).code) : undefined;
  const nombre = e instanceof Error ? e.name : typeof e;
  console.error(`[listado] No se pudo ${operacion} (lista "${clave}"): la lista sigue sin recordar filtros.`, { nombre, codigo });
}

export async function leerUltima(ctx: ContextoListado, clave: string): Promise<string | null> {
  try {
    const v = await prisma.fotofficeListView.findFirst({
      where: { workspaceId: ctx.workspaceId, listKey: clave, kind: "ULTIMA", ownerUserId: ctx.userId },
      select: { query: true },
    });
    return v?.query ?? null;
  } catch (e) {
    avisarFallaDeVistas("leer la última consulta", clave, e);
    return null;
  }
}

export async function guardarUltima(ctx: ContextoListado, clave: string, query: string): Promise<void> {
  const where = { workspaceId: ctx.workspaceId, listKey: clave, kind: "ULTIMA" as const, ownerUserId: ctx.userId };
  try {
    const actual = await prisma.fotofficeListView.findFirst({ where, select: { id: true, query: true } });
    if (actual) {
      if (actual.query !== query) await prisma.fotofficeListView.update({ where: { id: actual.id }, data: { query } });
      return;
    }
    try {
      await prisma.fotofficeListView.create({ data: { ...where, query } });
    } catch {
      // Otra pestaña la creó en el medio (índice único parcial): se actualiza la que ganó.
      await prisma.fotofficeListView.updateMany({ where, data: { query } });
    }
  } catch (e) {
    avisarFallaDeVistas("guardar la última consulta", clave, e);
  }
}

export async function listarVistas(ctx: ContextoListado, clave: string) {
  try {
    const filas = await prisma.fotofficeListView.findMany({
      where: {
        workspaceId: ctx.workspaceId,
        listKey: clave,
        kind: "GUARDADA",
        OR: [{ ownerUserId: ctx.userId }, { shared: true }],
      },
      orderBy: { name: "asc" },
      select: { id: true, name: true, query: true, shared: true, ownerUserId: true },
    });
    return filas.map((v) => ({ id: v.id, name: v.name ?? "", query: v.query, shared: v.shared, editable: puedeEditarVista(ctx, v) }));
  } catch (e) {
    avisarFallaDeVistas("leer las vistas guardadas", clave, e);
    return [];
  }
}

export async function crearVista(ctx: ContextoListado, clave: string, nombre: string, query: string, compartida: boolean) {
  return prisma.fotofficeListView.create({
    data: { workspaceId: ctx.workspaceId, listKey: clave, kind: "GUARDADA", name: nombre, query, ownerUserId: ctx.userId, shared: compartida },
  });
}

/** Sólo una vista guardada de esta lista y este workspace, y que la persona pueda modificar. */
async function vistaEditable(ctx: ContextoListado, clave: string, id: string) {
  const v = await prisma.fotofficeListView.findFirst({
    where: { id, workspaceId: ctx.workspaceId, listKey: clave, kind: "GUARDADA" },
    select: { id: true, ownerUserId: true, shared: true },
  });
  return v && puedeEditarVista(ctx, v) ? v : null;
}

export async function renombrarVista(ctx: ContextoListado, clave: string, id: string, nombre: string): Promise<boolean> {
  if (!(await vistaEditable(ctx, clave, id))) return false;
  await prisma.fotofficeListView.update({ where: { id }, data: { name: nombre } });
  return true;
}

export async function borrarVista(ctx: ContextoListado, clave: string, id: string): Promise<boolean> {
  if (!(await vistaEditable(ctx, clave, id))) return false;
  await prisma.fotofficeListView.delete({ where: { id } });
  return true;
}
