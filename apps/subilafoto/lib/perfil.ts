import { esClaveDeLogo } from "./logo";

/**
 * La ficha de venta del fotógrafo.
 *
 * Es lo que ve su cliente en `/v/[slug]`, y hasta hoy **no había forma de cargarla**: el
 * perfil nacía solo al crear el primer evento, con el nombre "Mi estudio" y precio cero.
 * Como la vitrina exige estar publicada y con precio mayor que cero, el enlace de venta de
 * cualquier fotógrafo daba 404 para siempre.
 *
 * Puro: acá viven las reglas, y la escritura es de la acción.
 */

/** Mil pesos. Por debajo es un error de tipeo, no un precio. */
export const PRECIO_MINIMO_CENTS = 100_000;
/** Cinco millones de pesos. Por encima también es un error de tipeo. */
export const PRECIO_MAXIMO_CENTS = 500_000_000;

const LARGO = { headline: 120, descripcion: 1200, terminos: 3000, nombre: 80 } as const;

/**
 * De lo que escribe una persona a centavos enteros.
 *
 * El punto es ambiguo acá: en "120.000" separa los miles y en "1500.50" son centavos. Las
 * dos formas se escriben, así que las dos tienen que andar.
 *
 * La regla: si hay coma, la coma manda y los puntos son de miles. Si no hay coma, un punto
 * seguido de **exactamente tres dígitos** es separador de miles —"120.000"— y cualquier
 * otro punto es decimal —"1500.50"—.
 *
 * Un `Float` guardado sería plata mal contada, así que se redondea al centavo.
 */
export function aCentavos(texto: string): number | null {
  const crudo = texto.trim().replace(/\s/g, "");

  const limpio = crudo.includes(",")
    ? crudo.replace(/\./g, "").replace(",", ".")
    : /^\d{1,3}(\.\d{3})+$/.test(crudo)
      ? crudo.replace(/\./g, "")
      : crudo;

  if (!/^\d+(\.\d+)?$/.test(limpio)) return null;

  const pesos = Number(limpio);
  if (!Number.isFinite(pesos) || pesos <= 0) return null;

  return Math.round(pesos * 100);
}

export type EntradaDePerfil = {
  displayName: string;
  precio: string;
  headline: string;
  descripcion: string;
  logoUrl: string;
  brandColor: string;
  termsText: string;
  publicar: boolean;
};

export type DatosDePerfil = {
  displayName: string;
  basePriceCents: number;
  headline: string | null;
  description: string | null;
  logoUrl: string | null;
  brandColor: string | null;
  termsText: string | null;
  isPublished: boolean;
};

export type Revision = { ok: true; datos: DatosDePerfil } | { ok: false; error: string };

const recortar = (v: string, max: number) => {
  const t = v.trim();
  return t ? t.slice(0, max) : null;
};

export function revisarPerfil(entrada: EntradaDePerfil): Revision {
  const displayName = entrada.displayName.trim().slice(0, LARGO.nombre);
  if (!displayName) {
    return { ok: false, error: "Falta el nombre: es lo que ve tu cliente." };
  }

  /*
    Sin precio se puede guardar, pero no publicar. Escribir la ficha en dos ratos tiene que
    poder; publicar sin precio no, porque la vitrina daría 404 y el fotógrafo creería que
    su enlace anda.
  */
  const centavos = entrada.precio.trim() ? aCentavos(entrada.precio) : null;

  if (entrada.precio.trim() && centavos === null) {
    return { ok: false, error: "El precio tiene que ser un número." };
  }
  if (centavos !== null && centavos < PRECIO_MINIMO_CENTS) {
    return { ok: false, error: "Ese precio es demasiado bajo. ¿Le faltan ceros?" };
  }
  if (centavos !== null && centavos > PRECIO_MAXIMO_CENTS) {
    return { ok: false, error: "Ese precio es demasiado alto. ¿Le sobran ceros?" };
  }
  if (entrada.publicar && centavos === null) {
    return { ok: false, error: "Para publicar tu enlace hace falta un precio." };
  }

  const brandColor = entrada.brandColor.trim();
  if (brandColor && !/^#[0-9a-fA-F]{6}$/.test(brandColor)) {
    return { ok: false, error: "El color tiene que ser un código como #7C2BFF." };
  }

  /*
    El logo se muestra en la vitrina y en la ficha del proveedor. Sólo `https`: un
    `javascript:` ahí adentro es un agujero, y un `http://` rompe el candado del navegador
    en la única pantalla donde el cliente está por pagar.
  */
  const logoUrl = entrada.logoUrl.trim();
  // Dos formas válidas: una clave de nuestro bucket —si lo subió— o una dirección `https`
  // —si la pegó—. Cualquier otra cosa se rechaza.
  const logoValido = !logoUrl || esClaveDeLogo(logoUrl) || /^https:\/\/[^\s]+$/i.test(logoUrl);
  if (!logoValido) {
    return { ok: false, error: "El logo tiene que ser una dirección que empiece con https." };
  }

  return {
    ok: true,
    datos: {
      displayName,
      basePriceCents: centavos ?? 0,
      headline: recortar(entrada.headline, LARGO.headline),
      // Los textos largos se recortan en vez de rechazarse: perder el final de una
      // descripción es mejor que perder todo lo escrito por pasarse de largo.
      description: recortar(entrada.descripcion, LARGO.descripcion),
      logoUrl: logoUrl || null,
      brandColor: brandColor || null,
      termsText: recortar(entrada.termsText, LARGO.terminos),
      isPublished: entrada.publicar && centavos !== null,
    },
  };
}
