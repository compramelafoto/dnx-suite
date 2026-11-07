/** Textos de las páginas públicas de turnos. Módulo PURO. */
import { ETIQUETA_MODALIDAD, type Modalidad } from "./constantes";

export function duracionTexto(min: number): string {
  if (min < 60) return `${min} minutos`;
  const h = Math.floor(min / 60);
  const m = min % 60;
  const horas = h === 1 ? "1 hora" : `${h} horas`;
  return m === 0 ? horas : `${horas} y ${m} minutos`;
}

/** "Videollamada · 30 minutos" */
export function resumenDelTipo(t: { modality: Modalidad; durationMinutes: number }): string {
  return `${ETIQUETA_MODALIDAD[t.modality]} · ${duracionTexto(t.durationMinutes)}`;
}
