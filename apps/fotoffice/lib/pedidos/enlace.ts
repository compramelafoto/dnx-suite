import "server-only";
import { createHmac } from "node:crypto";
import { prisma } from "@repo/db";
import { hashDeToken, resolverClaveDeEnlace, tokenConForma } from "@/lib/presupuestos/enlace";
import { sitioDelWorkspace } from "@/lib/presupuestos/sitio";
import { MENSAJES_PEDIDO, puedeGestionarPedidos, type CtxPedidos } from "./acceso";

/**
 * Los enlaces públicos del pedido y del recibo (etapa 3, spec §2 A.5, A.6). Mismo criterio que el
 * del presupuesto (`lib/presupuestos/enlace.ts`):
 *
 * - **Token HMAC-SHA256** con la clave de los enlaces, en base64url (43 caracteres). No se adivina
 *   sin la clave y el servidor lo puede rearmar cuando lo necesita ("Copiar enlace", el correo del
 *   recibo, la lista de recibos del pedido) sin guardarlo en claro.
 * - **Propósitos distintos** en el mensaje firmado (`fotoffice-pedido:v1:` y `fotoffice-recibo:v1:`,
 *   y los dos distintos del presupuesto): el token de un recibo nunca abre un pedido, ni al revés.
 * - **En la base sólo el hash** SHA-256: `FotofficePedido.accessTokenHash` y
 *   `FotofficeCobro.receiptTokenHash` (los dos únicos).
 * - **El del pedido se puede renovar** ("rotar"): el mensaje lleva una generación (0, 1, 2…). Al
 *   rearmarlo se busca la generación cuyo hash coincide con el guardado; renovar guarda el de la
 *   siguiente, y el enlace viejo deja de abrir. El del recibo no se renueva: es uno por cobro.
 *
 * Las páginas públicas (`/w/<slug>/pedido/<token>` y `/w/<slug>/recibo/<token>`, o en el dominio
 * propio) las arma la Task 7 con `resolverTokenPedido` y `resolverTokenRecibo`.
 */

const PREFIJO_PEDIDO = "fotoffice-pedido:v1:";
const PREFIJO_RECIBO = "fotoffice-recibo:v1:";
/** Cuántas veces se puede renovar el enlace de un pedido (se rearma probando cada generación). */
export const MAX_GENERACIONES_PEDIDO = 50;

export { hashDeToken, resolverClaveDeEnlace, tokenConForma };

// --- Puro -------------------------------------------------------------------------------------

export function tokenDelPedido(pedidoId: string, clave: string, generacion = 0): string {
  return createHmac("sha256", clave).update(`${PREFIJO_PEDIDO}${pedidoId}:${generacion}`).digest("base64url");
}

export function tokenDelRecibo(cobroId: string, clave: string): string {
  return createHmac("sha256", clave).update(`${PREFIJO_RECIBO}${cobroId}`).digest("base64url");
}

/** La generación del enlace vigente del pedido (la que da el hash guardado), o null. */
export function generacionDelPedido(pedidoId: string, hashGuardado: string | null, clave: string): number | null {
  if (!hashGuardado) return null;
  for (let g = 0; g <= MAX_GENERACIONES_PEDIDO; g++) {
    if (hashDeToken(tokenDelPedido(pedidoId, clave, g)) === hashGuardado) return g;
  }
  return null;
}

export function rutaDelPedido(token: string): string {
  return `/pedido/${encodeURIComponent(token)}`;
}

export function rutaDelRecibo(token: string): string {
  return `/recibo/${encodeURIComponent(token)}`;
}

type Sitio = { customDomain: string | null; appOrigin: string; slug: string | null };

function url(sitio: Sitio, ruta: string): string | null {
  if (sitio.customDomain) return `https://${sitio.customDomain}${ruta}`;
  if (!sitio.appOrigin || !sitio.slug) return null;
  return `${sitio.appOrigin}/w/${encodeURIComponent(sitio.slug)}${ruta}`;
}

/** Dirección completa del pedido: dominio propio o `/w/<slug>`. null si no hay cómo armarla. */
export function urlDelPedido(input: Sitio & { token: string }): string | null {
  return url(input, rutaDelPedido(input.token));
}

/** Dirección completa del recibo: dominio propio o `/w/<slug>`. null si no hay cómo armarla. */
export function urlDelRecibo(input: Sitio & { token: string }): string | null {
  return url(input, rutaDelRecibo(input.token));
}

// --- Con base ---------------------------------------------------------------------------------

