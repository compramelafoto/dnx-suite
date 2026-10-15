import { PDFDocument, PDFFont, PDFImage, PDFPage, StandardFonts, rgb } from "pdf-lib";
import { aBloques, type Bloque, type Segmento } from "./formato";
import { LEYENDA_FIRMA } from "./constantes";

/**
 * Arma el PDF sellado de un contrato (etapa 5). Módulo PURO: recibe datos y bytes, devuelve bytes. Sin
 * base de datos ni almacenamiento (eso vive en `pdf.ts`), así se prueba sin nada alrededor.
 *
 * - A4, tipografía estándar Helvetica (WinAnsi cubre los acentos y la eñe del español). Un carácter que la
 *   fuente no puede dibujar se reemplaza por "?" y se cuenta: la hoja de constancia lo avisa.
 * - Los bloques salen de `aBloques` (títulos, párrafos con negrita, tablas, salto de página real).
 * - Al final, las firmas (dibujo + nombre escrito + fecha) y la hoja de constancia con la evidencia.
 * - Pie de cada página: número de contrato y "Página n de m".
 */

export type FirmanteParaPdf = {
  orden: number;
  nombre: string;
  documento: string | null;
  email: string;
  nombreEscrito: string | null;
  /** PNG de la firma dibujada. */
  firmaPng: Uint8Array | null;
  firmadoEn: Date | null;
  verificadoEn: Date | null;
  ipHash: string | null;
  userAgent: string | null;
};

export type EntradaPdf = {
  organizacion: string;
  numero: string;
  nombre: string;
  version: number;
  texto: string;
  /** SHA-256 (hex) del texto de la versión. */
  huellaTexto: string;
  empresa: { nombre: string; firmaImagen: Uint8Array | null };
  firmantes: FirmanteParaPdf[];
  generadoEn: Date;
};

export type SalidaPdf = { bytes: Uint8Array; paginas: number; reemplazados: number };

const A4 = { w: 595.28, h: 841.89 };
const MARGEN_X = 57;
const MARGEN_SUP = 62;
const MARGEN_INF = 74;
const ANCHO = A4.w - MARGEN_X * 2;
const TAM = 10.5;
const INTERLINEA = 15;
const GRIS = rgb(0.4, 0.4, 0.4);
const NEGRO = rgb(0.07, 0.07, 0.07);
const ZONA = "America/Argentina/Buenos_Aires";

// --- Utilidades puras ------------------------------------------------------------------------

