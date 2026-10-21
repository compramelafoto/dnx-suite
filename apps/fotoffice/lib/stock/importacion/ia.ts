import "server-only";
import sharp from "sharp";
import { Anthropic, costMicroUsd } from "@repo/dnx-bot";
import { leerConfigBot, plataformaDe } from "@/lib/dnx-bot/config";
import { gastoDelMes, registrarUsoImportacion } from "@/lib/dnx-bot/store";
import { MAX_BYTES_ARCHIVO, MAX_CARACTERES_TEXTO, MAX_PAGINAS_PDF } from "./constantes";
import { SCHEMA_FACTURA, validarDocumento, type DocumentoImportado } from "./esquema";

/**
 * Lectura de facturas, remitos y capturas con Claude (stock etapa 3). El gasto entra en los mismos
 * topes mensuales que DNX Bot (`botUsageDaily`), pero no depende de tener acceso al bot.
 */

type Bloque =
  | Anthropic.Beta.Messages.BetaTextBlockParam
  | Anthropic.Beta.Messages.BetaImageBlockParam
  | Anthropic.Beta.Messages.BetaRequestDocumentBlock;

export type EntradaIa = Bloque[];

/** Lo único que se usa del SDK: así los tests inyectan un cliente falso. */
export type ClienteIa = {
  beta: {
    messages: {
      create(
        params: Anthropic.Beta.Messages.MessageCreateParamsNonStreaming,
      ): Promise<Anthropic.Beta.Messages.BetaMessage>;
    };
  };
};

export const SYSTEM_PROMPT = `Vas a leer un documento de compra de un comercio fotográfico argentino: puede ser una factura, un remito, una captura de pantalla de un pedido o una lista de precios. Devolvé sus datos con el esquema pedido.

Reglas:
- Una fila por artículo comprado.
- No inventes nada: si un código de barras, un código del proveedor, un precio o cualquier otro dato no figura en el documento, poné null.
- "cantidad" es lo comprado tal como dice el documento (si dice 2 cajas, es 2).
- Si el artículo es un pack, caja o bulto que trae N unidades, poné "unidades_por_paquete" = N; si no, null.
- Copiá los costos tal como figuran, con o sin IVA, e indicá en "precios_con_iva" si los precios del documento incluyen IVA (true), no lo incluyen (false) o no se sabe (null).
- Ignorá los renglones de envío o flete, los descuentos generales y los subtotales o totales: no son artículos.
- "total" es el total final del documento, si figura.
- Los números argentinos usan punto para los miles y coma para los decimales: "1.234,50" ⇒ 1234.5. Devolvé los montos en pesos como números con punto decimal.
- "fecha" en formato AAAA-MM-DD, o null si no figura.`;

const ERR_PESO = "El archivo pesa más de 10 MB.";
const ERR_TIPO = "Ese tipo de archivo no se puede leer: usá JPG, PNG, HEIC o PDF.";
const ERR_IMAGEN = "No pudimos abrir esa imagen. Probá sacarle una captura o exportarla como JPG.";
const ERR_PAGINAS = `El PDF tiene más de ${MAX_PAGINAS_PDF} páginas: dividilo o usá la plantilla CSV.`;
const ERR_TEXTO_LARGO = "El texto pegado supera los 20 000 caracteres: dividilo o usá la plantilla CSV.";
const ERR_TEXTO_VACIO = "Pegá el texto de la factura.";

const ERR_SIN_CLAVE = "La lectura con IA no está configurada.";
const ERR_TOPE = "Se alcanzó el tope de gasto de IA de este mes. Usá la plantilla CSV.";
const ERR_RECHAZO = "No pudimos leer este archivo. Probá con otra foto o cargalo a mano.";
const ERR_LARGA = "La factura es muy larga: dividila o usá la plantilla CSV.";
const ERR_INCOMPLETA = "La lectura salió incompleta. Probá de nuevo o usá la plantilla CSV.";
const ERR_API = "No pudimos leer el archivo en este momento. Probá de nuevo en un rato o usá la plantilla CSV.";

const PEDIDO_ARCHIVO = "Leé este documento y devolvé sus datos con el esquema pedido.";

const TIPOS_IMAGEN = new Set(["image/jpeg", "image/jpg", "image/png", "image/webp", "image/heic", "image/heif"]);
const EXT_IMAGEN = new Set(["jpg", "jpeg", "png", "webp", "heic", "heif"]);

export function iaDisponible(): boolean {
  return leerConfigBot().anthropicApiKey !== null;
}

function clase(nombre: string, tipo: string): "imagen" | "pdf" | null {
  const t = tipo.trim().toLowerCase();
  if (TIPOS_IMAGEN.has(t)) return "imagen";
  if (t === "application/pdf") return "pdf";
  // El navegador a veces no sabe el tipo (HEIC en Windows, por ejemplo): se mira la extensión.
  if (t && t !== "application/octet-stream") return null;
  const ext = nombre.toLowerCase().split(".").pop() ?? "";
  if (!nombre.includes(".")) return null;
  if (EXT_IMAGEN.has(ext)) return "imagen";
  if (ext === "pdf") return "pdf";
  return null;
}

