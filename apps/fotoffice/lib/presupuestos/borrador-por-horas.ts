import { getCommercialPositioningFactor, getProfileHourlyRate, type CuantoCobroProfileInput } from "@repo/cuanto-cobro-core";
import { precioSegundoFotografo, type Receta } from "@/lib/presupuesto-automatico/por-horas-puro";
import type { Alternativa } from "./alternativas";
import type { ItemPresupuesto } from "./constantes";
import { calcularItemDelPanel, trabajoVacio } from "./panel-cuanto-cobro";

/**
 * Presupuesto por horas (spec 2026-10-28): los ítems de una consulta sin propuesta modelo. Un
 * renglón de cobertura calculado por ¿Cuánto cobro? con el traslado sumado al precio (sin margen ni
 * renglón propio) y, si corresponde, una segunda opción con el segundo fotógrafo. Módulo PURO.
 */

export const ALTERNATIVA_UN_FOTOGRAFO = "un-fotografo";
export const ALTERNATIVA_DOS_FOTOGRAFOS = "dos-fotografos";

export type ItemsPorHoras = { items: ItemPresupuesto[]; alternativas: Alternativa[]; traslado: number | null; segundoFotografo: number | null };

/** Lo que vale una hora de Daniel: el costo de la hora del perfil × su posicionamiento comercial. */
export function valorHoraDeDaniel(perfil: CuantoCobroProfileInput): number | null {
  try {
    const costo = getProfileHourlyRate(perfil);
    if (costo === null || !Number.isFinite(costo) || costo <= 0) return null;
    return costo * getCommercialPositioningFactor((perfil as { commercialPositioningId?: never }).commercialPositioningId);
  } catch {
    return null;
  }
}

const horasEnTexto = (h: number) => `${String(h).replace(".", ",")} ${h === 1 ? "hora" : "horas"}`;

function itemSegundoFotografo(id: string, horas: number, precio: number, alternativaId: string | null, opcional: boolean): ItemPresupuesto {
  return {
    id,
    productId: null,
    nombre: `Segundo fotógrafo (${horasEnTexto(horas)})`,
    descripcion: null,
    cantidad: 1,
    precioUnitario: precio,
    descuento: null,
    modoPrecio: "LISTA",
    calculo: null,
    seccion: null,
    opcional,
    alternativaId,
  };
}

export function itemsPorHoras(p: {
  perfil: CuantoCobroProfileInput;
  receta: Receta;
  conSegundoFotografo: boolean;
  segundoFotografoPct: number;
  tipoDeTrabajo: string;
  ahora: Date;
}): { ok: true; valor: ItemsPorHoras } | { ok: false; motivo: "PERFIL" } {
  const { receta } = p;
  const trabajo = {
    ...trabajoVacio(receta.nombre),
    horasCobertura: String(receta.coberturaHoras),
    horasEdicion: String(receta.edicionHoras),
    disparosEstimados: String(receta.disparos),
  };
  let base: ReturnType<typeof calcularItemDelPanel>;
  try {
    base = calcularItemDelPanel(p.perfil, trabajo, p.tipoDeTrabajo, { id: "cobertura", nombre: receta.nombre }, p.ahora);
  } catch {
    return { ok: false, motivo: "PERFIL" };
  }
  if (!base.ok || !(base.item.precioUnitario > 0)) return { ok: false, motivo: "PERFIL" };

  const traslado = receta.trasladoPesos;
  let cobertura = base.item;
  if (traslado) {
    const ajustado = calcularItemDelPanel(p.perfil, trabajo, p.tipoDeTrabajo, { id: "cobertura", nombre: receta.nombre, precioAjustado: base.item.precioUnitario + traslado }, p.ahora);
    if (!ajustado.ok) return { ok: false, motivo: "PERFIL" };
    cobertura = ajustado.item;
  }
  cobertura = { ...cobertura, descripcion: receta.descripcion };

  const segundo = p.conSegundoFotografo ? precioSegundoFotografo(valorHoraDeDaniel(p.perfil), receta.coberturaHoras, p.segundoFotografoPct) : null;
  if (segundo === null) return { ok: true, valor: { items: [cobertura], alternativas: [], traslado, segundoFotografo: null } };

  const alternativas: Alternativa[] = [
    { id: ALTERNATIVA_UN_FOTOGRAFO, nombre: "Un fotógrafo", descripcion: null, masElegida: false },
    { id: ALTERNATIVA_DOS_FOTOGRAFOS, nombre: "Dos fotógrafos", descripcion: "Recomendado para eventos grandes.", masElegida: true },
  ];
  const items: ItemPresupuesto[] = [
    { ...cobertura, id: "cobertura-1", alternativaId: ALTERNATIVA_UN_FOTOGRAFO },
    { ...cobertura, id: "cobertura-2", alternativaId: ALTERNATIVA_DOS_FOTOGRAFOS },
    itemSegundoFotografo("segundo-fotografo", receta.coberturaHoras, segundo, ALTERNATIVA_DOS_FOTOGRAFOS, false),
  ];
  return { ok: true, valor: { items, alternativas, traslado, segundoFotografo: segundo } };
}

/** Horas de cobertura de un ítem CALCULO (suma de sus conceptos). */
function horasDeCobertura(item: ItemPresupuesto): number {
  if (item.modoPrecio !== "CALCULO" || !item.calculo) return 0;
  const conceptos = (item.calculo as { entrada?: { presupuesto?: { concepts?: { coverageHours?: unknown }[] } } }).entrada?.presupuesto?.concepts ?? [];
  return conceptos.reduce((suma, c) => {
    const n = Number(String(c?.coverageHours ?? "").replace(",", "."));
    return suma + (Number.isFinite(n) && n > 0 ? n : 0);
  }, 0);
}

/**
 * Propuesta modelo (XV, Boda): el segundo fotógrafo va como ítem OPCIONAL dentro de cada paquete
 * (las propuestas ya tienen sus paquetes y el máximo de opciones es 4), con las horas de cobertura
 * del paquete. Sin valor de la hora o sin horas, no agrega nada.
 */
export function segundoFotografoOpcional(items: ItemPresupuesto[], alternativas: Alternativa[], valorHora: number | null, pct: number): ItemPresupuesto[] {
  const grupos = alternativas.length > 0 ? alternativas.map((a) => a.id) : [null];
  const nuevos: ItemPresupuesto[] = [];
  for (const [i, grupo] of grupos.entries()) {
    const horas = items.filter((it) => (it.alternativaId ?? null) === grupo).reduce((s, it) => s + horasDeCobertura(it), 0);
    const precio = precioSegundoFotografo(valorHora, horas, pct);
    if (precio !== null) nuevos.push(itemSegundoFotografo(`segundo-fotografo-${i + 1}`, horas, precio, grupo, true));
  }
  return [...items, ...nuevos];
}
