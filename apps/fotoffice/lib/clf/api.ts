import { CLF_BASE_URL } from "./enlace";

/**
 * Cliente de la API de CLF para FOTOFFICE (etapa 2 de la conexión). Habla sólo de servidor a servidor.
 * Nunca loguea la llave ni el secreto. Distingue errores definitivos (código o llave rechazados) de temporales.
 */

export const TIEMPO_API_CLF_MS = 15000;

export type DepsApiClf = { fetch?: typeof fetch; baseUrl?: string; env?: Readonly<Record<string, string | undefined>> };

export type CuentaClf = { id: number; nombre: string; mpUserId: string | null };

/** Una venta tal como la entrega CLF (lista blanca; ver `apps/compramelafoto/lib/fotoffice-conexion/ventas.ts`). */
export type VentaClf = {
  orderId: number;
  mpPaymentId: string | null;
  estado: "PAID" | "REFUNDED" | "FAILED";
  motivo: "reintegro" | "contracargo" | "rechazo" | null;
  pagadoEl: Date;
  actualizadoEl: Date;
  album: { id: number; titulo: string };
  detalle: string;
  pagoFamilia: number;
  comisionPlataforma: number;
  descuentoReferidos: number;
  comisionOrganizador: number;
  retenidoEsperadoMp: number;
  netoFotografo: number;
  cobrador: "PHOTOGRAPHER" | "ORGANIZER";
  cobradorMpUserId: string | null;
};

function base(deps: DepsApiClf): string {
  const env = deps.env ?? process.env;
  return (deps.baseUrl ?? env.CLF_PUBLIC_BASE_URL ?? CLF_BASE_URL).replace(/\/+$/, "");
}

export function secretoCompartido(env: Readonly<Record<string, string | undefined>> = process.env): string | null {
  return env.DNX_CLF_FOTOFFICE_CLIENT_SECRET?.trim() || null;
}

async function pedir(deps: DepsApiClf, ruta: string, init: RequestInit): Promise<Response> {
  return (deps.fetch ?? fetch)(`${base(deps)}${ruta}`, { ...init, cache: "no-store", signal: AbortSignal.timeout(TIEMPO_API_CLF_MS) });
}

const num = (v: unknown): number | null => (typeof v === "number" && Number.isFinite(v) ? v : null);
const txt = (v: unknown): string | null => (typeof v === "string" ? v : null);
const fecha = (v: unknown): Date | null => {
  if (typeof v !== "string") return null;
  const d = new Date(v);
  return Number.isNaN(d.getTime()) ? null : d;
};

export async function canjearCodigo(
  codigo: string,
  deps: DepsApiClf = {},
): Promise<{ ok: true; llave: string; cuenta: CuentaClf } | { ok: false; codigo: "NO_CONFIGURADA" | "CODIGO_INVALIDO" | "SIN_CONEXION" }> {
  const secreto = secretoCompartido(deps.env);
  if (!secreto) return { ok: false, codigo: "NO_CONFIGURADA" };
  try {
    const r = await pedir(deps, "/api/integraciones/fotoffice/v1/canjear", {
      method: "POST",
      headers: { authorization: `Bearer ${secreto}`, "content-type": "application/json", accept: "application/json" },
      body: JSON.stringify({ code: codigo }),
    });
    if (r.status === 400 || r.status === 401 || r.status === 404) return { ok: false, codigo: "CODIGO_INVALIDO" };
    if (!r.ok) return { ok: false, codigo: "SIN_CONEXION" };
    const j = (await r.json()) as Record<string, unknown>;
    const c = (j.cuenta ?? {}) as Record<string, unknown>;
    const llave = txt(j.llave);
    const id = num(c.id);
    if (!llave || !llave.startsWith("clf_fo_") || id === null) return { ok: false, codigo: "SIN_CONEXION" };
    return { ok: true, llave, cuenta: { id, nombre: (txt(c.nombre) ?? "").slice(0, 200) || `Cuenta ${id}`, mpUserId: txt(c.mpUserId) } };
  } catch {
    return { ok: false, codigo: "SIN_CONEXION" };
  }
}

/** Avisa a CLF que la llave ya no se usa. No falla nunca: desconectar en FOTOFFICE sigue aunque CLF no responda. */
export async function revocarLlave(llave: string, deps: DepsApiClf = {}): Promise<boolean> {
  try {
    const r = await pedir(deps, "/api/integraciones/fotoffice/v1/revocar", { method: "POST", headers: { authorization: `Bearer ${llave}` } });
    return r.ok;
  } catch {
    return false;
  }
}

function aVenta(v: unknown): VentaClf | null {
  if (!v || typeof v !== "object") return null;
  const o = v as Record<string, unknown>;
  const a = (o.album ?? {}) as Record<string, unknown>;
  const orderId = num(o.orderId);
  const pagadoEl = fecha(o.pagadoEl);
  const actualizadoEl = fecha(o.actualizadoEl);
  const albumId = num(a.id);
  const estado = o.estado;
  const montos = ["pagoFamilia", "comisionPlataforma", "descuentoReferidos", "comisionOrganizador", "retenidoEsperadoMp", "netoFotografo"].map((k) => num(o[k]));
  if (orderId === null || !pagadoEl || !actualizadoEl || albumId === null) return null;
  if (estado !== "PAID" && estado !== "REFUNDED" && estado !== "FAILED") return null;
  if (montos.some((m) => m === null)) return null;
  const motivo = o.motivo === "reintegro" || o.motivo === "contracargo" || o.motivo === "rechazo" ? o.motivo : null;
  return {
    orderId,
    mpPaymentId: txt(o.mpPaymentId),
    estado,
    motivo,
    pagadoEl,
    actualizadoEl,
    album: { id: albumId, titulo: (txt(a.titulo) ?? "").slice(0, 300) || `Álbum ${albumId}` },
    detalle: (txt(o.detalle) ?? "").slice(0, 500),
    pagoFamilia: montos[0]!,
    comisionPlataforma: montos[1]!,
    descuentoReferidos: montos[2]!,
    comisionOrganizador: montos[3]!,
    retenidoEsperadoMp: montos[4]!,
    netoFotografo: montos[5]!,
    cobrador: o.cobrador === "ORGANIZER" ? "ORGANIZER" : "PHOTOGRAPHER",
    cobradorMpUserId: txt(o.cobradorMpUserId),
  };
}

export async function pedirVentas(
  llave: string,
  cursor: string | null,
  deps: DepsApiClf = {},
): Promise<{ ok: true; ventas: VentaClf[]; siguiente: string | null; hayMas: boolean } | { ok: false; codigo: "LLAVE_RECHAZADA" | "SIN_CONEXION" }> {
  try {
    const q = cursor ? `?cursor=${encodeURIComponent(cursor)}` : "";
    const r = await pedir(deps, `/api/integraciones/fotoffice/v1/ventas${q}`, { headers: { authorization: `Bearer ${llave}`, accept: "application/json" } });
    if (r.status === 401 || r.status === 403) return { ok: false, codigo: "LLAVE_RECHAZADA" };
    if (!r.ok) return { ok: false, codigo: "SIN_CONEXION" };
    const j = (await r.json()) as Record<string, unknown>;
    if (!Array.isArray(j.ventas)) return { ok: false, codigo: "SIN_CONEXION" };
    const ventas = j.ventas.map(aVenta).filter((v): v is VentaClf => v !== null);
    return { ok: true, ventas, siguiente: txt(j.siguiente), hayMas: j.hayMas === true };
  } catch {
    return { ok: false, codigo: "SIN_CONEXION" };
  }
}
