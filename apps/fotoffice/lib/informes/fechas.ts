/** Fechas en hora de Buenos Aires para los informes (etapa 6). Módulo PURO. */
import { hoyEnBuenosAires } from "@/lib/listado/periodos";

/** "AAAA-MM-DD" del instante, en Buenos Aires. */
export function diaEnBuenosAires(d: Date): string {
  return hoyEnBuenosAires(d);
}

/** Suma días a un "AAAA-MM-DD" (calendario puro, sin husos). */
export function sumarDias(dia: string, n: number): string {
  const [y, m, d] = dia.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d + n)).toISOString().slice(0, 10);
}

/** Lunes = 0 … domingo = 6. */
export function diaDeSemana(dia: string): number {
  const [y, m, d] = dia.split("-").map(Number);
  return (new Date(Date.UTC(y, m - 1, d)).getUTCDay() + 6) % 7;
}

/** "2026-03-05" → "05/03". */
export function etiquetaDia(dia: string): string {
  return `${dia.slice(8, 10)}/${dia.slice(5, 7)}`;
}
