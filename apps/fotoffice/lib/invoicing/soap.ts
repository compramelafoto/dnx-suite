import { ARCA_TIMEOUT_MS } from "./constants";
import { text } from "./xml";

/**
 * El transporte SOAP: un `fetch` con tiempo de espera. Lo único que importa distinguir es si
 * hubo respuesta o no, porque "no hubo respuesta" es el caso que obliga a conciliar (§11.4c).
 */

export type SoapResultado =
  | { ok: true; status: number; body: string }
  /** No llegó nada: corte por tiempo de espera, red caída, DNS. No se sabe qué hizo ARCA. */
  | { ok: false; sinRespuesta: true; detalle: string };

export type Transporte = (url: string, soapAction: string, body: string) => Promise<SoapResultado>;

export function crearTransporte(opts: { timeoutMs?: number; fetchImpl?: typeof fetch } = {}): Transporte {
  const timeoutMs = opts.timeoutMs ?? ARCA_TIMEOUT_MS;
  const f = opts.fetchImpl ?? fetch;
  return async (url, soapAction, body) => {
    try {
      const res = await f(url, {
        method: "POST",
        headers: { "Content-Type": "text/xml; charset=utf-8", SOAPAction: `"${soapAction}"` },
        body,
        signal: AbortSignal.timeout(timeoutMs),
        cache: "no-store",
      });
      return { ok: true, status: res.status, body: await res.text() };
    } catch (e) {
      const nombre = e instanceof Error ? e.name : "";
      return {
        ok: false,
        sinRespuesta: true,
        detalle: nombre === "TimeoutError" || nombre === "AbortError" ? "ARCA no respondió a tiempo." : "No se pudo conectar con ARCA.",
      };
    }
  };
}

/** Un SOAP Fault, si la respuesta lo trae. */
export function leerFault(xml: string): { code: string; message: string } | null {
  if (!/<(?:\w+:)?Fault[\s>]/.test(xml)) return null;
  const code = (text(xml, "faultcode") ?? "").replace(/^.*:/, "");
  const message = text(xml, "faultstring") ?? "Error de ARCA sin detalle.";
  return { code, message };
}
