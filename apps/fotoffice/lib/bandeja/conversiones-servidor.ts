import "server-only";
import { after } from "next/server";
import { prisma } from "@repo/db";
import { leerTokenWhatsapp } from "@/lib/integrations/whatsapp/credentials";
import { leerConexion } from "./conexion";
import { clicMasReciente, cuerpoDelAviso, VENTANA_CLIC_MS, type EventoConversion } from "./conversiones";

/**
 * Le avisa a Meta que un chat que llegó por un anuncio "clic a WhatsApp" terminó en cotización
 * (`LeadSubmitted`) o en venta (`Purchase`). Sólo hay aviso si el cliente tocó un anuncio en los
 * últimos 90 días (hay `ctwa_clid`) y la conexión de WhatsApp es REAL. Nunca lanza ni frena lo que
 * la llamó: cualquier problema queda en el log con su código, sin teléfonos ni textos.
 *
 * El conjunto de datos (dataset) es el que Meta tiene atado a la cuenta de WhatsApp Business
 * (`GET /{waba}/dataset`); `META_DATASET_MENSAJERIA` lo fija a mano si hace falta.
 */

export type PedidoDeAviso =
  | { evento: "LeadSubmitted"; workspaceId: string; eventoId: string; chatId: string }
  | { evento: "Purchase"; workspaceId: string; eventoId: string; pedidoId: string };

export type DepsAviso = {
  fetch?: typeof fetch;
  ahora?: () => Date;
  leerToken?: (workspaceId: string) => Promise<string | null>;
};

export type ResultadoAviso = { ok: true } | { ok: false; motivo: string };

const version = () => process.env.WHATSAPP_API_VERSION || "v21.0";

async function datasetDeLaCuenta(wabaId: string, token: string, f: typeof fetch): Promise<string | null> {
  const fijo = process.env.META_DATASET_MENSAJERIA?.trim();
  if (fijo) return fijo;
  const res = await f(`https://graph.facebook.com/${version()}/${wabaId}/dataset`, {
    headers: { Authorization: `Bearer ${token}` },
    signal: AbortSignal.timeout(10_000),
  });
  if (!res.ok) return null;
  const j = (await res.json().catch(() => null)) as { data?: { dataset_id?: unknown }[] } | null;
  const id = j?.data?.[0]?.dataset_id;
  return typeof id === "string" || typeof id === "number" ? String(id) : null;
}

/** Chats del cliente (por pedido) o el chat del bot (por cotización). */
async function chatsDelAviso(p: PedidoDeAviso): Promise<{ chatIds: string[]; valorArs: number | null }> {
  if (p.evento === "LeadSubmitted") return { chatIds: [p.chatId], valorArs: null };
  const pedido = await prisma.fotofficePedido.findFirst({
    where: { id: p.pedidoId, workspaceId: p.workspaceId },
    select: { clientId: true, totalArs: true },
  });
  if (!pedido) return { chatIds: [], valorArs: null };
  const chats = await prisma.fotofficeWaChat.findMany({
    where: { workspaceId: p.workspaceId, clientId: pedido.clientId },
    select: { id: true },
  });
  return { chatIds: chats.map((c) => c.id), valorArs: Number(pedido.totalArs.toString()) };
}

export async function avisarConversionAMeta(p: PedidoDeAviso, deps: DepsAviso = {}): Promise<ResultadoAviso> {
  const ahora = deps.ahora?.() ?? new Date();
  const f = deps.fetch ?? fetch;
  try {
    const { chatIds, valorArs } = await chatsDelAviso(p);
    if (chatIds.length === 0) return { ok: false, motivo: "SIN_CHAT" };
    const mensajes = await prisma.fotofficeWaMensaje.findMany({
      where: {
        workspaceId: p.workspaceId,
        chatId: { in: chatIds },
        direccion: "ENTRANTE",
        createdAt: { gte: new Date(ahora.getTime() - VENTANA_CLIC_MS) },
      },
      orderBy: { createdAt: "desc" },
      take: 300,
      select: { media: true, createdAt: true },
    });
    const clic = clicMasReciente(mensajes, ahora);
    if (!clic) return { ok: false, motivo: "SIN_ANUNCIO" };

    const conexion = await leerConexion(p.workspaceId);
    if (conexion.modo !== "REAL" || !conexion.wabaId) return { ok: false, motivo: "SIN_CONEXION_REAL" };
    const token = await (deps.leerToken ?? leerTokenWhatsapp)(p.workspaceId).catch(() => null);
    if (!token) return { ok: false, motivo: "SIN_TOKEN" };
    const dataset = await datasetDeLaCuenta(conexion.wabaId, token, f);
    if (!dataset) return { ok: false, motivo: "SIN_DATASET" };

    const cuerpo = cuerpoDelAviso({
      evento: p.evento, eventoId: p.eventoId, cuando: ahora, wabaId: conexion.wabaId, ctwaClid: clic.ctwaClid, valorArs,
    });
    const res = await f(`https://graph.facebook.com/${version()}/${dataset}/events`, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify(cuerpo),
      signal: AbortSignal.timeout(10_000),
    });
    if (!res.ok) {
      const j = (await res.json().catch(() => null)) as { error?: { code?: unknown; error_subcode?: unknown } } | null;
      return { ok: false, motivo: `META_${res.status}_${String(j?.error?.code ?? "")}_${String(j?.error?.error_subcode ?? "")}` };
    }
    return { ok: true };
  } catch (e) {
    return { ok: false, motivo: e instanceof Error ? e.name : "ERROR" };
  }
}

/** Corre el aviso después de responder (no demora la pantalla ni el bot). Nunca lanza. */
export function programarConversion(p: PedidoDeAviso): void {
  const correr = async () => {
    const r = await avisarConversionAMeta(p);
    const evento: EventoConversion = p.evento;
    if (r.ok) console.info("[fotoffice][conversiones] aviso enviado a Meta", { evento, eventoId: p.eventoId });
    else if (r.motivo !== "SIN_ANUNCIO" && r.motivo !== "SIN_CHAT") {
      console.warn("[fotoffice][conversiones] no se pudo avisar a Meta", { evento, motivo: r.motivo });
    }
  };
  try {
    after(correr);
  } catch {
    void correr();
  }
}
