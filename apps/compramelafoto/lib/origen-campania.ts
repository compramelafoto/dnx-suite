/**
 * De qué campaña vino cada fotógrafo que se registra.
 *
 * 1. El middleware ve los parámetros UTM del enlace del anuncio (o el `fbclid` que agrega
 *    Meta) y los guarda en la cookie `clf_origen` por 60 días. Gana la última campaña.
 * 2. Al crear la cuenta, el registro copia ese origen a `User.tags` como
 *    `origen:<fuente>/<medio>/<campaña>/<anuncio>`. No hace falta cambiar la base.
 *
 * Con eso se puede seguir cada anuncio hasta el registro, el primer álbum y la primera venta.
 * Nunca lanza errores: la atribución no puede frenar un registro.
 */

export const COOKIE_ORIGEN = "clf_origen";
export const EDAD_COOKIE_ORIGEN_S = 60 * 24 * 60 * 60;
export const PREFIJO_TAG_ORIGEN = "origen:";

/** Deja solo minúsculas, números, punto, guion y guion bajo. */
function limpiar(valor: string | null | undefined, max = 60): string {
  return (valor ?? "")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9._-]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, max);
}

type Params = { get(name: string): string | null };

/**
 * Arma el origen a partir de los parámetros del enlace. Devuelve null si no hay nada que
 * indique una campaña (una visita común no pisa el origen guardado).
 */
export function origenDesdeParams(params: Params): string | null {
  const fuente = limpiar(params.get("utm_source"));
  const fbclid = params.get("fbclid");
  if (!fuente && !fbclid) return null;
  const partes = [
    fuente || "meta",
    limpiar(params.get("utm_medium")) || (fbclid ? "paid" : "-"),
    limpiar(params.get("utm_campaign")) || "-",
    limpiar(params.get("utm_content")) || "-",
  ];
  return partes.join("/");
}

/** Valida un origen leído de la cookie (podría venir manipulado). */
export function origenValido(valor: string | null | undefined): string | null {
  if (!valor) return null;
  const v = valor.trim();
  return /^[a-z0-9._-]{1,60}(\/[a-z0-9._-]{1,60}){3}$/.test(v) ? v : null;
}

type RequestLike = { headers: { get(name: string): string | null } };

export function leerOrigen(req: RequestLike): string | null {
  const header = req.headers.get("cookie");
  if (!header) return null;
  for (const parte of header.split(";")) {
    const i = parte.indexOf("=");
    if (i === -1 || parte.slice(0, i).trim() !== COOKIE_ORIGEN) continue;
    let valor = parte.slice(i + 1).trim();
    try {
      valor = decodeURIComponent(valor);
    } catch {
      /* se usa crudo */
    }
    return origenValido(valor);
  }
  return null;
}

export function tagDeOrigen(origen: string): string {
  return `${PREFIJO_TAG_ORIGEN}${origen}`;
}

type Guardar = (userId: number, tag: string) => Promise<unknown>;

async function guardarEnBase(userId: number, tag: string) {
  const { prisma } = await import("@/lib/prisma");
  const user = await prisma.user.findUnique({ where: { id: userId }, select: { tags: true } });
  if (!user || user.tags.some((t) => t.startsWith(PREFIJO_TAG_ORIGEN))) return;
  await prisma.user.update({ where: { id: userId }, data: { tags: { push: tag } } });
}

/** Copia el origen de la cookie a la cuenta recién creada. Guarda solo el primero. */
export async function guardarOrigenEnUsuario(
  input: { req: RequestLike; userId: number },
  deps: { guardar?: Guardar } = {}
): Promise<string | null> {
  try {
    const origen = leerOrigen(input.req);
    if (!origen) return null;
    const tag = tagDeOrigen(origen);
    await (deps.guardar ?? guardarEnBase)(input.userId, tag);
    return tag;
  } catch (err) {
    console.error("ORIGEN: no se pudo guardar el origen del registro", err);
    return null;
  }
}
