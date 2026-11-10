import "server-only";
import sharp from "sharp";
import { prisma } from "@repo/db";
import { Anthropic, costMicroUsd } from "@repo/dnx-bot";
import { leerConfigBot, plataformaDe } from "@/lib/dnx-bot/config";
import { resolveWorkspaceCollector } from "@/lib/payments/connect/collector";
import { urlDeLecturaArchivo } from "@/lib/carpetas/almacen";
import type { CtxBandeja } from "../acceso";
import type { Resultado } from "../acciones";
import { claveDeMedia } from "../archivo-de-mensaje";
import { decidir, textoDelVeredicto, type Leido, type PagoMp, type Veredicto } from "./veredicto";

/**
 * "Verificar comprobante" en la Bandeja: una persona del equipo toca el botón sobre la imagen que
 * mandó el cliente. Se lee con Claude (operación, monto, fecha, quién paga y a quién) y se busca
 * en el Mercado Pago conectado al estudio: primero la operación por número y, si no está, un pago
 * del mismo monto cerca de esa fecha. El resultado queda como mensaje del sistema en el chat.
 * No cambia ningún pedido ni cobro: es una ayuda para quien atiende.
 */

export const MENSAJES_COMPROBANTE = {
  sinImagen: "No encontramos esa imagen en el chat.",
  noLeido: "No pude leer el comprobante. Probá de nuevo o revisalo a mano.",
  sinMp: "No se pudo consultar Mercado Pago. Revisá que esté conectado en Configuración → Cobros.",
} as const;

const SISTEMA = `Vas a leer una imagen que un cliente mandó por WhatsApp a un estudio de fotografía de Argentina. Puede ser un comprobante de transferencia o de pago (Mercado Pago, un banco, una billetera) o cualquier otra cosa.
Devolvé los datos con el esquema pedido. No inventes nada: lo que no figure, null.
- "es_comprobante": true sólo si es un comprobante de pago o transferencia.
- "operacion": el número de operación o de transacción, sólo dígitos y letras, sin espacios.
- "monto": el importe transferido en pesos, como número con punto decimal ("$ 10.000" ⇒ 10000; "1.234,50" ⇒ 1234.5).
- "fecha": fecha y hora del comprobante en formato ISO 8601 con la zona de Argentina (-03:00), o null.
- "origen": quién paga (nombre del titular de origen). "destinatario": a quién se le paga.`;

const ESQUEMA = {
  type: "object",
  additionalProperties: false,
  required: ["es_comprobante", "operacion", "monto", "fecha", "origen", "destinatario"],
  properties: {
    es_comprobante: { type: "boolean" },
    operacion: { type: ["string", "null"] },
    monto: { type: ["number", "null"] },
    fecha: { type: ["string", "null"] },
    origen: { type: ["string", "null"] },
    destinatario: { type: ["string", "null"] },
  },
} as const;

type Imagen = { chatId: string; bytes: Buffer; mime: string };

export type DepsComprobante = {
  imagen?: (workspaceId: string, chatId: string, mensajeId: string) => Promise<Imagen | null>;
  leer?: (img: Imagen, workspaceId: string) => Promise<Leido | null>;
  pagoPorOperacion?: (workspaceId: string, operacion: string) => Promise<PagoMp | null>;
  pagosDelMonto?: (workspaceId: string, monto: number, fecha: string | null) => Promise<PagoMp[]>;
  sistema?: (workspaceId: string, chatId: string, texto: string) => Promise<void>;
};

const LIMITE_BYTES = 15 * 1024 * 1024;

