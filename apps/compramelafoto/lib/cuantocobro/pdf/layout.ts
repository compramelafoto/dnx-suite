import { rgb, type RGB } from "pdf-lib";
import { finalizePdfPages } from "./context";
import { resolvePdfLogo, scaleLogoToMaxBox, type ResolvePdfLogoOptions } from "./logo";
import { resolveLineHeight, wrapTextByWidth } from "./text";
import type {
  PdfDocumentContext,
  PdfDrawTextOptions,
  PdfDrawWrappedTextOptions,
  PdfLogoEmbedResult,
  PdfTextAlign,
} from "./types";

function pickFont(ctx: PdfDocumentContext, options: Pick<PdfDrawTextOptions, "bold" | "semibold">) {
  if (options.bold) return ctx.fonts.bold;
  if (options.semibold) return ctx.fonts.semibold;
  return ctx.fonts.regular;
}

function resolveX(ctx: PdfDocumentContext, text: string, fontSize: number, align: PdfTextAlign, font = ctx.fonts.regular): number {
  const textWidth = font.widthOfTextAtSize(text, fontSize);
  if (align === "center") return ctx.margin + (ctx.contentWidth - textWidth) / 2;
  if (align === "right") return ctx.width - ctx.margin - textWidth;
  return ctx.margin;
}

export function moveY(ctx: PdfDocumentContext, amount: number): void {
  ctx.cursorY -= amount;
}

export function addPage(ctx: PdfDocumentContext): void {
  ctx.pageNumber += 1;
  ctx.page = ctx.pdfDoc.addPage([ctx.width, ctx.height]);
  ctx.cursorY = ctx.height - ctx.margin;
}

export function ensureSpace(ctx: PdfDocumentContext, height: number, reservedBottom = 0): void {
  const bottomLimit = ctx.margin + reservedBottom;
  if (ctx.cursorY - height >= bottomLimit) return;
  addPage(ctx);
}

export function drawText(ctx: PdfDocumentContext, text: string, options: PdfDrawTextOptions = {}): number {
  const size = options.size ?? 10;
  const font = pickFont(ctx, options);
  const color = options.color ?? ctx.colors.textPrimary;
  const align = options.align ?? "left";
  const lineHeight = options.lineHeight ?? resolveLineHeight(size);

  ensureSpace(ctx, lineHeight);

  ctx.page.drawText(text, {
    x: resolveX(ctx, text, size, align, font),
    y: ctx.cursorY,
    size,
    font,
    color,
    maxWidth: ctx.contentWidth,
  });

  moveY(ctx, lineHeight);
  return lineHeight;
}

export function drawWrappedText(
  ctx: PdfDocumentContext,
  text: string,
  options: PdfDrawWrappedTextOptions = {},
): number {
  const size = options.size ?? 10;
  const font = pickFont(ctx, options);
  const maxWidth = options.maxWidth ?? ctx.contentWidth;
  const lineHeight = options.lineHeight ?? resolveLineHeight(size);
  const lines = wrapTextByWidth(text, font, size, maxWidth);

  let totalHeight = 0;
  for (const line of lines) {
    if (!line) {
      moveY(ctx, lineHeight * 0.75);
      totalHeight += lineHeight * 0.75;
      continue;
    }
    drawText(ctx, line, { ...options, size, lineHeight });
    totalHeight += lineHeight;
  }

  return totalHeight;
}

export function drawTitle(ctx: PdfDocumentContext, text: string, options: PdfDrawTextOptions = {}): number {
  return drawText(ctx, text, {
    size: 20,
    bold: true,
    color: ctx.colors.textPrimary,
    lineHeight: 24,
    ...options,
  });
}

export function drawSectionTitle(ctx: PdfDocumentContext, text: string, options: PdfDrawTextOptions = {}): number {
  moveY(ctx, 10);
  drawDivider(ctx, { spacingBefore: 0, spacingAfter: 4, color: ctx.colors.border });
  return drawText(ctx, text, {
    size: 12,
    bold: true,
    color: ctx.colors.textSecondary,
    lineHeight: 16,
    ...options,
  });
}

export function drawMetaText(
  ctx: PdfDocumentContext,
  label: string,
  value: string,
  options: PdfDrawTextOptions = {},
): number {
  return drawText(ctx, `${label}: ${value}`, {
    size: 10,
    color: ctx.colors.textSecondary,
    ...options,
  });
}

