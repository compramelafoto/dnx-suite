/**
 * Capas de la agenda (Etapa 4, Entrega B). Módulo PURO: arma los eventos de la vista a partir de filas
 * YA LEÍDAS (y ya filtradas por permisos y por módulo encendido: este módulo no decide quién ve qué).
 * Cada evento: `{ id, capa, titulo, inicio, fin, todoElDia, color, href, editable }`.
 *
 * - `inicio` y `fin` son instantes; `fin` es exclusivo (un evento de todo el día termina a las 00:00 de Argentina
 *   del día siguiente);
 * - sólo las citas son editables, y no las anuladas (que ni se muestran);
 * - los eventos se ordenan por inicio, los de todo el día primero, y de ahí por título.
 */
import { COLOR_CAPA, COLOR_TIPO_POR_OMISION, type ClaveCapa, type EstadoCita } from "./constantes";
import { fechaValida, seSuperpone, todoElDia, type RangoVista } from "./fechas";

export type EventoAgenda = {
  id: string;
  capa: ClaveCapa;
  titulo: string;
  inicio: Date;
  fin: Date;
  todoElDia: boolean;
  color: string;
  href: string;
  editable: boolean;
};

export type FilaCita = {
  id: string;
  title: string;
  status: EstadoCita | string;
  startAt: Date;
  endAt: Date;
  allDay: boolean;
  ownerUserId: number | null;
  typeColor: string | null;
};
export type FilaEntrega = { proyectoId: string; nombre: string; finalDueDate: string | Date; ownerUserId: number | null };
export type FilaTarea = { id: string; titulo: string; vencimiento: string | Date; ownerUserId: number | null; href: string };
export type FilaCuota = { pedidoId: string; cuotaId: string; pedidoNumero: string; contacto: string; vencimiento: string | Date; saldo: number };
export type FilaConsulta = { leadId: string; nombre: string; proximaAccion: Date; ownerUserId: number | null; todoElDia?: boolean };
export type FilaCumple = { id: string; clientId: string; nombre: string; mes: number; dia: number };
export type FilaReserva = { id: string; titulo: string; inicio: Date; fin: Date };

const dia = (v: string | Date) => fechaValida(v);

function ordenar(eventos: EventoAgenda[]): EventoAgenda[] {
  return eventos.sort(
    (a, b) =>
      a.inicio.getTime() - b.inicio.getTime() ||
      Number(b.todoElDia) - Number(a.todoElDia) ||
      a.titulo.localeCompare(b.titulo, "es"),
  );
}

export function eventosDeCitas(filas: readonly FilaCita[], puedeGestionar: boolean): EventoAgenda[] {
  return filas
    .filter((c) => c.status !== "ANULADA")
    .map((c) => ({
      id: `cita:${c.id}`,
      capa: "CITAS" as const,
      titulo: c.title,
      inicio: c.startAt,
      fin: c.endAt,
      todoElDia: c.allDay,
      color: c.typeColor ?? COLOR_TIPO_POR_OMISION,
      href: `/agenda?cita=${c.id}`,
      editable: puedeGestionar,
    }));
}

export function eventosDeEntregas(filas: readonly FilaEntrega[]): EventoAgenda[] {
  const out: EventoAgenda[] = [];
  for (const f of filas) {
    const d = dia(f.finalDueDate);
    if (d === null) continue;
    const { startAt, endAt } = todoElDia(d);
    out.push({
      id: `entrega:${f.proyectoId}`, capa: "ENTREGAS", titulo: `Entrega: ${f.nombre}`, inicio: startAt, fin: endAt,
      todoElDia: true, color: COLOR_CAPA.ENTREGAS, href: `/proyectos/${f.proyectoId}`, editable: false,
    });
  }
  return out;
}

export function eventosDeTareas(filas: readonly FilaTarea[]): EventoAgenda[] {
  const out: EventoAgenda[] = [];
  for (const f of filas) {
    const d = dia(f.vencimiento);
    if (d === null) continue;
    const { startAt, endAt } = todoElDia(d);
    out.push({
      id: `tarea:${f.id}`, capa: "TAREAS", titulo: f.titulo, inicio: startAt, fin: endAt,
      todoElDia: true, color: COLOR_CAPA.TAREAS, href: f.href, editable: false,
    });
  }
  return out;
}

/** Sólo cuotas con saldo (> 0). El permiso de dinero lo resuelve quien lee las filas. */
export function eventosDeCuotas(filas: readonly FilaCuota[]): EventoAgenda[] {
  const out: EventoAgenda[] = [];
  for (const f of filas) {
    if (!(f.saldo > 0)) continue;
    const d = dia(f.vencimiento);
    if (d === null) continue;
    const { startAt, endAt } = todoElDia(d);
    out.push({
      id: `cuota:${f.cuotaId}`, capa: "CUOTAS", titulo: `Cuota · ${f.contacto} · pedido ${f.pedidoNumero}`, inicio: startAt, fin: endAt,
      todoElDia: true, color: COLOR_CAPA.CUOTAS, href: `/pedidos/${f.pedidoId}`, editable: false,
    });
  }
  return out;
}

