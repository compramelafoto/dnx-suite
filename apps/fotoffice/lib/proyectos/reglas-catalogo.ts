import "server-only";
import { prisma } from "@repo/db";
import { responsablesDe } from "@/lib/circuitos/tablero";
import { NO_EXISTE, type ResultadoCatalogo } from "@/lib/catalogo/perfil";
import { DIAS_DESDE_EVENTO_MAX, DIAS_DESDE_EVENTO_MIN, LARGO_MAXIMO_NOMBRE, VARIABLES_NOMBRE } from "./constantes";

/**
 * Reglas "Proyecto que genera" de un producto (Etapa 4, Entrega A): qué flujo de trabajo se abre
 * cuando el producto se vende, con responsable opcional, días desde el evento y plantilla de
 * nombre. Pueden ser varias por producto. Se editan con `sales.catalog` (lo exige la acción, igual
 * que los costos-plantilla de `lib/catalogo/costos.ts`).
 *
 * El `workspaceId` sale siempre de la sesión: un flujo, un producto o un responsable de otro
 * workspace es, para éste, algo que no existe.
 */

export const TOPE_REGLAS_POR_PRODUCTO = 10;

export type ReglaEntrada = {
  circuitId: string;
  ownerUserId: number | null;
  daysFromEvent: number;
  nameTemplate: string | null;
  /** Días hasta la entrega que propone el Mostrador; null = los del recorrido. */
  plazoDias: number | null;
  /** Proveedor por omisión (laboratorio). */
  proveedorId: string | null;
};

export const PLAZO_MAXIMO_DIAS = 365;

export type ReglaDetalle = ReglaEntrada & { id: string; circuitName: string; circuitActive: boolean; ultimoPlazoDias: number | null };

export type OpcionesDeRegla = {
  /** Flujos de trabajo activos. */
  circuitos: { id: string; name: string }[];
  /** Miembros del equipo. */
  equipo: { id: number; nombre: string }[];
  /** Proveedores activos (Configuración → Proveedores). */
  proveedores: { id: string; name: string }[];
};

const VARIABLE = /\{([^{}]*)\}/g;

/** Forma de cada regla, sin tocar la base. Los chequeos contra el workspace van en `guardarReglas`. */
export function normalizarReglas(raw: readonly unknown[]): { ok: true; valor: ReglaEntrada[] } | { ok: false; error: string } {
  if (raw.length > TOPE_REGLAS_POR_PRODUCTO) return { ok: false, error: `Un producto admite hasta ${TOPE_REGLAS_POR_PRODUCTO} proyectos.` };
  const out: ReglaEntrada[] = [];
  const vistos = new Set<string>();
  for (const [i, x] of raw.entries()) {
    const fila = `Fila ${i + 1}`;
    const r = (x ?? {}) as Record<string, unknown>;
    const circuitId = typeof r.circuitId === "string" ? r.circuitId.trim() : "";
    if (!circuitId || circuitId.length > 64) return { ok: false, error: `${fila}: elegí el flujo.` };
    if (vistos.has(circuitId)) return { ok: false, error: `${fila}: ese flujo ya está en otra fila.` };
    vistos.add(circuitId);

    const dias = r.daysFromEvent;
    if (typeof dias !== "number" || !Number.isInteger(dias) || dias < DIAS_DESDE_EVENTO_MIN || dias > DIAS_DESDE_EVENTO_MAX) {
      return { ok: false, error: `${fila}: los días desde el evento tienen que ser un número entero entre ${DIAS_DESDE_EVENTO_MIN} y ${DIAS_DESDE_EVENTO_MAX}.` };
    }

    let ownerUserId: number | null = null;
    if (r.ownerUserId !== null && r.ownerUserId !== undefined && r.ownerUserId !== "") {
      if (typeof r.ownerUserId !== "number" || !Number.isInteger(r.ownerUserId) || r.ownerUserId <= 0) {
        return { ok: false, error: `${fila}: el responsable no es válido.` };
      }
      ownerUserId = r.ownerUserId;
    }

    let nameTemplate: string | null = null;
    if (r.nameTemplate !== null && r.nameTemplate !== undefined) {
      if (typeof r.nameTemplate !== "string") return { ok: false, error: `${fila}: el nombre no es válido.` };
      const t = r.nameTemplate.trim();
      if (t.length > LARGO_MAXIMO_NOMBRE) return { ok: false, error: `${fila}: el nombre puede tener hasta ${LARGO_MAXIMO_NOMBRE} caracteres.` };
      for (const m of t.matchAll(VARIABLE)) {
        if (!(VARIABLES_NOMBRE as readonly string[]).includes(m[1] ?? "")) {
          return { ok: false, error: `${fila}: {${m[1]}} no existe. Podés usar {contacto}, {producto}, {evento} y {pedido}.` };
        }
      }
      nameTemplate = t === "" ? null : t;
    }
    let plazoDias: number | null = null;
    if (r.plazoDias !== null && r.plazoDias !== undefined && r.plazoDias !== "") {
      if (typeof r.plazoDias !== "number" || !Number.isInteger(r.plazoDias) || r.plazoDias < 0 || r.plazoDias > PLAZO_MAXIMO_DIAS) {
        return { ok: false, error: `${fila}: el plazo de entrega tiene que ser un número de días entre 0 y ${PLAZO_MAXIMO_DIAS}.` };
      }
      plazoDias = r.plazoDias;
    }
    const proveedorId = typeof r.proveedorId === "string" && r.proveedorId.trim() !== "" ? r.proveedorId.trim().slice(0, 64) : null;
    out.push({ circuitId, ownerUserId, daysFromEvent: dias, nameTemplate, plazoDias, proveedorId });
  }
  return { ok: true, valor: out };
}

