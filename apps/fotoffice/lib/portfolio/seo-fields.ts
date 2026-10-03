/**
 * Lo que el socio puede decidir sobre cómo se ve su ficha en Google y al compartirla.
 *
 * ── Por qué no alcanzaba con la presentación ──
 *
 * Hasta ahora la descripción que mostraba Google ERA la presentación del socio. Son dos textos con
 * trabajos distintos: la presentación puede ser larga y en primera persona —"Desde chico me gustó
 * la fotografía…"—, mientras que Google corta a unos 160 caracteres y ahí conviene un resumen con
 * las palabras que la gente escribe cuando busca. Quien arrancaba su presentación contando su
 * infancia tenía eso, y sólo eso, como carta de presentación en el buscador.
 *
 * ── Vacío no es peor ──
 *
 * Los tres campos son opcionales y, en vacío, se comportan igual que antes de existir. Un campo de
 * SEO que obliga a completarlo para no empeorar es una trampa: de 271 socios, la mayoría no va a
 * entrar nunca.
 */

/** Lo que Google suele mostrar del título antes de cortar. No es una regla exacta: es un ancho. */
export const SEO_TITULO_VISIBLE = 60;
/** Tope duro. Más que esto no lo guarda nadie, ni siquiera para rellenar con palabras. */
export const SEO_TITULO_MAX = 120;

/** Lo que Google suele mostrar de la descripción. */
export const SEO_DESCRIPCION_VISIBLE = 160;
export const SEO_DESCRIPCION_MAX = 300;

/** Qué imagen se usa al compartir. `null` = el orden automático de siempre. */
export const OPCIONES_MINIATURA = ["LOGO", "COVER", "PROFILE"] as const;
export type OpcionMiniatura = (typeof OPCIONES_MINIATURA)[number];

export function esOpcionMiniatura(v: unknown): v is OpcionMiniatura {
  return typeof v === "string" && (OPCIONES_MINIATURA as readonly string[]).includes(v);
}

/** Normaliza un texto de SEO: una sola línea, sin espacios dobles, cortado al tope. */
export function limpiarTextoSeo(valor: string | null | undefined, max: number): string | null {
  const t = (valor ?? "").replace(/\s+/g, " ").trim();
  return t === "" ? null : t.slice(0, max);
}

/**
 * Cómo queda el texto cuando Google lo corta.
 *
 * Corta en la última palabra entera, que es lo que hace el buscador: partir una palabra al medio
 * en la vista previa haría creer que así se va a ver, y no es cierto.
 */
export function recorteDeGoogle(texto: string, limite: number): { visible: string; cortado: boolean } {
  if (texto.length <= limite) return { visible: texto, cortado: false };
  const duro = texto.slice(0, limite);
  const ultimoEspacio = duro.lastIndexOf(" ");
  const visible = ultimoEspacio > limite * 0.6 ? duro.slice(0, ultimoEspacio) : duro;
  return { visible: visible.trimEnd(), cortado: true };
}

export type FuentesDeTitulo = {
  seoTitle: string | null;
  displayName: string;
  businessName: string | null;
  city: string | null;
};

/** El título que va a la etiqueta `<title>`: el del socio si lo escribió, si no el automático. */
export function tituloEfectivo(f: FuentesDeTitulo): string {
  const propio = limpiarTextoSeo(f.seoTitle, SEO_TITULO_MAX);
  if (propio) return propio;

  const donde = f.city ? ` · ${f.city}` : "";
  return `${f.displayName}${f.businessName ? ` · ${f.businessName}` : ""}${donde}`;
}

export type FuentesDeDescripcion = {
  seoDescription: string | null;
  bio: string | null;
  businessName: string | null;
  displayName: string;
  rubros: string[];
  city: string | null;
  province: string | null;
  institucion: string;
};

/**
 * La descripción, por orden de preferencia: la escrita para Google, la presentación, o una armada.
 *
 * La tercera existe porque dejar la descripción vacía le entrega a Google la decisión de qué
 * fragmento de la página mostrar, y suele elegir mal —el menú, o el pie—.
 */
export function descripcionEfectiva(f: FuentesDeDescripcion): string {
  const propia = limpiarTextoSeo(f.seoDescription, SEO_DESCRIPCION_MAX);
  if (propia) return propia;

  const escrita = f.bio?.trim();
  if (escrita) return escrita.replace(/\s+/g, " ").slice(0, SEO_DESCRIPCION_MAX);

  const donde = f.city ? `${f.city}${f.province ? `, ${f.province}` : ""}` : null;
  return [
    f.businessName ?? f.displayName,
    f.rubros.length > 0 ? f.rubros.join(", ") : null,
    donde ? `en ${donde}` : null,
    `Socio de ${f.institucion}.`,
  ]
    .filter(Boolean)
    .join(" · ")
    .slice(0, SEO_DESCRIPCION_MAX);
}

export type FuentesDeMiniatura = {
  seoImageChoice: string | null;
  logoUrl: string | null;
  coverUrl: string | null;
  profilePhotoUrl: string | null;
};

/**
 * Qué imagen se ve al compartir el enlace.
 *
 * Con una elección hecha, manda esa — **pero si esa imagen no existe, se cae al orden automático
 * en vez de quedarse sin ninguna**. Alguien que eligió "mi logo" y después lo borró no tiene por
 * qué terminar con una tarjeta sin imagen y sin enterarse.
 */
export function miniaturaEfectiva(f: FuentesDeMiniatura): string | null {
  const elegida = esOpcionMiniatura(f.seoImageChoice)
    ? { LOGO: f.logoUrl, COVER: f.coverUrl, PROFILE: f.profilePhotoUrl }[f.seoImageChoice]
    : null;
  return elegida ?? f.logoUrl ?? f.coverUrl ?? f.profilePhotoUrl ?? null;
}
