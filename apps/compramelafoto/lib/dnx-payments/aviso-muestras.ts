import { createHmac } from "node:crypto";

/**
 * Aviso a Muestras Fotográficas: "la orden X de Mercado Pago cambió" (Muestras, etapa 8, D31/D35).
 *
 * El receptor de webhooks `order` de CLF es el único que tiene Mercado Pago configurado; cuando la
 * orden es una venta de obras de Muestras (`external_reference` = `muestras-venta-…`), le avisa en
 * segundo plano. El aviso no dice nada del pago: Muestras le pregunta a Mercado Pago con su propio
 * token. Este módulo NUNCA lanza ni cambia la respuesta de CLF a Mercado Pago.
 */
export const MUESTRAS_REFERENCE_PREFIX = "muestras-venta-";
export const MUESTRAS_AVISO_URL_POR_OMISION = "https://muestrasfotograficas.com/api/pagos/aviso";
export const AVISO_ENCABEZADO = "x-dnx-aviso";
const ESPERA_MS = 3000;

export function esOrdenDeMuestras(ref: string | null | undefined): boolean {
  return typeof ref === "string" && ref.startsWith(MUESTRAS_REFERENCE_PREFIX) && ref.length > MUESTRAS_REFERENCE_PREFIX.length;
}

/**
 * COPIA IDÉNTICA de `apps/muestras/lib/ventas/aviso-firma.ts` (`firmarAviso`): si se cambia una,
 * se cambia la otra, y el vector fijo de los dos tests tiene que seguir dando lo mismo.
 *
 * Encabezado `x-dnx-aviso: t=<segundos>,v1=<HMAC-SHA256(secreto, "<t>.<cuerpo>") en hex>`.
 */
export function firmarAviso(secreto: string, t: number, cuerpo: string): string {
  const v1 = createHmac("sha256", secreto).update(`${t}.${cuerpo}`).digest("hex");
  return `t=${t},v1=${v1}`;
}

export type DependenciasDelAviso = {
  fetch: typeof fetch;
  env: Record<string, string | undefined>;
  ahora: () => number;
};

let avisadoSinSecreto = false;

/** Para los tests: vuelve a avisar una vez la falta del secreto. */
export function olvidarAvisoSinSecreto(): void {
  avisadoSinSecreto = false;
}

const prefijo = (id: string) => id.slice(0, 8);

/**
 * `POST` firmado a Muestras con `{"providerOrderId":"…"}`, 3 segundos de espera y sin reintentos
 * (Muestras también concilia por su cuenta). Sin `MUESTRAS_AVISO_PAGOS_SECRET`, no hace nada (un
 * aviso en el log, una vez). Nunca lanza.
 */
export async function avisarAMuestras(
  providerOrderId: string,
  deps: DependenciasDelAviso = { fetch: globalThis.fetch, env: process.env, ahora: () => Date.now() },
): Promise<void> {
  try {
    const secreto = deps.env.MUESTRAS_AVISO_PAGOS_SECRET?.trim();
    if (!secreto) {
      if (!avisadoSinSecreto) {
        avisadoSinSecreto = true;
        console.warn("[dnx-payments] aviso a Muestras: falta MUESTRAS_AVISO_PAGOS_SECRET, no se avisa.");
      }
      return;
    }
    const url = deps.env.MUESTRAS_AVISO_PAGOS_URL?.trim() || MUESTRAS_AVISO_URL_POR_OMISION;
    const cuerpo = JSON.stringify({ providerOrderId });
    const t = Math.floor(deps.ahora() / 1000);
    const res = await deps.fetch(url, {
      method: "POST",
      headers: { "content-type": "application/json", [AVISO_ENCABEZADO]: firmarAviso(secreto, t, cuerpo) },
      body: cuerpo,
      signal: AbortSignal.timeout(ESPERA_MS),
      cache: "no-store",
    });
    if (res.status !== 202) {
      console.warn(`[dnx-payments] aviso a Muestras: respuesta ${res.status} para la orden ${prefijo(providerOrderId)}…`);
    }
  } catch (error) {
    const nombre = (error as { name?: string } | null)?.name ?? "Error";
    console.warn(`[dnx-payments] aviso a Muestras falló (${nombre}) para la orden ${prefijo(providerOrderId)}…`);
  }
}
