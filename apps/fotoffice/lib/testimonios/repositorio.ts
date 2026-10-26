import "server-only";
import { prisma, type Prisma } from "@repo/db";
import {
  ESTADOS_TESTIMONIO,
  esTablaFaltante,
  puedePublicar,
  textoConsentimientoManual,
  validarEdicionPanel,
  type DatosTestimonio,
  type EstadoTestimonio,
  type OrigenTestimonio,
} from "./dominio";

/**
 * Escrituras y lecturas del panel de Testimonios. Todo filtra por `workspaceId`: un id de otro
 * estudio nunca se lee ni se toca. Lo público (sin el correo del autor) vive en `publico.ts`.
 */

export type ExtrasTestimonio = {
  origen: OrigenTestimonio;
  consentimiento: boolean;
  consentimientoTexto?: string | null;
  clientId?: string | null;
  proyectoId?: string | null;
  trabajoId?: string | null;
  invitacionId?: string | null;
  autorFotoUrl?: string | null;
  autorFotoKey?: string | null;
  origenExternoId?: string | null;
};

/**
 * Crea un testimonio PENDIENTE: siempre pasa por la moderación del estudio antes de salir. `db` es
 * la transacción cuando nace de una invitación (se marca usada en la misma).
 */
export async function crearTestimonio(
  workspaceId: string,
  datos: DatosTestimonio,
  extras: ExtrasTestimonio,
  ahora: Date = new Date(),
  db: Prisma.TransactionClient | typeof prisma = prisma,
): Promise<{ id: string }> {
  return db.fotofficeTestimonio.create({
    data: {
      workspaceId,
      ...datos,
      estado: "PENDIENTE",
      origen: extras.origen,
      consentimiento: extras.consentimiento,
      consentimientoAt: extras.consentimiento ? ahora : null,
      consentimientoTexto: extras.consentimiento ? (extras.consentimientoTexto ?? null) : null,
      clientId: extras.clientId ?? null,
      proyectoId: extras.proyectoId ?? null,
      trabajoId: extras.trabajoId ?? null,
      invitacionId: extras.invitacionId ?? null,
      autorFotoUrl: extras.autorFotoUrl ?? null,
      autorFotoKey: extras.autorFotoKey ?? null,
      origenExternoId: extras.origenExternoId ?? null,
    },
    select: { id: true },
  });
}

/**
 * Crea un testimonio YA PUBLICADO que trajo un importador (por ejemplo, los de la web anterior en
 * Alboom, que el propio autor había publicado ahí). Es la única entrada que no pasa por la
 * moderación: el permiso queda asentado con `consentimientoTexto` y `puedePublicar` se exige igual.
 * Idempotente por `origenExternoId`: si ya existe, devuelve el que está.
 */
export async function crearTestimonioImportado(
  workspaceId: string,
  datos: DatosTestimonio,
  extras: { consentimientoTexto: string; origenExternoId: string; trabajoId?: string | null; autorFotoUrl?: string | null; autorFotoKey?: string | null; orden?: number },
  ahora: Date = new Date(),
): Promise<{ id: string; creado: boolean }> {
  const ya = await prisma.fotofficeTestimonio.findFirst({ where: { workspaceId, origenExternoId: extras.origenExternoId }, select: { id: true } });
  if (ya) return { id: ya.id, creado: false };
  const motivo = puedePublicar({ consentimiento: true, texto: datos.texto, autorNombre: datos.autorNombre });
  if (motivo) throw new Error(motivo);
  const t = await prisma.fotofficeTestimonio.create({
    data: {
      workspaceId,
      ...datos,
      estado: "PUBLICADO",
      origen: "IMPORTADO",
      consentimiento: true,
      consentimientoAt: ahora,
      consentimientoTexto: extras.consentimientoTexto,
      trabajoId: extras.trabajoId ?? null,
      autorFotoUrl: extras.autorFotoUrl ?? null,
      autorFotoKey: extras.autorFotoKey ?? null,
      origenExternoId: extras.origenExternoId,
      orden: extras.orden ?? 0,
      moderadoAt: ahora,
    },
    select: { id: true },
  });
  return { id: t.id, creado: true };
}

export type TestimonioDelPanel = {
  id: string;
  texto: string;
  extracto: string | null;
  autorNombre: string;
  autorDetalle: string | null;
  autorFotoUrl: string | null;
  autorEnlace: string | null;
  autorEmail: string | null;
  calificacion: number | null;
  estado: string;
  consentimiento: boolean;
  consentimientoTexto: string | null;
  origen: string;
  destacado: boolean;
  orden: number;
  clientId: string | null;
  proyectoId: string | null;
  createdAt: Date;
};

/** Para el panel (incluye el correo del autor: nunca usar en una página pública). */
export async function listarTestimonios(workspaceId: string, filtro: { estado?: EstadoTestimonio } = {}): Promise<TestimonioDelPanel[]> {
  try {
    return await prisma.fotofficeTestimonio.findMany({
      where: { workspaceId, ...(filtro.estado ? { estado: filtro.estado } : {}) },
      orderBy: [{ destacado: "desc" }, { orden: "asc" }, { createdAt: "desc" }],
      select: {
        id: true,
        texto: true,
        extracto: true,
        autorNombre: true,
        autorDetalle: true,
        autorFotoUrl: true,
        autorEnlace: true,
        autorEmail: true,
        calificacion: true,
        estado: true,
        consentimiento: true,
        consentimientoTexto: true,
        origen: true,
        destacado: true,
        orden: true,
        clientId: true,
        proyectoId: true,
        createdAt: true,
      },
    });
  } catch (err) {
    if (esTablaFaltante(err)) return [];
    throw err;
  }
}