export type PdfDividerOptions = {
  thickness?: number;
  color?: RGB;
  spacingBefore?: number;
  spacingAfter?: number;
};

export function drawDivider(ctx: PdfDocumentContext, options: PdfDividerOptions = {}): void {
  const spacingBefore = options.spacingBefore ?? 0;
  const spacingAfter = options.spacingAfter ?? 6;
  const thickness = options.thickness ?? 0.5;

  moveY(ctx, spacingBefore);
  ensureSpace(ctx, spacingAfter + thickness);

  const y = ctx.cursorY + spacingAfter / 2;
  ctx.page.drawLine({
    start: { x: ctx.margin, y },
    end: { x: ctx.width - ctx.margin, y },
    thickness,
    color: options.color ?? ctx.colors.border,
  });

  moveY(ctx, spacingAfter);
}

export type PdfCardOptions = {
  padding?: number;
  height: number;
  backgroundColor?: RGB;
  borderColor?: RGB;
  borderWidth?: number;
  radius?: number;
};

/** Rectángulo con borde suave; `radius` reservado (pdf-lib no tiene border-radius nativo). */
export function drawCard(ctx: PdfDocumentContext, options: PdfCardOptions): { topY: number; innerWidth: number } {
  const padding = options.padding ?? 12;
  const borderWidth = options.borderWidth ?? 0.75;
  const totalHeight = options.height + padding * 2;

  ensureSpace(ctx, totalHeight);
  const topY = ctx.cursorY;
  const x = ctx.margin;
  const width = ctx.contentWidth;

  ctx.page.drawRectangle({
    x,
    y: topY - totalHeight,
    width,
    height: totalHeight,
    color: options.backgroundColor ?? ctx.colors.softBackground,
    borderColor: options.borderColor ?? ctx.colors.border,
    borderWidth,
  });

  moveY(ctx, totalHeight);
  return { topY: topY - padding, innerWidth: width - padding * 2 };
}

export function drawPill(
  ctx: PdfDocumentContext,
  text: string,
  options: PdfDrawTextOptions & { paddingX?: number; paddingY?: number } = {},
): number {
  const size = options.size ?? 9;
  const font = pickFont(ctx, options);
  const paddingX = options.paddingX ?? 8;
  const paddingY = options.paddingY ?? 4;
  const textWidth = font.widthOfTextAtSize(text, size);
  const pillWidth = textWidth + paddingX * 2;
  const pillHeight = size + paddingY * 2;

  ensureSpace(ctx, pillHeight + 4);
  const x = ctx.margin;
  const y = ctx.cursorY - pillHeight;

  ctx.page.drawRectangle({
    x,
    y,
    width: pillWidth,
    height: pillHeight,
    color: ctx.colors.softBackground,
    borderColor: ctx.colors.border,
    borderWidth: 0.5,
  });

  ctx.page.drawText(text, {
    x: x + paddingX,
    y: y + paddingY,
    size,
    font,
    color: options.color ?? ctx.colors.accent,
  });

  moveY(ctx, pillHeight + 6);
  return pillHeight + 6;
}

export type PdfCheckItemOptions = {
  title: string;
  description?: string;
  titleSize?: number;
  descriptionSize?: number;
};

function drawCheckMarkGlyph(ctx: PdfDocumentContext, centerX: number, centerY: number, size: number) {
  const arm = size * 0.38;
  ctx.page.drawLine({
    start: { x: centerX - arm, y: centerY },
    end: { x: centerX - arm * 0.15, y: centerY - arm * 0.85 },
    thickness: 1.1,
    color: ctx.colors.accent,
  });
  ctx.page.drawLine({
    start: { x: centerX - arm * 0.15, y: centerY - arm * 0.85 },
    end: { x: centerX + arm, y: centerY + arm * 0.55 },
    thickness: 1.1,
    color: ctx.colors.accent,
  });
}