/** Fecha y hora de Argentina: "09/10/2026 15:30". */
export function fechaHoraAR(d: Date): string {
  const p = Object.fromEntries(
    new Intl.DateTimeFormat("es-AR", { timeZone: ZONA, day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit", hourCycle: "h23" })
      .formatToParts(d)
      .map((x) => [x.type, x.value]),
  );
  return `${p.day}/${p.month}/${p.year} ${p.hour}:${p.minute}`;
}

/** "daniel@gmail.com" → "d***@gmail.com". */
export function enmascararCorreo(correo: string): string {
  const i = correo.lastIndexOf("@");
  if (i < 1) return "***";
  return `${correo.slice(0, 1)}***${correo.slice(i)}`;
}

/** Navegador recortado para la constancia (una línea). */
export function navegadorResumido(ua: string | null): string {
  const t = (ua ?? "").replace(/\s+/g, " ").trim();
  if (!t) return "no disponible";
  return t.length > 90 ? `${t.slice(0, 87)}...` : t;
}

/** Nombre de archivo seguro del PDF de un contrato. */
export function nombreArchivoPdf(numero: string): string {
  const limpio = numero.replace(/[^A-Za-z0-9_-]+/g, "-").replace(/^-+|-+$/g, "");
  return `contrato-${limpio || "firmado"}.pdf`;
}

type Medidor = { permitidos: Set<number>; reemplazados: number };

/** Deja sólo lo que Helvetica (WinAnsi) puede dibujar; lo demás pasa a "?" (y se cuenta). */
export function aWinAnsi(texto: string, m: { permitidos: Set<number>; reemplazados: number }): string {
  let salida = "";
  for (const ch of texto.normalize("NFC")) {
    const cp = ch.codePointAt(0)!;
    if (cp === 9) salida += " ";
    else if (cp === 10 || cp === 13) salida += "\n";
    else if (cp < 32 || cp === 127) continue;
    else if (m.permitidos.has(cp)) salida += ch;
    else {
      salida += "?";
      m.reemplazados++;
    }
  }
  return salida;
}

// --- Texto con negrita y cortes de línea ------------------------------------------------------

type Tramo = { t: string; negrita: boolean };

function tramosDe(segmentos: Segmento[], m: Medidor): Tramo[] {
  return segmentos.map((s) => ({ t: aWinAnsi(s.texto, m), negrita: s.negrita }));
}

/** Parte los tramos en líneas que entran en `ancho`. Respeta los saltos de línea del texto. */
function cortarLineas(tramos: Tramo[], ancho: number, tam: number, normal: PDFFont, negrita: PDFFont): Tramo[][] {
  const fuente = (b: boolean) => (b ? negrita : normal);
  const medir = (t: string, b: boolean) => fuente(b).widthOfTextAtSize(t, tam);
  const lineas: Tramo[][] = [];
  // Primero se separan los saltos duros.
  const duras: Tramo[][] = [[]];
  for (const tr of tramos) {
    const partes = tr.t.split("\n");
    partes.forEach((p, i) => {
      if (i > 0) duras.push([]);
      if (p) duras[duras.length - 1]!.push({ t: p, negrita: tr.negrita });
    });
  }
  for (const dura of duras) {
    let actual: Tramo[] = [];
    let w = 0;
    const cerrar = () => {
      // Sin espacios al final de la línea.
      while (actual.length > 0 && actual[actual.length - 1]!.t.trim() === "") actual.pop();
      const ult = actual[actual.length - 1];
      if (ult) ult.t = ult.t.replace(/\s+$/, "");
      lineas.push(actual);
      actual = [];
      w = 0;
    };
    const poner = (t: string, b: boolean, ancho_t: number) => {
      const ult = actual[actual.length - 1];
      if (ult && ult.negrita === b) ult.t += t;
      else actual.push({ t, negrita: b });
      w += ancho_t;
    };
    for (const tr of dura) {
      for (const palabra of tr.t.split(/(\s+)/)) {
        if (palabra === "") continue;
        const espacio = /^\s+$/.test(palabra);
        if (espacio && actual.length === 0) continue;
        const pw = medir(palabra, tr.negrita);
        if (w + pw <= ancho) {
          poner(palabra, tr.negrita, pw);
          continue;
        }
        if (espacio) {
          cerrar();
          continue;
        }
        if (actual.length > 0) cerrar();
        if (pw <= ancho) {
          poner(palabra, tr.negrita, pw);
          continue;
        }
        // Palabra más ancha que la línea (una huella, un enlace): se corta por caracteres.
        let trozo = "";
        for (const ch of palabra) {
          if (medir(trozo + ch, tr.negrita) > ancho && trozo) {
            poner(trozo, tr.negrita, medir(trozo, tr.negrita));
            cerrar();
            trozo = "";
          }
          trozo += ch;
        }
        if (trozo) poner(trozo, tr.negrita, medir(trozo, tr.negrita));
      }
    }
    cerrar();
  }
  return lineas.length > 0 ? lineas : [[]];
}

// --- Hoja -------------------------------------------------------------------------------------

class Hoja {
  pdf!: PDFDocument;
  normal!: PDFFont;
  negrita!: PDFFont;
  paginas: PDFPage[] = [];
  pagina!: PDFPage;
  y = 0;
  medidor: Medidor = { permitidos: new Set(), reemplazados: 0 };

  nueva(): void {
    this.pagina = this.pdf.addPage([A4.w, A4.h]);
    this.paginas.push(this.pagina);
    this.y = A4.h - MARGEN_SUP;
  }

  /** ¿La página actual todavía no tiene nada escrito? */
  get vacia(): boolean {
    return this.y >= A4.h - MARGEN_SUP - 0.5;
  }

  asegurar(alto: number): void {
    if (this.y - alto < MARGEN_INF) this.nueva();
  }

  limpio(t: string): string {
    return aWinAnsi(t, this.medidor);
  }

  /** Dibuja una línea de tramos a partir de x. */
  linea(tramos: Tramo[], x: number, tam: number, color = NEGRO): void {
    let cx = x;
    for (const tr of tramos) {
      if (!tr.t) continue;
      const f = tr.negrita ? this.negrita : this.normal;
      this.pagina.drawText(tr.t, { x: cx, y: this.y, size: tam, font: f, color });
      cx += f.widthOfTextAtSize(tr.t, tam);
    }
  }

  /** Párrafo de tramos (puede partirse entre páginas). */
  parrafo(tramos: Tramo[], tam = TAM, interlinea = INTERLINEA, color = NEGRO, x = MARGEN_X, ancho = ANCHO): void {
    for (const l of cortarLineas(tramos, ancho, tam, this.normal, this.negrita)) {
      this.asegurar(interlinea);
      this.y -= interlinea;
      this.linea(l, x, tam, color);
    }
  }

  texto(t: string, opciones: { negrita?: boolean; tam?: number; color?: ReturnType<typeof rgb>; despues?: number; x?: number; ancho?: number } = {}): void {
    const tam = opciones.tam ?? TAM;
    this.parrafo([{ t: this.limpio(t), negrita: opciones.negrita ?? false }], tam, Math.round(tam * 1.45), opciones.color ?? NEGRO, opciones.x ?? MARGEN_X, opciones.ancho ?? ANCHO);
    this.y -= opciones.despues ?? 0;
  }

  titulo(segmentos: Segmento[], nivel: 1 | 2): void {
    const tam = nivel === 1 ? 14 : 12;
    // Que un título no quede solo al pie de la página.
    this.asegurar(tam * 1.4 + 10 + INTERLINEA * 2);
    this.y -= nivel === 1 ? 10 : 6;
    const tramos = tramosDe(segmentos, this.medidor).map((t) => ({ ...t, negrita: true }));
    this.parrafo(tramos, tam, Math.round(tam * 1.4));
    this.y -= 2;
  }

  tabla(filas: string[][]): void {
    const tam = 9.5;
    const inter = 12.5;
    const pad = 4;
    const columnas = Math.max(1, ...filas.map((f) => f.length));
    const celdas = filas.map((f) => Array.from({ length: columnas }, (_, i) => this.limpio(f[i] ?? "")));
    const natural = Array.from({ length: columnas }, (_, c) =>
      Math.max(30, ...celdas.map((f, r) => (r === 0 ? this.negrita : this.normal).widthOfTextAtSize(f[c]!.replace(/\n/g, " "), tam) + pad * 2)),
    );
    const suma = natural.reduce((a, b) => a + b, 0);
    const anchos = natural.map((n) => (n / suma) * ANCHO);

    const dibujarFila = (fila: string[], encabezado: boolean) => {
      const lineasPorCelda = fila.map((c, i) => cortarLineas([{ t: c, negrita: encabezado }], anchos[i]! - pad * 2, tam, this.normal, this.negrita));
      const alto = Math.max(...lineasPorCelda.map((l) => l.length)) * inter + pad * 2;
      return { lineasPorCelda, alto };
    };
    const pintar = (fila: string[], encabezado: boolean) => {
      const { lineasPorCelda, alto } = dibujarFila(fila, encabezado);
      if (this.y - alto < MARGEN_INF) {
        this.nueva();
        if (!encabezado) pintar(celdas[0]!, true);
      }
      const arriba = this.y;
      let x = MARGEN_X;
      lineasPorCelda.forEach((lineas, i) => {
        this.pagina.drawRectangle({
          x, y: arriba - alto, width: anchos[i]!, height: alto, borderWidth: 0.6, borderColor: rgb(0.6, 0.6, 0.6),
          ...(encabezado ? { color: rgb(0.92, 0.92, 0.92) } : {}),
        });
        let ly = arriba - pad;
        for (const l of lineas) {
          ly -= inter;
          let cx = x + pad;
          for (const tr of l) {
            const f = tr.negrita ? this.negrita : this.normal;
            this.pagina.drawText(tr.t, { x: cx, y: ly + 3, size: tam, font: f, color: NEGRO });
            cx += f.widthOfTextAtSize(tr.t, tam);
          }
        }
        x += anchos[i]!;
      });
      this.y = arriba - alto;
    };
    this.y -= 4;
    celdas.forEach((f, i) => pintar(f, i === 0));
    this.y -= 6;
  }

  bloque(b: Bloque): void {
    if (b.tipo === "titulo") this.titulo(b.segmentos, b.nivel);
    else if (b.tipo === "parrafo") {
      this.parrafo(tramosDe(b.segmentos, this.medidor));
      this.y -= 7;
    } else if (b.tipo === "salto") {
      if (!this.vacia) this.nueva();
    } else this.tabla(b.filas);
  }

  async imagen(png: Uint8Array | null, x: number, maxW: number, maxH: number): Promise<{ alto: number } | null> {
    if (!png) return null;
    let img: PDFImage;
    try {
      img = await this.pdf.embedPng(png);
    } catch {
      return null;
    }
    const esc = Math.min(maxW / img.width, maxH / img.height, 1);
    const w = img.width * esc;
    const h = img.height * esc;
    this.pagina.drawImage(img, { x, y: this.y - h, width: w, height: h });
    return { alto: h };
  }
}

// --- Documento --------------------------------------------------------------------------------

export async function construirPdf(e: EntradaPdf): Promise<SalidaPdf> {
  const h = new Hoja();
  h.pdf = await PDFDocument.create();
  h.normal = await h.pdf.embedFont(StandardFonts.Helvetica);
  h.negrita = await h.pdf.embedFont(StandardFonts.HelveticaBold);
  h.medidor.permitidos = new Set(h.normal.getCharacterSet());
  h.pdf.setTitle(`Contrato ${h.limpio(e.numero)}`);
  h.pdf.setProducer("FOTOFFICE");
  h.pdf.setCreator("FOTOFFICE");
  h.pdf.setCreationDate(e.generadoEn);
  h.pdf.setModificationDate(e.generadoEn);
  h.nueva();

  // Encabezado.
  h.texto(e.organizacion, { negrita: true, tam: 10, color: GRIS });
  h.texto(`Contrato ${e.numero}`, { negrita: true, tam: 18, despues: 2 });
  if (e.nombre.trim() && e.nombre.trim() !== `Contrato ${e.numero}`) h.texto(e.nombre, { tam: 10.5, color: GRIS });
  h.y -= 8;

  for (const b of aBloques(e.texto)) h.bloque(b);

  // Firmas.
  h.asegurar(190);
  h.y -= 12;
  h.texto("Firmas", { negrita: true, tam: 13, despues: 4 });
  for (const f of e.firmantes) {
    h.asegurar(130);
    h.y -= 4;
    const dibujo = await h.imagen(f.firmaPng, MARGEN_X, 220, 75);
    if (dibujo) h.y -= dibujo.alto + 2;
    else h.texto("(la imagen de la firma no está disponible)", { tam: 9, color: GRIS });
    h.pagina.drawLine({ start: { x: MARGEN_X, y: h.y }, end: { x: MARGEN_X + 240, y: h.y }, thickness: 0.6, color: rgb(0.5, 0.5, 0.5) });
    h.texto(f.nombreEscrito?.trim() || f.nombre, { negrita: true });
    if (f.documento) h.texto(`Documento: ${f.documento}`, { tam: 9.5, color: GRIS });
    h.texto(f.firmadoEn ? `Firmó el ${fechaHoraAR(f.firmadoEn)} (hora de Argentina)` : "Sin firmar", { tam: 9.5, color: GRIS, despues: 8 });
  }
  // La empresa.
  h.asegurar(130);
  h.y -= 4;
  const firmaEmpresa = await h.imagen(e.empresa.firmaImagen, MARGEN_X, 220, 75);
  if (firmaEmpresa) h.y -= firmaEmpresa.alto + 2;
  else h.y -= 30;
  h.pagina.drawLine({ start: { x: MARGEN_X, y: h.y }, end: { x: MARGEN_X + 240, y: h.y }, thickness: 0.6, color: rgb(0.5, 0.5, 0.5) });
  h.texto(e.empresa.nombre, { negrita: true });
  h.texto("Por la empresa", { tam: 9.5, color: GRIS, despues: 8 });
  h.texto(LEYENDA_FIRMA, { tam: 9, color: GRIS });

  // Hoja de constancia (siempre página nueva).
  h.nueva();
  h.texto("Hoja de constancia", { negrita: true, tam: 16, despues: 6 });
  h.texto(`Contrato: ${e.numero}`, { negrita: true });
  h.texto(`Versión del texto firmada: ${e.version}`);
  h.texto("Huella SHA-256 del texto de esta versión:", { despues: 0 });
  h.texto(e.huellaTexto, { tam: 9, color: GRIS, despues: 10 });

  for (const f of e.firmantes) {
    h.asegurar(130);
    h.texto(`Firmante ${f.orden}: ${f.nombre}`, { negrita: true, despues: 1 });
    h.texto(`Correo verificado: ${enmascararCorreo(f.email)}`, { tam: 9.5 });
    h.texto(`Código enviado a ese correo y verificado el: ${f.verificadoEn ? `${fechaHoraAR(f.verificadoEn)} (hora de Argentina)` : "sin verificar"}`, { tam: 9.5 });
    h.texto(`Firmó el: ${f.firmadoEn ? `${fechaHoraAR(f.firmadoEn)} (hora de Argentina)` : "sin firmar"}`, { tam: 9.5 });
    h.texto(`Huella de la conexión (IP con hash): ${f.ipHash ? f.ipHash.slice(0, 12) : "no disponible"}`, { tam: 9.5 });
    h.texto(`Navegador: ${navegadorResumido(f.userAgent)}`, { tam: 9.5, despues: 10 });
  }

  h.asegurar(80);
  h.texto(LEYENDA_FIRMA, { negrita: true, tam: 10, despues: 6 });
  h.texto(`Constancia generada el ${fechaHoraAR(e.generadoEn)} (hora de Argentina).`, { tam: 9.5, color: GRIS });
  if (h.medidor.reemplazados > 0) {
    h.texto(
      `Aviso: ${h.medidor.reemplazados} carácter(es) del texto no se pueden dibujar con la tipografía estándar del PDF y se reemplazaron por "?". El texto original completo y su huella están guardados en el sistema.`,
      { tam: 9, color: GRIS },
    );
  }

  // Pie de todas las páginas.
  const reemplazados = h.medidor.reemplazados;
  const total = h.paginas.length;
  const numero = h.limpio(e.numero);
  h.paginas.forEach((p, i) => {
    p.drawLine({ start: { x: MARGEN_X, y: 52 }, end: { x: A4.w - MARGEN_X, y: 52 }, thickness: 0.5, color: rgb(0.75, 0.75, 0.75) });
    p.drawText(`Contrato ${numero}`, { x: MARGEN_X, y: 38, size: 8.5, font: h.normal, color: GRIS });
    const t = `Página ${i + 1} de ${total}`;
    p.drawText(t, { x: A4.w - MARGEN_X - h.normal.widthOfTextAtSize(t, 8.5), y: 38, size: 8.5, font: h.normal, color: GRIS });
  });

  return { bytes: await h.pdf.save(), paginas: total, reemplazados };
}
