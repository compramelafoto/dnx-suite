import "server-only";
import sharp from "sharp";
import { socialLayout, socialTexts, type SocialActivity, type SocialFormat, type SocialVariant } from "@repo/muestras";
import { MAX_PIXELES } from "@/lib/imagenes/procesar";
import { leerBytesDeR2 } from "@/lib/imagenes/r2";
import { qrSvg } from "./qr";
import { capaDeTexto, tituloQueEntra } from "./texto";

/** Colores del sitio (`globals.css`): tinta, superficie, fondo para obras, amarillo de los spots. */
const TINTA = "#1c2b35", SUPERFICIE = "#f2f3f4", OSCURO = "#11181d", SPOT = "#e0a526", CLARO = "#d5dade";

export type MuestraParaRedes = SocialActivity & { slug: string; coverImageUrl: string | null };
export type ObraParaRedes = { title: string; authorName: string; year: number | null; imageUrl: string };

type Caja = { width: number; height: number };

/** La foto lista para pegar en su caja, o `null` si no está o no se puede leer (la pieza sale igual). */
async function fotoEnSuCaja(url: string | null, caja: Caja, padding: number, entera: boolean): Promise<sharp.OverlayOptions | null> {
  if (!url) return null;
  const bytes = await leerBytesDeR2(url);
  if (!bytes) return null;
  try {
    const foto = await sharp(bytes, { limitInputPixels: MAX_PIXELES })
      .rotate()
      .resize(
        entera
          // Una obra nunca se recorta (D28, regla D3 de la etapa 4).
          ? { width: caja.width - 2 * padding, height: caja.height - 2 * padding, fit: "inside", withoutEnlargement: false }
          : { width: caja.width, height: caja.height, fit: "cover", position: sharp.strategy.attention },
      )
      .flatten({ background: OSCURO })
      .toColourspace("srgb")
      .png()
      .toBuffer({ resolveWithObject: true });
    return {
      input: foto.data,
      left: Math.round((caja.width - foto.info.width) / 2),
      top: Math.round((caja.height - foto.info.height) / 2),
    };
  } catch (err) {
    console.error("[redes] foto ilegible:", err instanceof Error ? err.message : String(err));
    return null;
  }
}

/**
 * Una pieza para redes (D24–D28): foto arriba, banda de tinta abajo con el texto en blanco y el
 * antetítulo en amarillo; en la invitación, el QR a la página de la inauguración. JPEG sRGB sin
 * metadatos. Si alguna capa de texto no se dibuja, error: nunca una pieza sin texto.
 */
export async function armarPiezaRedes(p: {
  muestra: MuestraParaRedes;
  obra: ObraParaRedes | null;
  formato: SocialFormat;
  variante: SocialVariant;
  urlInvitacion: string;
}): Promise<Buffer> {
  const l = socialLayout(p.formato, p.variante);
  const t = socialTexts(p.variante, p.muestra, p.obra);
  const capas: sharp.OverlayOptions[] = [];

  // 1. Foto: la obra entera sobre fondo oscuro, o la portada llenando su caja.
  const esObra = p.variante === "WORK";
  const foto = await fotoEnSuCaja(esObra ? p.obra?.imageUrl ?? null : p.muestra.coverImageUrl, l.photo, l.padding, esObra);
  if (foto) capas.push(foto);
  else if (esObra) capas.push({ input: { create: { width: l.photo.width, height: l.photo.height, channels: 3, background: SUPERFICIE } }, left: 0, top: 0 });

  // 2. Banda de tinta.
  capas.push({ input: { create: { width: l.band.width, height: l.band.height, channels: 3, background: TINTA } }, left: 0, top: l.band.y });

  // 3. Textos: antetítulo arriba, pie abajo; los datos se arman antes que el título para saber
  //    cuánto alto le queda a este.
  let y = l.textTop;
  const kicker = await capaDeTexto({ texto: t.kicker.toUpperCase(), tamano: l.kickerSize, peso: "negrita", color: SPOT, ancho: l.textWidth });
  capas.push({ input: kicker.input, left: l.textLeft, top: y });
  y += kicker.height + l.gap;

  const pie = await capaDeTexto({ texto: t.footer, tamano: l.footerSize, peso: "normal", color: CLARO, ancho: l.textWidth });
  const pieTop = l.textBottom - pie.height;

  const tituloMinimo = Math.round(l.titleSizes.at(-1)! * 1.3);
  const armarDatos = (lineas: string[]) =>
    capaDeTexto({ texto: lineas.join("\n"), tamano: l.detailSize, peso: "normal", color: "#ffffff", ancho: l.textWidth, interlineado: 1.3 });
  let datos = await armarDatos(t.details);
  if (pieTop - l.gap - datos.height - l.gap - y < tituloMinimo && t.details.length > 2) datos = await armarDatos(t.details.slice(0, 2));
  const altoTitulo = pieTop - l.gap - datos.height - l.gap - y;

  const titulo = await tituloQueEntra(t.title, l.titleSizes, l.textWidth, Math.max(altoTitulo, tituloMinimo), "#ffffff");
  capas.push({ input: titulo.capa.input, left: l.textLeft, top: y });
  y += titulo.capa.height + l.gap;
  capas.push({ input: datos.input, left: l.textLeft, top: Math.min(y, pieTop - l.gap - datos.height) });
  capas.push({ input: pie.input, left: l.textLeft, top: pieTop });

  if (l.qr) capas.push({ input: qrSvg(p.urlInvitacion, l.qr.width), left: l.qr.x, top: l.qr.y });

  return sharp({ create: { width: l.width, height: l.height, channels: 3, background: esObra ? OSCURO : SUPERFICIE } })
    .composite(capas)
    .jpeg({ quality: 90, chromaSubsampling: "4:4:4" })
    .toBuffer();
}
