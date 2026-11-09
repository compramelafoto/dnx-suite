import "server-only";
import { prisma } from "@repo/db";
import { textoDinero } from "../buscador/motor";
import { diaArgentino, inicioDelDiaArgentino } from "../periodista/horario";
import { escaparHtml } from "../periodista/mensaje";
import { gastoDelMesVendedor, leerAjustesVendedor, type AjustesVendedor } from "./ajustes";
import { traerVentas, type DepsClfVendedor } from "./clf";
import { GRUPOS, ROTULO_GRUPO, type Grupo } from "./tipos";

/**
 * Resumen diario (19:00) e informe mensual (día 1, 9:00) del Vendedor. Todo en hora argentina.
 *
 * Los correos se cuentan por filas de `DnxVendedorCorreo` (un hilo con primero y recordatorio son dos
 * correos). Las ventas y los registros son un «mínimo comprobado»: sólo se cuenta a quien CLF pudo
 * atribuir al correo. Los importes son pesos enteros (los `totalCents` de CLF ya vienen en pesos).
 */

export const PREFIJO_INFORME = "fotoffice_vendedor_informe_";
/** Marca de que el aviso de informe incompleto de un mes ya salió. */
export const PREFIJO_AVISO_INFORME = "fotoffice_vendedor_informe_aviso_";
const HORA_RESUMEN_AR = 19;
const HORA_INFORME_AR = 9;
const DESFASE_AR_MS = 3 * 60 * 60 * 1000;
const ESPERA_APROBACION_MS = 48 * 60 * 60 * 1000;
const MICROS = 1_000_000;
const MESES = ["enero", "febrero", "marzo", "abril", "mayo", "junio", "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre"];

export type FilaInforme = { enviados: number; respondieron: number; registros: number; vendieron: number; ventas: number; totalPesos: number };
export type InformeMes = { mes: string; porGrupo: Array<{ grupo: Grupo } & FilaInforme>; total: FilaInforme; gastoUsd: number; ventasDisponibles: boolean };

const horaArgentina = (ahora: Date) => new Date(ahora.getTime() - DESFASE_AR_MS).getUTCHours();
const esGrupo = (g: string): g is Grupo => (GRUPOS as readonly string[]).includes(g);
const vacia = (): FilaInforme => ({ enviados: 0, respondieron: 0, registros: 0, vendieron: 0, ventas: 0, totalPesos: 0 });
const hayActividad = (f: FilaInforme) => Object.values(f).some((n) => n > 0);

/** Pesos enteros con puntos de miles: `$ 1.234.567`. */
export function pesos(n: number): string {
  return `$ ${String(Math.round(n)).replace(/\B(?=(\d{3})+(?!\d))/g, ".")}`;
}

/** Una respuesta de verdad: no cuenta lo automático (fuera de oficina) ni los rebotes. */
const esRespuestaReal = (clase: string | null) => clase !== "AUTOMATICA" && clase !== "REBOTE";

// --- Resumen diario ---------------------------------------------------------------------------

export function tocaResumen(ahora: Date, a: AjustesVendedor): boolean {
  return horaArgentina(ahora) >= HORA_RESUMEN_AR && a.resumenDia !== diaArgentino(ahora);
}

const plural = (n: number, uno: string, varios: string) => `${n} ${n === 1 ? uno : varios}`;

