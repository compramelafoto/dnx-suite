import "server-only";
import { prisma } from "@repo/db";
import { responsablesDe } from "@/lib/circuitos/tablero";
import { NO_EXISTE, type ResultadoCatalogo } from "@/lib/catalogo/perfil";
import {
  DIAS_DESDE_EVENTO_MAX,
  DIAS_DESDE_EVENTO_MIN,
  DURACION_MINUTOS_MAX,
  DURACION_MINUTOS_MIN,
} from "./constantes";
import { minutosDeHora } from "./fechas";

/**
 * Reglas "Cita que genera" de un producto (Etapa 4, Entrega B): qué cita se agenda cuando el producto
 * se vende, con tipo, título, días desde el evento, hora de inicio (o todo el día), duración y
 * responsable opcionales. Pueden ser varias por producto. Se editan con `sales.catalog` (lo exige la
 * acción), igual que las de "Proyecto que genera".
 *
 * El `workspaceId` sale siempre de la sesión: un tipo, un producto o un responsable de otro
 * workspace es, para éste, algo que no existe.
 */

export const TOPE_REGLAS_CITA_POR_PRODUCTO = 10;
export const TITULO_REGLA_MAXIMO = 200;
const VARIABLES_TITULO = ["contacto", "producto", "evento", "pedido"] as const;
const VARIABLE = /\{([^{}]*)\}/g;

export type ReglaCitaEntrada = {
  typeId: string | null;
  title: string | null;
  daysFromEvent: number;
  /** "HH:MM" de Argentina; null = todo el día. */
  startTime: string | null;
  durationMinutes: number;
  ownerUserId: number | null;
};

export type ReglaCitaDetalle = ReglaCitaEntrada & { id: string; typeName: string | null; typeActive: boolean };

export type OpcionesDeReglaCita = {
  /** Tipos de cita activos. */
  tipos: { id: string; name: string; color: string }[];
  /** Miembros del equipo. */
  equipo: { id: number; nombre: string }[];
};

/** Forma de cada regla, sin tocar la base. Los chequeos contra el workspace van en `guardarReglas`. */
export function normalizarReglas(raw: readonly unknown[]): { ok: true; valor: ReglaCitaEntrada[] } | { ok: false; error: string } {
  if (raw.length > TOPE_REGLAS_CITA_POR_PRODUCTO) return { ok: false, error: `Un producto admite hasta ${TOPE_REGLAS_CITA_POR_PRODUCTO} citas.` };
  const out: ReglaCitaEntrada[] = [];
  for (const [i, x] of raw.entries()) {
    const fila = `Fila ${i + 1}`;
    const r = (x ?? {}) as Record<string, unknown>;

    let typeId: string | null = null;
    if (r.typeId !== null && r.typeId !== undefined && r.typeId !== "") {
      if (typeof r.typeId !== "string" || r.typeId.length > 64) return { ok: false, error: `${fila}: el tipo no es válido.` };
      typeId = r.typeId;
    }

    let title: string | null = null;
    if (r.title !== null && r.title !== undefined) {
      if (typeof r.title !== "string") return { ok: false, error: `${fila}: el título no es válido.` };
      const t = r.title.trim();
      if (t.length > TITULO_REGLA_MAXIMO) return { ok: false, error: `${fila}: el título puede tener hasta ${TITULO_REGLA_MAXIMO} caracteres.` };
      for (const m of t.matchAll(VARIABLE)) {
        if (!(VARIABLES_TITULO as readonly string[]).includes(m[1] ?? "")) {
          return { ok: false, error: `${fila}: {${m[1]}} no existe. Podés usar {contacto}, {producto}, {evento} y {pedido}.` };
        }
      }
      title = t === "" ? null : t;
    }

    const dias = r.daysFromEvent;
    if (typeof dias !== "number" || !Number.isInteger(dias) || dias < DIAS_DESDE_EVENTO_MIN || dias > DIAS_DESDE_EVENTO_MAX) {
      return { ok: false, error: `${fila}: los días desde el evento tienen que ser un número entero entre ${DIAS_DESDE_EVENTO_MIN} y ${DIAS_DESDE_EVENTO_MAX}.` };
    }

    let startTime: string | null = null;
    if (r.startTime !== null && r.startTime !== undefined && r.startTime !== "") {
      if (typeof r.startTime !== "string" || minutosDeHora(r.startTime) === null) return { ok: false, error: `${fila}: la hora tiene que ser como 18:30.` };
      startTime = r.startTime.trim();
    }

    const dur = r.durationMinutes;
    if (typeof dur !== "number" || !Number.isInteger(dur) || dur < DURACION_MINUTOS_MIN || dur > DURACION_MINUTOS_MAX) {
      return { ok: false, error: `${fila}: la duración tiene que ser un número entero de minutos entre ${DURACION_MINUTOS_MIN} y ${DURACION_MINUTOS_MAX}.` };
    }

    let ownerUserId: number | null = null;
    if (r.ownerUserId !== null && r.ownerUserId !== undefined && r.ownerUserId !== "") {
      if (typeof r.ownerUserId !== "number" || !Number.isInteger(r.ownerUserId) || r.ownerUserId <= 0) {
        return { ok: false, error: `${fila}: el responsable no es válido.` };
      }
      ownerUserId = r.ownerUserId;
    }
    out.push({ typeId, title, daysFromEvent: dias, startTime, durationMinutes: dur, ownerUserId });
  }
  return { ok: true, valor: out };
}