export function eventosDeConsultas(filas: readonly FilaConsulta[]): EventoAgenda[] {
  return filas.map((f) => ({
    id: `consulta:${f.leadId}`, capa: "CONSULTAS" as const, titulo: `Consulta: ${f.nombre}`, inicio: f.proximaAccion,
    fin: new Date(f.proximaAccion.getTime() + 30 * 60_000), todoElDia: false, color: COLOR_CAPA.CONSULTAS,
    href: `/consultas/${f.leadId}`, editable: false,
  }));
}

/** Los cumpleaños se repiten cada año: se arma uno por cada año que toca el rango (29/02 sólo en bisiestos). */
export function eventosDeCumpleanos(filas: readonly FilaCumple[], rango: Pick<RangoVista, "desdeDia" | "hastaDia">): EventoAgenda[] {
  const out: EventoAgenda[] = [];
  const desde = Number(rango.desdeDia.slice(0, 4));
  const hasta = Number(rango.hastaDia.slice(0, 4));
  for (const f of filas) {
    for (let anio = desde; anio <= hasta; anio++) {
      const d = fechaValida(`${anio}-${String(f.mes).padStart(2, "0")}-${String(f.dia).padStart(2, "0")}`);
      if (d === null || d < rango.desdeDia || d > rango.hastaDia) continue;
      const { startAt, endAt } = todoElDia(d);
      out.push({
        id: `cumple:${f.id}:${anio}`, capa: "CUMPLEANOS", titulo: `Cumpleaños: ${f.nombre}`, inicio: startAt, fin: endAt,
        todoElDia: true, color: COLOR_CAPA.CUMPLEANOS, href: `/clientes/${f.clientId}`, editable: false,
      });
    }
  }
  return out;
}

export function eventosDeReservas(filas: readonly FilaReserva[]): EventoAgenda[] {
  return filas.map((f) => ({
    id: `reserva:${f.id}`, capa: "RESERVAS" as const, titulo: f.titulo, inicio: f.inicio, fin: f.fin, todoElDia: false,
    color: COLOR_CAPA.RESERVAS, href: "/reservas", editable: false,
  }));
}

export type EntradaCapas = {
  citas?: readonly FilaCita[];
  entregas?: readonly FilaEntrega[];
  tareas?: readonly FilaTarea[];
  cuotas?: readonly FilaCuota[];
  consultas?: readonly FilaConsulta[];
  cumpleanos?: readonly FilaCumple[];
  reservas?: readonly FilaReserva[];
};

/**
 * Junta las capas pedidas. `capasVisibles` filtra por las encendidas; `ownerUserId` (si viene) deja sólo lo
 * del responsable (las capas sin responsable conocido —cuotas, cumpleaños, reservas— no se filtran por él);
 * el rango descarta lo que no lo toca.
 */
export function armarEventos(
  entrada: EntradaCapas,
  opciones: { rango: RangoVista; puedeGestionar: boolean; capasVisibles?: readonly ClaveCapa[]; ownerUserId?: number | null },
): EventoAgenda[] {
  const visible = (c: ClaveCapa) => !opciones.capasVisibles || opciones.capasVisibles.includes(c);
  const dueno = opciones.ownerUserId ?? null;
  const delDueno = <T extends { ownerUserId: number | null }>(filas: readonly T[] | undefined) =>
    (filas ?? []).filter((f) => dueno === null || f.ownerUserId === dueno);

  const todos: EventoAgenda[] = [];
  if (visible("CITAS")) todos.push(...eventosDeCitas(delDueno(entrada.citas), opciones.puedeGestionar));
  if (visible("ENTREGAS")) todos.push(...eventosDeEntregas(delDueno(entrada.entregas)));
  if (visible("TAREAS")) todos.push(...eventosDeTareas(delDueno(entrada.tareas)));
  if (visible("CUOTAS")) todos.push(...eventosDeCuotas(entrada.cuotas ?? []));
  if (visible("CONSULTAS")) todos.push(...eventosDeConsultas(delDueno(entrada.consultas)));
  if (visible("CUMPLEANOS")) todos.push(...eventosDeCumpleanos(entrada.cumpleanos ?? [], opciones.rango));
  if (visible("RESERVAS")) todos.push(...eventosDeReservas(entrada.reservas ?? []));

  return ordenar(todos.filter((e) => seSuperpone(e.inicio, e.fin, opciones.rango.desde, opciones.rango.hasta)));
}
