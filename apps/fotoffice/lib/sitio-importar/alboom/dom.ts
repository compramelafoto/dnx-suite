/**
 * Lector de HTML mínimo para el importador de Alboom. FOTOFFICE no tiene un parser de HTML entre
 * sus dependencias y sumar uno reescribe el lockfile de todo el monorepo (ya rompió el CI de otras
 * apps una vez), así que esto alcanza para lo que hace falta: leer páginas públicas de Alboom,
 * que son HTML de servidor bastante prolijo, y sacar textos, atributos y pedazos de HTML.
 *
 * No es un parser completo del estándar. Tolera lo que aparece en Alboom: etiquetas sin cerrar,
 * `</p>` sueltos, `<p>` adentro de `<p>`, `<img/>` autocerrados, scripts con `<` adentro. Cada
 * elemento recuerda dónde empieza y termina en el texto original, así `htmlInterno` devuelve el
 * HTML de adentro tal cual estaba (sin re-serializar).
 */

export type Elemento = {
  tipo: "elemento";
  tag: string;
  attrs: Record<string, string>;
  hijos: Nodo[];
  padre: Elemento | null;
  /** Posición del primer carácter después de la etiqueta de apertura. */
  inicioContenido: number;
  /** Posición donde empieza la etiqueta de cierre (o donde se cerró sola). */
  finContenido: number;
};

export type Texto = { tipo: "texto"; texto: string; padre: Elemento };
export type Nodo = Elemento | Texto;

const VACIOS = new Set(["area", "base", "br", "col", "embed", "hr", "img", "input", "link", "meta", "param", "source", "track", "wbr"]);
const TEXTO_CRUDO = new Set(["script", "style", "textarea", "title", "noscript"]);
/** Etiquetas que, al abrirse, cierran un `<p>` abierto (como hace el navegador). */
const CIERRAN_P = new Set([
  "address", "article", "aside", "blockquote", "div", "dl", "fieldset", "figure", "figcaption", "footer", "form",
  "h1", "h2", "h3", "h4", "h5", "h6", "header", "hr", "main", "nav", "ol", "p", "pre", "section", "table", "ul",
]);

/** Un `<li>` abierto se cierra al abrir otro `<li>` (sin salir de su lista); lo mismo filas y celdas. */
const HERMANOS_IMPLICITOS: Record<string, { cierra: string[]; frontera: string[] }> = {
  li: { cierra: ["li"], frontera: ["ul", "ol"] },
  option: { cierra: ["option"], frontera: ["select"] },
  tr: { cierra: ["tr"], frontera: ["table", "tbody", "thead", "tfoot"] },
  td: { cierra: ["td", "th"], frontera: ["tr", "table"] },
  th: { cierra: ["td", "th"], frontera: ["tr", "table"] },
};

function nuevoElemento(tag: string, attrs: Record<string, string>, padre: Elemento | null, inicio: number): Elemento {
  return { tipo: "elemento", tag, attrs, hijos: [], padre, inicioContenido: inicio, finContenido: inicio };
}

/** Lee los atributos de lo que hay entre `<tag` y `>`. Devuelve también dónde terminó y si era `/>`. */
function leerAtributos(html: string, desde: number): { attrs: Record<string, string>; fin: number; autocerrado: boolean } {
  const attrs: Record<string, string> = {};
  let i = desde;
  const n = html.length;
  while (i < n) {
    while (i < n && /\s/.test(html[i])) i++;
    if (i >= n) break;
    if (html[i] === ">") return { attrs, fin: i + 1, autocerrado: false };
    if (html[i] === "/" && html[i + 1] === ">") return { attrs, fin: i + 2, autocerrado: true };
    if (html[i] === "/") {
      i++;
      continue;
    }
    let nombre = "";
    while (i < n && !/[\s=>]/.test(html[i]) && !(html[i] === "/" && html[i + 1] === ">")) nombre += html[i++];
    while (i < n && /\s/.test(html[i])) i++;
    let valor = "";
    if (html[i] === "=") {
      i++;
      while (i < n && /\s/.test(html[i])) i++;
      const comilla = html[i];
      if (comilla === '"' || comilla === "'") {
        const cierre = html.indexOf(comilla, i + 1);
        const hasta = cierre === -1 ? n : cierre;
        valor = html.slice(i + 1, hasta);
        i = hasta + 1;
      } else {
        while (i < n && !/[\s>]/.test(html[i])) valor += html[i++];
      }
    }
    const clave = nombre.toLowerCase();
    if (clave && !(clave in attrs)) attrs[clave] = decodificarEntidades(valor);
  }
  return { attrs, fin: n, autocerrado: false };
}