export const MENSAJES_ENLACE = {
  sinClave: "Los enlaces para clientes no están configurados. Avisale a quien administra FOTOFFICE.",
  sinSitio: "Para mandar enlaces a clientes, la organización necesita su dirección pública (Configuración → Sitio web).",
  tope: "Este enlace ya se renovó demasiadas veces.",
  fallo: "No se pudo armar el enlace. Probá de nuevo.",
} as const;

export type DepsEnlace = {
  /** Inyectable en las pruebas; por omisión, `resolverClaveDeEnlace()`. */
  clave?: string | null;
  /** Origen de la app (`https://…`); por omisión, el del entorno. */
  appOrigin?: string;
};

export type ResultadoEnlace = { ok: true; url: string } | { ok: false; error: string };

function origenDe(deps: DepsEnlace): string {
  return (deps.appOrigin ?? (process.env.NEXT_PUBLIC_APP_URL || process.env.APP_URL || "")).replace(/\/+$/, "");
}

function idValido(v: unknown): v is string {
  return typeof v === "string" && v.length > 0 && v.length <= 64;
}

function falla(donde: string, error: unknown): void {
  const e = error as { code?: unknown } | null;
  console.error(`[pedidos] ${donde} falló`, { codigo: typeof e?.code === "string" ? e.code : null });
}

/** Sitio y clave, o el motivo por el que no hay enlaces. */
async function preparar(workspaceId: string, deps: DepsEnlace): Promise<{ ok: true; clave: string; sitio: Sitio } | { ok: false; error: string }> {
  const clave = deps.clave !== undefined ? deps.clave : resolverClaveDeEnlace();
  if (!clave) return { ok: false, error: MENSAJES_ENLACE.sinClave };
  const s = await sitioDelWorkspace(workspaceId);
  const sitio = { customDomain: s?.customDomain ?? null, slug: s?.slug ?? null, appOrigin: origenDe(deps) };
  if (!s || !url(sitio, "/x")) return { ok: false, error: MENSAJES_ENLACE.sinSitio };
  return { ok: true, clave, sitio };
}

/**
 * El enlace del pedido para el cliente. La primera vez lo crea (guarda el hash); después lo rearma
 * igual. Con `rotar`, guarda el de la generación siguiente y el anterior deja de abrir. Con
 * "Gestionar" en Pedidos (crear o renovar el enlace es escribir).
 */
export async function enlaceDelPedido(
  ctx: CtxPedidos,
  pedidoId: unknown,
  opciones: { rotar?: boolean } = {},
  deps: DepsEnlace = {},
): Promise<ResultadoEnlace> {
  if (!puedeGestionarPedidos(ctx)) return { ok: false, error: MENSAJES_PEDIDO.sinPermiso };
  if (!idValido(pedidoId)) return { ok: false, error: MENSAJES_PEDIDO.datosInvalidos };
  return enlaceDelPedidoDelSistema(ctx.workspaceId, pedidoId, opciones, deps);
}

/**
 * Igual que `enlaceDelPedido`, sin permisos: para el código del servidor que ya validó quién llama
 * (el recibo automático, que lo usa si su texto trae `[pedido_enlace]`).
 */
export async function enlaceDelPedidoDelSistema(
  workspaceId: string,
  pedidoId: string,
  opciones: { rotar?: boolean } = {},
  deps: DepsEnlace = {},
): Promise<ResultadoEnlace> {
  const prep = await preparar(workspaceId, deps);
  if (!prep.ok) return prep;
  const { clave, sitio } = prep;
  try {
    const p = await prisma.fotofficePedido.findFirst({ where: { id: pedidoId, workspaceId }, select: { id: true, accessTokenHash: true } });
    if (!p) return { ok: false, error: MENSAJES_PEDIDO.noExiste };
    const actual = generacionDelPedido(p.id, p.accessTokenHash, clave);
    if (actual !== null && !opciones.rotar) {
      return { ok: true, url: urlDelPedido({ ...sitio, token: tokenDelPedido(p.id, clave, actual) })! };
    }
    // Sin hash, con un hash de otra clave (se cambió la clave) o al renovar: una generación nueva.
    const generacion = actual === null ? 0 : actual + 1;
    if (generacion > MAX_GENERACIONES_PEDIDO) return { ok: false, error: MENSAJES_ENLACE.tope };
    const token = tokenDelPedido(p.id, clave, generacion);
    // Escritura condicional sobre el hash leído: si otro lo creó o renovó en el medio, gana el otro
    // y se devuelve el suyo (sin rotar dos veces por un doble clic).
    const r = await prisma.fotofficePedido.updateMany({
      where: { id: p.id, workspaceId, accessTokenHash: p.accessTokenHash },
      data: { accessTokenHash: hashDeToken(token) },
    });
    if (r.count === 1) return { ok: true, url: urlDelPedido({ ...sitio, token })! };
    const otro = await prisma.fotofficePedido.findFirst({ where: { id: p.id, workspaceId }, select: { accessTokenHash: true } });
    const g = generacionDelPedido(p.id, otro?.accessTokenHash ?? null, clave);
    if (g === null) return { ok: false, error: MENSAJES_ENLACE.fallo };
    return { ok: true, url: urlDelPedido({ ...sitio, token: tokenDelPedido(p.id, clave, g) })! };
  } catch (e) {
    falla("enlaceDelPedido", e);
    return { ok: false, error: MENSAJES_ENLACE.fallo };
  }
}

