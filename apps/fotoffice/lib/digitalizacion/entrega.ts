/**
 * Entrega de los videos de un pedido (spec 2026-10-22, E1–E5, E8 y E11). Módulo PURO: sin base,
 * sin entorno y con el reloj inyectado. Lo usan el servidor (`servidor/entregas.ts`), los crons y
 * las páginas, también desde el navegador: el token (con `node:crypto`) vive en `token-entrega.ts`.
 */
import { diaEnBuenosAires } from "@/lib/presupuestos/estados";
import { diasEntre, sumarDias } from "@/lib/pedidos/plan-cuotas";

/** Días que quedan los videos (y los cassettes) desde que se manda el correo. */
export const DIAS_VIGENCIA = 30;
/** Descargas por video incluidas en el precio (D14); se suman las `descargasExtra` pagadas. */
export const DESCARGAS_INCLUIDAS = 3;
/** Días antes del vencimiento en que se avisa (E8). */
export const UMBRALES_RECORDATORIO = [10, 5, 1] as const;
export const MAX_FRANJAS = 20;
const MAX_KM = 10_000;
const MAX_PRECIO = 100_000_000;
/**
 * El envío automático espera esto desde la última actividad del pedido cuando no se sabe cuántos
 * cassettes se vendieron: puede venir otro.
 */
export const HORAS_ESPERA_AUTOMATICO = 12;
/** Con la cantidad conocida y todos los cassettes hechos, sólo un margen corto de protección. */
export const MINUTOS_ESPERA_CON_CANTIDAD = 30;
const HORA_MS = 60 * 60 * 1000;
const MINUTO_MS = 60 * 1000;
const ZONA = "America/Argentina/Buenos_Aires";

// --- Cuándo está lista ------------------------------------------------------------------------

/** Cómo vienen las grabaciones de los trabajos del pedido. */
export type PreparacionEntrega = "CONVIRTIENDO" | "CON_ERROR" | "SIN_VIDEOS" | "LISTA";

/**
 * E2: lista cuando todas las grabaciones completas están LISTA o SIN_IMAGEN y al menos una LISTA.
 * Las DESCARTADAS no cuentan; una que sigue GRABANDO (o en cola, o convirtiéndose) hace esperar.
 * Una con ERROR frena el envío hasta que alguien la reintente o la descarte.
 *
 * Grabaciones de antes de la conversión: COMPLETA, sin `conversionEstado` y `sinImagen` cuentan
 * como SIN_IMAGEN (si no, trabarían el pedido para siempre); con imagen, siguen "convirtiendo".
 */
export function estadoDeEntrega(grabaciones: readonly { estado: string; conversionEstado: string | null; sinImagen?: boolean }[]): PreparacionEntrega {
  const vivas = grabaciones
    .filter((g) => g.estado !== "DESCARTADA")
    .map((g) => (g.estado === "COMPLETA" && g.conversionEstado === null && g.sinImagen === true ? { ...g, conversionEstado: "SIN_IMAGEN" } : g));
  if (vivas.some((g) => g.estado !== "COMPLETA" || g.conversionEstado === null || g.conversionEstado === "PENDIENTE" || g.conversionEstado === "PROCESANDO")) {
    return "CONVIRTIENDO";
  }
  if (vivas.some((g) => g.conversionEstado === "ERROR")) return "CON_ERROR";
  if (vivas.some((g) => g.conversionEstado === "LISTA")) return "LISTA";
  return "SIN_VIDEOS";
}

export type EstadoVisibleEntrega = PreparacionEntrega | "LISTA_PARA_ENVIAR" | "ENVIADA" | "BORRADA";

/** Lo que se muestra en la lista: una vez enviada, manda el envío; vencida cuenta como borrada. */
export function estadoVisibleDeEntrega(
  e: { preparacion: PreparacionEntrega; enviadoAt: Date | null; videosVencenAt: Date | null; videosBorradosAt: Date | null },
  ahora: Date,
): EstadoVisibleEntrega {
  if (e.videosBorradosAt || videosVencidos(e, ahora)) return "BORRADA";
  if (e.enviadoAt) return "ENVIADA";
  return e.preparacion === "LISTA" ? "LISTA_PARA_ENVIAR" : e.preparacion;
}

