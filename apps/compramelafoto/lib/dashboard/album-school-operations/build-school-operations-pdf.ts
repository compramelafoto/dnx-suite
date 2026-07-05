import { PDFDocument, StandardFonts, rgb } from "pdf-lib";
import type { PDFPage } from "pdf-lib";
import type { SchoolOperationOrderRow } from "./school-operations-query";

const PAGE_W = 842;
const PAGE_H = 595;
const M = 36;
/** Ancho útil (A4 apaisado menos márgenes). */
const USABLE_W = PAGE_W - 2 * M;
const LINE_H = 10;
const FONT_MAIN = 6.5;
const FONT_HEAD = 6.5;
const MIN_ROW_BASE = 12;

/** Anchos en pt; deben sumar `USABLE_W`. */
/** Suma = USABLE_W (770 con márgenes 36). */
const COL_W = [50, 50, 30, 30, 38, 24, 100, 108, 42, 24, 238, 36] as const;
const COL_COUNT = COL_W.length;

/** Caracteres por columna (Helvetica ~6.5pt; evita solapamiento). */
const MAX_CH: number[] = COL_W.map((w) => Math.max(3, Math.floor((w - 6) / 3.4)));

const HEADERS = [
  "Apellido",
  "Nombre",
  "Nivel",
  "Turno",
  "Curso",
  "Div.",
  "Comprador",
  "Resumen compra",
  "Total ARS",
  "Fotos",
  "Observaciones",
  "Verif.",
] as const;

function assertColSum() {
  const s = COL_W.reduce((a, b) => a + b, 0);
  if (Math.abs(s - USABLE_W) > 0.01) {
    throw new Error(`build-school-operations-pdf: COL_W sum ${s} !== USABLE_W ${USABLE_W}`);
  }
}

function trunc(s: string | null | undefined, max: number): string {
  const t = (s ?? "").replace(/\s+/g, " ").trim();
  if (!t) return "—";
  return t.length <= max ? t : `${t.slice(0, max - 1)}…`;
}

function splitLongLine(text: string, maxChars: number): string[] {
  const t = text.trim();
  if (!t) return [""];
  if (t.length <= maxChars) return [t];
  const words = t.split(/\s+/);
  const lines: string[] = [];
  let cur = "";
  for (const w of words) {
    const next = cur ? `${cur} ${w}` : w;
    if (next.length <= maxChars) {
      cur = next;
    } else {
      if (cur) lines.push(cur);
      cur = w.length > maxChars ? `${w.slice(0, maxChars - 1)}…` : w;
    }
  }
  if (cur) lines.push(cur);
  return lines;
}

function colStart(i: number): number {
  let x = M;
  for (let k = 0; k < i; k++) x += COL_W[k]!;
  return x;
}

/** Casilla para tachar a mano; si `photosDone`, marca verificada en el sistema. */
function drawVerificationBox(
  page: PDFPage,
  colIndex: number,
  baselineY: number,
  photosDone: boolean
) {
  const xCol = colStart(colIndex);
  const colW = COL_W[colIndex]!;
  const size = Math.min(11, colW - 4);
  const x = xCol + (colW - size) / 2;
  const yBottom = baselineY - 8;

  page.drawRectangle({
    x,
    y: yBottom,
    width: size,
    height: size,
    borderColor: rgb(0.42, 0.42, 0.42),
    borderWidth: 0.55,
  });

  if (photosDone) {
    const green = rgb(0.12, 0.55, 0.28);
    const p = 2.2;
    page.drawLine({
      start: { x: x + p, y: yBottom + size * 0.5 },
      end: { x: x + size * 0.38, y: yBottom + p },
      thickness: 1.15,
      color: green,
    });
    page.drawLine({
      start: { x: x + size * 0.34, y: yBottom + p + 0.5 },
      end: { x: x + size - p, y: yBottom + size - p },
      thickness: 1.15,
      color: green,
    });
  }
}

