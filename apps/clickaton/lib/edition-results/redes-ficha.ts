/**
 * Las dos imágenes de cada obra para el carrusel de Instagram.
 *
 * 1. La foto, a 1080 de ancho y dentro de las proporciones que Instagram
 *    acepta sin recortar (de 4:5 a 1,91:1). Si la foto se pasa, se completa
 *    con negro en vez de cortarla.
 * 2. La ficha del resultado: puesto, autor, código anónimo y nota, como la
 *    fila de la pantalla de Resultados que hasta ahora se capturaba a mano.
 *    Sale con el mismo tamaño que su foto: Instagram recorta todo el carrusel
 *    a la proporción de la primera imagen, y una captura vertical detrás de
 *    una foto horizontal perdía la nota.
 *
 * Las letras van convertidas en trazos: librsvg ignora una tipografía
 * incrustada con `@font-face` y en el servidor no hay ninguna instalada, así
 * que un `<text>` saldría vacío en producción.
 */
import { medirTexto, textoATrazos } from "@repo/design-studio";
import sharp from "sharp";

const ANCHO = 1080;
const PROPORCION_MINIMA = 4 / 5;
const PROPORCION_MAXIMA = 1.91;
const FONDO = "#111111";
const AMARILLO = "#ffc400";
const GRIS = "#9a9a9a";
const BLANCO = "#f5f5f5";

export type DatosDeFicha = {
  consigna: string;
  puesto: number;
  nombre: string;
  numero: string | null;
  instagram: string | null;
  codigo: string;
  nota: number | null;
  escala: number;
};

export type ImagenParaRedes = { jpeg: Buffer; ancho: number; alto: number };

/** Alto de la imagen para redes según la proporción de la foto original. */
export function altoParaRedes(ancho: number, alto: number): number {
  const proporcion = Math.min(PROPORCION_MAXIMA, Math.max(PROPORCION_MINIMA, ancho / alto));
  return Math.round(ANCHO / proporcion);
}

export async function fotoParaRedes(original: Buffer): Promise<ImagenParaRedes> {
  // `rotate()` sin argumentos endereza según el EXIF: las fotos de celular vienen acostadas.
  const derecha = await sharp(original).rotate().toBuffer({ resolveWithObject: true });
  const alto = altoParaRedes(derecha.info.width, derecha.info.height);
  const jpeg = await sharp(derecha.data)
    .resize(ANCHO, alto, { fit: "contain", background: FONDO })
    .flatten({ background: FONDO })
    .jpeg({ quality: 90, mozjpeg: true })
    .toBuffer();
  return { jpeg, ancho: ANCHO, alto };
}

export function formatearNota(nota: number | null): string {
  return nota == null ? "—" : nota.toLocaleString("es-AR", { maximumFractionDigits: 2 });
}

/*
 * El bloque de datos se diseña en un lienzo fijo de 560 × 600 y después se
 * escala para entrar donde haya lugar: a la derecha si la ficha es
 * horizontal, abajo si es vertical o cuadrada.
 */
const BLOQUE_ANCHO = 560;
const BLOQUE_ALTO = 600;

type Linea = {
  texto: string;
  y: number;
  tamano: number;
  color: string;
  negrita: boolean;
  espaciado?: number;
};

/** Dibuja una línea achicando la letra hasta que entre en el ancho del bloque. */
async function lineaEnTrazos(l: Linea): Promise<string> {
  const slot = l.negrita ? "bold" : "normal";
  let tamano = l.tamano;
  const ancho = await medirTexto({ texto: l.texto, fontId: "dmSans", slot, tamano, espaciado: l.espaciado });
  if (ancho > BLOQUE_ANCHO) tamano = Math.floor((tamano * BLOQUE_ANCHO) / ancho);
  const { svg } = await textoATrazos({
    texto: l.texto,
    fontId: "dmSans",
    slot,
    tamano,
    x: 0,
    y: l.y,
    color: l.color,
    espaciado: l.espaciado,
  });
  return svg;
}

