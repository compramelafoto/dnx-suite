import { NextResponse } from "next/server";
import type { PDFImage, PDFPage, PDFFont } from "pdf-lib";
import { PDFDocument, StandardFonts, rgb } from "pdf-lib";
import QRCode from "qrcode";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/auth";
import { Role } from "@/lib/prisma";
import { ensureFulfillmentQrTokenForPreCompraOrderItem } from "@/lib/school-fulfillment/ensure-fulfillment-qr-token";
import { baseAppUrl, urlDeEntregaEscolar } from "@/lib/school-fulfillment/entrega-url";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const A4_W = 595.28;
const A4_H = 841.89;

/** Grid 2 columnas × 3 filas = 6 etiquetas por hoja */
const COLS = 2;
const ROWS = 3;
const PER_PAGE = COLS * ROWS;
const CELL_W = A4_W / COLS;
const CELL_H = A4_H / ROWS;

const PAD = 14;
const QR_MARGIN_BOTTOM = 12;
const BORDER_COLOR = rgb(0.82, 0.82, 0.82);
const REF_COLOR = rgb(0.42, 0.42, 0.42);
const GUIDE_COLOR = rgb(0.88, 0.88, 0.88);

function referenciaLegible(token: string): string {
  if (token.length <= 10) return token;
  return `${token.slice(0, 4)}…${token.slice(-4)}`;
}

function fitWidth(text: string, maxW: number, font: PDFFont, size: number): string {
  if (font.widthOfTextAtSize(text, size) <= maxW) return text;
  let s = text;
  const ell = "…";
  while (s.length > 0 && font.widthOfTextAtSize(s + ell, size) > maxW) {
    s = s.slice(0, -1);
  }
  return s ? s + ell : ell;
}

async function loadOptionalLogo(): Promise<PDFImage | null> {
  // Evita lectura de disco en runtime serverless para que Vercel no tracee el
  // árbol completo de "public" dentro de esta función.
  return null;
}

function drawPageCutGuides(page: PDFPage) {
  for (let c = 1; c < COLS; c++) {
    const x = c * CELL_W;
    page.drawLine({
      start: { x, y: 0 },
      end: { x, y: A4_H },
      thickness: 0.35,
      color: GUIDE_COLOR,
    });
  }
  for (let r = 1; r < ROWS; r++) {
    const y = A4_H - r * CELL_H;
    page.drawLine({
      start: { x: 0, y },
      end: { x: A4_W, y },
      thickness: 0.35,
      color: GUIDE_COLOR,
    });
  }
}

function drawLabelInCell(
  page: PDFPage,
  x0: number,
  y0: number,
  cellW: number,
  cellH: number,
  opts: {
    alumno: string;
    cliente: string;
    curso: string;
    escuela: string;
    refLine: string;
    qrImage: PDFImage;
    logoImage: PDFImage | null;
    font: PDFFont;
    fontBold: PDFFont;
  }
) {
  const { alumno, cliente, curso, escuela, refLine, qrImage, logoImage, font, fontBold } = opts;
  const cellTop = y0 + cellH;
  const innerX = x0 + PAD;
  const innerY = y0 + PAD;
  const innerW = cellW - PAD * 2;
  const innerTop = cellTop - PAD;

  page.drawRectangle({
    x: x0 + 0.7,
    y: y0 + 0.7,
    width: cellW - 1.4,
    height: cellH - 1.4,
    borderWidth: 0.7,
    borderColor: BORDER_COLOR,
  });

  const headerH = 18;
  const qrSize = Math.min(84, Math.floor(innerW * 0.44));
  const qrX = x0 + (cellW - qrSize) / 2;
  const qrY = innerY + QR_MARGIN_BOTTOM;
  const refY = qrY + qrSize + 8;
  const textTopY = innerTop - headerH - 6;
  const textBottomY = refY + 16;
  const span = Math.max(52, textTopY - textBottomY);

  if (logoImage) {
    const desiredH = 11;
    const ratio = logoImage.width / logoImage.height;
    const logoW = Math.min(innerW * 0.35, desiredH * ratio);
    page.drawImage(logoImage, {
      x: innerX,
      y: innerTop - desiredH,
      width: logoW,
      height: desiredH,
    });
  }

  const headerRight = "Entrega escolar";
  const headerSize = 8;
  const hw = font.widthOfTextAtSize(headerRight, headerSize);
  page.drawText(headerRight, {
    x: innerX + innerW - hw,
    y: innerTop - 11,
    size: headerSize,
    font,
    color: REF_COLOR,
  });

  const alumnoY = textTopY;
  const clienteY = textTopY - span * 0.32;
  const cursoY = textTopY - span * 0.60;
  const escuelaY = textTopY - span * 0.80;

  const drawCentered = (rawText: string, y: number, size: number, usedFont: PDFFont, color?: ReturnType<typeof rgb>) => {
    const txt = fitWidth(rawText, innerW, usedFont, size);
    const w = usedFont.widthOfTextAtSize(txt, size);
    const x = x0 + (cellW - w) / 2;
    page.drawText(txt, { x, y, size, font: usedFont, color });
  };

  drawCentered(alumno, alumnoY, 14, fontBold);
  drawCentered(`Cliente: ${cliente}`, clienteY, 10, font);
  drawCentered(`Curso: ${curso}`, cursoY, 9, font);
  drawCentered(`Escuela: ${escuela}`, escuelaY, 9, font);
  drawCentered(`Ref: ${refLine}`, refY, 8, font, REF_COLOR);

  page.drawImage(qrImage, {
    x: qrX,
    y: qrY,
    width: qrSize,
    height: qrSize,
  });
}

