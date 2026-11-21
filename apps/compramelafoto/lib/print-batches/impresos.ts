import { PDFDocument, StandardFonts, rgb, type PDFFont, type PDFPage } from "pdf-lib";
import QRCode from "qrcode";
import { geometriaDeEtiqueta } from "@/lib/design-v2/produccion-reglas";
import { resumirCopias } from "./correos";
import { MARCA_RETIRA_CLIENTE, aNombreDe } from "./puerta-del-lab";

/**
 * PDFs del lote de impresión: sobres (A4, 3 × 8 como las etiquetas de la línea escolar), etiqueta
 * del lote y remito. Sin base de datos ni `server-only`, para poder probarlos; los datos los arma
 * `impresos-del-lote.ts`. Nunca llevan correo ni teléfono del cliente.
 */

export type SobreDePedido = {
  fotografo: string; cliente: string; album: string; pedido: number; contenido: string; lote: string;
  retiraCliente: boolean; laboratorio?: string; qrUrl: string;
};

/**
 * Los PDFs usan fuentes estándar (WinAnsi). Se conserva el Latin-1 imprimible (tildes, ñ, ü, «×», «·»,
 * que Helvetica sí codifica) y se saca lo demás (emojis, símbolos) para que no rompa el PDF.
 */
export const limpio = (s: string) => s.normalize("NFC").replace(/[^\x20-\x7E\xA0-\xFF]/g, "");

/** «3× 13x18 brillo · 2× 10x15»: junta medida + acabado, ordenado por medida; sin acabado se omite. */
export function textoDeContenido(copias: Array<{ medida: string; acabado: string; cantidad: number }>): string {
  return resumirCopias(copias).map((c) => `${c.cantidad}× ${c.medida}${c.acabado ? ` ${c.acabado}` : ""}`).join(" · ");
}

/** Las líneas de texto del sobre, de arriba hacia abajo (la primera es la grande). */
export function lineasDelSobre(s: SobreDePedido): string[] {
  const lineas = [aNombreDe(s.fotografo, s.cliente)];
  if (s.retiraCliente) {
    lineas.push(MARCA_RETIRA_CLIENTE);
    if (s.laboratorio?.trim()) lineas.push(s.laboratorio.trim());
  }
  lineas.push(`Pedido #${s.pedido} · ${s.lote}`);
  if (s.album.trim()) lineas.push(s.album.trim());
  if (s.contenido.trim()) lineas.push(s.contenido.trim());
  return lineas;
}

/** Achica la letra hasta que entre; si ni en 6 pt entra, corta con «...». */
function ajustar(texto: string, f: PDFFont, tam: number, max: number) {
  let size = tam;
  while (size > 6 && f.widthOfTextAtSize(texto, size) > max) size -= 0.5;
  let t = texto;
  if (f.widthOfTextAtSize(t, size) > max) {
    while (t.length > 0 && f.widthOfTextAtSize(`${t}...`, size) > max) t = t.slice(0, -1);
    t = `${t.trimEnd()}...`;
  }
  return { t, size };
}

const png = (url: string) => QRCode.toBuffer(url, { type: "png", width: 240, margin: 1 });

export async function pdfDeSobres(sobres: SobreDePedido[]): Promise<Uint8Array> {
  const doc = await PDFDocument.create();
  const font = await doc.embedFont(StandardFonts.Helvetica);
  const bold = await doc.embedFont(StandardFonts.HelveticaBold);
  const cols = 3;
  const filas = 8;
  const margen = 20;
  const ancho = (595 - margen * 2) / cols;
  const alto = (842 - margen * 2) / filas;
  for (const [i, s] of sobres.entries()) {
    const enHoja = i % (cols * filas);
    if (enHoja === 0) doc.addPage([595, 842]);
    const page = doc.getPages()[doc.getPageCount() - 1]!;
    const x = margen + (enHoja % cols) * ancho;
    const yTop = 842 - margen - Math.floor(enHoja / cols) * alto;
    const yBase = yTop - alto;
    const g = geometriaDeEtiqueta(ancho, alto, true);
    page.drawRectangle({ x: x + 3, y: yBase + 3, width: ancho - 6, height: alto - 6, borderColor: rgb(0.8, 0.8, 0.8), borderWidth: 0.5 });
    const [primera, ...resto] = lineasDelSobre(s).map(limpio);
    const dibujar = (texto: string, f: PDFFont, tam: number, y: number, color?: ReturnType<typeof rgb>) => {
      const a = ajustar(texto, f, tam, g.textoMax);
      page.drawText(a.t, { x: x + g.textoX, y, size: a.size, font: f, color });
    };
    dibujar(primera ?? "", bold, 12, yTop - 24);
    let y = yTop - 38;
    for (const l of resto) {
      if (y < yBase + 10) break;
      const marca = l === limpio(MARCA_RETIRA_CLIENTE);
      dibujar(l, marca ? bold : font, marca ? 8 : 8.5, y, marca ? rgb(0.75, 0.1, 0.1) : rgb(0.25, 0.25, 0.25));
      y -= 11;
    }
    if (g.qr) {
      const qr = await doc.embedPng(await png(s.qrUrl));
      page.drawImage(qr, { x: x + g.qr.x, y: yBase + g.qr.y, width: g.qr.lado, height: g.qr.lado });
    }
  }
  if (doc.getPageCount() === 0) doc.addPage([595, 842]);
  return doc.save();
}

