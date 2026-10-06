/**
 * Lo que llega de los formularios de Consultas (nueva consulta, alta rápida y la ficha) y su
 * conversión a los datos del alta. Módulo PURO: lo usan las acciones del servidor y los
 * componentes de cliente (para mostrar los mismos campos), y no toca la base.
 *
 * Las fechas viajan como texto ("aaaa-mm-dd" y "hh:mm"):
 *   - una fecha sola se guarda como medianoche UTC, la fecha de calendario de toda la app (PR 402);
 *   - con hora, es la hora de Buenos Aires (UTC−3, sin horario de verano desde 2009).
 */
import { esFechaSinHora } from "@/lib/plantillas/variables";
import { CAMPOS_POR_GRUPO, type CampoEvento, type GrupoConsulta } from "./constantes";

const diaAR = new Intl.DateTimeFormat("en-CA", {
  timeZone: "America/Argentina/Buenos_Aires", year: "numeric", month: "2-digit", day: "2-digit",
});

/**
 * "aaaa-mm-dd" de una fecha guardada, con la regla de toda la app (PR 402): medianoche UTC exacta
 * es una fecha de calendario (se lee en UTC); cualquier otro instante, en hora de Buenos Aires.
 * Es la misma regla que `diaDeCalendario` de `fechas.ts` (que es del servidor).
 */
export function diaDeFecha(d: Date): string {
  return esFechaSinHora(d) ? d.toISOString().slice(0, 10) : diaAR.format(d);
}

/** Los datos del evento tal como los escribe la persona (todo texto). */
export type FormEvento = {
  fecha?: string;
  hora?: string;
  invitados?: string;
  novio1?: string;
  novio2?: string;
  ceremonia?: string;
  recepcion?: string;
  lugar?: string;
  ciudad?: string;
};

/** Qué textos del formulario pertenecen a cada dato del grupo. */
export const TEXTOS_DE_CAMPO: Record<CampoEvento, readonly (keyof FormEvento)[]> = {
  fechaHora: ["fecha", "hora"],
  invitados: ["invitados"],
  novios: ["novio1", "novio2"],
  ceremonia: ["ceremonia"],
  recepcion: ["recepcion"],
  lugar: ["lugar"],
  ciudad: ["ciudad"],
};

export type EventoConvertido = {
  startsAt: Date | null;
  horaConocida: boolean;
  guests: number | null;
  partnerOneName: string | null;
  partnerTwoName: string | null;
  ceremonyVenue: string | null;
  receptionVenue: string | null;
  venue: string | null;
  city: string | null;
};

const FECHA = /^(\d{4})-(\d{2})-(\d{2})$/;
const HORA = /^([01]\d|2[0-3]):([0-5]\d)$/;

/** "aaaa-mm-dd" → medianoche UTC de ese día; null si está vacío; undefined si no es una fecha real. */
export function fechaDeCalendario(texto: unknown): Date | null | undefined {
  if (texto === undefined || texto === null) return null;
  if (typeof texto !== "string") return undefined;
  const t = texto.trim();
  if (!t) return null;
  const m = FECHA.exec(t);
  if (!m) return undefined;
  const d = new Date(`${t}T00:00:00.000Z`);
  if (Number.isNaN(d.getTime()) || d.toISOString().slice(0, 10) !== t) return undefined;
  const anio = Number(m[1]);
  if (anio < 1900 || anio > 2200) return undefined;
  return d;
}

/** Día + hora de Buenos Aires → instante. undefined si la hora no es válida. */
export function instanteDeBuenosAires(fecha: string, hora: string): Date | undefined {
  if (!HORA.test(hora)) return undefined;
  const d = new Date(`${fecha}T${hora}:00.000-03:00`);
  return Number.isNaN(d.getTime()) ? undefined : d;
}

/**
 * "150.000", "150000", "1.234,50", "$ 2500" → número. null si está vacío; undefined si no se
 * entiende. El punto es separador de miles (como se escribe en la Argentina) y la coma, decimal.
 */
