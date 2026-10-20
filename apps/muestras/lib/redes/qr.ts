import "server-only";
import { matrizDelQr } from "@/lib/fichas/qr";
import { tramosOscuros } from "@/lib/piezas/dibujo";

/** QR en SVG con rectángulos (librsvg los dibuja sin fuentes) y margen blanco de 4 módulos. */
export function qrSvg(url: string, lado: number): Buffer {
  const m = matrizDelQr(url);
  const total = m.length + 8;
  const rects = tramosOscuros(m)
    .map((t) => `<rect x="${t.col + 4}" y="${t.fila + 4}" width="${t.largo}" height="1"/>`)
    .join("");
  return Buffer.from(
    `<svg xmlns="http://www.w3.org/2000/svg" width="${lado}" height="${lado}" viewBox="0 0 ${total} ${total}" shape-rendering="crispEdges">` +
      `<rect width="${total}" height="${total}" fill="#fff"/><g fill="#000">${rects}</g></svg>`,
  );
}
