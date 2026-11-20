/**
 * PURO. El recordatorio de pago del bot de WhatsApp: al cliente que pidió algo por el chat (un
 * pedido del catálogo o copias) y no pagó, el bot le escribe una vez, cerca del final de la
 * ventana de 24 h de Meta (después ya no se puede escribir sin plantilla aprobada).
 */

export const RECORDAR_DESDE_HORAS = 20;
export const RECORDAR_HASTA_HORAS = 23.5;

/**
 * Seguimiento de las cotizaciones de EVENTOS dentro de la ventana (pedido de Daniel, 20/11/2026): a
 * las 22 h del último mensaje del cliente, sólo de 7 a 21 h de Argentina. Si a esa hora es de noche,
 * lo antes posible sin que se cumplan las 24 h: a las 7 si todavía entra, o si no la tarde anterior,
 * antes de las 21 (`momentoDelSeguimiento`). El recordatorio de pago y el de consultas siguen como antes.
 */
export const IDEAL_HORAS = 22;
/** Margen antes del cierre de la ventana de 24 h (el cron corre cada 15 minutos). */
export const LIMITE_HORAS = 23.75;
export const HORA_DESDE_ENVIO = 7;
export const HORA_HASTA_ENVIO = 21;
/** Lo más temprano que puede tocar: cuando el final de la ventana cae de noche, sale la tarde anterior (~13,5 h). */
export const EVENTO_DESDE_HORAS = 13;
/** La tarde anterior sale media hora antes de las 21, para que el cron tenga dos vueltas. */
const MARGEN_ANTES_DE_CERRAR_MS = 30 * 60_000;
/** Pedidos más viejos que esto no se recuerdan (el cliente ya habló de otra cosa). */
export const PEDIDO_MAXIMO_DIAS = 3;
/** Comienzo del mensaje SISTEMA que deja el recordatorio en el chat (sirve para no repetirlo). */
export const MARCA_RECORDATORIO = "Recordatorio de pago enviado";

const HORA_MS = 3_600_000;
const DIA_MS = 24 * HORA_MS;
/** Argentina está en UTC−3 todo el año (sin horario de verano). */
const DESFASE_AR_MS = -3 * HORA_MS;
const msDelDiaAr = (t: number) => (((t + DESFASE_AR_MS) % DIA_MS) + DIA_MS) % DIA_MS;

/** ¿Son entre las 7 y las 21 h en Argentina? */
export function enHorarioDeEnvio(d: Date): boolean {
  const h = msDelDiaAr(d.getTime()) / HORA_MS;
  return h >= HORA_DESDE_ENVIO && h < HORA_HASTA_ENVIO;
}

/** El primer instante desde `t` (incluido) en que son las `hora` en punto en Argentina. */
function proximaHoraAr(t: number, hora: number): number {
  const x = t - msDelDiaAr(t) + hora * HORA_MS;
  return x >= t ? x : x + DIA_MS;
}

/** El último instante hasta `t` (incluido) en que son las `hora` en punto en Argentina. */
function anteriorHoraAr(t: number, hora: number): number {
  const x = proximaHoraAr(t, hora);
  return x > t ? x - DIA_MS : x;
}

/** Desde cuándo le toca el seguimiento al chat cuyo cliente escribió por última vez en `ultimoEntranteEn`. */
export function momentoDelSeguimiento(ultimoEntranteEn: Date): Date {
  const t0 = ultimoEntranteEn.getTime();
  const ideal = t0 + IDEAL_HORAS * HORA_MS;
  if (enHorarioDeEnvio(new Date(ideal))) return new Date(ideal);
  const apertura = proximaHoraAr(ideal, HORA_DESDE_ENVIO);
  if (apertura <= t0 + LIMITE_HORAS * HORA_MS) return new Date(apertura);
  return new Date(anteriorHoraAr(ideal, HORA_HASTA_ENVIO) - MARGEN_ANTES_DE_CERRAR_MS);
}

export type PendienteDePago =
  | { tipo: "PEDIDO"; numero: string; aPagar: number; url: string | null; creado: Date }
  | { tipo: "IMPRESION"; numero: number; aPagar: number; creado: Date };

/** ¿Le toca el recordatorio? Sólo entre las 20 y las 23:30 h desde el último mensaje del cliente. */
export function tocaRecordar(ultimoEntranteEn: Date | null, ahora: Date): boolean {
  if (!ultimoEntranteEn) return false;
  const horas = (ahora.getTime() - ultimoEntranteEn.getTime()) / HORA_MS;
  return horas >= RECORDAR_DESDE_HORAS && horas <= RECORDAR_HASTA_HORAS;
}

/** ¿Le toca ahora el seguimiento de la cotización del evento? Desde `momentoDelSeguimiento`, de 7 a 21 h y antes de las 23:45 h. */
export function tocaSeguimientoDeEvento(ultimoEntranteEn: Date | null, ahora: Date): boolean {
  if (!ultimoEntranteEn) return false;
  const t = ahora.getTime();
  return enHorarioDeEnvio(ahora) && t >= momentoDelSeguimiento(ultimoEntranteEn).getTime() && t <= ultimoEntranteEn.getTime() + LIMITE_HORAS * HORA_MS;
}

const pesos = new Intl.NumberFormat("es-AR", { style: "currency", currency: "ARS", minimumFractionDigits: 0, maximumFractionDigits: 2 });

/** `porTransferencia`: el estudio cobra por transferencia (tiene alias o CVU cargado): no se manda el link. */
export function textoDelRecordatorio(nombre: string | null, p: PendienteDePago, porTransferencia = false): string {
  const primero = nombre?.trim().split(/\s+/)[0];
  const hola = primero ? `¡Hola ${primero}!` : "¡Hola!";
  const monto = pesos.format(p.aPagar);
  if (porTransferencia) {
    const que = p.tipo === "PEDIDO" ? `el pago de tu pedido N° ${p.numero} (${monto})` : `la seña de tus copias (pedido N° ${p.numero}, ${monto})`;
    return `${hola} Te escribo porque quedó pendiente ${que}. Cuando transfieras, mandame el comprobante por acá. ¿Querés que te pase de nuevo los datos para transferir? 😊`;
  }
  if (p.tipo === "PEDIDO") {
    const pagar = p.url ? ` Si querés dejarlo confirmado, lo podés pagar acá: ${p.url}` : " ¿Querés que te mande el enlace para pagarlo?";
    return `${hola} Te escribo porque quedó pendiente el pago de tu pedido N° ${p.numero} (${monto}).${pagar}\nCualquier duda, escribime y lo vemos 😊`;
  }
  return `${hola} Te escribo porque quedó pendiente la seña de tus copias (pedido N° ${p.numero}, ${monto}). ¿Querés que te mande de nuevo el enlace para pagarla? Si querés cambiar algo, decime y lo ajustamos 😊`;
}

export function marcaDe(p: PendienteDePago): string {
  return `${MARCA_RECORDATORIO} (pedido N° ${p.numero})`;
}
