/**
 * PURO. El recordatorio de pago del bot de WhatsApp: al cliente que pidió algo por el chat (un
 * pedido del catálogo o copias) y no pagó, el bot le escribe una vez, cerca del final de la
 * ventana de 24 h de Meta (después ya no se puede escribir sin plantilla aprobada).
 */

export const RECORDAR_DESDE_HORAS = 20;
export const RECORDAR_HASTA_HORAS = 23.5;
/** Pedidos más viejos que esto no se recuerdan (el cliente ya habló de otra cosa). */
export const PEDIDO_MAXIMO_DIAS = 3;
/** Comienzo del mensaje SISTEMA que deja el recordatorio en el chat (sirve para no repetirlo). */
export const MARCA_RECORDATORIO = "Recordatorio de pago enviado";

const HORA_MS = 3_600_000;

export type PendienteDePago =
  | { tipo: "PEDIDO"; numero: string; aPagar: number; url: string | null; creado: Date }
  | { tipo: "IMPRESION"; numero: number; aPagar: number; creado: Date };

/** ¿Le toca el recordatorio? Sólo entre las 20 y las 23:30 h desde el último mensaje del cliente. */
export function tocaRecordar(ultimoEntranteEn: Date | null, ahora: Date): boolean {
  if (!ultimoEntranteEn) return false;
  const horas = (ahora.getTime() - ultimoEntranteEn.getTime()) / HORA_MS;
  return horas >= RECORDAR_DESDE_HORAS && horas <= RECORDAR_HASTA_HORAS;
}

const pesos = new Intl.NumberFormat("es-AR", { style: "currency", currency: "ARS", minimumFractionDigits: 0, maximumFractionDigits: 2 });

export function textoDelRecordatorio(nombre: string | null, p: PendienteDePago): string {
  const primero = nombre?.trim().split(/\s+/)[0];
  const hola = primero ? `¡Hola ${primero}!` : "¡Hola!";
  const monto = pesos.format(p.aPagar);
  if (p.tipo === "PEDIDO") {
    const pagar = p.url ? ` Si querés dejarlo confirmado, lo podés pagar acá: ${p.url}` : " ¿Querés que te mande el enlace para pagarlo?";
    return `${hola} Te escribo porque quedó pendiente el pago de tu pedido N° ${p.numero} (${monto}).${pagar}\nCualquier duda, escribime y lo vemos 😊`;
  }
  return `${hola} Te escribo porque quedó pendiente la seña de tus copias (pedido N° ${p.numero}, ${monto}). ¿Querés que te mande de nuevo el enlace para pagarla? Si querés cambiar algo, decime y lo ajustamos 😊`;
}

export function marcaDe(p: PendienteDePago): string {
  return `${MARCA_RECORDATORIO} (pedido N° ${p.numero})`;
}