/** Cuenta las páginas de un PDF por sus objetos `/Type /Page`. 0 = no se pudo contar (se confía en el peso). */
function paginasPdf(bytes: Buffer): number {
  const texto = bytes.toString("latin1");
  return (texto.match(/\/Type\s*\/Page(?![a-zA-Z])/g) ?? []).length;
}

type Archivo = { nombre: string; tipo: string; bytes: Buffer };

export async function prepararEntrada(
  entrada: Archivo | { texto: string },
): Promise<{ ok: true; bloques: EntradaIa } | { ok: false; error: string }> {
  if ("texto" in entrada) {
    const texto = entrada.texto.trim();
    if (!texto) return { ok: false, error: ERR_TEXTO_VACIO };
    if (texto.length > MAX_CARACTERES_TEXTO) return { ok: false, error: ERR_TEXTO_LARGO };
    return { ok: true, bloques: [{ type: "text", text: `Este es el texto del documento:\n\n${texto}` }] };
  }

  if (entrada.bytes.length > MAX_BYTES_ARCHIVO) return { ok: false, error: ERR_PESO };
  const c = clase(entrada.nombre, entrada.tipo);
  if (!c) return { ok: false, error: ERR_TIPO };

  if (c === "pdf") {
    if (paginasPdf(entrada.bytes) > MAX_PAGINAS_PDF) return { ok: false, error: ERR_PAGINAS };
    return {
      ok: true,
      bloques: [
        { type: "document", source: { type: "base64", media_type: "application/pdf", data: entrada.bytes.toString("base64") } },
        { type: "text", text: PEDIDO_ARCHIVO },
      ],
    };
  }

  let jpeg: Buffer;
  try {
    jpeg = await sharp(entrada.bytes, { limitInputPixels: 100_000_000 })
      .rotate() // endereza según el EXIF de la cámara
      .resize({ width: 2000, height: 2000, fit: "inside", withoutEnlargement: true })
      .jpeg({ quality: 85 })
      .toBuffer();
  } catch (e) {
    console.error("[stock/importacion] no se pudo procesar la imagen", e);
    return { ok: false, error: ERR_IMAGEN };
  }
  return {
    ok: true,
    bloques: [
      { type: "image", source: { type: "base64", media_type: "image/jpeg", data: jpeg.toString("base64") } },
      { type: "text", text: PEDIDO_ARCHIVO },
    ],
  };
}

function superado(gasto: number, tope: number): boolean {
  return tope > 0 && gasto >= tope;
}

export async function leerConIa(
  workspaceId: string,
  userId: number,
  entrada: EntradaIa,
  deps: { cliente?: ClienteIa; ahora?: Date } = {},
): Promise<{ ok: true; doc: DocumentoImportado } | { ok: false; error: string }> {
  const config = leerConfigBot();
  if (!config.anthropicApiKey) return { ok: false, error: ERR_SIN_CLAVE };

  const plataforma = plataformaDe(workspaceId);
  const ahora = deps.ahora ?? new Date();
  const [gastoWorkspace, gastoGlobal] = await Promise.all([
    gastoDelMes({ plataforma, ahora }),
    gastoDelMes({ ahora }),
  ]);
  if (
    superado(gastoWorkspace, config.limits.workspaceMonthlyCapMicroUsd) ||
    superado(gastoGlobal, config.limits.monthlyCapMicroUsd)
  ) {
    return { ok: false, error: ERR_TOPE };
  }

  const model = process.env.FOTOFFICE_STOCK_IMPORT_MODEL?.trim() || config.model;
  let respuesta: Anthropic.Beta.Messages.BetaMessage;
  try {
    const cliente: ClienteIa =
      deps.cliente ?? new Anthropic({ apiKey: config.anthropicApiKey, maxRetries: 1, timeout: 120_000 });
    respuesta = await cliente.beta.messages.create({
      model,
      max_tokens: 16000,
      betas: ["server-side-fallback-2026-07-01"],
      fallbacks: "default",
      output_config: { effort: "medium", format: { type: "json_schema", schema: SCHEMA_FACTURA } },
      system: SYSTEM_PROMPT,
      messages: [{ role: "user", content: entrada }],
    });
  } catch (e) {
    console.error("[stock/importacion] falló la llamada a Claude", e);
    return { ok: false, error: ERR_API };
  }

  // El gasto se registra siempre que hubo respuesta, aunque sea un rechazo: los tokens se cobran igual.
  try {
    await registrarUsoImportacion({
      plataforma,
      userId,
      usage: respuesta.usage,
      costMicroUsd: costMicroUsd(respuesta.model || model, respuesta.usage),
    });
  } catch (e) {
    console.error("[stock/importacion] no se pudo registrar el uso de IA", e);
  }

  if (respuesta.stop_reason === "refusal") return { ok: false, error: ERR_RECHAZO };
  if (respuesta.stop_reason === "max_tokens") return { ok: false, error: ERR_LARGA };

  const texto = respuesta.content.find((b) => b.type === "text");
  if (!texto || texto.type !== "text") return { ok: false, error: ERR_INCOMPLETA };
  let json: unknown;
  try {
    json = JSON.parse(texto.text);
  } catch {
    return { ok: false, error: ERR_INCOMPLETA };
  }
  const v = validarDocumento(json);
  return v.ok ? { ok: true, doc: v.doc } : { ok: false, error: ERR_INCOMPLETA };
}
