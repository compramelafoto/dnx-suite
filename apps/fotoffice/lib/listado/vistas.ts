import "server-only";
import { prisma } from "@repo/db";
import { puede } from "@/lib/access/policy";
import { escribirConsulta, leerConsulta } from "./consulta";
import type { ContextoListado, DefinicionListado } from "./tipos";

export function puedeEditarVista(ctx: ContextoListado, v: { ownerUserId: number; shared: boolean }): boolean {
  return v.shared ? puede(ctx.role, "configurar") : v.ownerUserId === ctx.userId;
}

export function normalizarNombreVista(raw: string | null | undefined): string | null {
  const n = (raw ?? "").trim().replace(/\s+/g, " ");
  return n.length >= 1 && n.length <= 60 ? n : null;
}

export function sanearQuery<F>(def: DefinicionListado<F>, raw: string): string {
  const { consulta } = leerConsulta(def, new URLSearchParams(raw));
  return escribirConsulta(def, { ...consulta, pagina: 1, ver: null });
}

export async function leerUltima(ctx: ContextoListado, clave: string): Promise<string | null> {
  const v = await prisma.fotofficeListView.findFirst({
    where: { workspaceId: ctx.workspaceId, listKey: clave, kind: "ULTIMA", ownerUserId: ctx.userId },
    select: { query: true },
  });
  return v?.query ?? null;
}

export async function guardarUltima(ctx: ContextoListado, clave: string, query: string): Promise<void> {
  const where = { workspaceId: ctx.workspaceId, listKey: clave, kind: "ULTIMA" as const, ownerUserId: ctx.userId };
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
}

export async function listarVistas(ctx: ContextoListado, clave: string) {
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
}

export async function crearVista(ctx: ContextoListado, clave: string, nombre: string, query: string, compartida: boolean) {
  return prisma.fotofficeListView.create({
    data: { workspaceId: ctx.workspaceId, listKey: clave, kind: "GUARDADA", name: nombre, query, ownerUserId: ctx.userId, shared: compartida },
  });
}

async function vistaEditable(ctx: ContextoListado, id: string) {
  const v = await prisma.fotofficeListView.findFirst({
    where: { id, workspaceId: ctx.workspaceId, kind: "GUARDADA" },
    select: { id: true, ownerUserId: true, shared: true },
  });
  return v && puedeEditarVista(ctx, v) ? v : null;
}

export async function renombrarVista(ctx: ContextoListado, id: string, nombre: string): Promise<boolean> {
  if (!(await vistaEditable(ctx, id))) return false;
  await prisma.fotofficeListView.update({ where: { id }, data: { name: nombre } });
  return true;
}

export async function borrarVista(ctx: ContextoListado, id: string): Promise<boolean> {
  if (!(await vistaEditable(ctx, id))) return false;
  await prisma.fotofficeListView.delete({ where: { id } });
  return true;
}
