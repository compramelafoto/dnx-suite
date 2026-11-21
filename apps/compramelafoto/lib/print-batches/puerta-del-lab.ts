/**
 * Funciones puras de la puerta del laboratorio sin cuenta (`/lab/lote/[token]`): formato del token,
 * botones de estado, texto de cada pedido y fechas. Sin Prisma, para poder probarlo; la carga desde
 * la base está en `lote-del-lab.ts`.
 */

import { puedeMover, type EntregaLote, type EstadoLote } from "./reglas";
import { resumirCopias, type CopiaResumen } from "./correos";
import { nombreSinContacto } from "@/lib/orders/print-export/datos-del-cliente";

export { nombreSinContacto };

/** Mismo texto para enlace inventado, de otro lote, mal escrito o de un lote anulado: no dice si existe. */
export const ENLACE_INVALIDO = "Este enlace no es válido o el lote se anuló.";

export const ERROR_CAMBIO_DE_ESTADO = "Ese cambio de estado no se puede hacer.";

/** El laboratorio con el enlace deja esta cookie (la lee el QR del sobre, Tarea 9). */
export const DURACION_COOKIE_S = 30 * 24 * 60 * 60;
export function nombreDeLaCookie(batchId: number): string {
  return `lab_lote_${batchId}`;
}

/** `nuevoTokenDeLote` da 32 bytes en base64url: 43 caracteres sin relleno. */
export function tokenConFormatoValido(token: unknown): token is string {
  return typeof token === "string" && /^[A-Za-z0-9_-]{43}$/.test(token);
}

/** Estados a los que el laboratorio puede llevar el lote, con el texto de su botón. */
const BOTONES: ReadonlyArray<{ hacia: EstadoLote; texto: string }> = [
  { hacia: "EN_PRODUCCION", texto: "Lo empezamos" },
  { hacia: "LISTO", texto: "Está listo" },
  { hacia: "DESPACHADO", texto: "Lo despachamos" },
];
export type EstadoDelLab = "EN_PRODUCCION" | "LISTO" | "DESPACHADO";

export function esEstadoDelLab(valor: unknown): valor is EstadoDelLab {
  return typeof valor === "string" && BOTONES.some((b) => b.hacia === valor);
}

/** Los botones que se muestran según el estado del lote y la entrega («Lo despachamos» sólo si envía el lab). */
export function botonesDelLab(estado: EstadoLote, entrega: EntregaLote): Array<{ hacia: EstadoDelLab; texto: string }> {
  return BOTONES.filter((b) => puedeMover(estado, b.hacia, "LABORATORIO", entrega)) as Array<{ hacia: EstadoDelLab; texto: string }>;
}

const TEXTO_DEL_ESTADO: Record<EstadoLote, string> = {
  ARMADO: "Armado",
  ENVIADO: "Enviado, sin empezar",
  EN_PRODUCCION: "En producción",
  LISTO: "Listo",
  DESPACHADO: "Despachado",
  RECIBIDO: "Recibido por el fotógrafo",
  CERRADO: "Cerrado",
  ANULADO: "Anulado",
};
export function textoDelEstado(estado: EstadoLote): string {
  return TEXTO_DEL_ESTADO[estado] ?? estado;
}

export function nombreDelFotografo(u: { name: string | null; companyName: string | null }): string {
  return u.name?.trim() || u.companyName?.trim() || "Fotógrafo";
}

export type ResumenDelPedido = { cliente: string; pedido: number | null; album: string; copias: CopiaResumen[]; totalCopias: number };

/** Lee el `resumen` Json de una fila del lote sin confiar en su forma; nunca trae correo ni teléfono. */
export function leerResumen(json: unknown): ResumenDelPedido {
  const r = json && typeof json === "object" && !Array.isArray(json) ? (json as Record<string, unknown>) : {};
  const texto = (v: unknown) => (typeof v === "string" ? v.trim() : "");
  const copias: CopiaResumen[] = Array.isArray(r.copias)
    ? r.copias.flatMap((c): CopiaResumen[] => {
        if (!c || typeof c !== "object") return [];
        const o = c as Record<string, unknown>;
        const cantidad = Number(o.cantidad);
        if (!Number.isFinite(cantidad) || cantidad <= 0) return [];
        return [{ medida: texto(o.medida) || "Sin medida", acabado: texto(o.acabado), cantidad }];
      })
    : [];
  const pedido = Number(r.pedido);
  return {
    cliente: nombreSinContacto(texto(r.cliente)),
    pedido: Number.isInteger(pedido) && pedido > 0 ? pedido : null,
    album: texto(r.album),
    copias,
    totalCopias: copias.reduce((s, c) => s + c.cantidad, 0),
  };
}

/** «<Fotógrafo> + <Cliente>»: a nombre de quién va el pedido para el laboratorio. */
export function aNombreDe(fotografo: string, cliente: string): string {
  return `${fotografo} + ${cliente}`;
}

export const MARCA_RETIRA_CLIENTE = "RETIRA EL CLIENTE · PAGADO, no cobrar";

/** «13x18 BRILLO» o «10x15» si no tiene acabado. */
export function medidaYAcabado(c: Pick<CopiaResumen, "medida" | "acabado">): string {
  return `${c.medida}${c.acabado ? ` ${c.acabado}` : ""}`;
}

export function textoDeCopias(copias: readonly CopiaResumen[]): string {
  return copias.map((c) => `${c.cantidad}× ${medidaYAcabado(c)}`).join(" · ");
}

/** Resumen de copias de todo el lote, por medida y acabado. */
export function copiasDelLote(pedidos: ReadonlyArray<{ copias: readonly CopiaResumen[] }>): CopiaResumen[] {
  return resumirCopias(pedidos.flatMap((p) => p.copias));
}

/**
 * dd/mm/aaaa en hora argentina. Una fecha sin hora (guardada a las 00:00 UTC) se muestra tal cual,
 * para que el 25/11 no aparezca como 24/11.
 */
export function fechaCorta(d: Date): string {
  const sinHora = d.getUTCHours() === 0 && d.getUTCMinutes() === 0 && d.getUTCSeconds() === 0 && d.getUTCMilliseconds() === 0;
  return d.toLocaleDateString("es-AR", {
    timeZone: sinHora ? "UTC" : "America/Argentina/Buenos_Aires",
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
}
