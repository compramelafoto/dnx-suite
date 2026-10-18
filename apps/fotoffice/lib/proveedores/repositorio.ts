import "server-only";
import { Prisma, prisma } from "@repo/db";
import { validarProveedor } from "./datos";

export type FilaProveedor = {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
  notes: string | null;
  active: boolean;
  trabajos: number;
};

export async function listarProveedores(workspaceId: string, opts: { soloActivos?: boolean } = {}): Promise<FilaProveedor[]> {
  const filas = await prisma.fotofficeProveedor.findMany({
    where: { workspaceId, ...(opts.soloActivos ? { active: true } : {}) },
    orderBy: [{ active: "desc" }, { name: "asc" }],
    select: { id: true, name: true, email: true, phone: true, notes: true, active: true, _count: { select: { proyectos: true } } },
  });
  return filas.map(({ _count, ...f }) => ({ ...f, trabajos: _count.proyectos }));
}

export type ResultadoProveedor = { ok: true; id: string } | { ok: false; error: string };

/** Alta o edición. El nombre no se repite dentro del negocio. */
export async function guardarProveedor(workspaceId: string, id: string | null, raw: Parameters<typeof validarProveedor>[0]): Promise<ResultadoProveedor> {
  const v = validarProveedor(raw);
  if (!v.ok) return v;
  try {
    if (id) {
      const r = await prisma.fotofficeProveedor.updateMany({ where: { id, workspaceId }, data: v.valor });
      if (r.count === 0) return { ok: false, error: "Ese proveedor no existe." };
      return { ok: true, id };
    }
    const creado = await prisma.fotofficeProveedor.create({ data: { workspaceId, ...v.valor }, select: { id: true } });
    return { ok: true, id: creado.id };
  } catch (e) {
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") {
      return { ok: false, error: "Ya hay un proveedor con ese nombre." };
    }
    throw e;
  }
}

/** Se desactiva en vez de borrarse: los trabajos viejos lo siguen nombrando. */
export async function cambiarActivoProveedor(workspaceId: string, id: string, active: boolean): Promise<boolean> {
  const r = await prisma.fotofficeProveedor.updateMany({ where: { id, workspaceId }, data: { active } });
  return r.count > 0;
}