export function parsearHtml(html: string): Elemento {
  const raiz = nuevoElemento("#documento", {}, null, 0);
  const pila: Elemento[] = [raiz];
  const actual = () => pila[pila.length - 1];
  const agregarTexto = (texto: string) => {
    if (texto) actual().hijos.push({ tipo: "texto", texto, padre: actual() });
  };
  /** Cierra todo hasta `indice` incluido; los que se cierran solos terminan en `posicion`. */
  const cerrarHasta = (indice: number, posicion: number) => {
    while (pila.length > indice) {
      const el = pila.pop() as Elemento;
      el.finContenido = posicion;
    }
  };

  let i = 0;
  const n = html.length;
  while (i < n) {
    const lt = html.indexOf("<", i);
    if (lt === -1) {
      agregarTexto(html.slice(i));
      break;
    }
    agregarTexto(html.slice(i, lt));
    if (html.startsWith("<!--", lt)) {
      const fin = html.indexOf("-->", lt + 4);
      i = fin === -1 ? n : fin + 3;
      continue;
    }
    if (html[lt + 1] === "!" || html[lt + 1] === "?") {
      const fin = html.indexOf(">", lt);
      i = fin === -1 ? n : fin + 1;
      continue;
    }
    if (html[lt + 1] === "/") {
      const m = /^<\/([a-zA-Z][\w:-]*)[^>]*>/.exec(html.slice(lt, lt + 200));
      if (!m) {
        agregarTexto("<");
        i = lt + 1;
        continue;
      }
      const tag = m[1].toLowerCase();
      for (let k = pila.length - 1; k > 0; k--) {
        if (pila[k].tag === tag) {
          cerrarHasta(k, lt);
          break;
        }
      }
      i = lt + m[0].length;
      continue;
    }
    const m = /^<([a-zA-Z][\w:-]*)/.exec(html.slice(lt, lt + 100));
    if (!m) {
      agregarTexto("<");
      i = lt + 1;
      continue;
    }
    const tag = m[1].toLowerCase();
    const { attrs, fin, autocerrado } = leerAtributos(html, lt + m[0].length);

    // Cierres implícitos: un bloque cierra el <p> abierto; un <li> cierra el <li> hermano.
    if (CIERRAN_P.has(tag) && actual().tag === "p") cerrarHasta(pila.length - 1, lt);
    const hermano = HERMANOS_IMPLICITOS[tag];
    if (hermano) {
      for (let k = pila.length - 1; k > 0; k--) {
        if (hermano.frontera.includes(pila[k].tag)) break;
        if (hermano.cierra.includes(pila[k].tag)) {
          cerrarHasta(k, lt);
          break;
        }
      }
    }

    const el = nuevoElemento(tag, attrs, actual(), fin);
    actual().hijos.push(el);
    if (VACIOS.has(tag) || autocerrado) {
      i = fin;
      continue;
    }
    if (TEXTO_CRUDO.has(tag)) {
      const buscador = new RegExp(`</${tag}`, "gi");
      buscador.lastIndex = fin;
      const cierre = buscador.exec(html)?.index ?? -1;
      const hasta = cierre === -1 ? n : cierre;
      if (hasta > fin) el.hijos.push({ tipo: "texto", texto: html.slice(fin, hasta), padre: el });
      el.finContenido = hasta;
      const gt = cierre === -1 ? -1 : html.indexOf(">", cierre);
      i = gt === -1 ? n : gt + 1;
      continue;
    }
    pila.push(el);
    i = fin;
  }
  cerrarHasta(1, n);
  raiz.finContenido = n;
  return raiz;
}

