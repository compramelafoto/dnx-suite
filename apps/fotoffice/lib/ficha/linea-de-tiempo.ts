import { puedeEnContexto, type AccesoEfectivo } from "@/lib/access/policy";
import type { MensajeVista } from "@/lib/plantillas/vista-mensaje";
import type { PersonaRef } from "./persona";

/**
 * Motor de la línea de tiempo de la ficha: junta los hechos de varias fuentes (notas,
 * historial, caja, cuotas, carnets, adjuntos...) en una sola lista, más nuevo primero, de a
 * 30 por página.
 *
 * Módulo sin base: no importa Prisma ni `server-only`, así la pantalla puede usar los tipos
 * y los proveedores se prueban por separado.
 */

export const TIPOS_EVENTO = ["notas", "cambios", "mensajes", "plata", "portal", "carnets", "adjuntos"] as const;
export type TipoEvento = (typeof TIPOS_EVENTO)[number];

export type EventoFicha = {
  /** Único entre proveedores: "<proveedor>:<id>". */
  id: string;
  tipo: TipoEvento;
  fecha: Date;
  actor: string | null;
  titulo: string;
  detalle?: string;
  enlace?: string;
  cambios?: { campo: string; antes: string; despues: string }[];
  /**
   * Sólo en las notas: lo que la pantalla necesita para editar, borrar o fijar la nota. La
   * decisión de quién puede hacerlo se vuelve a tomar en el servidor en cada acción.
   */
  nota?: { id: string; categoryId: string | null; categoria: string; authorUserId: number | null; editada: boolean };
  /** Sólo en los mensajes (correo o WhatsApp): canal, estado, asunto y cuerpo para mostrarlos. */
  mensaje?: MensajeVista;
};

/**
 * Datos extra para que cada proveedor lea exactamente lo que falta:
 * - `idTope`: el id del último evento mostrado. En la fecha exacta de `antesDe` sólo van los
 *   eventos con id menor (así un empate de fechas no repite ni saltea filas).
 * - `tipo`: el filtro de la pantalla, para que un proveedor de varios tipos no gaste su cupo
 *   en filas que después se descartan.
 */
export type OpcionesTraer = { idTope?: string | null; tipo?: TipoEvento | null };

export type Proveedor = {
  clave: string;
  tipo: TipoEvento | TipoEvento[];
  capacidad?: "verDinero";
  /** El módulo de la plata que trae (Caja, Cuotas): `verDinero` se mira sobre ése. */
  moduloDinero?: string;
  /** Hasta `take` eventos con fecha <= `antesDe` (o los más nuevos si es null), más nuevo primero. */
  traer: (
    ctx: { workspaceId: string },
    persona: PersonaRef,
    antesDe: Date | null,
    take: number,
    opciones?: OpcionesTraer,
  ) => Promise<EventoFicha[]>;
};

export type PaginaLinea = { eventos: EventoFicha[]; siguiente: string | null; fallaron: string[] };

/** Lo que viaja al navegador: la fecha como texto ISO. */
export type EventoFichaWire = Omit<EventoFicha, "fecha"> & { fecha: string };
export type PaginaLineaWire = { eventos: EventoFichaWire[]; siguiente: string | null; fallaron: string[] };

export const EVENTOS_POR_PAGINA = 30;

export function cursorDe(e: EventoFicha): string {
  return `${e.fecha.toISOString()}|${e.id}`;
}

export function leerCursor(c: string | null): { fecha: Date; id: string } | null {
  if (typeof c !== "string" || c.length === 0 || c.length > 300) return null;
  const corte = c.indexOf("|");
  if (corte <= 0) return null;
  const iso = c.slice(0, corte);
  const id = c.slice(corte + 1);
  if (!id || !/^\d{4}-\d{2}-\d{2}T/.test(iso)) return null;
  const fecha = new Date(iso);
  if (Number.isNaN(fecha.getTime())) return null;
  return { fecha, id };
}

/** Más nuevo primero; en empate de fecha, id descendente (el mismo orden que el cursor). */
export function compararEventos(a: EventoFicha, b: EventoFicha): number {
  const d = b.fecha.getTime() - a.fecha.getTime();
  if (d !== 0) return d;
  return a.id < b.id ? 1 : a.id > b.id ? -1 : 0;
}

