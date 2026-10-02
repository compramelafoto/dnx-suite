import { hoyEnBuenosAires } from "../listado/periodos";

export type EtapaCalculo = { id: string; order: number; days: number; archivedAt: Date | null };

const DIA_MS = 24 * 60 * 60 * 1000;

/** Fin del día (Buenos Aires) del día calendario de `base` + `dias`. */
function finDelDia(base: Date, dias: number): Date {
  const ymd = hoyEnBuenosAires(base);
  const t = new Date(`${ymd}T12:00:00.000Z`);
  const destino = new Date(t.getTime() + dias * DIA_MS).toISOString().slice(0, 10);
  return new Date(`${destino}T23:59:59.999-03:00`);
}

/** Fin del día (Buenos Aires) de `entrada` + `dias`; null si dias === 0. */
export function vencimientoDeEtapa(entrada: Date, dias: number): Date | null {
  return dias === 0 ? null : finDelDia(entrada, dias);
}

export function estaVencida(dueAt: Date | null, ahora: Date): boolean {
  return dueAt !== null && ahora.getTime() > dueAt.getTime();
}

export function vencimientoDeTarea(entrada: Date, dias: number): Date {
  return finDelDia(entrada, dias);
}

/** Encadena las etapas activas desde la actual. Si la actual ya venció, arranca desde hoy. */
export function proyeccion(etapas: EtapaCalculo[], actualId: string, enteredAt: Date, dueAt: Date | null, hoy: Date) {
  const actual = etapas.find((e) => e.id === actualId);
  const restantes = etapas
    .filter((e) => !e.archivedAt && actual !== undefined && e.order >= actual.order)
    .sort((a, b) => a.order - b.order);
  const desdeHoy = estaVencida(dueAt, hoy);
  const resultado: { id: string; inicio: Date; fin: Date | null }[] = [];
  let cursor = desdeHoy ? hoy : enteredAt;
  let hayDias = false;
  restantes.forEach((e, i) => {
    const inicio = cursor;
    let fin: Date;
    if (i === 0 && !desdeHoy && dueAt) fin = dueAt;
    else fin = e.days > 0 ? finDelDia(inicio, e.days) : inicio; // 0 días: su fin es su inicio
    if (e.days > 0) hayDias = true;
    resultado.push({ id: e.id, inicio, fin });
    cursor = fin;
  });
  return {
    desdeHoy,
    etapas: resultado,
    // Si ninguna etapa tiene días, no hay fin proyectado.
    fin: hayDias ? (resultado[resultado.length - 1]?.fin ?? null) : null,
  };
}

export function esRetroceso(etapas: EtapaCalculo[], actualId: string, destinoId: string): boolean {
  const a = etapas.find((e) => e.id === actualId);
  const d = etapas.find((e) => e.id === destinoId);
  if (!a || !d) return false;
  return d.order <= a.order;
}

export type ValidacionMovimiento =
  | { ok: true }
  | { ok: false; motivo: "OTRO_CIRCUITO" | "ARCHIVADA" | "MISMA_ETAPA" | "TAREAS_PENDIENTES"; pendientes?: string[] };

export function validarMovimiento(opts: {
  etapas: EtapaCalculo[]; actualId: string; destinoId: string;
  requiereTareas: boolean; pendientesObligatorias: string[]; forzar: boolean; puedeForzar: boolean;
}): ValidacionMovimiento {
  const destino = opts.etapas.find((e) => e.id === opts.destinoId);
  if (!destino) return { ok: false, motivo: "OTRO_CIRCUITO" };
  if (opts.destinoId === opts.actualId) return { ok: false, motivo: "MISMA_ETAPA" };
  if (destino.archivedAt) return { ok: false, motivo: "ARCHIVADA" };
  if (opts.requiereTareas && opts.pendientesObligatorias.length > 0 && !(opts.forzar && opts.puedeForzar)) {
    return { ok: false, motivo: "TAREAS_PENDIENTES", pendientes: opts.pendientesObligatorias };
  }
  return { ok: true };
}