/** El resumen del día, o `null` si no pasó nada que contar. */
export async function resumenDelDia(ahora: Date): Promise<string | null> {
  const desde = inicioDelDiaArgentino(ahora);
  const [salidas, abiertos, entradas, registrados, gastos, propuestos, ajustes, gastoMes] = await Promise.all([
    prisma.dnxVendedorCorreo.findMany({ where: { direccion: "SALIDA", creadoEn: { gte: desde } }, select: { paso: true } }),
    prisma.dnxVendedorCorreo.findMany({ where: { direccion: "SALIDA", abiertoEn: { gte: desde } }, select: { id: true } }),
    prisma.dnxVendedorCorreo.findMany({ where: { direccion: "ENTRADA", creadoEn: { gte: desde } }, select: { hiloId: true, clase: true } }),
    prisma.dnxVendedorHilo.findMany({ where: { registradoEn: { gte: desde } }, select: { id: true } }),
    prisma.dnxVendedorGasto.findMany({ where: { creadoEn: { gte: desde } }, select: { usdMicros: true } }),
    prisma.dnxVendedorModelo.findMany({
      where: { estado: "PROPUESTO", creadoEn: { lt: new Date(ahora.getTime() - ESPERA_APROBACION_MS) } },
      select: { grupo: true },
      orderBy: { creadoEn: "asc" },
    }),
    leerAjustesVendedor(),
    gastoDelMesVendedor(ahora),
  ]);

  const por = (paso: string) => salidas.filter((c: { paso: string | null }) => c.paso === paso).length;
  const primeros = por("PRIMERO");
  const recordatorios = por("RECORDATORIO");
  const respuestas = por("RESPUESTA");
  const salieron = primeros + recordatorios + respuestas;
  const contestaron = new Set(
    entradas.filter((e: { hiloId: string | null; clase: string | null }) => e.hiloId && esRespuestaReal(e.clase)).map((e: { hiloId: string | null }) => e.hiloId),
  ).size;
  const grupos = [...new Set(propuestos.map((m: { grupo: string }) => m.grupo))].map((g) => (esGrupo(g as string) ? ROTULO_GRUPO[g as Grupo] : (g as string)));

  if (salieron === 0 && abiertos.length === 0 && contestaron === 0 && registrados.length === 0 && grupos.length === 0) return null;

  const gastoHoy = gastos.reduce((s: number, g: { usdMicros: number }) => s + g.usdMicros, 0) / MICROS;
  const lineas = [
    "<b>📬 Vendedor: resumen de hoy</b>",
    "",
    `Salieron ${plural(salieron, "correo", "correos")}: ${plural(primeros, "primero", "primeros")}, ${plural(recordatorios, "recordatorio", "recordatorios")}, ${plural(respuestas, "respuesta", "respuestas")}.`,
    `Abiertos: ${abiertos.length}`,
    `Contestaron: ${contestaron}`,
    `Se registraron: ${registrados.length}`,
    `Gasto de Claude: hoy ${textoDinero(gastoHoy)} · del mes ${textoDinero(gastoMes)} de ${textoDinero(ajustes.topeClaudeUsd)}`,
  ];
  if (grupos.length > 0) lineas.push("", `Esperan tu aprobación: ${escaparHtml(grupos.join(", "))}`);
  return lineas.join("\n");
}

// --- Informe mensual --------------------------------------------------------------------------

/** "2026-10" del mes anterior al de `ahora` (argentino). */
export function mesAnterior(ahora: Date): string {
  const [y, m] = diaArgentino(ahora).split("-").map(Number);
  return m === 1 ? `${y - 1}-12` : `${y}-${String(m - 1).padStart(2, "0")}`;
}

export function tocaInforme(ahora: Date, a: AjustesVendedor): boolean {
  return diaArgentino(ahora).endsWith("-01") && horaArgentina(ahora) >= HORA_INFORME_AR && a.informeMes !== mesAnterior(ahora);
}

/**
 * Pendiente: el informe del mes anterior todavía no se completó (CLF no respondió) y estamos entre el día 1
 * (desde las 9) y el día 7. Sólo reintenta la parte que falta; `tocaInforme` sigue siendo el caso normal.
 */
export function informePendiente(ahora: Date, a: AjustesVendedor): boolean {
  const dia = Number(diaArgentino(ahora).slice(8, 10));
  if (dia > 7 || a.informeMes === mesAnterior(ahora)) return false;
  return dia > 1 || horaArgentina(ahora) >= HORA_INFORME_AR;
}