function tiposDe(p: Proveedor): TipoEvento[] {
  return Array.isArray(p.tipo) ? p.tipo : [p.tipo];
}

/** ¿El evento va después del cursor en el orden de la línea? */
function despuesDelCursor(e: EventoFicha, cursor: { fecha: Date; id: string } | null): boolean {
  if (!cursor) return true;
  const t = e.fecha.getTime();
  const c = cursor.fecha.getTime();
  if (t !== c) return t < c;
  return e.id < cursor.id;
}

export async function armarLinea(opts: {
  proveedores: Proveedor[];
  ctx: { workspaceId: string; role: string | null; acceso?: AccesoEfectivo; modulo?: string };
  persona: PersonaRef;
  filtro: TipoEvento | null;
  cursor: string | null;
  take?: number;
}): Promise<PaginaLinea> {
  const take = Math.min(Math.max(1, Math.floor(opts.take ?? EVENTOS_POR_PAGINA)), 100);
  const cursor = leerCursor(opts.cursor);
  const veDinero = puedeEnContexto(opts.ctx, "verDinero");

  // Los permisos se aplican ACÁ, en el servidor: un proveedor de plata sin `verDinero` ni
  // siquiera se consulta, y su contenido nunca llega al navegador.
  const activos = opts.proveedores.filter((p) => {
    if (p.capacidad && !puedeEnContexto(opts.ctx, p.capacidad, p.moduloDinero)) return false;
    if (opts.filtro && !tiposDe(p).includes(opts.filtro)) return false;
    return true;
  });

  const resultados = await Promise.allSettled(
    activos.map((p) =>
      p.traer({ workspaceId: opts.ctx.workspaceId }, opts.persona, cursor?.fecha ?? null, take + 1, {
        idTope: cursor?.id ?? null,
        tipo: opts.filtro,
      }),
    ),
  );

  const fallaron: string[] = [];
  const todos: EventoFicha[] = [];
  const vistos = new Set<string>();
  resultados.forEach((r, i) => {
    const p = activos[i]!;
    if (r.status === "rejected") {
      console.error(`[ficha] el proveedor "${p.clave}" de la línea de tiempo falló`, r.reason);
      fallaron.push(p.clave);
      return;
    }
    for (const e of r.value) {
      if (!despuesDelCursor(e, cursor)) continue;
      if (opts.filtro && e.tipo !== opts.filtro) continue;
      // Segunda red: ningún evento de plata sale sin permiso, lo declare o no su proveedor.
      if (e.tipo === "plata" && !veDinero) continue;
      if (vistos.has(e.id)) continue;
      vistos.add(e.id);
      todos.push(e);
    }
  });

  todos.sort(compararEventos);
  const eventos = todos.slice(0, take);
  const hayMas = todos.length > take;
  return { eventos, siguiente: hayMas ? cursorDe(eventos[eventos.length - 1]!) : null, fallaron };
}

export function serializarPagina(p: PaginaLinea): PaginaLineaWire {
  return {
    eventos: p.eventos.map((e) => ({ ...e, fecha: e.fecha.toISOString() })),
    siguiente: p.siguiente,
    fallaron: p.fallaron,
  };
}

/**
 * Cómo acota cada proveedor su consulta al cursor, para un campo de fecha y un prefijo de id
 * ("notas:", "cuotas:pago:"...). Devuelve un fragmento de `where` para meter en un `AND`.
 *
 * En la fecha exacta del corte decide según el id del último evento mostrado (`idTope`):
 * - si ese id es de esta misma fuente, van sólo las filas con id menor;
 * - si es de otra fuente, todas las filas de esta fuente comparan igual contra él (el prefijo
 *   decide), así que van todas o ninguna.
 */
export function whereCorte(
  campo: string,
  prefijo: string,
  antesDe: Date | null,
  idTope: string | null | undefined,
): Record<string, unknown> {
  if (!antesDe) return {};
  if (!idTope) return { [campo]: { lte: antesDe } };
  if (idTope.startsWith(prefijo)) {
    const idFila = idTope.slice(prefijo.length);
    return { OR: [{ [campo]: { lt: antesDe } }, { [campo]: antesDe, id: { lt: idFila } }] };
  }
  return prefijo < idTope ? { [campo]: { lte: antesDe } } : { [campo]: { lt: antesDe } };
}
