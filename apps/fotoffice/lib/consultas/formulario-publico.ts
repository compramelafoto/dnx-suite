import "server-only";
import { prisma, type Prisma } from "@repo/db";
import { headers } from "next/headers";
import { z } from "zod";
import { checkRateLimit, clientIp } from "@/lib/geocode/rate-limit";

/**
 * Lo que comparten los formularios públicos de consultas (el general/XV de `createServiceLead` y
 * el del sitio, `createSiteInquiry`): topes de largo, el freno por IP, los recortes y el origen
 * («¿Cómo nos conociste?»). Vive fuera de los archivos `"use server"` a propósito: todo lo que
 * esos archivos exportan se vuelve una acción que el navegador puede llamar.
 */

/** Topes de largo del formulario público (es abierto: nadie tiene que iniciar sesión). */
export const MAX_NOMBRE = 120;
export const MAX_EMAIL = 254;
export const MAX_TELEFONO = 40;
export const MAX_MENSAJE = 4000;
export const MAX_CORTO = 200;

const opcional = <T extends z.ZodTypeAny>(s: T) => s.optional().or(z.literal(""));

/** Los campos de la persona y del evento, iguales en los dos formularios. */
export const camposPublicos = {
  workspaceSlug: z.string().min(1).max(MAX_CORTO),
  name: z.string().min(1).max(MAX_NOMBRE, `El nombre puede tener hasta ${MAX_NOMBRE} caracteres.`),
  email: opcional(z.string().max(MAX_EMAIL, "Email inválido.").email("Email inválido.")),
  phone: opcional(z.string().max(MAX_TELEFONO, `El teléfono puede tener hasta ${MAX_TELEFONO} caracteres.`)),
  eventDate: opcional(z.string().max(MAX_CORTO)),
  eventLocation: opcional(z.string().max(MAX_CORTO, `El lugar puede tener hasta ${MAX_CORTO} caracteres.`)),
  message: opcional(z.string().max(MAX_MENSAJE, `El mensaje puede tener hasta ${MAX_MENSAJE} caracteres.`)),
  origenId: opcional(z.string().max(MAX_CORTO)),
};

/**
 * Freno por IP del formulario público: el de memoria del proxy de geocodificación (cada instancia
 * de Vercel lleva su conteo, así que es "N por instancia"; no es un control de seguridad, sólo
 * evita un bucle o un raspador). Sin IP conocida no se frena: agruparía a todos juntos. Los dos
 * formularios comparten la cuenta: es la misma puerta de entrada a Consultas.
 */
const FRENO_CONSULTAS = { limit: 10, windowMs: 10 * 60 * 1000 };
export const MENSAJE_FRENO = "Recibimos muchas consultas seguidas desde tu conexión. Probá de nuevo en unos minutos.";

export async function frenadoPorIp(): Promise<boolean> {
  let ip: string;
  try {
    ip = clientIp(await headers());
  } catch {
    return false; // Fuera de un pedido (pruebas, scripts): no hay IP que contar.
  }
  if (ip === "desconocido") return false;
  return !checkRateLimit({ key: `service-lead:${ip}`, ...FRENO_CONSULTAS }).allowed;
}

export function vacioANull(value?: string | null): string | null {
  const trimmed = value?.trim();
  return trimmed ? trimmed : null;
}

/** Vacío = null; si no, recortado al tope (nunca rechaza: es lo que escribió quien consulta). */
export function recortar(value: string | null | undefined, max: number): string | null {
  return vacioANull(value)?.slice(0, max).trim() || null;
}

export function fechaOpcional(value?: string | null): Date | null {
  const trimmed = value?.trim();
  if (!trimmed) return null;
  const date = new Date(trimmed);
  return Number.isNaN(date.getTime()) ? null : date;
}

type Db = Prisma.TransactionClient | typeof prisma;

/**
 * El origen elegido en «¿Cómo nos conociste?», sólo si es un origen ACTIVO de este workspace.
 * Si no (de otro workspace, archivado mientras la página estaba abierta, basura), se ignora: la
 * consulta entra igual sin origen. El alta, en cambio, rechazaría un origen inválido.
 */
export async function origenDelFormulario(db: Db, workspaceId: string, origenId: unknown): Promise<string | null> {
  if (typeof origenId !== "string" || !origenId || origenId.length > 100) return null;
  const origen = await db.fotofficeOrigen.findFirst({ where: { id: origenId, workspaceId, archivedAt: null }, select: { id: true } });
  return origen?.id ?? null;
}

export type OpcionPublica = { id: string; nombre: string };

/** Los orígenes activos del workspace para «¿Cómo nos conociste?», en su orden. Sólo id y nombre. */
export async function origenesPublicos(workspaceId: string, db: Db = prisma): Promise<OpcionPublica[]> {
  const filas = await db.fotofficeOrigen.findMany({
    where: { workspaceId, archivedAt: null },
    orderBy: [{ order: "asc" }, { createdAt: "asc" }],
    take: 200,
    select: { id: true, name: true },
  });
  return filas.map((o) => ({ id: o.id, nombre: o.name }));
}

/** Para las páginas: si la lectura falla, el formulario sale sin la pregunta (nunca sin formulario). */
export async function origenesPublicosSinFallar(workspaceId: string): Promise<OpcionPublica[]> {
  return origenesPublicos(workspaceId).catch((err: unknown) => {
    const e = err as { name?: string; code?: string } | null;
    console.error("[consultas] no se pudieron leer los orígenes", { error: e?.name ?? "desconocido", codigo: e?.code ?? null });
    return [];
  });
}
