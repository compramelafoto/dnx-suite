import "server-only";
import { leerTokenInstagram } from "@/lib/integrations/instagram/credentials";
import type { Conexion } from "../conexion";
import type { DepsEnvio, ResultadoEnvio } from "../envio";
import { partirPorBytes } from "./partir";

export { BYTES_MAXIMOS_INSTAGRAM, partirPorBytes } from "./partir";

/**
 * Salida por mensaje directo de Instagram: `POST /{igPageId}/messages` con el token de la página de
 * Facebook vinculada. Igual que WhatsApp: SIMULADO simula; en REAL manda de verdad o falla con un
 * código (SIN_PAGINA, SIN_TOKEN, el de Meta, el HTTP o RED). Instagram acepta hasta 1000 bytes por
 * mensaje: un texto más largo sale en varias partes. Nunca lanza ni loguea el texto, el IGSID o el token.
 */

const TIEMPO_MAXIMO_MS = 15_000;

export async function enviarTextoInstagram(
  conexion: Pick<Conexion, "workspaceId" | "modo" | "igPageId"> & Partial<Pick<Conexion, "igActivo">>,
  igsid: string,
  texto: string,
  deps: DepsEnvio = {},
): Promise<ResultadoEnvio> {
  if (conexion.modo !== "REAL") return { ok: true, simulado: true };
  if (conexion.igActivo !== true || !conexion.igPageId) return { ok: false, codigo: "SIN_PAGINA" };
  const token = await (deps.leerToken ?? leerTokenInstagram)(conexion.workspaceId).catch(() => null);
  if (!token) return { ok: false, codigo: "SIN_TOKEN" };
  const partes = partirPorBytes(texto);
  if (partes.length === 0) return { ok: false, codigo: "SIN_TEXTO" };

  const version = process.env.WHATSAPP_API_VERSION || "v21.0";
  const url = `https://graph.facebook.com/${version}/${conexion.igPageId}/messages`;
  let ultimoMid = "";
  for (const parte of partes) {
    try {
      const res = await (deps.fetch ?? fetch)(url, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify({ recipient: { id: igsid }, message: { text: parte } }),
        signal: AbortSignal.timeout(TIEMPO_MAXIMO_MS),
      });
      const cuerpo = (await res.json().catch(() => null)) as { message_id?: unknown; error?: { code?: unknown } } | null;
      if (!res.ok) {
        const c = cuerpo?.error?.code;
        // Si ya salieron partes anteriores, igual se marca fallido: desde el panel se puede reenviar.
        return { ok: false, codigo: String(typeof c === "number" || typeof c === "string" ? c : res.status) };
      }
      const mid = cuerpo?.message_id;
      if (typeof mid !== "string" || !mid) return { ok: false, codigo: "SIN_ID" };
      ultimoMid = mid;
    } catch {
      return { ok: false, codigo: "RED" };
    }
  }
  return { ok: true, simulado: false, waMessageId: ultimoMid };
}