// --- Vencimientos y cupo ----------------------------------------------------------------------

/** 23:59:59.999 de Argentina (UTC−3, sin horario de verano) del día en que cae `d` allá. */
export function finDelDiaArgentino(d: Date): Date {
  return new Date(`${diaEnBuenosAires(d)}T23:59:59.999-03:00`);
}

/** El día 30 (de Argentina) desde `desde`, al final del día: "disponibles hasta el dd/mm" incluye ese día. */
export function venceDesde(desde: Date): Date {
  return new Date(`${sumarDias(diaEnBuenosAires(desde), DIAS_VIGENCIA)}T23:59:59.999-03:00`);
}

export function vencimientosDesde(enviadoAt: Date): { videosVencenAt: Date; cassettesVencenAt: Date } {
  const vence = venceDesde(enviadoAt);
  return { videosVencenAt: vence, cassettesVencenAt: new Date(vence) };
}

/** El margen del envío automático: corto con la cantidad de cassettes conocida, 12 h si no. */
export function margenEnvioAutomaticoMs(cantidadConocida: boolean): number {
  return cantidadConocida ? MINUTOS_ESPERA_CON_CANTIDAD * MINUTO_MS : HORAS_ESPERA_AUTOMATICO * HORA_MS;
}

/**
 * Desde cuándo sale sola la entrega: un margen después de la última actividad del pedido (el máximo
 * entre `terminadaAt` y `convertidaAt` de las grabaciones no descartadas). Sin la cantidad de
 * cassettes vendidos, 12 h (por si falta grabar otro); con la cantidad conocida, 30 min (que estén
 * todos hechos lo decide `../cassettes.ts`). null = sin fechas (sale ya). El botón "Enviar al
 * cliente" no espera.
 */
export function envioAutomaticoDesde(
  grabaciones: readonly { estado: string; terminadaAt: Date | null; convertidaAt: Date | null }[],
  opciones: { cantidadConocida?: boolean } = {},
): Date | null {
  let ultima: number | null = null;
  for (const g of grabaciones) {
    if (g.estado === "DESCARTADA") continue;
    for (const f of [g.terminadaAt, g.convertidaAt]) if (f && (ultima === null || f.getTime() > ultima)) ultima = f.getTime();
  }
  return ultima === null ? null : new Date(ultima + margenEnvioAutomaticoMs(opciones.cantidadConocida === true));
}

/**
 * Un video que quedó LISTA después del envío tiene sus 30 días: si `convertidaAt` + 30 días (al
 * final del día) pasa el vencimiento vigente, devuelve el nuevo; si no, null. Idempotente: una vez
 * extendido, la condición deja de cumplirse.
 */
export function extensionPorVideosNuevos(
  videosVencenAt: Date | null,
  grabaciones: readonly { estado: string; conversionEstado: string | null; convertidaAt: Date | null }[],
): Date | null {
  if (!videosVencenAt) return null;
  let nuevo: Date | null = null;
  for (const g of grabaciones) {
    if (g.estado === "DESCARTADA" || g.conversionEstado !== "LISTA" || !g.convertidaAt) continue;
    const v = venceDesde(g.convertidaAt);
    if (v.getTime() > videosVencenAt.getTime() && (!nuevo || v.getTime() > nuevo.getTime())) nuevo = v;
  }
  return nuevo;
}

/** Duración de una firma: la normal, o lo que falte para el vencimiento si es menos; nunca menos de 60 s. */
export function segundosDeFirma(normal: number, videosVencenAt: Date | null, ahora: Date): number {
  if (!videosVencenAt) return normal;
  const faltan = Math.floor((videosVencenAt.getTime() - ahora.getTime()) / 1000);
  return Math.max(60, Math.min(normal, faltan));
}