export async function buildSchoolOperationsPdfBytes(args: {
  albumTitle: string;
  generatedAt: Date;
  filterDescription: string;
  orders: SchoolOperationOrderRow[];
}): Promise<Uint8Array> {
  assertColSum();
  const { albumTitle, generatedAt, filterDescription, orders } = args;
  const pdfDoc = await PDFDocument.create();
  const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const fontBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);

  let page = pdfDoc.addPage([PAGE_W, PAGE_H]);
  let y = PAGE_H - M;

  page.drawText("Operativo escolar", {
    x: M,
    y,
    size: 14,
    font: fontBold,
    color: rgb(0.1, 0.1, 0.1),
  });
  y -= 20;

  page.drawText(`Álbum: ${trunc(albumTitle, 95)}`, { x: M, y, size: 9, font });
  y -= 14;
  page.drawText(
    `Generado: ${generatedAt.toLocaleString("es-AR", { dateStyle: "short", timeStyle: "short" })}`,
    { x: M, y, size: 8, font, color: rgb(0.35, 0.35, 0.35) }
  );
  y -= 12;
  for (const ln of splitLongLine(filterDescription, 105)) {
    page.drawText(ln, { x: M, y, size: 8, font, color: rgb(0.2, 0.35, 0.55) });
    y -= 11;
  }
  y -= 8;

  function drawTableHeaderRow() {
    let x = M;
    for (let i = 0; i < HEADERS.length; i++) {
      page.drawText(HEADERS[i]!, {
        x,
        y,
        size: FONT_HEAD,
        font: fontBold,
        color: rgb(0.15, 0.15, 0.15),
      });
      x += COL_W[i]!;
    }
    y -= MIN_ROW_BASE;
    page.drawLine({
      start: { x: M, y: y + 4 },
      end: { x: PAGE_W - M, y: y + 4 },
      thickness: 0.5,
      color: rgb(0.75, 0.75, 0.75),
    });
    y -= 6;
  }

  function newPageTable() {
    page = pdfDoc.addPage([PAGE_W, PAGE_H]);
    y = PAGE_H - M;
    drawTableHeaderRow();
  }

  function needVerticalSpace(h: number) {
    if (y < M + h + 16) {
      newPageTable();
    }
  }

  drawTableHeaderRow();

  if (orders.length === 0) {
    page.drawText("No hay pedidos para exportar con los filtros actuales.", {
      x: M,
      y,
      size: 9,
      font,
      color: rgb(0.45, 0.45, 0.45),
    });
    return pdfDoc.save();
  }

  for (const o of orders) {
    const comprText = o.buyerName
      ? `${o.buyerName} (${o.buyerEmail})`
      : o.buyerEmail || "—";
    const totalStr = (o.totalCents / 100).toLocaleString("es-AR", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });
    const fotos = o.photosTakenAt ? "Sí" : "No";

    const rawCells: string[] = [
      o.studentLastName ?? "",
      o.studentFirstName ?? "",
      o.level ?? "",
      o.shift ?? "",
      o.courseName ?? "",
      o.division ?? "",
      comprText,
      o.packSummary ?? "",
      totalStr,
      fotos,
      o.studentNotes ?? "",
    ];

    const lineGroups = rawCells.map((cell, i) =>
      splitLongLine(trunc(cell, MAX_CH[i]! * 3), MAX_CH[i]!)
    );
    const maxLines = Math.min(6, Math.max(1, ...lineGroups.map((g) => g.length)));

    const rowHeight = LINE_H * maxLines + 4;
    needVerticalSpace(rowHeight);

    const topBaseline = y;
    for (let lineIdx = 0; lineIdx < maxLines; lineIdx++) {
      const lineY = topBaseline - lineIdx * LINE_H;
      let x = M;
      for (let i = 0; i < COL_COUNT - 1; i++) {
        const line = lineGroups[i]![lineIdx] ?? "";
        if (line) {
          page.drawText(line, {
            x,
            y: lineY,
            size: FONT_MAIN,
            font,
            color: rgb(0.12, 0.12, 0.12),
          });
        }
        x += COL_W[i]!;
      }
    }

    drawVerificationBox(page, COL_COUNT - 1, topBaseline, Boolean(o.photosTakenAt));

    y -= rowHeight;
  }

  return pdfDoc.save();
}
