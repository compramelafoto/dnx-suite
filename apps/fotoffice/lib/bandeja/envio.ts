import "server-only";
import { leerTokenWhatsapp } from "@/lib/integrations/whatsapp/credentials";
import type { Conexion } from "./conexion";

/**
 * Salida a WhatsApp (§6 del diseño). Con la conexión SIMULADA simula; en REAL manda de verdad o
 * falla (SIN_NUMERO / SIN_TOKEN si falta algo), nunca simula en silencio. NUNCA lanza ni
 * loguea el texto, el teléfono o el token: devuelve el código de error de Meta (o el HTTP).
 */

export type ResultadoEnvio =
  | { ok: true; simulado: true }
  | { ok: true; simulado: false; waMessageId: string }
  | { ok: false; codigo: string };

export type DepsEnvio = {
  fetch?: typeof fetch;
  /** Por omisión, el baúl de integraciones. */
  leerToken?: (workspaceId: string) => Promise<string | null>;
};

const TIEMPO_MAXIMO_MS = 15_000;

export async function enviarTexto(
  conexion: Pick<Conexion, "workspaceId" | "modo" | "phoneNumberId">,
  waId: string,
  texto: string,
  deps: DepsEnvio = {},
): Promise<ResultadoEnvio> {
  if (conexion.modo !== "REAL") return { ok: true, simulado: true };
  // En modo REAL la honestidad gana: sin número o sin token usable (falta, revocado, no se puede
  // descifrar) NO se simula —parecería enviado—: falla con un código que la pantalla explica.
  if (!conexion.phoneNumberId) return { ok: false, codigo: "SIN_NUMERO" };
  const token = await (deps.leerToken ?? leerTokenWhatsapp)(conexion.workspaceId).catch(() => null);
  if (!token) return { ok: false, codigo: "SIN_TOKEN" };

  const version = process.env.WHATSAPP_API_VERSION || "v21.0";
  const url = `https://graph.facebook.com/${version}/${conexion.phoneNumberId}/messages`;
  try {
    const res = await (deps.fetch ?? fetch)(url, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        messaging_product: "whatsapp",
        recipient_type: "individual",
        to: waId,
        type: "text",
        text: { preview_url: false, body: texto },
      }),
      signal: AbortSignal.timeout(TIEMPO_MAXIMO_MS),
    });
    const cuerpo = (await res.json().catch(() => null)) as
      | { messages?: { id?: unknown }[]; error?: { code?: unknown } }
      | null;
    if (!res.ok) {
      const codigoMeta = cuerpo?.error?.code;
      return { ok: false, codigo: String(typeof codigoMeta === "number" || typeof codigoMeta === "string" ? codigoMeta : res.status) };
    }
    const id = cuerpo?.messages?.[0]?.id;
    if (typeof id !== "string" || !id) return { ok: false, codigo: "SIN_ID" };
    return { ok: true, simulado: false, waMessageId: id };
  } catch {
    return { ok: false, codigo: "RED" };
  }
}