export function drawCheckItem(ctx: PdfDocumentContext, options: PdfCheckItemOptions): number {
  const titleSize = options.titleSize ?? 12;
  const descriptionSize = options.descriptionSize ?? 10.5;
  const markerSize = PDF_CHECK_MARKER_SIZE;
  const gap = 12;
  const titleFont = ctx.fonts.bold;
  const bodyFont = ctx.fonts.regular;

  const titleLines = wrapTextByWidth(options.title, titleFont, titleSize, ctx.contentWidth - markerSize - gap);
  const descriptionLines = options.description
    ? wrapTextByWidth(options.description, bodyFont, descriptionSize, ctx.contentWidth - markerSize - gap)
    : [];

  const titleBlockHeight = titleLines.length * resolveLineHeight(titleSize);
  const descriptionBlockHeight = descriptionLines.length * resolveLineHeight(descriptionSize);
  const blockHeight = Math.max(markerSize + 2, titleBlockHeight + descriptionBlockHeight);

  ensureSpace(ctx, blockHeight + 14, PDF_FOOTER_RESERVE_PT);
  const topY = ctx.cursorY;
  const markerCenterX = ctx.margin + markerSize / 2 + 1;
  const markerCenterY = topY - markerSize / 2 - 1;

  ctx.page.drawCircle({
    x: markerCenterX,
    y: markerCenterY,
    size: markerSize / 2,
    color: ctx.colors.accent,
    opacity: 0.12,
    borderColor: ctx.colors.accent,
    borderWidth: 0.75,
  });

  drawCheckMarkGlyph(ctx, markerCenterX, markerCenterY, markerSize);

  let textY = topY;
  const textX = ctx.margin + markerSize + gap;

  for (const line of titleLines) {
    ctx.page.drawText(line, {
      x: textX,
      y: textY,
      size: titleSize,
      font: titleFont,
      color: ctx.colors.textPrimary,
    });
    textY -= resolveLineHeight(titleSize);
  }

  for (const line of descriptionLines) {
    ctx.page.drawText(line, {
      x: textX,
      y: textY,
      size: descriptionSize,
      font: bodyFont,
      color: ctx.colors.textMuted,
    });
    textY -= resolveLineHeight(descriptionSize);
  }

  moveY(ctx, blockHeight + 14);
  return blockHeight + 14;
}

export type PdfInvestmentHeroOptions = {
  label?: string;
  amountSize?: number;
  paddingTop?: number;
  paddingBottom?: number;
};

export function measureInvestmentHeroHeight(options: PdfInvestmentHeroOptions = {}): number {
  const paddingTop = options.paddingTop ?? 32;
  const paddingBottom = options.paddingBottom ?? 32;
  const labelGap = 14;
  const labelLineHeight = 14;
  const amountLineHeight = (options.amountSize ?? 36) + 10;
  return paddingTop + labelLineHeight + labelGap + amountLineHeight + paddingBottom;
}

/** Bloque de inversión centrado con espaciado fijo — evita solapamientos label/monto. */
export function drawInvestmentHero(
  ctx: PdfDocumentContext,
  amount: string,
  options: PdfInvestmentHeroOptions = {},
): number {
  const label = options.label ?? "Inversión estimada";
  const amountSize = options.amountSize ?? 36;
  const paddingTop = options.paddingTop ?? 32;
  const paddingBottom = options.paddingBottom ?? 32;
  const labelSize = 10;
  const labelLineHeight = 14;
  const amountLineHeight = amountSize + 10;
  const labelGap = 14;
  const blockHeight = paddingTop + labelLineHeight + labelGap + amountLineHeight + paddingBottom;

  ensureSpace(ctx, blockHeight, PDF_FOOTER_RESERVE_PT);

  const topY = ctx.cursorY;
  const centerX = ctx.margin + ctx.contentWidth / 2;

  const labelWidth = ctx.fonts.semibold.widthOfTextAtSize(label, labelSize);
  ctx.page.drawText(label, {
    x: centerX - labelWidth / 2,
    y: topY - paddingTop - labelSize,
    size: labelSize,
    font: ctx.fonts.semibold,
    color: ctx.colors.textMuted,
  });

  const amountY = topY - paddingTop - labelLineHeight - labelGap - amountSize;
  const amountWidth = ctx.fonts.bold.widthOfTextAtSize(amount, amountSize);
  ctx.page.drawText(amount, {
    x: centerX - amountWidth / 2,
    y: amountY,
    size: amountSize,
    font: ctx.fonts.bold,
    color: ctx.colors.accent,
  });

  moveY(ctx, blockHeight);
  return blockHeight;
}

export function drawAmount(
  ctx: PdfDocumentContext,
  amount: string,
  options: PdfDrawTextOptions & { label?: string } = {},
): number {
  return drawInvestmentHero(ctx, amount, {
    label: options.label,
    amountSize: options.size ?? 36,
  });
}

