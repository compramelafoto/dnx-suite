/**
 * Redirecciones del sitio: las reglas, puras (sin base ni red). Las usan el `proxy.ts` (que no
 * puede cargar Prisma), el catch-all del sitio, el panel y el importador de Alboom.
 *
 * Una redirección lleva una ruta vieja (`desde`) a otra (`hacia`): `/sobre` → `/quien-soy`. Las
 * rutas se comparan normalizadas (`normalizarRuta`), así `/Sobre/` y `/sobre` son la misma. Un `*`
 * al final de `desde` es un comodín (`/proof/*`) y, si `hacia` también tiene `*`, se reemplaza por
 * lo que cubrió (`https://otro.com/proof/*`).
 *
 * Las rutas son las del sitio, sin `/w/<slug>`: quien redirige le agrega el prefijo si hace falta.
 */

export type CodigoRedireccion = 301 | 302;

/** `origen` de las redirecciones (y de los trabajos) que dejó el importador de Alboom Prosite. */
export const ORIGEN_ALBOOM = "alboom-prosite";

/**
 * `origen` de la redirección `post.php?id=` de un artículo que el importador CREÓ (con el id del
 * artículo): así «Publicar contenido importado» sabe qué publicar sin tocar borradores ajenos.
 */
export const PREFIJO_ARTICULO_IMPORTADO = `${ORIGEN_ALBOOM}:post=`;

export function origenDeArticuloImportado(postId: number): string {
  return `${PREFIJO_ARTICULO_IMPORTADO}${postId}`;
}

/** ¿La redirección la dejó el importador de Alboom (con o sin marca de artículo)? */
export function esOrigenAlboom(origen: string | null | undefined): boolean {
  return origen === ORIGEN_ALBOOM || Boolean(origen?.startsWith(PREFIJO_ARTICULO_IMPORTADO));
}

export type ReglaRedireccion = { desde: string; hacia: string; codigo: number };

export type DestinoRedireccion = { hacia: string; codigo: CodigoRedireccion };

/** Saltos como máximo al seguir una cadena (A → B → C…). */
export const MAX_SALTOS = 3;

/** Las únicas páginas viejas en las que la consulta importa (`?id=` es el número). */
const CON_CONSULTA = new Set(["/post.php", "/album.php"]);

function decodificar(ruta: string): string {
  try {
    return decodeURIComponent(ruta);
  } catch {
    return ruta;
  }
}

