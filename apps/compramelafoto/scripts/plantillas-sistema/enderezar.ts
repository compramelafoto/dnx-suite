/**
 * Lámina de verificación de los libritos apaisados: cada cara girada como la endereza el visor
 * 3D del canje (`giroParaLeer`), así se revisa a ojo que se lean derechas.
 *
 * Por modelo: la tapa y la contratapa (una arriba de la otra) y el interior abierto, que se lee
 * como un calendario.
 */
import sharp from "sharp";
import { giroParaLeer, type BloqueParaLeer } from "../../components/canje-externo/librito-3d/modelo-librito";
import type { PlantillaSistema } from "./definiciones";
import { ANCHO } from "./lienzo";

type Apaisado = { p: PlantillaSistema; exterior: Buffer; interior: Buffer };

function bloquesParaLeer(p: PlantillaSistema): BloqueParaLeer[] {
  return p.bloques.map((b) => ({
    type: b.type,
    pageIndex: b.pageIndex,
    layout: { x: b.x, y: b.y, width: b.width, height: b.height, rotation: b.rotation, visible: b.visible },
  }));
}

async function cara(png: Buffer, mitad: "izquierda" | "derecha" | null, giro: number | null): Promise<Buffer> {
  let img = sharp(png);
  if (mitad) {
    const m = await sharp(png).metadata();
    const w = Math.floor(m.width! / 2);
    img = sharp(await img.extract({ left: mitad === "izquierda" ? 0 : m.width! - w, top: 0, width: w, height: m.height! }).toBuffer());
  }
  return img.rotate(giro ?? 0).png().toBuffer();
}

const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;");

export async function laminaEnderezada(modelos: Apaisado[], destino: string) {
  const anchoCara = 620;
  const altoCara = Math.round((anchoCara * 1771) / 2362);
  const altoInterior = altoCara * 2 + 20;
  const anchoInterior = Math.round((altoInterior * 2362) / 3543);
  const rotulo = 50;
  const gap = 30;
  const filaAlto = rotulo + altoInterior;
  const ancho = gap * 3 + anchoCara + anchoInterior;
  const compuestos: sharp.OverlayOptions[] = [];
  for (const [i, { p, exterior, interior }] of modelos.entries()) {
    const bloques = bloquesParaLeer(p);
    const y = gap + i * (filaAlto + gap);
    const giroTapa = giroParaLeer(bloques, { pageIndex: 0, mitad: "derecha", canvasW: ANCHO });
    const giroContra = giroParaLeer(bloques, { pageIndex: 0, mitad: "izquierda", canvasW: ANCHO });
    const giroInterior = giroParaLeer(bloques, { pageIndex: 1, mitad: null, canvasW: ANCHO });
    compuestos.push({
      input: Buffer.from(
        `<svg xmlns="http://www.w3.org/2000/svg" width="${ancho}" height="${rotulo}"><text x="${gap}" y="34" font-family="Helvetica, Arial, sans-serif" font-size="26" fill="#222">${esc(p.nombre)} — tapa, contratapa e interior enderezados (giros ${giroTapa}°, ${giroContra}°, ${giroInterior}°)</text></svg>`,
      ),
      left: 0,
      top: y,
    });
    const tapa = await sharp(await cara(exterior, "derecha", giroTapa)).resize(anchoCara, altoCara, { fit: "fill" }).toBuffer();
    const contra = await sharp(await cara(exterior, "izquierda", giroContra)).resize(anchoCara, altoCara, { fit: "fill" }).toBuffer();
    const inter = await sharp(await cara(interior, null, giroInterior)).resize(anchoInterior, altoInterior, { fit: "fill" }).toBuffer();
    compuestos.push({ input: tapa, left: gap, top: y + rotulo });
    compuestos.push({ input: contra, left: gap, top: y + rotulo + altoCara + 20 });
    compuestos.push({ input: inter, left: gap * 2 + anchoCara, top: y + rotulo });
    // El doblez del interior abierto, sólo en la lámina.
    compuestos.push({
      input: Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${anchoInterior}" height="2"><rect width="${anchoInterior}" height="2" fill="#ff0000" opacity="0.35"/></svg>`),
      left: gap * 2 + anchoCara,
      top: y + rotulo + Math.round(altoInterior / 2) - 1,
    });
  }
  await sharp({
    create: { width: ancho, height: gap + modelos.length * (filaAlto + gap), channels: 3, background: "#e9e9ee" },
  })
    .composite(compuestos)
    .jpeg({ quality: 85 })
    .toFile(destino);
}