async function imagenDelChat(workspaceId: string, chatId: string, mensajeId: string): Promise<Imagen | null> {
  const m = await prisma.fotofficeWaMensaje.findFirst({
    where: { id: mensajeId, workspaceId, chatId, direccion: "ENTRANTE", tipo: { in: ["IMAGEN", "DOCUMENTO"] } },
    select: { media: true },
  });
  const clave = m ? claveDeMedia(m.media) : null;
  const mime = (m?.media as { mimeType?: unknown } | null)?.mimeType;
  if (!clave || typeof mime !== "string" || !mime.startsWith("image/")) return null;
  const res = await fetch(await urlDeLecturaArchivo(clave, "comprobante", "ver"), { cache: "no-store" });
  if (!res.ok) return null;
  const bytes = Buffer.from(await res.arrayBuffer());
  if (bytes.length > LIMITE_BYTES) return null;
  // Claude acepta hasta 5 MB por imagen: se achica a 2000 px en JPEG, alcanza para leer un comprobante.
  const jpeg = await sharp(bytes).rotate().resize({ width: 2000, height: 2000, fit: "inside", withoutEnlargement: true }).jpeg({ quality: 85 }).toBuffer();
  return { chatId, bytes: jpeg, mime: "image/jpeg" };
}

async function leerConClaude(img: Imagen, workspaceId: string): Promise<Leido | null> {
  const config = leerConfigBot();
  if (!config.anthropicApiKey) return null;
  const cliente = new Anthropic({ apiKey: config.anthropicApiKey, maxRetries: 1, timeout: 60_000 });
  let respuesta: Anthropic.Beta.Messages.BetaMessage;
  try {
    respuesta = await cliente.beta.messages.create({
      model: config.model,
      max_tokens: 2000,
      betas: ["server-side-fallback-2026-07-01"],
      fallbacks: "default",
      output_config: { effort: "low", format: { type: "json_schema", schema: ESQUEMA } },
      system: SISTEMA,
      messages: [
        {
          role: "user",
          content: [
            { type: "image", source: { type: "base64", media_type: "image/jpeg", data: img.bytes.toString("base64") } },
            { type: "text", text: "Leé esta imagen." },
          ],
        },
      ],
    });
  } catch (e) {
    console.warn("[fotoffice][comprobante] falló la lectura con Claude", { codigo: e instanceof Error ? e.name : "desconocido" });
    return null;
  }
  try {
    const { registrarUsoWa } = await import("../bot/uso");
    await registrarUsoWa({ plataforma: plataformaDe(workspaceId), chatId: img.chatId, usage: respuesta.usage, costMicroUsd: costMicroUsd(respuesta.model || config.model, respuesta.usage), contarMensaje: false });
  } catch {
    // El uso no frena la verificación.
  }
  if (respuesta.stop_reason === "refusal" || respuesta.stop_reason === "max_tokens") return null;
  const bloque = respuesta.content.find((b) => b.type === "text");
  if (!bloque || bloque.type !== "text") return null;
  try {
    const j = JSON.parse(bloque.text) as Record<string, unknown>;
    const txt = (v: unknown) => (typeof v === "string" && v.trim() ? v.trim().slice(0, 120) : null);
    return {
      esComprobante: j.es_comprobante === true,
      operacion: txt(j.operacion)?.replace(/[^\w-]/g, "") || null,
      monto: typeof j.monto === "number" && Number.isFinite(j.monto) ? j.monto : null,
      fecha: txt(j.fecha),
      origen: txt(j.origen),
      destinatario: txt(j.destinatario),
    };
  } catch {
    return null;
  }
}

async function tokenMp(workspaceId: string): Promise<string> {
  const c = await resolveWorkspaceCollector(workspaceId);
  if (!c.ok) throw new Error(c.code);
  return c.collector.accessToken;
}

function pagoDe(p: Record<string, unknown>): PagoMp {
  const pagador = p.payer as { first_name?: unknown; last_name?: unknown } | undefined;
  const nombre = [pagador?.first_name, pagador?.last_name].filter((x) => typeof x === "string" && x).join(" ");
  return {
    id: String(p.id),
    monto: Number(p.transaction_amount ?? 0),
    estado: String(p.status ?? ""),
    fecha: typeof p.date_approved === "string" ? p.date_approved : typeof p.date_created === "string" ? p.date_created : null,
    pagador: nombre || null,
  };
}