/** Días de calendario de Argentina de hoy al vencimiento (0 = vence hoy). */
export function diasQueFaltan(videosVencenAt: Date, ahora: Date): number {
  return diasEntre(diaEnBuenosAires(ahora), diaEnBuenosAires(videosVencenAt));
}

/** Llegó la fecha: se trata como borrada aunque el cron todavía no haya pasado. */
export function videosVencidos(e: { videosVencenAt: Date | null }, ahora: Date): boolean {
  return e.videosVencenAt !== null && e.videosVencenAt.getTime() <= ahora.getTime();
}

export function descargasRestantes(d: { descargasExtra: number; usadas: number }): { quedan: number; total: number } {
  const total = DESCARGAS_INCLUIDAS + Math.max(0, d.descargasExtra);
  return { quedan: Math.max(0, total - d.usadas), total };
}

/**
 * E8: qué recordatorio sale hoy, o null. Se cuentan días de calendario de Argentina entre hoy y el
 * día del vencimiento. Sale el umbral más chico que alcanza (si se saltó el de 10 y faltan 5, sólo
 * el de 5) y una sola vez por umbral. Ya vencida no se avisa: se borra.
 */
export function recordatorioQueCorresponde(e: { videosVencenAt: Date | null; recordatorios: readonly number[] }, ahora: Date): number | null {
  if (!e.videosVencenAt || videosVencidos(e, ahora)) return null;
  const faltan = diasQueFaltan(e.videosVencenAt, ahora);
  const umbral = [...UMBRALES_RECORDATORIO].sort((a, b) => a - b).find((u) => faltan <= u);
  if (umbral === undefined || e.recordatorios.includes(umbral)) return null;
  return umbral;
}

// --- Franjas de envío (E9 / E11) --------------------------------------------------------------

export type FranjaEnvio = { hastaKm: number; precioArs: number };

function numero(v: unknown): v is number {
  return typeof v === "number" && Number.isFinite(v);
}

function conHastaDosDecimales(n: number): boolean {
  return Math.abs(Math.round(n * 100) - n * 100) < 1e-6;
}

/** Valida las franjas que se guardan en `DigitalizacionAjustes.enviosFranjas` y las ordena por km. */
export function validarFranjas(raw: unknown): { ok: true; franjas: FranjaEnvio[] } | { ok: false; error: string } {
  if (!Array.isArray(raw)) return { ok: false, error: "Las franjas no son válidas." };
  if (raw.length > MAX_FRANJAS) return { ok: false, error: `Podés cargar hasta ${MAX_FRANJAS} franjas.` };
  const franjas: FranjaEnvio[] = [];
  for (const f of raw) {
    if (typeof f !== "object" || f === null) return { ok: false, error: "Las franjas no son válidas." };
    const claves = Object.keys(f);
    if (claves.some((k) => k !== "hastaKm" && k !== "precioArs")) return { ok: false, error: "Las franjas no son válidas." };
    const { hastaKm, precioArs } = f as Record<string, unknown>;
    if (!numero(hastaKm) || hastaKm <= 0 || hastaKm > MAX_KM) return { ok: false, error: `Los km tienen que ser un número entre 0 y ${MAX_KM}.` };
    if (!numero(precioArs) || precioArs < 0 || precioArs > MAX_PRECIO || !conHastaDosDecimales(precioArs)) {
      return { ok: false, error: "El precio tiene que ser un número de pesos, sin negativos y con hasta dos decimales." };
    }
    franjas.push({ hastaKm, precioArs });
  }
  franjas.sort((a, b) => a.hastaKm - b.hastaKm);
  for (let i = 1; i < franjas.length; i++) {
    if (franjas[i]!.hastaKm === franjas[i - 1]!.hastaKm) return { ok: false, error: "Hay dos franjas con los mismos km." };
  }
  return { ok: true, franjas };
}

