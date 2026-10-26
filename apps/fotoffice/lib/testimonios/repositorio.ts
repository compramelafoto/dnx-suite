import "server-only";
import { prisma, type Prisma } from "@repo/db";
import {
  ESTADOS_TESTIMONIO,
  esTablaFaltante,
  puedePublicar,
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
