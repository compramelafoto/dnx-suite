import { isReservedSlug, slugify } from "./slug";

/**
 * La ficha online de un producto (`ProductStoreListing`): dónde se vende y cómo se muestra en
 * la tienda. Módulo PURO.
 *
 * Igual que `parseProductForm`, todas las reglas viven acá y no en el componente: un
 * formulario mandado a mano tiene que quedar igual de protegido.
 */

export const MAX_ONLINE_TITLE = 200;
export const MAX_ONLINE_DESCRIPTION = 5000;
const MAX_IMAGE_URL = 2048;

export type ListingValues = {
  sellOnline: boolean;
  sellAtCounter: boolean;
  /** Ya normalizado. Vacío = "armalo vos a partir del nombre" (lo decide la acción). */
  slug: string;
  onlineTitle: string | null;
  onlineDescription: string | null;
  weightGrams: number | null;
  lengthCm: number | null;
  widthCm: number | null;
  heightCm: number | null;
  maxPerOrder: number | null;
};

export type ListingFormResult = { ok: true; values: ListingValues } | { ok: false; error: string };

/** Los enteros opcionales y el error que corresponde a cada uno. */
const ENTEROS = [
  ["weightGrams", "El peso tiene que ser un número entero mayor a cero, en gramos."],
  ["lengthCm", "El largo tiene que ser un número entero mayor a cero, en centímetros."],
  ["widthCm", "El ancho tiene que ser un número entero mayor a cero, en centímetros."],
  ["heightCm", "El alto tiene que ser un número entero mayor a cero, en centímetros."],
  ["maxPerOrder", "El tope por compra tiene que ser un número entero mayor a cero."],
] as const;

function texto(fd: FormData, campo: string): string {
  const v = fd.get(campo);
  return typeof v === "string" ? v.trim() : "";
}

/**
 * Una casilla tildada manda "on" y después su respaldo oculto "off"; destildada, sólo el
 * respaldo. `FormData.get` devuelve la primera coincidencia, así que alcanza con mirar esa.
 */
function casilla(fd: FormData, campo: string): boolean {
  return fd.get(campo) === "on";
}

export function parseListingForm(fd: FormData): ListingFormResult {
  const sellOnline = casilla(fd, "sellOnline");
  const sellAtCounter = casilla(fd, "sellAtCounter");
  // Una ficha que no se vende en ningún lado es un producto que nadie puede comprar y que
  // nadie entiende por qué no aparece: para eso está el botón de desactivar.
  if (!sellOnline && !sellAtCounter) return { ok: false, error: "Elegí al menos un lugar donde se vende." };

  const slugCrudo = texto(fd, "slug");
  const slug = slugify(slugCrudo);
  if (slugCrudo !== "" && slug === "") {
    return { ok: false, error: "La dirección tiene que tener al menos una letra o un número." };
  }
  if (isReservedSlug(slug)) return { ok: false, error: "Esa dirección está reservada por la tienda. Elegí otra." };

  const onlineTitle = texto(fd, "onlineTitle") || null;
  if (onlineTitle !== null && onlineTitle.length > MAX_ONLINE_TITLE) {
    return { ok: false, error: `El título online puede tener hasta ${MAX_ONLINE_TITLE} caracteres.` };
  }
  const onlineDescription = texto(fd, "onlineDescription") || null;
  if (onlineDescription !== null && onlineDescription.length > MAX_ONLINE_DESCRIPTION) {
    return { ok: false, error: `La descripción online puede tener hasta ${MAX_ONLINE_DESCRIPTION} caracteres.` };
  }

  const enteros: Partial<Record<(typeof ENTEROS)[number][0], number | null>> = {};
  for (const [campo, error] of ENTEROS) {
    const crudo = texto(fd, campo);
    if (crudo === "") {
      enteros[campo] = null;
      continue;
    }
    // Sólo dígitos: `Number("1e3")` o `Number("2.5")` pasarían por número y no lo son acá.
    if (!/^\d+$/.test(crudo)) return { ok: false, error };
    const n = Number(crudo);
    if (!Number.isSafeInteger(n) || n <= 0 || n > 2_147_483_647) return { ok: false, error };
    enteros[campo] = n;
  }

  return {
    ok: true,
    values: {
      sellOnline,
      sellAtCounter,
      slug,
      onlineTitle,
      onlineDescription,
      weightGrams: enteros.weightGrams ?? null,
      lengthCm: enteros.lengthCm ?? null,
      widthCm: enteros.widthCm ?? null,
      heightCm: enteros.heightCm ?? null,
      maxPerOrder: enteros.maxPerOrder ?? null,
    },
  };
}

/**
 * Las fotos de la galería y la tabla de talles llegan como la dirección que devolvió la subida
 * (`/api/uploads/image`). Una acción del servidor se puede llamar a mano con cualquier texto:
 * esto evita guardar un `javascript:` o algo que no es una imagen publicable.
 */
export function isAcceptableImageUrl(url: string): boolean {
  if (url === "" || url.length > MAX_IMAGE_URL) return false;
  try {
    return new URL(url).protocol === "https:";
  } catch {
    return false;
  }
}