async function bloqueDeDatos(d: DatosDeFicha): Promise<string> {
  const ig = d.instagram?.trim().replace(/^@+/, "");
  const sub = [d.numero ? `N.º ${d.numero}` : null, ig ? `@${ig}` : null]
    .filter(Boolean)
    .join(" · ");
  const etiqueta = (y: number, texto: string): Linea => ({
    texto,
    y,
    tamano: 20,
    color: GRIS,
    negrita: true,
    espaciado: 3.5,
  });

  const lineas: Linea[] = [
    {
      // El nombre de la edición es largo y quedaba ilegible: la marca alcanza.
      texto: `Clickatón · ${d.consigna}`.toLocaleUpperCase("es-AR"),
      y: 22,
      tamano: 22,
      color: AMARILLO,
      negrita: true,
      espaciado: 2,
    },
    etiqueta(104, "PUESTO"),
    { texto: String(d.puesto), y: 196, tamano: 96, color: AMARILLO, negrita: true },
    etiqueta(262, "PARTICIPANTE"),
    { texto: d.nombre, y: 314, tamano: 46, color: BLANCO, negrita: true },
    ...(sub ? [{ texto: sub, y: 354, tamano: 28, color: GRIS, negrita: false }] : []),
    etiqueta(420, "CÓDIGO"),
    { texto: d.codigo, y: 462, tamano: 34, color: BLANCO, negrita: false },
    etiqueta(528, `NOTA (DE ${d.escala})`),
    { texto: formatearNota(d.nota), y: 594, tamano: 64, color: BLANCO, negrita: true },
  ];
  const trazos = await Promise.all(lineas.map(lineaEnTrazos));
  return `<rect x="0" y="40" width="64" height="4" fill="${AMARILLO}"/>${trazos.join("")}`;
}

/** Arma la ficha del mismo tamaño que la foto ya preparada para redes. */
export async function fichaParaRedes(
  foto: ImagenParaRedes,
  datos: DatosDeFicha,
): Promise<ImagenParaRedes> {
  const { ancho: W, alto: H } = foto;
  const margen = Math.round(Math.min(W, H) * 0.08);
  const horizontal = W / H > 1.15;

  // Dónde va el bloque de datos y dónde la miniatura de la obra.
  let escala: number;
  let bx: number;
  let by: number;
  let miniatura: { x: number; y: number; w: number; h: number };
  if (horizontal) {
    const columna = Math.round((W - margen * 3) * 0.5);
    escala = Math.min(columna / BLOQUE_ANCHO, (H - margen * 2) / BLOQUE_ALTO);
    bx = margen * 2 + columna;
    by = Math.round((H - BLOQUE_ALTO * escala) / 2);
    miniatura = { x: margen, y: margen, w: columna, h: H - margen * 2 };
  } else {
    escala = Math.min((W - margen * 2) / BLOQUE_ANCHO, (H * 0.55) / BLOQUE_ALTO);
    bx = margen;
    by = H - margen - Math.round(BLOQUE_ALTO * escala);
    miniatura = { x: margen, y: margen, w: W - margen * 2, h: by - margen * 2 };
  }

  const svg = [
    `<svg width="${W}" height="${H}" xmlns="http://www.w3.org/2000/svg">`,
    `<rect x="0" y="0" width="${Math.max(6, Math.round(W * 0.008))}" height="${H}" fill="${AMARILLO}"/>`,
    `<g transform="translate(${bx} ${by}) scale(${escala.toFixed(4)})">${await bloqueDeDatos(datos)}</g>`,
    `</svg>`,
  ].join("");

  const capas: sharp.OverlayOptions[] = [{ input: Buffer.from(svg), top: 0, left: 0 }];
  if (miniatura.w > 40 && miniatura.h > 40) {
    const mini = await sharp(foto.jpeg)
      .resize(miniatura.w, miniatura.h, { fit: "inside" })
      .toBuffer({ resolveWithObject: true });
    capas.push({
      input: mini.data,
      left: miniatura.x + Math.round((miniatura.w - mini.info.width) / 2),
      top: miniatura.y + Math.round((miniatura.h - mini.info.height) / 2),
    });
  }

  const jpeg = await sharp({ create: { width: W, height: H, channels: 3, background: FONDO } })
    .composite(capas)
    .jpeg({ quality: 92, mozjpeg: true })
    .toBuffer();
  return { jpeg, ancho: W, alto: H };
}
