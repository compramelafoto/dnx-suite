/**
 * Pasa una página del diseño (lo que dibuja `TemplateCanvasRenderer`, que es HTML con estilos en
 * línea) a un `<canvas>`, para usarla como textura del librito 3D.
 *
 * Camino principal: se clona el HTML, cada `<img>` se reemplaza por su contenido embebido (data
 * URL) y todo se mete en un SVG con `<foreignObject>`, que el navegador sabe pintar en un canvas.
 * Un SVG usado como imagen no puede pedir nada afuera; por eso las fotos tienen que ir adentro.
 *
 * Si el navegador no deja leer ese canvas (algunos Safari lo marcan como "contaminado") se usa un
 * plan B más simple: el color del papel y las fotos en su lugar, sin los textos.
 */

export type PaginaRasterizada = {
  canvas: HTMLCanvasElement;
  /** Imágenes que no se pudieron leer (CORS o red): quedan en blanco. */
  imagenesFallidas: number;
  /** true si hubo que usar el plan B (sin textos). */
  simplificada: boolean;
};

/** Lado máximo de una foto embebida: la textura no pasa de ~2048 px, más no suma. */
const MAX_LADO_IMAGEN = 1400;
const PIXEL_VACIO = "data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7";

/*
 * Lo mínimo del "preflight" de Tailwind que la página usa sin saberlo: dentro del SVG no llegan
 * las hojas de estilo del sitio. Los estilos en línea del diseño pisan estas reglas.
 */
const ESTILO_BASE =
  "*,::before,::after{box-sizing:border-box;border:0 solid;margin:0;padding:0}" +
  "img,svg,canvas{display:block;vertical-align:middle}";

function blobADataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(String(r.result));
    r.onerror = () => reject(r.error);
    r.readAsDataURL(blob);
  });
}

async function imagenEmbebida(src: string): Promise<string> {
  if (src.startsWith("data:")) return src;
  const res = await fetch(src, { mode: "cors", credentials: "same-origin" });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const blob = await res.blob();
  const tipo = blob.type || "";
  // SVG y GIF van tal cual; el resto se achica para que el SVG no pese decenas de MB.
  if (/svg|gif/.test(tipo) || typeof createImageBitmap !== "function") return blobADataUrl(blob);
  const bmp = await createImageBitmap(blob);
  try {
    const k = Math.min(1, MAX_LADO_IMAGEN / Math.max(bmp.width, bmp.height));
    if (k >= 1 && blob.size < 900_000) return blobADataUrl(blob);
    const c = document.createElement("canvas");
    c.width = Math.max(1, Math.round(bmp.width * k));
    c.height = Math.max(1, Math.round(bmp.height * k));
    c.getContext("2d")!.drawImage(bmp, 0, 0, c.width, c.height);
    return /png|webp/.test(tipo) ? c.toDataURL("image/png") : c.toDataURL("image/jpeg", 0.88);
  } finally {
    bmp.close();
  }
}

function cargarImagen(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.decoding = "sync";
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error("No se pudo dibujar la página"));
    img.src = src;
  });
}

const esperarCuadro = () => new Promise<void>((r) => requestAnimationFrame(() => r()));

/** Espera a que terminen de cargar las imágenes de `root` (y a que React reacomode los encuadres). */
export async function esperarImagenes(root: HTMLElement, timeoutMs = 15_000): Promise<void> {
  const limite = Date.now() + timeoutMs;
  for (let vuelta = 0; vuelta < 4; vuelta++) {
    const pendientes = [...root.querySelectorAll("img")].filter((i) => !i.complete);
    if (pendientes.length === 0 && vuelta > 0) break;
    await Promise.race([
      Promise.all(
        pendientes.map(
          (i) =>
            new Promise<void>((r) => {
              i.addEventListener("load", () => r(), { once: true });
              i.addEventListener("error", () => r(), { once: true });
            }),
        ),
      ),
      new Promise<void>((r) => setTimeout(r, Math.max(0, limite - Date.now()))),
    ]);
    // `CroppedPhotoRenderer` acomoda la foto en el onLoad: dos cuadros para que React lo pinte.
    await esperarCuadro();
    await esperarCuadro();
    if (Date.now() >= limite) break;
  }
}

function lienzo(ancho: number, alto: number): HTMLCanvasElement {
  const c = document.createElement("canvas");
  c.width = ancho;
  c.height = alto;
  return c;
}

/** ¿Se puede leer el canvas? Si está "contaminado", WebGL tampoco lo acepta como textura. */
function esLegible(c: HTMLCanvasElement): boolean {
  try {
    c.getContext("2d")!.getImageData(0, 0, 1, 1);
    return true;
  } catch {
    return false;
  }
}