/** Etiqueta del lote: una hoja A6 apaisada para pegar en la caja o bolsa. */
export async function pdfEtiquetaDeLote(l: {
  lote: string; fotografo: string; laboratorio: string; pedidos: number; copias: number; qrUrl: string; costoEstimado?: number;
}): Promise<Uint8Array> {
  const doc = await PDFDocument.create();
  const font = await doc.embedFont(StandardFonts.Helvetica);
  const bold = await doc.embedFont(StandardFonts.HelveticaBold);
  const W = 420;
  const H = 298;
  const page = doc.addPage([W, H]);
  const lado = 150;
  const textoMax = W - 40 - lado - 16;
  const linea = (texto: string, f: PDFFont, tam: number, y: number, color = rgb(0.1, 0.1, 0.1)) => {
    const a = ajustar(limpio(texto), f, tam, textoMax);
    page.drawText(a.t, { x: 20, y, size: a.size, font: f, color });
  };
  page.drawRectangle({ x: 8, y: 8, width: W - 16, height: H - 16, borderColor: rgb(0.7, 0.7, 0.7), borderWidth: 1 });
  linea(l.lote, bold, 30, H - 60);
  linea(l.fotografo, bold, 16, H - 92);
  linea(`Laboratorio: ${l.laboratorio}`, font, 12, H - 118, rgb(0.3, 0.3, 0.3));
  linea(`${l.pedidos} ${l.pedidos === 1 ? "pedido" : "pedidos"} · ${l.copias} ${l.copias === 1 ? "copia" : "copias"}`, font, 14, H - 148);
  if (l.costoEstimado != null) linea(`Costo estimado: $${Math.round(l.costoEstimado).toLocaleString("es-AR")}`, font, 12, H - 172, rgb(0.3, 0.3, 0.3));
  const qr = await doc.embedPng(await png(l.qrUrl));
  page.drawImage(qr, { x: W - 20 - lado, y: (H - lado) / 2, width: lado, height: lado });
  page.drawText("Escaneá para abrir el lote", { x: W - 20 - lado, y: (H - lado) / 2 - 14, size: 8, font, color: rgb(0.4, 0.4, 0.4) });
  return doc.save();
}

export type FilaDeRemito = { pedido: number; nombre: string; contenido: string; retiraCliente: boolean };
const FILAS_POR_PAGINA = 34;

/**
 * Remito del lote: una fila por pedido, con el nombre y el contenido. Si se pasa `noIncluidos`, al
 * final va la lista corta de lo que no entró (el remito de cada parte del ZIP).
 */
export async function pdfRemito(l: {
  lote: string; fotografo: string; laboratorio: string; filas: FilaDeRemito[]; noIncluidos?: string[];
}): Promise<Uint8Array> {
  const doc = await PDFDocument.create();
  const font = await doc.embedFont(StandardFonts.Helvetica);
  const bold = await doc.embedFont(StandardFonts.HelveticaBold);
  const total = Math.max(1, Math.ceil(l.filas.length / FILAS_POR_PAGINA));
  const texto = (page: PDFPage, t: string, x: number, y: number, f: PDFFont, size: number, max: number, color = rgb(0.1, 0.1, 0.1)) => {
    const a = ajustar(limpio(t), f, size, max);
    page.drawText(a.t, { x, y, size: a.size, font: f, color });
  };
  const encabezado = (page: PDFPage, n: number) => {
    texto(page, `Remito - ${l.lote}`, 40, 800, bold, 18, 515);
    texto(page, `${l.fotografo} - Laboratorio: ${l.laboratorio} - ${l.filas.length} ${l.filas.length === 1 ? "pedido" : "pedidos"}`, 40, 782, font, 10, 515, rgb(0.35, 0.35, 0.35));
    texto(page, `Hoja ${n} de ${total}`, 480, 818, font, 8, 80, rgb(0.5, 0.5, 0.5));
    page.drawLine({ start: { x: 40, y: 772 }, end: { x: 555, y: 772 }, thickness: 0.7, color: rgb(0.6, 0.6, 0.6) });
  };
  for (let n = 0; n < total; n++) {
    const page = doc.addPage([595, 842]);
    encabezado(page, n + 1);
    let y = 755;
    for (const f of l.filas.slice(n * FILAS_POR_PAGINA, (n + 1) * FILAS_POR_PAGINA)) {
      texto(page, `#${f.pedido}`, 40, y, bold, 9, 50);
      texto(page, f.nombre, 95, y, font, 9, 150);
      texto(page, f.retiraCliente ? `${f.contenido} - RETIRA EL CLIENTE` : f.contenido, 250, y, font, 9, 305);
      y -= 20;
    }
    if (n === total - 1 && l.noIncluidos?.length) {
      y -= 12;
      texto(page, "No incluidos", 40, y, bold, 11, 515);
      for (const t of l.noIncluidos.slice(0, 8)) {
        y -= 14;
        if (y < 30) break;
        texto(page, t, 40, y, font, 9, 515, rgb(0.5, 0.15, 0.15));
      }
    }
  }
  return doc.save();
}
