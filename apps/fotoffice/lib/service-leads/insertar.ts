/**
 * Formularios de consulta para insertar en cualquier web (WordPress, Wix, HTML propio…).
 *
 * Direcciones públicas del modo insertado:
 * - En FOTOFFICE: `/w/<slug>/insertar` (el formulario general) y `/w/<slug>/insertar/<formulario>`.
 * - En el dominio propio de la institución: `/insertar` y `/insertar/<formulario>` (el proxy las
 *   lleva a `/w/<slug>/insertar/...` como a cualquier página del sitio).
 *
 * Esas direcciones NO se dibujan bajo `app/w/[workspaceSlug]/`: ese layout pone el encabezado y el
 * pie del sitio, y acá tiene que verse sólo el formulario. El proxy las reescribe a la ruta interna
 * `/formulario-insertado/<slug>/<formulario>` (sin layout de sitio). La dirección que ve el
 * navegador —y a la que van los envíos del formulario— sigue siendo la pública.
 *
 * Funciones puras: se prueban sin levantar Next.
 */

export const SEGMENTO_INSERTAR = "insertar";
export const RUTA_INTERNA_INSERTADO = "/formulario-insertado";

/** El mensaje con el que la página insertada le avisa su alto a la web que la contiene. */
export const MENSAJE_ALTO = "fotoffice-form-height";

/** El script opcional que ajusta el alto del marco (archivo estático en `public/`). */
export const RUTA_SCRIPT_INSERTAR = "/insertar.js";

/**
 * Los formularios que hoy tienen página pública en el sitio: el general (portada) y el de XV.
 * Insertar uno distinto dibujaría algo que el sitio no muestra; se responde 404.
 */
export const FORMULARIOS_INSERTABLES = ["general", "xv"] as const;
export type FormularioInsertable = (typeof FORMULARIOS_INSERTABLES)[number];

export function esFormularioInsertable(formSlug: string | null | undefined): formSlug is FormularioInsertable {
  return (FORMULARIOS_INSERTABLES as readonly string[]).includes(formSlug ?? "");
}

const SLUG = "[a-z0-9][a-z0-9-]{0,62}";
const PUBLICA = new RegExp(`^/w/(${SLUG})/${SEGMENTO_INSERTAR}(?:/(${SLUG}))?/?$`, "i");

/**
 * `/w/<slug>/insertar[/<formulario>]` → la ruta interna que lo dibuja sin el armazón del sitio.
 * null si la dirección no es del modo insertado.
 */
export function rutaInternaInsertada(pathname: string): string | null {
  const m = PUBLICA.exec(pathname);
  if (!m) return null;
  const [, slug, form] = m;
  return `${RUTA_INTERNA_INSERTADO}/${slug}/${form ?? "general"}`;
}

/** Ruta pública del modo insertado, relativa a la base del sitio (`/w/<slug>` o el dominio propio). */
function rutaInsertada(formSlug: string): string {
  return formSlug === "general" ? `/${SEGMENTO_INSERTAR}` : `/${SEGMENTO_INSERTAR}/${encodeURIComponent(formSlug)}`;
}

/**
 * La base absoluta del sitio público de la institución: su dominio propio conectado, o el de
 * FOTOFFICE bajo `/w/<slug>`. null si no hay cómo armarla (sin slug, o sin dirección de la app).
 */
export function baseDelSitio(input: { customDomain: string | null; appOrigin: string; slug: string | null }): string | null {
  const dominio = input.customDomain?.trim().toLowerCase();
  if (dominio) return `https://${dominio}`;
  const slug = input.slug?.trim();
  const origen = input.appOrigin.trim().replace(/\/+$/, "");
  if (!slug || !origen) return null;
  return `${origen}/w/${encodeURIComponent(slug)}`;
}

/** Dirección absoluta de la página pública del formulario (la que se comparte por WhatsApp). */
export function urlPublicaFormulario(base: string, formSlug: string): string {
  return formSlug === "general" ? base : `${base}/${encodeURIComponent(formSlug)}`;
}

/** Dirección absoluta del formulario en modo insertado. */
export function urlInsertada(base: string, formSlug: string): string {
  return `${base}${rutaInsertada(formSlug)}`;
}

/** Dirección absoluta del script de alto automático: en el mismo origen que el formulario. */
export function urlScriptInsertar(base: string): string {
  return `${new URL(base).origin}${RUTA_SCRIPT_INSERTAR}`;
}

/** Alto fijo del marco cuando no se usa el script: entra el formulario general sin cortar. */
export const ALTO_FIJO_PX = 900;

function escaparAtributo(valor: string): string {
  return valor.replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

/** (a) El marco solo, con alto fijo. Funciona en cualquier web que acepte HTML. */
export function codigoMarcoSimple(input: { url: string; titulo: string }): string {
  return `<iframe src="${escaparAtributo(input.url)}" title="${escaparAtributo(input.titulo)}" height="${ALTO_FIJO_PX}" style="border:0;width:100%" loading="lazy"></iframe>`;
}

/** (b) El marco y el script que le ajusta el alto al del formulario (sin barras de desplazamiento). */
export function codigoMarcoConAltoAutomatico(input: { url: string; titulo: string; scriptUrl: string }): string {
  return [
    `<iframe src="${escaparAtributo(input.url)}" title="${escaparAtributo(input.titulo)}" data-fotoffice-form height="${ALTO_FIJO_PX}" style="border:0;width:100%" loading="lazy"></iframe>`,
    `<script src="${escaparAtributo(input.scriptUrl)}" async></script>`,
  ].join("\n");
}