export async function leerReglas(workspaceId: string, productId: string): Promise<ReglaCitaDetalle[]> {
  const filas = await prisma.fotofficeProductoCita.findMany({
    where: { workspaceId, productId },
    orderBy: [{ order: "asc" }],
    select: { id: true, typeId: true, title: true, daysFromEvent: true, startTime: true, durationMinutes: true, ownerUserId: true },
  });
  if (filas.length === 0) return [];
  const tipoIds = [...new Set(filas.map((f) => f.typeId as string | null).filter((x): x is string => x !== null))];
  const tipos = tipoIds.length
    ? await prisma.fotofficeCitaTipo.findMany({ where: { workspaceId, id: { in: tipoIds } }, select: { id: true, name: true, isActive: true } })
    : [];
  const porId = new Map(tipos.map((t) => [t.id as string, t]));
  return filas.map((f) => {
    const t = f.typeId ? porId.get(f.typeId as string) : undefined;
    return {
      id: f.id as string,
      typeId: (f.typeId as string | null) ?? null,
      title: (f.title as string | null) ?? null,
      daysFromEvent: f.daysFromEvent as number,
      startTime: (f.startTime as string | null) ?? null,
      durationMinutes: f.durationMinutes as number,
      ownerUserId: (f.ownerUserId as number | null) ?? null,
      typeName: (t?.name as string | undefined) ?? null,
      typeActive: t?.isActive === true,
    };
  });
}

/** Los tipos de cita activos y el equipo del workspace, para armar la sección. */
export async function opcionesDeRegla(workspaceId: string): Promise<OpcionesDeReglaCita> {
  const [tipos, equipo] = await Promise.all([
    prisma.fotofficeCitaTipo.findMany({
      where: { workspaceId, isActive: true },
      orderBy: [{ order: "asc" }, { name: "asc" }],
      select: { id: true, name: true, color: true },
    }),
    responsablesDe(workspaceId),
  ]);
  return { tipos: tipos as OpcionesDeReglaCita["tipos"], equipo };
}

export async function guardarReglas(workspaceId: string, productId: string, entrada: readonly unknown[]): Promise<ResultadoCatalogo> {
  const normal = normalizarReglas(entrada);
  if (!normal.ok) return normal;
  const reglas = normal.valor;

  return prisma.$transaction(async (tx) => {
    // Candado por producto: dos guardados a la vez no intercalan su borrar-y-crear.
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`fotoffice-cita-reglas:${workspaceId}:${productId}`}))`;
    const producto = await tx.product.findFirst({ where: { id: productId, workspaceId }, select: { id: true } });
    if (!producto) return NO_EXISTE;

    if (reglas.length > 0) {
      const previos = new Set(
        (await tx.fotofficeProductoCita.findMany({ where: { workspaceId, productId }, select: { typeId: true } }))
          .map((f) => f.typeId as string | null)
          .filter((x): x is string => x !== null),
      );
      const tipoIds = [...new Set(reglas.map((r) => r.typeId).filter((x): x is string => x !== null))];
      if (tipoIds.length > 0) {
        const tipos = await tx.fotofficeCitaTipo.findMany({ where: { workspaceId, id: { in: tipoIds } }, select: { id: true, isActive: true } });
        const porId = new Map(tipos.map((t) => [t.id as string, t]));
        for (const [i, r] of reglas.entries()) {
          if (r.typeId === null) continue;
          const t = porId.get(r.typeId);
          // Un tipo ya usado por la regla puede estar dado de baja (se conserva); uno nuevo, no.
          if (!t || (!t.isActive && !previos.has(r.typeId))) return { ok: false as const, error: `Fila ${i + 1}: elegí un tipo de cita activo.` };
        }
      }
      const duenos = [...new Set(reglas.map((r) => r.ownerUserId).filter((x): x is number => x !== null))];
      if (duenos.length > 0) {
        const miembros = await tx.workspaceMembership.findMany({ where: { workspaceId, userId: { in: duenos } }, select: { userId: true } });
        if (miembros.length !== duenos.length) return { ok: false as const, error: "Uno de los responsables no es parte del equipo." };
      }
    }

    await tx.fotofficeProductoCita.deleteMany({ where: { workspaceId, productId } });
    if (reglas.length > 0) {
      await tx.fotofficeProductoCita.createMany({
        data: reglas.map((r, order) => ({
          workspaceId,
          productId,
          typeId: r.typeId,
          title: r.title,
          daysFromEvent: r.daysFromEvent,
          startTime: r.startTime,
          durationMinutes: r.durationMinutes,
          ownerUserId: r.ownerUserId,
          order,
        })),
      });
    }
    return { ok: true } as const;
  });
}