type RouteCtx = { params: Promise<{ orderId: string }> };

export async function GET(_req: Request, context: RouteCtx) {
  const { error, user } = await requireAuth([Role.PHOTOGRAPHER, Role.LAB_PHOTOGRAPHER]);
  if (error || !user) {
    return NextResponse.json({ error: error || "No autorizado" }, { status: 401 });
  }

  const { orderId } = await Promise.resolve(context.params);
  const id = Number(orderId);
  if (!Number.isFinite(id) || id <= 0) {
    return NextResponse.json({ error: "ID de pedido inválido" }, { status: 400 });
  }

  const order = await prisma.preCompraOrder.findFirst({
    where: {
      id,
      album: { userId: user.id },
    },
    select: {
      id: true,
      buyerName: true,
      studentFirstName: true,
      studentLastName: true,
      schoolCourse: { select: { name: true, division: true } },
      album: {
        select: {
          school: { select: { name: true } },
        },
      },
      items: {
        select: {
          id: true,
          fulfillmentQrToken: true,
        },
      },
    },
  });

  if (!order) {
    return NextResponse.json({ error: "Pedido no encontrado" }, { status: 404 });
  }

  // Cada ítem tiene su código de entrega: si no lo tenía todavía, se le crea ahora (queda guardado).
  const itemsWithToken: { id: number; fulfillmentQrToken: string }[] = [];
  for (const it of order.items) {
    const token = it.fulfillmentQrToken?.length
      ? it.fulfillmentQrToken
      : (await ensureFulfillmentQrTokenForPreCompraOrderItem(prisma, it.id)).token;
    itemsWithToken.push({ id: it.id, fulfillmentQrToken: token });
  }

  if (itemsWithToken.length === 0) {
    return NextResponse.json({ error: "Este pedido no tiene productos para etiquetar." }, { status: 400 });
  }

  const alumno =
    [order.studentFirstName, order.studentLastName].filter(Boolean).join(" ").trim() || "—";
  const curso = order.schoolCourse
    ? `${order.schoolCourse.name}${order.schoolCourse.division ? ` ${order.schoolCourse.division}` : ""}`
    : "—";
  const escuela = order.album.school?.name?.trim() || "—";
  const cliente = order.buyerName?.trim() || "—";

  const pdfDoc = await PDFDocument.create();
  const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const fontBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
  const logoImage = await loadOptionalLogo();
  const baseUrl = baseAppUrl();

  let page = pdfDoc.addPage([A4_W, A4_H]);
  drawPageCutGuides(page);

  for (let i = 0; i < itemsWithToken.length; i++) {
    if (i > 0 && i % PER_PAGE === 0) {
      page = pdfDoc.addPage([A4_W, A4_H]);
      drawPageCutGuides(page);
    }

    const slot = i % PER_PAGE;
    const col = slot % COLS;
    const row = Math.floor(slot / COLS);
    const x0 = col * CELL_W;
    const y0 = A4_H - (row + 1) * CELL_H;

    const item = itemsWithToken[i];
    const token = item.fulfillmentQrToken;
    const qrUrl = urlDeEntregaEscolar(baseUrl, token);
    const pngBuffer = await QRCode.toBuffer(qrUrl, { type: "png", width: 240, margin: 1 });
    const qrImage = await pdfDoc.embedPng(pngBuffer);

    drawLabelInCell(page, x0, y0, CELL_W, CELL_H, {
      alumno,
      cliente,
      curso,
      escuela,
      refLine: referenciaLegible(token),
      qrImage,
      logoImage,
      font,
      fontBold,
    });
  }

  const bytes = await pdfDoc.save();
  const body = new ArrayBuffer(bytes.byteLength);
  new Uint8Array(body).set(bytes);
  const filename = `etiquetas-pedido-${order.id}.pdf`;

  return new NextResponse(body, {
    status: 200,
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="${filename}"`,
      "Cache-Control": "no-store",
    },
  });
}