/**
 * Lo que escribe la persona en el editor de franjas, como número: "3500", "3.500", "3500,50",
 * "1.500,5" o "2.5". Con coma, la coma es la de los decimales; sin coma, un punto seguido de tres
 * cifras es de los miles. NaN si no es un número.
 */
export function leerNumero(texto: string): number {
  const t = texto.trim().replace(/\s/g, "");
  if (!t) return Number.NaN;
  if (t.includes(",")) return /^\d{1,3}(\.\d{3})*(,\d+)?$|^\d+(,\d+)?$/.test(t) ? Number(t.replace(/\./g, "").replace(",", ".")) : Number.NaN;
  if (/^\d{1,3}(\.\d{3})+$/.test(t)) return Number(t.replace(/\./g, ""));
  return /^\d+(\.\d+)?$/.test(t) ? Number(t) : Number.NaN;
}

/** Lo guardado, para mostrar: si algo está roto, como si no hubiera franjas ("a coordinar"). */
export function leerFranjas(raw: unknown): FranjaEnvio[] {
  const r = validarFranjas(raw);
  return r.ok ? r.franjas : [];
}

// --- Formatos ---------------------------------------------------------------------------------

/** Centavos → "15.000 pesos" o "1.500,50 pesos". Nunca con "$". */
export function pesos(minor: number): string {
  const conCentavos = Math.round(minor) % 100 !== 0;
  const n = new Intl.NumberFormat("es-AR", { minimumFractionDigits: conCentavos ? 2 : 0, maximumFractionDigits: 2 }).format(minor / 100);
  return `${n} pesos`;
}

const FECHA_LARGA = new Intl.DateTimeFormat("es-AR", { timeZone: ZONA, day: "2-digit", month: "2-digit", year: "numeric" });
const FECHA_CORTA = new Intl.DateTimeFormat("es-AR", { timeZone: ZONA, day: "2-digit", month: "2-digit" });

/** "dd/mm/aaaa" (o "dd/mm") en hora argentina. */
export function fechaArgentina(d: Date, formato: "larga" | "corta" = "larga"): string {
  return (formato === "corta" ? FECHA_CORTA : FECHA_LARGA).format(d);
}

const FECHA_HORA = new Intl.DateTimeFormat("es-AR", { timeZone: ZONA, day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit", hourCycle: "h23" });

/** "dd/mm hh:mm" en hora argentina. */
export function fechaHoraArgentina(d: Date): string {
  const p = Object.fromEntries(FECHA_HORA.formatToParts(d).map((x) => [x.type, x.value]));
  return `${p.day}/${p.month} ${p.hour}:${p.minute}`;
}

/** "1 h 05 min" o "45 min". */
export function duracionLegible(seg: number): string {
  const h = Math.floor(seg / 3600);
  const m = Math.floor((seg % 3600) / 60);
  return h > 0 ? `${h} h ${String(m).padStart(2, "0")} min` : `${Math.max(m, seg > 0 ? 1 : 0)} min`;
}

// --- Token y dirección ------------------------------------------------------------------------

/** El título con el que se muestra un video: el que le pusieron, o "DVD" / "Cassette N". */
export function tituloDeVideo(g: { titulo: string | null; tipo: string; cassetteNumero: number | null }): string {
  if (g.titulo?.trim()) return g.titulo.trim();
  if (g.tipo === "DVD") return "DVD";
  return g.cassetteNumero != null ? `Cassette ${g.cassetteNumero}` : "Cassette";
}

/** Dirección completa: dominio propio o `/w/<slug>`. null si no hay cómo armarla. */
export function urlDeVideos(s: { customDomain: string | null; appOrigin: string; slug: string | null; token: string }): string | null {
  const ruta = `/videos/${encodeURIComponent(s.token)}`;
  if (s.customDomain) return `https://${s.customDomain}${ruta}`;
  if (!s.appOrigin || !s.slug) return null;
  return `${s.appOrigin}/w/${encodeURIComponent(s.slug)}${ruta}`;
}
