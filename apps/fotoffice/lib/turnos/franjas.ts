/**
 * Franjas semanales de un tipo de turno. Módulo PURO.
 * Se guardan como `{ weekday, startMinute, endMinute }`, el mismo formato que `BookingSpaceHours`,
 * para entregárselas tal cual al motor de disponibilidad de Reservas.
 */
import { minutosDeHora } from "@/lib/agenda/fechas";

export type Franja = { weekday: number; startMinute: number; endMinute: number };

export const DIAS_SEMANA = ["Domingo", "Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado"] as const;

/** Minutos → "HH:MM". 1440 se escribe "24:00". */
export function horaDeMinutos(m: number): string {
  return `${String(Math.floor(m / 60)).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}`;
}

function minutosDeFin(v: unknown): number | null {
  if (v === "24:00") return 1440;
  return typeof v === "string" ? minutosDeHora(v) : null;
}

/**
 * Valida lo que llega del formulario (`[{ weekday, inicio: "HH:MM", fin: "HH:MM" }]`).
 * Devuelve las franjas ordenadas, o null si alguna es inválida o se pisa con otra del mismo día.
 */
export function leerFranjas(v: unknown): Franja[] | null {
  if (!Array.isArray(v) || v.length > 50) return null;
  const franjas: Franja[] = [];
  for (const f of v) {
    if (!f || typeof f !== "object") return null;
    const o = f as Record<string, unknown>;
    const weekday = typeof o.weekday === "number" ? o.weekday : Number(o.weekday);
    const startMinute = typeof o.inicio === "string" ? minutosDeHora(o.inicio) : null;
    const endMinute = minutosDeFin(o.fin);
    if (!Number.isInteger(weekday) || weekday < 0 || weekday > 6) return null;
    if (startMinute === null || endMinute === null || startMinute >= endMinute) return null;
    franjas.push({ weekday, startMinute, endMinute });
  }
  franjas.sort((a, b) => a.weekday - b.weekday || a.startMinute - b.startMinute);
  for (let i = 1; i < franjas.length; i++) {
    const a = franjas[i - 1];
    const b = franjas[i];
    if (a.weekday === b.weekday && b.startMinute < a.endMinute) return null;
  }
  return franjas;
}

/** "Lunes de 10:00 a 13:00" — para mostrar. */
export function textoDeFranja(f: Franja): string {
  return `${DIAS_SEMANA[f.weekday]} de ${horaDeMinutos(f.startMinute)} a ${horaDeMinutos(f.endMinute)}`;
}
