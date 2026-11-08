import { CLF_BASE_URL, type ReferenciaAlbumClf } from "./enlace";

/**
 * Consulta el resumen público de un álbum en CLF (`/api/public/album/[slug]/resumen`), de servidor a
 * servidor. Distingue "no existe" de "no se pudo consultar": el primero es definitivo, el segundo no.
 */

export const TIEMPO_MAXIMO_CLF_MS = 8000;

export type ResumenAlbumClf = {
  id: number;
  titulo: string;
  slug: string;
  tienePreventa: boolean;
  preventaCierraEl: Date | null;
};

export type ResultadoResumenClf = { ok: true; resumen: ResumenAlbumClf } | { ok: false; codigo: "NO_EXISTE" | "SIN_CONEXION" };

export type DepsResumenClf = { fetch?: typeof fetch; baseUrl?: string };

function baseDeClf(deps: DepsResumenClf): string {
  return (deps.baseUrl ?? process.env.CLF_PUBLIC_BASE_URL ?? CLF_BASE_URL).replace(/\/+$/, "");
}

function aResumen(v: unknown): ResumenAlbumClf | null {
  if (!v || typeof v !== "object") return null;
  const o = v as Record<string, unknown>;
  if (typeof o.id !== "number" || !Number.isInteger(o.id) || o.id <= 0) return null;
  if (typeof o.titulo !== "string" || typeof o.slug !== "string" || !/^[a-z0-9-]{1,200}$/i.test(o.slug)) return null;
  if (typeof o.tienePreventa !== "boolean") return null;
  let cierra: Date | null = null;
  if (o.preventaCierraEl !== null && o.preventaCierraEl !== undefined) {
    if (typeof o.preventaCierraEl !== "string") return null;
    cierra = new Date(o.preventaCierraEl);
    if (Number.isNaN(cierra.getTime())) return null;
  }
  return { id: o.id, titulo: o.titulo.trim().slice(0, 300) || o.slug, slug: o.slug, tienePreventa: o.tienePreventa, preventaCierraEl: cierra };
}

export async function leerResumenAlbumClf(ref: ReferenciaAlbumClf, deps: DepsResumenClf = {}): Promise<ResultadoResumenClf> {
  const segmento = ref.tipo === "slug" ? encodeURIComponent(ref.slug) : String(ref.id);
  const url = `${baseDeClf(deps)}/api/public/album/${segmento}/resumen`;
  try {
    const r = await (deps.fetch ?? fetch)(url, { headers: { accept: "application/json" }, cache: "no-store", signal: AbortSignal.timeout(TIEMPO_MAXIMO_CLF_MS) });
    if (r.status === 404) return { ok: false, codigo: "NO_EXISTE" };
    if (!r.ok) return { ok: false, codigo: "SIN_CONEXION" };
    const resumen = aResumen(await r.json());
    return resumen ? { ok: true, resumen } : { ok: false, codigo: "SIN_CONEXION" };
  } catch {
    return { ok: false, codigo: "SIN_CONEXION" };
  }
}
