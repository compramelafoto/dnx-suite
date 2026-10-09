/**
 * "Mis entregas de la semana": el filtro PURO (sin base). Un proyecto entra si sigue vivo (ni
 * suspendido ni cerrado), tiene fecha final y esa fecha es hoy, ya pasó o cae en los próximos
 * `DIAS_DE_LA_SEMANA` días. Los vencidos van primero, después por fecha.
 */
import { diasEntre, fechaValida } from "./fechas";

export const DIAS_DE_LA_SEMANA = 7;

export type ProyectoParaEntrega = {
  id: string;
  numero: string;
  nombre: string;
  finalDueDate: string | null;
  suspendido: boolean;
  cerrado: boolean;
};

export type EntregaDeLaSemana = {
  id: string;
  numero: string;
  nombre: string;
  /** "YYYY-MM-DD". */
  finalDueDate: string;
  /** Días hasta la entrega: negativo = vencida hace N días; 0 = hoy. */
  dias: number;
};

export function entregasDeLaSemana(proyectos: readonly ProyectoParaEntrega[], hoy: string): EntregaDeLaSemana[] {
  const out: EntregaDeLaSemana[] = [];
  for (const p of proyectos) {
    if (p.suspendido || p.cerrado) continue;
    const fecha = fechaValida(p.finalDueDate);
    if (fecha === null) continue;
    const dias = diasEntre(hoy, fecha);
    if (dias > DIAS_DE_LA_SEMANA) continue;
    out.push({ id: p.id, numero: p.numero, nombre: p.nombre, finalDueDate: fecha, dias });
  }
  return out.sort((a, b) => a.dias - b.dias || a.numero.localeCompare(b.numero));
}