async function pagoPorOperacionMp(workspaceId: string, operacion: string): Promise<PagoMp | null> {
  if (!/^\d{6,20}$/.test(operacion)) return null;
  const res = await fetch(`https://api.mercadopago.com/v1/payments/${operacion}`, { headers: { Authorization: `Bearer ${await tokenMp(workspaceId)}` }, cache: "no-store" });
  if (res.status === 404 || res.status === 403) return null;
  if (!res.ok) throw new Error(`MP ${res.status}`);
  return pagoDe((await res.json()) as Record<string, unknown>);
}

async function pagosDelMontoMp(workspaceId: string, monto: number, fecha: string | null): Promise<PagoMp[]> {
  const centro = fecha && !Number.isNaN(Date.parse(fecha)) ? Date.parse(fecha) : Date.now();
  const q = new URLSearchParams({
    sort: "date_created", criteria: "desc", limit: "50", range: "date_created",
    begin_date: new Date(centro - 12 * 3_600_000).toISOString(), end_date: new Date(centro + 12 * 3_600_000).toISOString(),
  });
  const res = await fetch(`https://api.mercadopago.com/v1/payments/search?${q}`, { headers: { Authorization: `Bearer ${await tokenMp(workspaceId)}` }, cache: "no-store" });
  if (!res.ok) throw new Error(`MP ${res.status}`);
  const j = (await res.json()) as { results?: Record<string, unknown>[] };
  return (j.results ?? []).map(pagoDe).filter((p) => Math.abs(p.monto - monto) < 0.5);
}

const POR_OMISION: Required<DepsComprobante> = {
  imagen: imagenDelChat,
  leer: leerConClaude,
  pagoPorOperacion: pagoPorOperacionMp,
  pagosDelMonto: pagosDelMontoMp,
  sistema: async (workspaceId, chatId, texto) => {
    const { escribirSistema } = await import("../acciones");
    await prisma.$transaction((tx) => escribirSistema(tx, workspaceId, chatId, texto.slice(0, 600), new Date()));
  },
};

export async function verificarComprobante(
  ctx: CtxBandeja,
  chatId: string,
  mensajeId: string,
  deps: DepsComprobante = {},
): Promise<Resultado<{ estado: Veredicto["estado"]; texto: string }>> {
  const d = { ...POR_OMISION, ...deps };
  const img = await d.imagen(ctx.workspaceId, chatId, mensajeId).catch(() => null);
  if (!img) return { ok: false, error: MENSAJES_COMPROBANTE.sinImagen };
  const leido = await d.leer(img, ctx.workspaceId).catch(() => null);
  if (!leido) return { ok: false, error: MENSAJES_COMPROBANTE.noLeido };

  let veredicto: Veredicto;
  try {
    const porOperacion = leido.esComprobante && leido.operacion ? await d.pagoPorOperacion(ctx.workspaceId, leido.operacion) : null;
    const candidatos = leido.esComprobante && !porOperacion && leido.monto ? await d.pagosDelMonto(ctx.workspaceId, leido.monto, leido.fecha) : [];
    veredicto = decidir(leido, porOperacion, candidatos);
  } catch (e) {
    console.warn("[fotoffice][comprobante] no se pudo consultar Mercado Pago", { codigo: e instanceof Error ? e.message.slice(0, 40) : "desconocido" });
    return { ok: false, error: MENSAJES_COMPROBANTE.sinMp };
  }
  const texto = textoDelVeredicto(veredicto, leido);
  await d.sistema(ctx.workspaceId, chatId, `${ctx.userLabel} verificó un comprobante: ${texto}`).catch(() => undefined);
  return { ok: true, estado: veredicto.estado, texto };
}