// ---------------------------------------------------------------------------------------------
// Selectores: `tag`, `.clase`, `#id`, `[attr]`, `[attr="valor"]`, combinados (`div.a.b[x]`),
// descendiente (espacio), hijo directo (`>`) y varias opciones separadas por coma.

type Simple = { tag?: string; id?: string; clases: string[]; attrs: { nombre: string; valor?: string }[] };
type Paso = { simple: Simple; combinador: " " | ">" };

function parsearSimple(texto: string): Simple {
  const s: Simple = { clases: [], attrs: [] };
  const re = /([a-zA-Z][\w-]*)|\.([\w-]+)|#([\w-]+)|\[([\w:-]+)(?:=(?:"([^"]*)"|'([^']*)'|([^\]]*)))?\]/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(texto))) {
    if (m[1]) s.tag = m[1].toLowerCase();
    else if (m[2]) s.clases.push(m[2]);
    else if (m[3]) s.id = m[3];
    else if (m[4]) s.attrs.push({ nombre: m[4].toLowerCase(), valor: m[5] ?? m[6] ?? m[7] });
  }
  return s;
}

function parsearSelector(selector: string): Paso[][] {
  return selector.split(",").map((parte) => {
    const tokens = parte.trim().replace(/\s*>\s*/g, " > ").split(/\s+/).filter(Boolean);
    const pasos: Paso[] = [];
    let combinador: " " | ">" = " ";
    for (const t of tokens) {
      if (t === ">") {
        combinador = ">";
        continue;
      }
      pasos.push({ simple: parsearSimple(t), combinador });
      combinador = " ";
    }
    return pasos;
  });
}

function clases(el: Elemento): string[] {
  return (el.attrs.class ?? "").split(/\s+/).filter(Boolean);
}

function cumple(el: Elemento, s: Simple): boolean {
  if (s.tag && el.tag !== s.tag) return false;
  if (s.id && el.attrs.id !== s.id) return false;
  if (s.clases.length) {
    const propias = clases(el);
    if (!s.clases.every((c) => propias.includes(c))) return false;
  }
  for (const a of s.attrs) {
    if (!(a.nombre in el.attrs)) return false;
    if (a.valor !== undefined && el.attrs[a.nombre] !== a.valor) return false;
  }
  return true;
}

/** ¿`el` cumple la cadena de pasos (leída de derecha a izquierda), sin salir de `tope`? */
function cumpleCadena(el: Elemento, pasos: Paso[], indice: number, tope: Elemento): boolean {
  if (!cumple(el, pasos[indice].simple)) return false;
  if (indice === 0) return true;
  const combinador = pasos[indice].combinador;
  let p = el.padre;
  while (p && p !== tope) {
    if (cumpleCadena(p, pasos, indice - 1, tope)) return true;
    if (combinador === ">") return false;
    p = p.padre;
  }
  return false;
}

/** Todos los elementos dentro de `raiz` (sin incluirla) que cumplen el selector, en orden. */
export function buscarTodos(raiz: Elemento | null | undefined, selector: string): Elemento[] {
  if (!raiz) return [];
  const alternativas = parsearSelector(selector);
  const out: Elemento[] = [];
  const visitar = (el: Elemento) => {
    for (const h of el.hijos) {
      if (h.tipo !== "elemento") continue;
      if (alternativas.some((pasos) => pasos.length > 0 && cumpleCadena(h, pasos, pasos.length - 1, raiz))) out.push(h);
      visitar(h);
    }
  };
  visitar(raiz);
  return out;
}

export function buscar(raiz: Elemento | null | undefined, selector: string): Elemento | null {
  return buscarTodos(raiz, selector)[0] ?? null;
}

