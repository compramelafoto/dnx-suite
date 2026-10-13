import { createHmac, timingSafeEqual } from "node:crypto";

/**
 * Firma del aviso "la orden X cambió" que manda CLF a Muestras (etapa 8, spec D31).
 *
 * COPIA IDÉNTICA de `apps/compramelafoto/lib/dnx-payments/aviso-muestras.ts` (las funciones de firma):
 * si se cambia una, se cambia la otra, y el vector fijo de los dos tests tiene que seguir dando lo
 * mismo. El aviso no dice nada del pago: sólo hace que Muestras le pregunte a Mercado Pago.
 *
 * Encabezado `x-dnx-aviso: t=<segundos>,v1=<HMAC-SHA256(secreto, "<t>.<cuerpo>") en hex>`.
 */
export const AVISO_ENCABEZADO = "x-dnx-aviso";
export const AVISO_TOLERANCIA_SEG = 300;

export function firmarAviso(secreto: string, t: number, cuerpo: string): string {
  const v1 = createHmac("sha256", secreto).update(`${t}.${cuerpo}`).digest("hex");
  return `t=${t},v1=${v1}`;
}

export type ResultadoAviso = "ok" | "vencido" | "invalido" | "sin-configurar";

const ENCABEZADO_RE = /^t=(\d{1,12}),v1=([0-9a-f]{64})$/;

/**
 * Verifica el encabezado contra el cuerpo crudo. Primero la firma (en tiempo constante) y después la
 * ventana de 5 minutos, para los dos lados (relojes corridos).
 */
export function verificarAviso(
  secreto: string | null | undefined,
  encabezado: string | null | undefined,
  cuerpo: string,
  ahoraSeg: number,
  toleranciaSeg: number = AVISO_TOLERANCIA_SEG,
): ResultadoAviso {
  if (!secreto) return "sin-configurar";
  const m = ENCABEZADO_RE.exec((encabezado ?? "").trim());
  if (!m) return "invalido";
  const t = Number(m[1]);
  const esperada = Buffer.from(firmarAviso(secreto, t, cuerpo).slice(-64), "hex");
  const recibida = Buffer.from(m[2]!, "hex");
  if (esperada.length !== recibida.length || !timingSafeEqual(esperada, recibida)) return "invalido";
  if (Math.abs(ahoraSeg - t) > toleranciaSeg) return "vencido";
  return "ok";
}