/** Desde las 0:00 argentinas del día 1 de `mes` hasta las 0:00 del mes siguiente. */
function limitesDelMes(mes: string): { desde: Date; hasta: Date } {
  const [y, m] = mes.split("-").map(Number);
  const inicio = (anio: number, mesNro: number) => new Date(`${anio}-${String(mesNro).padStart(2, "0")}-01T03:00:00.000Z`);
  return { desde: inicio(y, m), hasta: m === 12 ? inicio(y + 1, 1) : inicio(y, m + 1) };
}

export async function armarInforme(mes: string, deps: { clf?: DepsClfVendedor } = {}): Promise<InformeMes> {
  const { desde, hasta } = limitesDelMes(mes);
  const [hilos, primeros, entradas, gastos] = await Promise.all([
    prisma.dnxVendedorHilo.findMany({ select: { id: true, grupo: true, registradoEn: true, usuarioClfId: true } }),
    prisma.dnxVendedorCorreo.findMany({
      where: { direccion: "SALIDA", paso: "PRIMERO", creadoEn: { gte: desde, lt: hasta } },
      select: { hiloId: true },
    }),
    prisma.dnxVendedorCorreo.findMany({ where: { direccion: "ENTRADA", hiloId: { not: null } }, select: { hiloId: true, clase: true, creadoEn: true } }),
    prisma.dnxVendedorGasto.findMany({ where: { creadoEn: { gte: desde, lt: hasta } }, select: { usdMicros: true } }),
  ]);

  type H = { id: string; grupo: string; registradoEn: Date | null; usuarioClfId: number | null };
  const hiloPorId = new Map<string, H>((hilos as H[]).map((h) => [h.id, h]));
  const filas = new Map<Grupo, FilaInforme>();
  const fila = (grupo: string): FilaInforme | null => {
    if (!esGrupo(grupo)) return null;
    let f = filas.get(grupo);
    if (!f) filas.set(grupo, (f = vacia()));
    return f;
  };
  const dentro = (d: Date | null) => d !== null && d >= desde && d < hasta;

  for (const p of primeros as Array<{ hiloId: string | null }>) {
    const h = p.hiloId ? hiloPorId.get(p.hiloId) : undefined;
    if (h) {
      const f = fila(h.grupo);
      if (f) f.enviados++;
    }
  }

  // Cada hilo cuenta una vez, en el mes de su primera entrada no automática.
  const primeraEntrada = new Map<string, Date>();
  for (const e of entradas as Array<{ hiloId: string; clase: string | null; creadoEn: Date }>) {
    if (!esRespuestaReal(e.clase)) continue;
    const previa = primeraEntrada.get(e.hiloId);
    if (!previa || e.creadoEn < previa) primeraEntrada.set(e.hiloId, e.creadoEn);
  }
  for (const [hiloId, cuando] of primeraEntrada) {
    const h = hiloPorId.get(hiloId);
    if (h && dentro(cuando)) {
      const f = fila(h.grupo);
      if (f) f.respondieron++;
    }
  }

  for (const h of hilos as H[]) {
    if (dentro(h.registradoEn)) {
      const f = fila(h.grupo);
      if (f) f.registros++;
    }
  }

  // Ventas del mes de todos los que ya estaban registrados antes de que termine.
  const candidatos = new Map<number, { hilo: H; registradoEn: Date }>();
  for (const h of hilos as H[]) {
    if (h.usuarioClfId !== null && h.registradoEn !== null && h.registradoEn < hasta && esGrupo(h.grupo) && !candidatos.has(h.usuarioClfId)) {
      candidatos.set(h.usuarioClfId, { hilo: h, registradoEn: h.registradoEn });
    }
  }
  let ventasDisponibles = true;
  if (candidatos.size > 0) {
    const r = await traerVentas(
      { desde, hasta, usuarios: [...candidatos].map(([userId, c]) => ({ userId, registradoEn: c.registradoEn })) },
      deps.clf,
    );
    if (Array.isArray(r)) {
      for (const v of r) {
        const c = candidatos.get(v.userId);
        const f = c ? fila(c.hilo.grupo) : null;
        if (!f) continue;
        if (v.ventas > 0) f.vendieron++;
        f.ventas += v.ventas;
        f.totalPesos += v.totalPesos;
      }
    } else {
      ventasDisponibles = false;
    }
  }

  const porGrupo = GRUPOS.flatMap((grupo) => {
    const f = filas.get(grupo);
    return f && hayActividad(f) ? [{ grupo, ...f }] : [];
  });
  const total = porGrupo.reduce<FilaInforme>(
    (t, g) => ({
      enviados: t.enviados + g.enviados, respondieron: t.respondieron + g.respondieron, registros: t.registros + g.registros,
      vendieron: t.vendieron + g.vendieron, ventas: t.ventas + g.ventas, totalPesos: t.totalPesos + g.totalPesos,
    }),
    vacia(),
  );
  const gastoUsd = (gastos as Array<{ usdMicros: number }>).reduce((s, g) => s + g.usdMicros, 0) / MICROS;
  return { mes, porGrupo, total, gastoUsd, ventasDisponibles };
}