export function atributo(el: Elemento | null | undefined, nombre: string): string | null {
  if (!el) return null;
  const v = el.attrs[nombre.toLowerCase()];
  return v === undefined ? null : v;
}

export function tieneClase(el: Elemento, clase: string): boolean {
  return clases(el).includes(clase);
}

/** El texto visible (sin scripts ni estilos), con las entidades resueltas y los espacios juntados. */
export function textoDe(el: Elemento | null | undefined): string {
  return textoCrudo(el).replace(/[\s ]+/g, " ").trim();
}

/** Como `textoDe` pero respeta los saltos de línea del original (para textos largos escritos a mano). */
export function textoConSaltos(el: Elemento | null | undefined): string {
  return textoCrudo(el)
    .replace(/\r\n?/g, "\n")
    .split("\n")
    .map((linea) => linea.replace(/[ \t ]+/g, " ").trim())
    .join("\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function textoCrudo(el: Elemento | null | undefined): string {
  if (!el) return "";
  let out = "";
  const visitar = (e: Elemento) => {
    if (e.tag === "script" || e.tag === "style" || e.tag === "noscript") return;
    if (e.tag === "br") out += "\n";
    for (const h of e.hijos) {
      if (h.tipo === "texto") out += decodificarEntidades(h.texto);
      else visitar(h);
    }
  };
  visitar(el);
  return out;
}

/** El HTML de adentro del elemento, tal cual está en `html` (el mismo texto que se parseó). */
export function htmlInterno(el: Elemento | null | undefined, html: string): string {
  if (!el) return "";
  return html.slice(el.inicioContenido, el.finContenido);
}

const ENTIDADES: Record<string, string> = {
  amp: "&", lt: "<", gt: ">", quot: '"', apos: "'", nbsp: " ",
  aacute: "á", eacute: "é", iacute: "í", oacute: "ó", uacute: "ú", Aacute: "Á", Eacute: "É", Iacute: "Í", Oacute: "Ó", Uacute: "Ú",
  agrave: "à", egrave: "è", igrave: "ì", ograve: "ò", ugrave: "ù", acirc: "â", ecirc: "ê", ocirc: "ô", atilde: "ã", otilde: "õ",
  ntilde: "ñ", Ntilde: "Ñ", uuml: "ü", Uuml: "Ü", ccedil: "ç", Ccedil: "Ç",
  iexcl: "¡", iquest: "¿", laquo: "«", raquo: "»", ordm: "º", ordf: "ª", deg: "°",
  ndash: "–", mdash: "—", hellip: "…", lsquo: "‘", rsquo: "’", ldquo: "“", rdquo: "”", bull: "•", middot: "·",
  copy: "©", reg: "®", trade: "™", euro: "€", times: "×", shy: "­", zwj: "‍",
};

export function decodificarEntidades(texto: string): string {
  if (!texto.includes("&")) return texto;
  return texto.replace(/&(#x[0-9a-fA-F]+|#\d+|[a-zA-Z]+);/g, (entera, cuerpo: string) => {
    if (cuerpo[0] === "#") {
      const codigo = cuerpo[1] === "x" || cuerpo[1] === "X" ? parseInt(cuerpo.slice(2), 16) : parseInt(cuerpo.slice(1), 10);
      if (!Number.isFinite(codigo) || codigo <= 0 || codigo > 0x10ffff) return entera;
      return String.fromCodePoint(codigo);
    }
    return ENTIDADES[cuerpo] ?? entera;
  });
}

/**
 * Alboom envuelve algunas descripciones en un `<p>` de más (`<p><p>…</p><p>…</p></p>`), que el
 * navegador convierte en un párrafo vacío arriba. Se saca ese envoltorio y nada más.
 */
export function quitarParrafoEnvolvente(html: string): string {
  const t = html.trim();
  if (/^<p>\s*<p[\s>]/i.test(t) && /<\/p>\s*<\/p>$/i.test(t)) return t.replace(/^<p>\s*/i, "").replace(/\s*<\/p>$/i, "");
  return t;
}