/** El enlace del recibo de un cobro del workspace (no escribe: el hash nace con el cobro). Con "Gestionar". */
export async function enlaceDelRecibo(ctx: CtxPedidos, cobroId: unknown, deps: DepsEnlace = {}): Promise<ResultadoEnlace> {
  if (!puedeGestionarPedidos(ctx)) return { ok: false, error: MENSAJES_PEDIDO.sinPermiso };
  if (!idValido(cobroId)) return { ok: false, error: MENSAJES_PEDIDO.datosInvalidos };
  const c = await prisma.fotofficeCobro.findFirst({ where: { id: cobroId, workspaceId: ctx.workspaceId }, select: { id: true } });
  if (!c) return { ok: false, error: "No encontramos ese cobro." };
  const enlaces = await enlacesDeRecibos(ctx.workspaceId, [c.id], deps);
  if (!enlaces.ok) return enlaces;
  const u = enlaces.urls.get(c.id);
  return u ? { ok: true, url: u } : { ok: false, error: MENSAJES_ENLACE.fallo };
}

/**
 * Los enlaces de varios recibos del workspace, por id de cobro (para la lista de recibos del
 * pedido, interna o pública). Sin permisos: quien llama ya validó el acceso al pedido. Sólo cobros
 * del workspace cuyo hash guardado coincide con el token (con otra clave, no hay enlace).
 */
export async function enlacesDeRecibos(
  workspaceId: string,
  cobroIds: readonly string[],
  deps: DepsEnlace = {},
): Promise<{ ok: true; urls: Map<string, string> } | { ok: false; error: string }> {
  const prep = await preparar(workspaceId, deps);
  if (!prep.ok) return prep;
  const urls = new Map<string, string>();
  const ids = [...new Set(cobroIds)].filter(idValido);
  if (ids.length === 0) return { ok: true, urls };
  const cobros = await prisma.fotofficeCobro.findMany({ where: { workspaceId, id: { in: ids } }, select: { id: true, receiptTokenHash: true } });
  for (const c of cobros) {
    const token = tokenDelRecibo(c.id, prep.clave);
    if (hashDeToken(token) !== c.receiptTokenHash) continue;
    const u = urlDelRecibo({ ...prep.sitio, token });
    if (u) urls.set(c.id, u);
  }
  return { ok: true, urls };
}

// --- Resolver un token (páginas públicas) -----------------------------------------------------

/**
 * El pedido de un token, dentro del workspace del slug de la dirección; null si el token no tiene
 * forma, no existe o es de otro workspace (la página responde "Enlace no disponible"). Un token de
 * recibo nunca da un pedido: su hash es de otro mensaje.
 */
export async function resolverTokenPedido(workspaceId: string, token: unknown): Promise<{ workspaceId: string; pedidoId: string } | null> {
  if (!tokenConForma(token)) return null;
  const p = await prisma.fotofficePedido.findFirst({ where: { workspaceId, accessTokenHash: hashDeToken(token) }, select: { id: true } });
  return p ? { workspaceId, pedidoId: p.id } : null;
}

/** El cobro (y su pedido) de un token de recibo, dentro del workspace; null si no. Anulado también abre: se ve "ANULADO". */
export async function resolverTokenRecibo(
  workspaceId: string,
  token: unknown,
): Promise<{ workspaceId: string; cobroId: string; pedidoId: string } | null> {
  if (!tokenConForma(token)) return null;
  const c = await prisma.fotofficeCobro.findFirst({
    where: { workspaceId, receiptTokenHash: hashDeToken(token) },
    select: { id: true, pedidoId: true },
  });
  return c ? { workspaceId, cobroId: c.id, pedidoId: c.pedidoId } : null;
}