export type PdfFooterOptions = {
  text?: string;
  leftText?: string;
  centerText?: string;
  rightText?: string;
  showPageNumber?: boolean;
  drawLine?: boolean;
};

export const PDF_FOOTER_RESERVE_PT = 48;
export const PDF_LOGO_MAX_WIDTH = 140;
export const PDF_LOGO_MAX_HEIGHT = 72;
export const PDF_CHECK_MARKER_SIZE = 14;

export function drawBlockHeading(ctx: PdfDocumentContext, text: string, options: PdfDrawTextOptions = {}): number {
  moveY(ctx, 22);
  return drawText(ctx, text, {
    size: 17,
    bold: true,
    color: ctx.colors.textPrimary,
    lineHeight: 22,
    ...options,
  });
}

export function measureCheckItemHeight(ctx: PdfDocumentContext, options: PdfCheckItemOptions): number {
  const titleSize = options.titleSize ?? 12;
  const descriptionSize = options.descriptionSize ?? 10.5;
  const markerSize = PDF_CHECK_MARKER_SIZE;
  const gap = 12;
  const titleFont = ctx.fonts.bold;
  const bodyFont = ctx.fonts.regular;
  const textWidth = ctx.contentWidth - markerSize - gap;

  const titleLines = wrapTextByWidth(options.title, titleFont, titleSize, textWidth);
  const descriptionLines = options.description
    ? wrapTextByWidth(options.description, bodyFont, descriptionSize, textWidth)
    : [];

  const titleBlockHeight = titleLines.length * resolveLineHeight(titleSize);
  const descriptionBlockHeight = descriptionLines.length * resolveLineHeight(descriptionSize);
  return Math.max(markerSize + 2, titleBlockHeight + descriptionBlockHeight) + 14;
}

export type PdfPaymentCardContent = {
  title: string;
  amount: string;
  subtitle?: string;
  note?: string;
};

export function measurePaymentCardHeight(ctx: PdfDocumentContext, card: PdfPaymentCardContent): number {
  const padding = 20;
  const cardGap = 14;
  const innerWidth = ctx.contentWidth - padding * 2;
  const titleSize = 12;
  const amountSize = 18;
  const bodySize = 10;

  const titleLines = wrapTextByWidth(card.title, ctx.fonts.bold, titleSize, innerWidth);
  const amountLines = wrapTextByWidth(card.amount, ctx.fonts.bold, amountSize, innerWidth);
  const subtitleLines = card.subtitle
    ? wrapTextByWidth(card.subtitle, ctx.fonts.regular, bodySize, innerWidth)
    : [];
  const noteLines = card.note ? wrapTextByWidth(card.note, ctx.fonts.regular, bodySize, innerWidth) : [];

  const innerHeight =
    titleLines.length * resolveLineHeight(titleSize) +
    amountLines.length * resolveLineHeight(amountSize) +
    subtitleLines.length * resolveLineHeight(bodySize) +
    noteLines.length * resolveLineHeight(bodySize) +
    (card.subtitle ? 6 : 0) +
    (card.note ? 6 : 0) +
    8;

  return innerHeight + padding * 2 + cardGap;
}