export function numeroDeTexto(texto: unknown): number | null | undefined {
  if (texto === undefined || texto === null) return null;
  if (typeof texto === "number") return Number.isFinite(texto) ? texto : undefined;
  if (typeof texto !== "string") return undefined;
  const t = texto.replace(/[\s$]/g, "");
  if (!t) return null;
  let normal: string;
  if (t.includes(",")) normal = t.replace(/\./g, "").replace(",", ".");
  else if (/^\d{1,3}(\.\d{3})+$/.test(t)) normal = t.replace(/\./g, "");
  else normal = t;
  if (!/^\d+(\.\d+)?$/.test(normal)) return undefined;
  const n = Number(normal);
  return Number.isFinite(n) ? n : undefined;
}

function texto(v: unknown): string | null {
  if (typeof v !== "string") return null;
  const t = v.trim();
  return t ? t : null;
}

/**
 * Los datos del evento de un grupo: sólo los campos que el grupo pide (los demás no se tocan).
 * `error` describe el primer dato que no se entiende.
 */
export function eventoDelFormulario(
  grupo: GrupoConsulta,
  f: FormEvento | null | undefined,
): { ok: true; evento: Partial<EventoConvertido>; campos: readonly CampoEvento[] } | { ok: false; error: "fecha" | "invitados" } {
  const campos = CAMPOS_POR_GRUPO[grupo];
  const e = f && typeof f === "object" ? f : {};
  const evento: Partial<EventoConvertido> = {};
  for (const campo of campos) {
    switch (campo) {
      case "fechaHora": {
        const dia = fechaDeCalendario(e.fecha);
        if (dia === undefined) return { ok: false, error: "fecha" };
        const hora = texto(e.hora);
        if (dia && hora) {
          const instante = instanteDeBuenosAires(e.fecha!.trim(), hora);
          if (!instante) return { ok: false, error: "fecha" };
          evento.startsAt = instante;
          evento.horaConocida = true;
        } else {
          evento.startsAt = dia;
          evento.horaConocida = false;
        }
        break;
      }
      case "invitados": {
        const n = numeroDeTexto(e.invitados);
        if (n === undefined || (n !== null && !Number.isInteger(n))) return { ok: false, error: "invitados" };
        evento.guests = n;
        break;
      }
      case "novios":
        evento.partnerOneName = texto(e.novio1);
        evento.partnerTwoName = texto(e.novio2);
        break;
      case "ceremonia":
        evento.ceremonyVenue = texto(e.ceremonia);
        break;
      case "recepcion":
        evento.receptionVenue = texto(e.recepcion);
        break;
      case "lugar":
        evento.venue = texto(e.lugar);
        break;
      case "ciudad":
        evento.city = texto(e.ciudad);
        break;
    }
  }
  return { ok: true, evento, campos };
}

/** Lo guardado → los textos del formulario (para editar en la ficha). */
export function formularioDelEvento(ev: {
  startsAt: string | null;
  horaConocida: boolean;
  guests: number | null;
  partnerOneName: string | null;
  partnerTwoName: string | null;
  ceremonyVenue: string | null;
  receptionVenue: string | null;
  venue: string | null;
  city: string | null;
}): FormEvento {
  let fecha = "";
  let hora = "";
  if (ev.startsAt) {
    const d = new Date(ev.startsAt);
    fecha = diaDeFecha(d);
    if (ev.horaConocida) {
      // Buenos Aires es UTC−3 todo el año.
      const ba = new Date(d.getTime() - 3 * 60 * 60 * 1000);
      hora = ba.toISOString().slice(11, 16);
    }
  }
  return {
    fecha,
    hora,
    invitados: ev.guests === null ? "" : String(ev.guests),
    novio1: ev.partnerOneName ?? "",
    novio2: ev.partnerTwoName ?? "",
    ceremonia: ev.ceremonyVenue ?? "",
    recepcion: ev.receptionVenue ?? "",
    lugar: ev.venue ?? "",
    ciudad: ev.city ?? "",
  };
}