async function porForeignObject(
  el: HTMLElement,
  ancho: number,
  alto: number,
  salidaW: number,
  salidaH: number,
): Promise<{ canvas: HTMLCanvasElement; fallidas: number }> {
  const clon = el.cloneNode(true) as HTMLElement;
  const originales = [...el.querySelectorAll("img")];
  const copias = [...clon.querySelectorAll("img")];
  const cache = new Map<string, Promise<string>>();
  let fallidas = 0;
  await Promise.all(
    copias.map(async (img, i) => {
      const src = originales[i]?.currentSrc || originales[i]?.src || img.getAttribute("src") || "";
      img.removeAttribute("srcset");
      img.removeAttribute("loading");
      if (!src) return;
      if (!cache.has(src)) cache.set(src, imagenEmbebida(src));
      try {
        img.setAttribute("src", await cache.get(src)!);
      } catch {
        fallidas++;
        img.setAttribute("src", PIXEL_VACIO);
      }
    }),
  );

  const raiz = getComputedStyle(el);
  clon.style.position = "relative";
  clon.style.left = "0";
  clon.style.top = "0";
  clon.style.transform = "none";
  clon.style.margin = "0";
  clon.style.fontFamily = raiz.fontFamily;
  clon.style.lineHeight = raiz.lineHeight;
  clon.style.color = raiz.color;

  const html = new XMLSerializer().serializeToString(clon);
  const svg =
    `<svg xmlns="http://www.w3.org/2000/svg" width="${ancho}" height="${alto}" viewBox="0 0 ${ancho} ${alto}">` +
    `<foreignObject x="0" y="0" width="${ancho}" height="${alto}">` +
    `<div xmlns="http://www.w3.org/1999/xhtml" style="width:${ancho}px;height:${alto}px;overflow:hidden">` +
    `<style>${ESTILO_BASE}</style>${html}</div></foreignObject></svg>`;

  const img = await cargarImagen(`data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`);
  try {
    await img.decode();
  } catch {
    /* algunos navegadores no decodifican SVG con decode(); el onload alcanza */
  }
  const c = lienzo(salidaW, salidaH);
  const ctx = c.getContext("2d")!;
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, salidaW, salidaH);
  ctx.drawImage(img, 0, 0, salidaW, salidaH);
  // Safari a veces pinta el primer cuadro sin las imágenes internas: un segundo dibujo lo arregla.
  await esperarCuadro();
  ctx.drawImage(img, 0, 0, salidaW, salidaH);
  if (!esLegible(c)) throw new Error("canvas contaminado");
  return { canvas: c, fallidas };
}

/** Plan B: fondo y fotos en su lugar, recortadas por su marco. Sin textos. */
async function porDibujoSimple(
  el: HTMLElement,
  ancho: number,
  salidaW: number,
  salidaH: number,
): Promise<{ canvas: HTMLCanvasElement; fallidas: number }> {
  const c = lienzo(salidaW, salidaH);
  const ctx = c.getContext("2d")!;
  const base = el.getBoundingClientRect();
  const k = salidaW / Math.max(1, base.width || ancho);
  const fondoEl = (el.firstElementChild as HTMLElement | null) ?? el;
  const fondo = getComputedStyle(fondoEl).backgroundColor;
  ctx.fillStyle = fondo && fondo !== "rgba(0, 0, 0, 0)" ? fondo : "#ffffff";
  ctx.fillRect(0, 0, salidaW, salidaH);
  let fallidas = 0;
  for (const img of el.querySelectorAll("img")) {
    const src = img.currentSrc || img.src;
    if (!src) continue;
    try {
      const limpia = await cargarImagen(await imagenEmbebida(src));
      const r = img.getBoundingClientRect();
      const marco = (img.parentElement ?? img).getBoundingClientRect();
      ctx.save();
      ctx.beginPath();
      ctx.rect((marco.left - base.left) * k, (marco.top - base.top) * k, marco.width * k, marco.height * k);
      ctx.clip();
      const fit = getComputedStyle(img).objectFit;
      let dx = r.left - base.left;
      let dy = r.top - base.top;
      let dw = r.width;
      let dh = r.height;
      if (fit === "cover" && limpia.naturalWidth > 0) {
        const s = Math.max(r.width / limpia.naturalWidth, r.height / limpia.naturalHeight);
        const w = limpia.naturalWidth * s;
        const h = limpia.naturalHeight * s;
        dx += (r.width - w) / 2;
        dy += (r.height - h) / 2;
        dw = w;
        dh = h;
      }
      ctx.drawImage(limpia, dx * k, dy * k, dw * k, dh * k);
      ctx.restore();
    } catch {
      fallidas++;
    }
  }
  if (!esLegible(c)) throw new Error("canvas contaminado");
  return { canvas: c, fallidas };
}

/** Papel liso del tamaño pedido: lo último que queda si nada se pudo dibujar. */
export function paginaEnBlanco(salidaW: number, salidaH: number): HTMLCanvasElement {
  const c = lienzo(salidaW, salidaH);
  const ctx = c.getContext("2d")!;
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, salidaW, salidaH);
  return c;
}

/**
 * Dibuja `el` (de `ancho`×`alto` px, sin escalar) en un canvas de `salidaW`×`salidaH`.
 * Prueba el camino completo y, si falla, el plan B. Si los dos fallan, lanza el error.
 */
export async function rasterizarPagina(
  el: HTMLElement,
  ancho: number,
  alto: number,
  salidaW: number,
  salidaH: number,
): Promise<PaginaRasterizada> {
  try {
    const { canvas, fallidas } = await porForeignObject(el, ancho, alto, salidaW, salidaH);
    return { canvas, imagenesFallidas: fallidas, simplificada: false };
  } catch {
    const { canvas, fallidas } = await porDibujoSimple(el, ancho, salidaW, salidaH);
    return { canvas, imagenesFallidas: fallidas, simplificada: true };
  }
}