export async function leerReglas(workspaceId: string, productId: string): Promise<ReglaDetalle[]> {
  const filas = await prisma.fotofficeProductoProyecto.findMany({
    where: { workspaceId, productId },
    orderBy: [{ order: "asc" }],
    select: { id: true, circuitId: true, ownerUserId: true, daysFromEvent: true, nameTemplate: true, plazoDias: true, ultimoPlazoDias: true, proveedorId: true },
  });
  if (filas.length === 0) return [];
  const circuitos = await prisma.fotofficeCircuit.findMany({
    where: { workspaceId, id: { in: filas.map((f) => f.circuitId) } },
    select: { id: true, name: true, isActive: true },
  });
  const porId = new Map(circuitos.map((c) => [c.id, c]));
  return filas.map((f) => ({
    id: f.id,
    circuitId: f.circuitId,
    ownerUserId: f.ownerUserId,
    daysFromEvent: f.daysFromEvent,
    nameTemplate: f.nameTemplate,
    plazoDias: f.plazoDias,
    ultimoPlazoDias: f.ultimoPlazoDias,
    proveedorId: f.proveedorId,
    circuitName: porId.get(f.circuitId)?.name ?? "Flujo",
    circuitActive: porId.get(f.circuitId)?.isActive === true,
  }));
}

/** Los flujos de trabajo activos y el equipo del workspace, para armar la sección. */
export async function opcionesDeRegla(workspaceId: string): Promise<OpcionesDeRegla> {
  const [circuitos, equipo, proveedores] = await Promise.all([
    prisma.fotofficeCircuit.findMany({
      where: { workspaceId, kind: "TRABAJO", isActive: true },
      orderBy: [{ isDefault: "desc" }, { name: "asc" }],
      select: { id: true, name: true },
    }),
    responsablesDe(workspaceId),
    prisma.fotofficeProveedor.findMany({ where: { workspaceId, active: true }, orderBy: { name: "asc" }, select: { id: true, name: true } }),
  ]);
  return { circuitos, equipo, proveedores };
}

