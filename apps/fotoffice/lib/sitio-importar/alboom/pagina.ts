import { atributo, buscar, buscarTodos, htmlInterno, parsearHtml, quitarParrafoEnvolvente, tieneClase, textoDe, type Elemento } from "./dom";
import { esUrlDeFoto, mejorUrlDeImagen, unicas, urlsDeFondo } from "./fotos";

/**
 * Una página cualquiera de Alboom (Quién soy, Cursos, Agenda, landings) leída como secciones.
 *
 * Alboom tiene dos tipos de página: las fijas (Sobre, Contacto: `<main>` con `<section>`) y las del
 * editor de páginas (`div.content-section`, cada una con columnas `.cp-col`). Cada sección (o cada
 * columna, cuando una sección tiene varias columnas con título propio, como las 3 tarjetas de
 * cursos o los 4 tipos de cita de la agenda) pasa a ser una `SeccionAlboom`: su título, el HTML de
 * sus textos, sus fotos, sus botones, sus iframes y si tenía un formulario de Alboom.
 */
export type BotonAlboom = { texto: string; url: string };

export type SeccionAlboom = {
  titulo?: string;
  /** HTML de los textos, tal cual (sin sanear). Los títulos internos van como `<h3>`. */
  html: string;
  imagenes: string[];
  botones: BotonAlboom[];
  iframes: string[];
  /** Había un formulario de Alboom (contacto o el de una landing). */
  formulario: boolean;
};

export type PaginaAlboom = {
  titulo: string;
  /** Foto de portada de las páginas fijas (`figure.page-cover`). */
  portadaUrl: string | null;
  secciones: SeccionAlboom[];
  /** Todos los iframes de la página, en orden (también los que quedaron dentro de una sección). */
  iframes: string[];
};

const SELECTOR_TITULO = ".cs__title, .as__title, h1, h2, h3, h4";
/** Lo que nunca aporta texto: código, formularios, botones (van aparte) e incrustados. */
const SALTEAR = new Set(["script", "style", "noscript", "form", "button", "iframe", "img", "picture", "svg", "nav", "footer", "header", "link"]);

function esTitulo(el: Elemento): boolean {
  return tieneClase(el, "cs__title") || tieneClase(el, "as__title") || /^h[1-6]$/.test(el.tag);
}

function esTexto(el: Elemento): boolean {
  return tieneClase(el, "fr-view") || tieneClase(el, "as__description") || tieneClase(el, "as__client-name");
}