/** La ruta sin normalizar mayúsculas: decodificada, sin barra final y con `?id=` sólo donde va. */
function rutaLimpia(entrada: string): string {
  let ruta = entrada.trim();
  let consulta = "";
  if (/^https?:\/\//i.test(ruta)) {
    try {
      const u = new URL(ruta);
      ruta = u.pathname;
      consulta = u.search;
    } catch {
      return "/";
    }
  } else {
    const q = ruta.search(/[?#]/);
    if (q >= 0) {
      consulta = ruta[q] === "?" ? ruta.slice(q).split("#")[0] : "";
      ruta = ruta.slice(0, q);
    }
  }
  ruta = decodificar(ruta).replace(/\/{2,}/g, "/");
  if (!ruta.startsWith("/")) ruta = `/${ruta}`;
  ruta = ruta.replace(/\/+$/, "") || "/";
  if (CON_CONSULTA.has(ruta.toLowerCase())) {
    const id = new URLSearchParams(consulta).get("id");
    return id && /^\d+$/.test(id) ? `${ruta}?id=${id}` : ruta;
  }
  return ruta;
}

/**
 * La forma en que se guardan y se comparan las rutas: minúsculas, decodificada, sin barra final
 * (salvo `/`), sin consulta — salvo `post.php` y `album.php`, que conservan sólo `?id=<n>`. Acepta
 * también una dirección completa (`https://sitio/x`): se queda con la ruta.
 */
export function normalizarRuta(ruta: string): string {
  return rutaLimpia(ruta).toLowerCase();
}

/** Las reglas listas para buscar: exactas en un mapa, comodines del más largo al más corto. */
export type TablaRedirecciones = {
  exactas: Map<string, ReglaRedireccion>;
  comodines: Array<{ prefijo: string; regla: ReglaRedireccion }>;
};

export function compilarRedirecciones(reglas: readonly ReglaRedireccion[]): TablaRedirecciones {
  const exactas = new Map<string, ReglaRedireccion>();
  const comodines: TablaRedirecciones["comodines"] = [];
  for (const r of reglas) {
    if (!r || typeof r.desde !== "string" || typeof r.hacia !== "string" || !r.hacia.trim()) continue;
    if (r.desde.endsWith("*")) {
      // El prefijo va tal cual (en minúsculas): `/post/89987-*` no debe perder el guion.
      const prefijo = r.desde.slice(0, -1).toLowerCase();
      if (prefijo.startsWith("/")) comodines.push({ prefijo, regla: r });
    } else {
      exactas.set(normalizarRuta(r.desde), r);
    }
  }
  comodines.sort((a, b) => b.prefijo.length - a.prefijo.length);
  return { exactas, comodines };
}

const codigoValido = (c: number): CodigoRedireccion => (c === 302 ? 302 : 301);

/** Un salto: la regla que corresponde a la ruta y adónde lleva (con el comodín ya puesto). */
type Salto = DestinoRedireccion & { consumioConsulta: boolean };

function unSalto(tabla: TablaRedirecciones, ruta: string): Salto | null {
  const clave = normalizarRuta(ruta);
  const exacta = tabla.exactas.get(clave);
  // Las reglas `post.php?id=` / `album.php?id=` usan la consulta: no se vuelve a pasar al destino.
  if (exacta) return { hacia: exacta.hacia.trim(), codigo: codigoValido(exacta.codigo), consumioConsulta: clave.includes("?") };
  for (const { prefijo, regla } of tabla.comodines) {
    if (!clave.startsWith(prefijo)) continue;
    // Lo que cubrió el comodín sale de la ruta original (sin pasar a minúsculas): un código de
    // galería como `/proof/AbC12` puede distinguir mayúsculas. Para rutas ASCII el largo es el mismo.
    // Va codificado: `/x/%5Cotro.com` no puede volver como `/\otro.com`, que el navegador lee como
    // `//otro.com` (otro sitio).
    const resto = encodeURI(rutaLimpia(ruta).slice(prefijo.length)).replace(/\\/g, "%5C");
    return { hacia: regla.hacia.trim().replace("*", resto), codigo: codigoValido(regla.codigo), consumioConsulta: false };
  }
  return null;
}

/**
 * ¿Un destino que el navegador llevaría a OTRO sitio sin que la regla lo diga? `//otro.com` y
 * `/\otro.com` se leen como direcciones completas. Las direcciones completas explícitas
 * (`https://…`) sí valen: las escribió quien cargó la regla.
 */
export function esDestinoPeligroso(hacia: string): boolean {
  return /^\/[\/\\]/.test(hacia) || /^[\\]/.test(hacia) || /[\u0000-\u001f]/.test(hacia);
}

/** La consulta de la ruta pedida (`?a=1`, sin `#`), o vacío. */
function consultaDe(ruta: string): string {
  let q = "";
  if (/^https?:\/\//i.test(ruta)) {
    try {
      q = new URL(ruta).search;
    } catch {
      q = "";
    }
  } else {
    const i = ruta.indexOf("?");
    q = i >= 0 ? ruta.slice(i).split("#")[0] : "";
  }
  return q.length > 1 ? q : "";
}

/**
 * Adónde lleva una ruta, siguiendo la cadena (A → B → C da C) hasta `MAX_SALTOS` saltos. Un bucle
 * (A → B → A, o una regla que lleva a sí misma) devuelve null: mejor un 404 que un sitio que no
 * termina de cargar. Si después del último salto permitido todavía hay otra regla, también null
 * (puede ser un bucle más largo). Basta un salto temporal (302) para que el resultado sea 302.
 * La consulta de la ruta pedida (`?utm_source=…`) pasa al destino, salvo que la haya usado la regla.
 */
export function resolverRedireccion(tabla: TablaRedirecciones, ruta: string): DestinoRedireccion | null {
  const vistas = new Set<string>([normalizarRuta(ruta)]);
  const primero = unSalto(tabla, ruta);
  if (!primero) return null;
  let actual: Salto = primero;
  let codigo: CodigoRedireccion = actual.codigo;
  for (let saltos = 1; ; saltos++) {
    if (esDestinoPeligroso(actual.hacia)) return null;
    // Una dirección completa (`https://…`) sale del sitio: ahí termina la cadena.
    if (!actual.hacia.startsWith("/")) break;
    const clave = normalizarRuta(actual.hacia);
    if (vistas.has(clave)) return null;
    const siguiente = unSalto(tabla, actual.hacia);
    if (!siguiente) break;
    if (saltos >= MAX_SALTOS) return null;
    vistas.add(clave);
    if (siguiente.codigo === 302) codigo = 302;
    actual = siguiente;
  }
  const consulta = primero.consumioConsulta ? "" : consultaDe(ruta);
  const hacia = consulta ? `${actual.hacia}${actual.hacia.includes("?") ? "&" : "?"}${consulta.slice(1)}` : actual.hacia;
  return { hacia, codigo };
}

/** Prefijo de la ruta de destino cuando el sitio se ve en `/w/<slug>` (no en su dominio propio). */
export function destinoBajoPrefijo(hacia: string, prefijo: string): string {
  if (!hacia.startsWith("/")) return hacia;
  return hacia === "/" ? prefijo : `${prefijo}${hacia}`;
}

// ── Validación del panel ────────────────────────────────────────────────────────────────────

export const MAX_DESDE = 500;
export const MAX_HACIA = 2000;

export type ReglaValidada = { desde: string; hacia: string; codigo: CodigoRedireccion };

/**
 * Lo que se carga a mano en el panel: `desde` es una ruta (con un `*` final opcional), nunca `/`
 * (taparía la portada); `hacia` es una ruta del sitio o una dirección `http(s)`.
 */
export function validarRegla(input: { desde?: unknown; hacia?: unknown; codigo?: unknown }): { ok: true; regla: ReglaValidada } | { ok: false; error: string } {
  const desdeCrudo = typeof input.desde === "string" ? input.desde.trim() : "";
  const haciaCrudo = typeof input.hacia === "string" ? input.hacia.trim() : "";
  if (!desdeCrudo || !haciaCrudo) return { ok: false, error: "Completá la dirección vieja y adónde tiene que llevar." };
  if (desdeCrudo.length > MAX_DESDE || haciaCrudo.length > MAX_HACIA) return { ok: false, error: "La dirección es demasiado larga." };

  const comodin = desdeCrudo.endsWith("*");
  const base = comodin ? desdeCrudo.slice(0, -1) : desdeCrudo;
  if (base.includes("*")) return { ok: false, error: "El * sólo puede ir al final de la dirección vieja." };
  const sinDominio = /^https?:\/\//i.test(base) ? base : base.startsWith("/") ? base : `/${base}`;
  let desde = normalizarRuta(sinDominio);
  if (comodin) desde = `${desde === "/" ? "" : desde}${base.endsWith("/") ? "/" : ""}*`;
  if (desde === "/" || desde === "*" || desde === "/*") return { ok: false, error: "La portada no se puede redirigir." };

  let hacia = haciaCrudo;
  if (/^https?:\/\//i.test(hacia)) {
    try {
      new URL(hacia.replace("*", "x"));
    } catch {
      return { ok: false, error: "La dirección nueva no es válida." };
    }
    // El comodín sólo puede ir en la ruta: en el dominio dejaría elegir a qué sitio se manda.
    const finDelDominio = hacia.indexOf("/", hacia.indexOf("//") + 2);
    const dominio = finDelDominio < 0 ? hacia : hacia.slice(0, finDelDominio);
    if (/[*?#@\\]/.test(dominio.slice(dominio.indexOf("//") + 2))) return { ok: false, error: "El * sólo puede ir en la ruta de la dirección nueva, no en el dominio." };
  } else if (/^[a-z][a-z0-9+.-]*:/i.test(hacia) || esDestinoPeligroso(hacia.startsWith("/") ? hacia : `/${hacia}`)) {
    return { ok: false, error: "La dirección nueva tiene que ser una ruta del sitio (/algo) o empezar con https://." };
  } else {
    if (!hacia.startsWith("/")) hacia = `/${hacia}`;
    if (/\s/.test(hacia)) return { ok: false, error: "La dirección nueva no puede tener espacios." };
  }
  if (!comodin && hacia.includes("*")) return { ok: false, error: "Usá * en la dirección nueva sólo si la vieja termina en *." };
  if (!hacia.includes("*") && hacia.startsWith("/") && normalizarRuta(hacia) === desde) {
    return { ok: false, error: "La dirección vieja y la nueva son la misma." };
  }

  const codigo = Number(input.codigo) === 302 ? 302 : 301;
  return { ok: true, regla: { desde, hacia, codigo } };
}