export type ResultadoModeracion = { ok: true } | { ok: false; error: string };

const NO_ENCONTRADO = "No encontramos ese testimonio.";

/**
 * Cambia el estado. Publicar exige el permiso del autor (`puedePublicar`), y la escritura lo vuelve a
 * pedir en el filtro: si alguien lo quitó entre la lectura y la escritura, no se publica.
 */
export async function moderarTestimonio(
  workspaceId: string,
  id: string,
  estado: EstadoTestimonio,
  userId: number,
): Promise<ResultadoModeracion> {
  if (!(ESTADOS_TESTIMONIO as readonly string[]).includes(estado)) return { ok: false, error: "Ese estado no existe." };
  const t = await prisma.fotofficeTestimonio.findFirst({
    where: { id, workspaceId },
    select: { id: true, consentimiento: true, texto: true, autorNombre: true },
  });
  if (!t) return { ok: false, error: NO_ENCONTRADO };
  if (estado === "PUBLICADO") {
    const motivo = puedePublicar(t);
    if (motivo) return { ok: false, error: motivo };
  }
  const r = await prisma.fotofficeTestimonio.updateMany({
    where: { id, workspaceId, ...(estado === "PUBLICADO" ? { consentimiento: true } : {}) },
    data: { estado, moderadoPorUserId: String(userId), moderadoAt: new Date() },
  });
  return r.count > 0 ? { ok: true } : { ok: false, error: NO_ENCONTRADO };
}

export async function marcarDestacado(workspaceId: string, id: string, destacado: boolean): Promise<boolean> {
  const r = await prisma.fotofficeTestimonio.updateMany({ where: { id, workspaceId }, data: { destacado } });
  return r.count > 0;
}

/** Cuántos esperan moderación (el número de la sub-navegación). Sin tablas, 0. */
export async function contarPendientes(workspaceId: string): Promise<number> {
  try {
    return await prisma.fotofficeTestimonio.count({ where: { workspaceId, estado: "PENDIENTE" } });
  } catch (err) {
    if (esTablaFaltante(err)) return 0;
    throw err;
  }
}

/** Cuántos hay en cada estado (las pestañas del panel). */
export async function contarPorEstado(workspaceId: string): Promise<Record<EstadoTestimonio, number>> {
  const cuenta: Record<EstadoTestimonio, number> = { PENDIENTE: 0, PUBLICADO: 0, RECHAZADO: 0 };
  const grupos = await prisma.fotofficeTestimonio.groupBy({ by: ["estado"], where: { workspaceId }, _count: { _all: true } });
  for (const g of grupos) {
    if ((ESTADOS_TESTIMONIO as readonly string[]).includes(g.estado)) cuenta[g.estado as EstadoTestimonio] = g._count._all;
  }
  return cuenta;
}

/**
 * Edita la frase destacada y el detalle del autor. Con `permisoDe` (quien marcó «Tengo permiso del
 * autor» en el panel) deja asentado el permiso a un testimonio que no lo tenía; nunca lo quita.
 */
export async function editarTestimonio(
  workspaceId: string,
  id: string,
  cambios: { extracto?: unknown; autorDetalle?: unknown },
  permisoDe: string | null = null,
  ahora: Date = new Date(),
): Promise<ResultadoModeracion> {
  const v = validarEdicionPanel(cambios);
  if (!v.ok) return v;
  const t = await prisma.fotofficeTestimonio.findFirst({ where: { id, workspaceId }, select: { consentimiento: true } });
  if (!t) return { ok: false, error: NO_ENCONTRADO };
  const permiso =
    permisoDe && !t.consentimiento
      ? { consentimiento: true, consentimientoAt: ahora, consentimientoTexto: textoConsentimientoManual(permisoDe, ahora) }
      : {};
  const r = await prisma.fotofficeTestimonio.updateMany({ where: { id, workspaceId }, data: { ...v.datos, ...permiso } });
  return r.count > 0 ? { ok: true } : { ok: false, error: NO_ENCONTRADO };
}

/** Guarda el orden recibido (0, 1, 2…). Los ids que no son del workspace se ignoran. */
export async function reordenarTestimonios(workspaceId: string, ids: readonly string[]): Promise<void> {
  const unicos = [...new Set(ids.filter((id) => typeof id === "string" && id.length > 0 && id.length <= 64))].slice(0, 500);
  if (unicos.length === 0) return;
  const propios = await prisma.fotofficeTestimonio.findMany({ where: { workspaceId, id: { in: unicos } }, select: { id: true } });
  const validos = new Set(propios.map((p) => p.id));
  const orden = unicos.filter((id) => validos.has(id));
  await prisma.$transaction(orden.map((id, i) => prisma.fotofficeTestimonio.updateMany({ where: { id, workspaceId }, data: { orden: i } })));
}

/** Borra el testimonio. Devuelve la key de su foto (si tenía) para borrarla de R2 después. */
export async function borrarTestimonio(workspaceId: string, id: string): Promise<{ ok: true; fotoKey: string | null } | { ok: false; error: string }> {
  const t = await prisma.fotofficeTestimonio.findFirst({ where: { id, workspaceId }, select: { autorFotoKey: true } });
  if (!t) return { ok: false, error: NO_ENCONTRADO };
  const r = await prisma.fotofficeTestimonio.deleteMany({ where: { id, workspaceId } });
  return r.count > 0 ? { ok: true, fotoKey: t.autorFotoKey } : { ok: false, error: NO_ENCONTRADO };
}
