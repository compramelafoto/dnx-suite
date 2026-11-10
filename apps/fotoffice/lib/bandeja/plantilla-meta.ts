import "server-only";
import { leerTokenWhatsapp } from "@/lib/integrations/whatsapp/credentials";
import type { Conexion } from "./conexion";
import { destinoParaMeta, type DepsEnvio, type ResultadoEnvio } from "./envio";

/**
 * Mensaje con plantilla aprobada de Meta: la única forma de escribirle a un cliente pasadas las 24
 * horas de su último mensaje. Cada envío se cobra según la categoría de la plantilla. Igual que
 * `enviarTexto`: nunca lanza ni loguea el teléfono, el texto o el token.
 */

export type Plantilla = {
  nombre: string;
  idioma: string;
  /** Valores de {{1}}, {{2}}… del cuerpo, en orden. */
  cuerpo: string[];
  /** Valor de {{1}} del primer botón con enlace (lo que va después de la dirección fija). */
  boton?: string;
};

const TIEMPO_MAXIMO_MS = 15_000;

export async function enviarPlantilla(
  conexion: Pick<Conexion, "workspaceId" | "modo" | "phoneNumberId">,
  waId: string,
  p: Plantilla,
  deps: DepsEnvio = {},
): Promise<ResultadoEnvio> {
  if (conexion.modo !== "REAL") return { ok: true, simulado: true };
  if (!conexion.phoneNumberId) return { ok: false, codigo: "SIN_NUMERO" };
  const token = await (deps.leerToken ?? leerTokenWhatsapp)(conexion.workspaceId).catch(() => null);
  if (!token) return { ok: false, codigo: "SIN_TOKEN" };
  const components: Record<string, unknown>[] = [];
  if (p.cuerpo.length > 0) components.push({ type: "body", parameters: p.cuerpo.map((text) => ({ type: "text", text })) });
  if (p.boton) components.push({ type: "button", sub_type: "url", index: "0", parameters: [{ type: "text", text: p.boton }] });
  const version = process.env.WHATSAPP_API_VERSION || "v21.0";
  try {
    const res = await (deps.fetch ?? fetch)(`https://graph.facebook.com/${version}/${conexion.phoneNumberId}/messages`, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        messaging_product: "whatsapp",
        recipient_type: "individual",
        to: destinoParaMeta(waId),
        type: "template",
        template: { name: p.nombre, language: { code: p.idioma }, components },
      }),
      signal: AbortSignal.timeout(TIEMPO_MAXIMO_MS),
    });
    const cuerpo = (await res.json().catch(() => null)) as { messages?: { id?: unknown }[]; error?: { code?: unknown } } | null;
    if (!res.ok) {
      const c = cuerpo?.error?.code;
      return { ok: false, codigo: String(typeof c === "number" || typeof c === "string" ? c : res.status) };
    }
    const id = cuerpo?.messages?.[0]?.id;
    return typeof id === "string" && id ? { ok: true, simulado: false, waMessageId: id } : { ok: false, codigo: "SIN_ID" };
  } catch {
    return { ok: false, codigo: "RED" };
  }
}
