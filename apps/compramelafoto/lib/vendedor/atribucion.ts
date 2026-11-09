/**
 * Atribución de registros al agente Vendedor de DNX.
 * Cookie propia `clf_dnxv` (la pone el middleware desde `?dnxv=`). Es independiente del
 * programa de referidos: no usa `clf_ref` ni crea nada de `ReferralAttribution`.
 */

export const COOKIE_VENDEDOR = "clf_dnxv";
export const EDAD_COOKIE_VENDEDOR_S = 60 * 24 * 60 * 60;

const TOKEN_RE = /^[A-Za-z0-9_-]{16,64}$/;

export function tokenVendedorValido(v: unknown): string | null {
  if (typeof v !== "string") return null;
  const t = v.trim();
  return TOKEN_RE.test(t) ? t : null;
}

export function leerTokenVendedor(req: Request): string | null {
  const header = req.headers.get("cookie");
  if (!header) return null;
  for (const part of header.split(";")) {
    const idx = part.indexOf("=");
    if (idx === -1) continue;
    if (part.slice(0, idx).trim() !== COOKIE_VENDEDOR) continue;
    const raw = part.slice(idx + 1).trim();
    let valor = raw;
    try {
      valor = decodeURIComponent(raw);
    } catch {
      /* se usa el valor crudo */
    }
    return tokenVendedorValido(valor);
  }
  return null;
}

type Crear = (data: { userId: number; token: string; rol: string }) => Promise<unknown>;

async function crearEnBase(data: { userId: number; token: string; rol: string }) {
  const { prisma } = await import("@/lib/prisma");
  return prisma.dnxVendedorAtribucion.create({ data });
}

/** Guarda a qué hilo del Vendedor se le atribuye el registro. Nunca lanza. */
export async function guardarAtribucionVendedor(
  input: { req: Request; userId: number; rol: string },
  deps: { crear?: Crear } = {}
): Promise<boolean> {
  try {
    const token = leerTokenVendedor(input.req);
    if (!token) return false;
    await (deps.crear ?? crearEnBase)({ userId: input.userId, token, rol: input.rol });
    return true;
  } catch (e) {
    const code = (e as { code?: string } | null)?.code;
    if (code !== "P2002") console.error("VENDEDOR: no se pudo guardar la atribución", e);
    return false;
  }
}