export function drawPaymentCard(ctx: PdfDocumentContext, card: PdfPaymentCardContent): number {
  const padding = 20;
  const cardGap = 14;
  const innerWidth = ctx.contentWidth - padding * 2;
  const totalHeight = measurePaymentCardHeight(ctx, card) - cardGap;

  ensureSpace(ctx, totalHeight + cardGap, PDF_FOOTER_RESERVE_PT);

  const topY = ctx.cursorY;
  const x = ctx.margin;
  const width = ctx.contentWidth;
  const shadowColor = rgb(0.93, 0.94, 0.96);

  ctx.page.drawRectangle({
    x: x + 2,
    y: topY - totalHeight - 2,
    width,
    height: totalHeight,
    color: shadowColor,
    borderWidth: 0,
  });

  ctx.page.drawRectangle({
    x,
    y: topY - totalHeight,
    width,
    height: totalHeight,
    color: rgb(1, 1, 1),
    borderColor: rgb(0.9, 0.91, 0.93),
    borderWidth: 0.5,
  });

  let textY = topY - padding;
  const textX = x + padding;
  const titleSize = 12;
  const amountSize = 18;
  const bodySize = 10;

  for (const line of wrapTextByWidth(card.title, ctx.fonts.bold, titleSize, innerWidth)) {
    ctx.page.drawText(line, { x: textX, y: textY, size: titleSize, font: ctx.fonts.bold, color: ctx.colors.textPrimary });
    textY -= resolveLineHeight(titleSize);
  }

  textY -= 4;
  for (const line of wrapTextByWidth(card.amount, ctx.fonts.bold, amountSize, innerWidth)) {
    ctx.page.drawText(line, { x: textX, y: textY, size: amountSize, font: ctx.fonts.bold, color: ctx.colors.accent });
    textY -= resolveLineHeight(amountSize);
  }

  if (card.subtitle) {
    textY -= 6;
    for (const line of wrapTextByWidth(card.subtitle, ctx.fonts.regular, bodySize, innerWidth)) {
      ctx.page.drawText(line, { x: textX, y: textY, size: bodySize, font: ctx.fonts.regular, color: ctx.colors.textSecondary });
      textY -= resolveLineHeight(bodySize);
    }
  }

  if (card.note) {
    textY -= 6;
    for (const line of wrapTextByWidth(card.note, ctx.fonts.regular, bodySize, innerWidth)) {
      ctx.page.drawText(line, { x: textX, y: textY, size: bodySize, font: ctx.fonts.regular, color: ctx.colors.textMuted });
      textY -= resolveLineHeight(bodySize);
    }
  }

  moveY(ctx, totalHeight + cardGap);
  return totalHeight + cardGap;
}

export function drawMetaColumn(
  ctx: PdfDocumentContext,
  items: Array<{ label: string; value: string }>,
  options: { x: number; width: number; align?: "left" | "right" },
): number {
  const align = options.align ?? "right";
  const labelSize = 8;
  const valueSize = 10;
  const rowGap = 8;
  let used = 0;

  for (const item of items) {
    const labelFont = ctx.fonts.regular;
    const valueFont = ctx.fonts.bold;
    const labelWidth = labelFont.widthOfTextAtSize(item.label.toUpperCase(), labelSize);
    const valueLines = wrapTextByWidth(item.value, valueFont, valueSize, options.width);
    const blockHeight = resolveLineHeight(labelSize) + valueLines.length * resolveLineHeight(valueSize) + rowGap;

    ensureSpace(ctx, blockHeight, PDF_FOOTER_RESERVE_PT);

    const labelX =
      align === "right" ? options.x + options.width - labelWidth : options.x;
    ctx.page.drawText(item.label.toUpperCase(), {
      x: labelX,
      y: ctx.cursorY,
      size: labelSize,
      font: labelFont,
      color: ctx.colors.textMuted,
    });

    let valueY = ctx.cursorY - resolveLineHeight(labelSize);
    for (const line of valueLines) {
      const lineWidth = valueFont.widthOfTextAtSize(line, valueSize);
      const valueX = align === "right" ? options.x + options.width - lineWidth : options.x;
      ctx.page.drawText(line, {
        x: valueX,
        y: valueY,
        size: valueSize,
        font: valueFont,
        color: ctx.colors.textPrimary,
      });
      valueY -= resolveLineHeight(valueSize);
    }

    moveY(ctx, blockHeight);
    used += blockHeight;
  }

  return used;
}

export function drawFooter(ctx: PdfDocumentContext, options: PdfFooterOptions = {}): void {
  const footerTextY = ctx.margin * 0.62;
  const lineY = footerTextY + 16;
  const size = 8;

  if (options.drawLine !== false) {
    ctx.page.drawLine({
      start: { x: ctx.margin, y: lineY },
      end: { x: ctx.width - ctx.margin, y: lineY },
      thickness: 0.35,
      color: ctx.colors.border,
    });
  }

  if (options.leftText) {
    ctx.page.drawText(options.leftText, {
      x: ctx.margin,
      y: footerTextY,
      size,
      font: ctx.fonts.regular,
      color: ctx.colors.textMuted,
    });
  }

  if (options.centerText) {
    const centerWidth = ctx.fonts.regular.widthOfTextAtSize(options.centerText, size);
    ctx.page.drawText(options.centerText, {
      x: ctx.margin + (ctx.contentWidth - centerWidth) / 2,
      y: footerTextY,
      size,
      font: ctx.fonts.regular,
      color: ctx.colors.textMuted,
    });
  }

  const rightText =
    options.rightText ??
    (options.showPageNumber !== false && ctx.totalPages > 1
      ? `Página ${ctx.pageNumber} de ${ctx.totalPages}`
      : options.text ?? "");

  if (rightText) {
    const textWidth = ctx.fonts.regular.widthOfTextAtSize(rightText, size);
    ctx.page.drawText(rightText, {
      x: ctx.width - ctx.margin - textWidth,
      y: footerTextY,
      size,
      font: ctx.fonts.regular,
      color: ctx.colors.textMuted,
    });
  } else if (options.text && !options.leftText && !options.centerText) {
    ctx.page.drawText(options.text, {
      x: ctx.margin,
      y: footerTextY,
      size,
      font: ctx.fonts.regular,
      color: ctx.colors.textMuted,
    });
  }
}