function mesEnPalabras(mes: string): string {
  const [y, m] = mes.split("-").map(Number);
  return `${MESES[m - 1] ?? mes} de ${y}`;
}

function lineaFila(f: FilaInforme, conVentas: boolean): string {
  const partes = [`${f.enviados} enviados`, `${f.respondieron} respondieron`, `${f.registros} se registraron`];
  if (conVentas) partes.push(`${f.vendieron} vendieron (${plural(f.ventas, "venta", "ventas")}, ${pesos(f.totalPesos)})`);
  return partes.join(" · ");
}

export function textoInforme(i: InformeMes): string {
  const lineas = [`<b>📊 Vendedor: informe de ${mesEnPalabras(i.mes)}</b>`, ""];
  if (i.porGrupo.length === 0) lineas.push("No hubo actividad este mes.");
  for (const g of i.porGrupo) lineas.push(`${escaparHtml(ROTULO_GRUPO[g.grupo])}: ${lineaFila(g, i.ventasDisponibles)}`);
  if (i.porGrupo.length > 0) lineas.push("", `Total: ${lineaFila(i.total, i.ventasDisponibles)}`);
  lineas.push("", `Gasto de Claude en el mes: ${textoDinero(i.gastoUsd)}`);
  lineas.push("", "Ventas y registros: mínimo comprobado (alguien que se registró con otro correo y desde otro navegador no se cuenta).");
  if (!i.ventasDisponibles) lineas.push("No pude traer las ventas de CLF: van en el próximo informe. Sigo reintentando en las próximas corridas, hasta el día 7.");
  return lineas.join("\n");
}

export async function guardarInforme(i: InformeMes): Promise<void> {
  const key = `${PREFIJO_INFORME}${i.mes}`;
  const value = JSON.stringify(i);
  await prisma.systemSettings.upsert({
    where: { key },
    create: { key, value, description: `Informe mensual del Vendedor (${i.mes})` },
    update: { value },
  });
}

/** Los informes guardados, del más nuevo al más viejo. */
export async function informesGuardados(): Promise<InformeMes[]> {
  const filas = (await prisma.systemSettings.findMany({
    where: { key: { startsWith: PREFIJO_INFORME } },
    select: { key: true, value: true },
  })) as Array<{ key: string; value: string }>;
  const out: InformeMes[] = [];
  for (const f of filas) {
    try {
      const v = JSON.parse(f.value) as InformeMes;
      if (v && typeof v.mes === "string" && Array.isArray(v.porGrupo) && v.total) out.push(v);
    } catch {
      // un informe ilegible no tapa a los demás
    }
  }
  return out.sort((a, b) => b.mes.localeCompare(a.mes));
}