function escapar(texto: string): string {
  return texto.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

function dentroDe(el: Elemento, tags: string[]): boolean {
  for (let p = el.padre; p; p = p.padre) if (tags.includes(p.tag)) return true;
  return false;
}

/** Los botones del agendador de Google Calendar que Alboom pega como script. */
function botonesDeAgenda(unidad: Elemento): BotonAlboom[] {
  const out: BotonAlboom[] = [];
  for (const s of buscarTodos(unidad, "script")) {
    const codigo = s.hijos.map((h) => (h.tipo === "texto" ? h.texto : "")).join("");
    if (!codigo.includes("schedulingButton")) continue;
    const url = /url:\s*['"]([^'"]+)['"]/.exec(codigo)?.[1];
    const texto = /label:\s*['"]([^'"]+)['"]/.exec(codigo)?.[1] ?? "Agendar un turno";
    if (url && esUrlDeFoto(url)) out.push({ texto, url });
  }
  return out;
}

function leerUnidad(unidad: Elemento, html: string): SeccionAlboom | null {
  const elTitulo = buscar(unidad, SELECTOR_TITULO);
  const titulo = textoDe(elTitulo) || undefined;

  const partes: string[] = [];
  const recorrer = (el: Elemento) => {
    for (const h of el.hijos) {
      if (h.tipo !== "elemento" || SALTEAR.has(h.tag) || h === elTitulo) continue;
      if (h.attrs["data-form"] !== undefined || tieneClase(h, "boom-button") || tieneClase(h, "as__action")) continue;
      if (esTexto(h)) {
        const interno = quitarParrafoEnvolvente(htmlInterno(h, html));
        if (interno) partes.push(h.tag === "h2" ? `<h3>${escapar(textoDe(h))}</h3>` : interno);
        continue;
      }
      if (esTitulo(h)) {
        const t = textoDe(h);
        if (t) partes.push(`<h3>${escapar(t)}</h3>`);
        continue;
      }
      recorrer(h);
    }
  };
  recorrer(unidad);

  const botones: BotonAlboom[] = [];
  for (const a of [...buscarTodos(unidad, "a.boom-button"), ...buscarTodos(unidad, ".as__action a")]) {
    const url = atributo(a, "href")?.trim();
    const texto = textoDe(a);
    if (url && texto && /^(https?:|mailto:|tel:)/i.test(url)) botones.push({ texto, url });
  }
  botones.push(...botonesDeAgenda(unidad));

  const seccion: SeccionAlboom = {
    ...(titulo ? { titulo } : {}),
    html: partes.join("\n"),
    imagenes: unicas(buscarTodos(unidad, "img").map(mejorUrlDeImagen).filter(esUrlDeFoto)),
    botones: botones.filter((b, i) => botones.findIndex((o) => o.url === b.url && o.texto === b.texto) === i),
    iframes: unicas(buscarTodos(unidad, "iframe").map((f) => atributo(f, "src")?.trim() ?? "").filter(esUrlDeFoto)),
    formulario: buscarTodos(unidad, "form, [data-form]").length > 0,
  };
  const textoPlano = seccion.html.replace(/<[^>]+>/g, "").replace(/&nbsp;|\s/g, "");
  const vacia = !titulo && !textoPlano && !seccion.imagenes.length && !seccion.botones.length && !seccion.iframes.length && !seccion.formulario;
  return vacia ? null : seccion;
}

/** Las columnas de una sección del editor, sin contar las anidadas dentro de otra columna. */
function columnasDe(seccion: Elemento): Elemento[] {
  const todas = buscarTodos(seccion, ".cp-col");
  return todas.filter((c) => !todas.some((otra) => otra !== c && contiene(otra, c)));
}

function contiene(padre: Elemento, el: Elemento): boolean {
  for (let p = el.padre; p; p = p.padre) if (p === padre) return true;
  return false;
}

function tituloDeLaPagina(raiz: Elemento): string {
  const crudo = textoDe(buscar(raiz, "title"));
  const limpio = crudo
    .replace(/^DNX Fotograf[ií]a\s*[-–|]\s*/i, "")
    .replace(/\s*[-–|]\s*DNX Fotograf[ií]a$/i, "")
    .trim();
  if (limpio && !/^DNX Fotograf[ií]a$/i.test(limpio)) return limpio;
  return textoDe(buscar(raiz, "main h1, .content-section h1")) || crudo || "Página";
}

export function leerPagina(html: string): PaginaAlboom {
  const raiz = parsearHtml(html);
  const cuerpo = buscar(raiz, "main") ?? buscar(raiz, "body") ?? raiz;

  const delEditor = buscarTodos(cuerpo, ".content-section").filter(
    (s, _i, todas) => !dentroDe(s, ["footer", "header", "nav"]) && !todas.some((o) => o !== s && contiene(o, s)),
  );
  const contenedores = delEditor.length
    ? delEditor
    : buscarTodos(cuerpo, "section").filter((s, _i, todas) => !dentroDe(s, ["footer", "header", "nav"]) && !todas.some((o) => o !== s && contiene(o, s)));
  const bloques = contenedores.length ? contenedores : [cuerpo];

  const secciones: SeccionAlboom[] = [];
  for (const s of bloques) {
    const columnas = columnasDe(s);
    const conTitulo = columnas.filter((c) => buscar(c, SELECTOR_TITULO));
    const unidades = conTitulo.length >= 2 ? columnas : [s];
    for (const u of unidades) {
      const leida = leerUnidad(u, html);
      if (leida) secciones.push(leida);
    }
  }

  const portada = buscar(cuerpo, "figure.page-cover");
  const portadaUrl =
    (portada && (mejorUrlDeImagen(buscar(portada, "img") ?? portada) ?? urlsDeFondo(atributo(buscar(portada, ".ip__background"), "style"))[0])) || null;

  return {
    titulo: tituloDeLaPagina(raiz),
    portadaUrl,
    secciones,
    iframes: unicas(
      buscarTodos(cuerpo, "iframe")
        .filter((f) => !dentroDe(f, ["footer", "header", "nav"]))
        .map((f) => atributo(f, "src")?.trim() ?? "")
        .filter(esUrlDeFoto),
    ),
  };
}