export async function drawLogoOrFallback(
  ctx: PdfDocumentContext,
  options: ResolvePdfLogoOptions & { maxWidth?: number; maxHeight?: number },
): Promise<PdfLogoEmbedResult> {
  const maxWidth = options.maxWidth ?? PDF_LOGO_MAX_WIDTH;
  const maxHeight = options.maxHeight ?? PDF_LOGO_MAX_HEIGHT;
  const result = await resolvePdfLogo(ctx.pdfDoc, options);

  if (result.kind === "fallback") {
    const size = 56;
    ensureSpace(ctx, size + 10);
    const y = ctx.cursorY - size;
    const boxX = ctx.margin;

    ctx.page.drawRectangle({
      x: boxX,
      y,
      width: size,
      height: size,
      color: ctx.colors.softBackground,
      borderColor: ctx.colors.border,
      borderWidth: 0.5,
    });

    const labelWidth = ctx.fonts.bold.widthOfTextAtSize(result.label, 18);
    ctx.page.drawText(result.label, {
      x: boxX + (size - labelWidth) / 2,
      y: y + size / 2 - 9,
      size: 18,
      font: ctx.fonts.bold,
      color: ctx.colors.accent,
    });

    moveY(ctx, size + 10);
    return result;
  }

  const scaled = scaleLogoToMaxBox(result.width, result.height, maxWidth, maxHeight);
  const minRenderedWidth = Math.min(maxWidth, Math.max(90, scaled.width));
  const isSquareish =
    Math.abs(result.width - result.height) / Math.max(result.width, result.height, 1) < 0.2;
  const logoX =
    isSquareish && scaled.width < minRenderedWidth
      ? ctx.margin + (minRenderedWidth - scaled.width) / 2
      : ctx.margin;

  ensureSpace(ctx, scaled.height + 10);
  const y = ctx.cursorY - scaled.height;

  ctx.page.drawImage(result.image, {
    x: logoX,
    y,
    width: scaled.width,
    height: scaled.height,
  });

  moveY(ctx, scaled.height + 10);
  return result;
}

/** Dibuja pie en todas las páginas (llamar antes de `savePdfDocument`). */
export function drawFootersOnAllPages(
  ctx: PdfDocumentContext,
  options: PdfFooterOptions & {
    leftTextBuilder?: (pageNumber: number, totalPages: number) => string;
    centerTextBuilder?: (pageNumber: number, totalPages: number) => string;
    rightTextBuilder?: (pageNumber: number, totalPages: number) => string;
  } = {},
): void {
  finalizePdfPages(ctx);
  const pages = ctx.pdfDoc.getPages();
  const totalPages = pages.length;

  pages.forEach((page, index) => {
    const previousPage = ctx.page;
    const previousPageNumber = ctx.pageNumber;
    const previousTotalPages = ctx.totalPages;
    const pageNumber = index + 1;

    ctx.page = page;
    ctx.pageNumber = pageNumber;
    ctx.totalPages = totalPages;

    drawFooter(ctx, {
      leftText: options.leftTextBuilder?.(pageNumber, totalPages) ?? options.leftText,
      centerText: options.centerTextBuilder?.(pageNumber, totalPages) ?? options.centerText,
      rightText: options.rightTextBuilder?.(pageNumber, totalPages) ?? options.rightText,
      text: options.text,
      showPageNumber: options.showPageNumber,
      drawLine: options.drawLine,
    });

    ctx.page = previousPage;
    ctx.pageNumber = previousPageNumber;
    ctx.totalPages = previousTotalPages;
  });
}
