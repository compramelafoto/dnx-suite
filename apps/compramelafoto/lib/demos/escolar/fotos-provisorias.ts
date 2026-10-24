/**
 * Fotos provisorias de la demo escolar: tarjetas con nombre y curso, para que el álbum se vea
 * armado mientras no estén las fotos generadas con IA. No tienen caras: el análisis facial las
 * trata como fotos sin personas.
 */

import sharp from "sharp";

const PALETAS = ["#f3d9b1", "#cfe3f5", "#d8eccd", "#f5d0d6", "#e3d6f3", "#f7e7a8"];

function escapar(t: string): string {
  return t.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

function silueta(cx: number, cy: number, r: number, color: string): string {
  return `<circle cx="${cx}" cy="${cy}" r="${r}" fill="${color}"/>
<path d="M ${cx - r * 1.9} ${cy + r * 3.4} Q ${cx - r * 1.8} ${cy + r * 1.3} ${cx} ${cy + r * 1.25} Q ${cx + r * 1.8} ${cy + r * 1.3} ${cx + r * 1.9} ${cy + r * 3.4} Z" fill="${color}"/>`;
}

export async function generarFotoProvisoria(opts: {
  nombre: string;
  curso: string;
  tipo: "retrato" | "grupal";
  /** Para variar el color entre alumnos. */
  semilla?: number;
}): Promise<Buffer> {
  const fondo = PALETAS[(opts.semilla ?? 0) % PALETAS.length];
  const [w, h] = opts.tipo === "retrato" ? [1200, 1500] : [1800, 1200];
  let figuras = "";
  if (opts.tipo === "retrato") {
    figuras = silueta(w / 2, 560, 170, "#ffffffb0");
  } else {
    for (let fila = 0; fila < 3; fila += 1) {
      for (let col = 0; col < 7; col += 1) {
        figuras += silueta(220 + col * 230, 300 + fila * 230, 55, "#ffffffb0");
      }
    }
  }
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}">
<defs><linearGradient id="g" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${fondo}"/><stop offset="1" stop-color="#8fa3b8"/></linearGradient></defs>
<rect width="100%" height="100%" fill="url(#g)"/>
${figuras}
<text x="50%" y="${h - 210}" text-anchor="middle" font-family="Helvetica, Arial, sans-serif" font-size="${opts.tipo === "retrato" ? 78 : 70}" font-weight="700" fill="#1f2933">${escapar(opts.nombre)}</text>
<text x="50%" y="${h - 130}" text-anchor="middle" font-family="Helvetica, Arial, sans-serif" font-size="46" fill="#1f2933">${escapar(opts.curso)}</text>
<text x="50%" y="${h - 60}" text-anchor="middle" font-family="Helvetica, Arial, sans-serif" font-size="30" letter-spacing="6" fill="#1f2933aa">FOTO PROVISORIA · DEMO</text>
</svg>`;
  return sharp(Buffer.from(svg)).jpeg({ quality: 88 }).toBuffer();
}