export async function guardarReglas(workspaceId: string, productId: string, entrada: readonly unknown[]): Promise<ResultadoCatalogo> {
  const normal = normalizarReglas(entrada);
  if (!normal.ok) return normal;
  const reglas = normal.valor;

  return prisma.$transaction(async (tx) => {
    // Candado por producto: dos guardados a la vez no intercalan su borrar-y-crear.
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`fotoffice-proyecto-reglas:${workspaceId}:${productId}`}))`;
    const producto = await tx.product.findFirst({ where: { id: productId, workspaceId }, select: { id: true } });
    if (!producto) return NO_EXISTE;

    if (reglas.length > 0) {
      const previas = new Set(
        (await tx.fotofficeProductoProyecto.findMany({ where: { workspaceId, productId }, select: { circuitId: true } })).map((f) => f.circuitId),
      );
      const circuitos = await tx.fotofficeCircuit.findMany({
        where: { workspaceId, id: { in: reglas.map((r) => r.circuitId) }, kind: "TRABAJO" },
        select: { id: true, isActive: true },
      });
      const porId = new Map(circuitos.map((c) => [c.id, c]));
      for (const [i, r] of reglas.entries()) {
        const c = porId.get(r.circuitId);
        // Un flujo ya usado por la regla puede estar dado de baja (se saltea al crear); uno nuevo, no.
        if (!c || (!c.isActive && !previas.has(r.circuitId))) return { ok: false as const, error: `Fila ${i + 1}: elegí un flujo de trabajo activo.` };
      }
      const duenos = [...new Set(reglas.map((r) => r.ownerUserId).filter((x): x is number => x !== null))];
      if (duenos.length > 0) {
        const miembros = await tx.workspaceMembership.findMany({ where: { workspaceId, userId: { in: duenos } }, select: { userId: true } });
        if (miembros.length !== duenos.length) return { ok: false as const, error: "Uno de los responsables no es parte del equipo." };
      }
      const provs = [...new Set(reglas.map((r) => r.proveedorId).filter((x): x is string => x !== null))];
      if (provs.length > 0) {
        const existen = await tx.fotofficeProveedor.count({ where: { workspaceId, id: { in: provs } } });
        if (existen !== provs.length) return { ok: false as const, error: "Uno de los proveedores no existe." };
      }
    }

    // El último plazo usado en el Mostrador sobrevive al guardar: es lo que se va a proponer.
    const ultimos = new Map(
      (
        await tx.fotofficeProductoProyecto.findMany({ where: { workspaceId, productId }, select: { circuitId: true, ultimoPlazoDias: true } })
      ).map((f) => [f.circuitId, f.ultimoPlazoDias]),
    );
    await tx.fotofficeProductoProyecto.deleteMany({ where: { workspaceId, productId } });
    if (reglas.length > 0) {
      await tx.fotofficeProductoProyecto.createMany({
        data: reglas.map((r, order) => ({
          workspaceId,
          productId,
          circuitId: r.circuitId,
          ownerUserId: r.ownerUserId,
          daysFromEvent: r.daysFromEvent,
          nameTemplate: r.nameTemplate,
          plazoDias: r.plazoDias,
          proveedorId: r.proveedorId,
          ultimoPlazoDias: ultimos.get(r.circuitId) ?? null,
          order,
        })),
      });
    }
    return { ok: true } as const;
  });
}

/**
 * «Proveedor por defecto» de la ficha del producto: el mismo campo de sus reglas de «Proyecto que
 * genera», puesto a la vista. Se aplica a todas las reglas del producto (casi siempre una).
 */
export async function guardarProveedorPorDefecto(workspaceId: string, productId: string, proveedorId: string | null): Promise<{ ok: true } | { ok: false; error: string }> {
  if (!/^[A-Za-z0-9_-]{1,64}$/.test(productId)) return { ok: false, error: "El producto no es válido." };
  if (proveedorId !== null) {
    if (!/^[A-Za-z0-9_-]{1,64}$/.test(proveedorId)) return { ok: false, error: "El proveedor no es válido." };
    const existe = await prisma.fotofficeProveedor.count({ where: { id: proveedorId, workspaceId } });
    if (existe === 0) return { ok: false, error: "Ese proveedor no existe." };
  }
  const r = await prisma.fotofficeProductoProyecto.updateMany({ where: { workspaceId, productId }, data: { proveedorId } });
  return r.count > 0 ? { ok: true } : { ok: false, error: "Este producto no genera un trabajo: activá «Proyecto que genera» primero." };
}
