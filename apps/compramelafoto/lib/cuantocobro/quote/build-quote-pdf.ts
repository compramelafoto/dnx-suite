import type { RGB } from "pdf-lib";
import {
  buildCommercialProposalModel,
  commercialProposalModelExposesInternalData,
  type CommercialProposalModel,
} from "../commercial-proposal";
import {
  collectPdfLogoCandidates,
  resolvePdfPhotographerAccentHex,
} from "../pdf/branding";
import {
  createPdfDocumentContext,
  drawBlockHeading,
  drawCheckItem,
  drawDivider,
  drawFootersOnAllPages,
  drawInvestmentHero,
  drawLogoOrFallback,
  drawMetaColumn,
  drawPaymentCard,
  drawText,
  drawWrappedText,
  ensureSpace,
  measureCheckItemHeight,
  measureInvestmentHeroHeight,
  measurePaymentCardHeight,
  moveY,
  PDF_FOOTER_RESERVE_PT,
  savePdfDocument,
} from "../pdf";
import type { PdfDocumentContext } from "../pdf";
import type { FrozenQuoteCommercialSnapshot } from "./quote-commercial-snapshot";

const PDF_INTERNAL_FORBIDDEN_PATTERNS = [
  /hourlyrate/i,
  /minimumsustainable/i,
  /profitability/i,
  /vhh/i,
  /estimatedmargin/i,
  /laborcost/i,
];

const CLIENT_VISIBLE_META_LABELS = new Set([
  "Cliente",
  "Tipo de trabajo",
  "Fecha del evento",
  "N.º de propuesta",
  "Vigencia",
]);

const PDF_META_LABEL_DISPLAY: Record<string, string> = {
  "Tipo de trabajo": "Evento",
  "Fecha del evento": "Fecha",
  "N.º de propuesta": "Número",
  Vigencia: "Validez",
};

function filterClientMeta(model: CommercialProposalModel) {
  return model.meta
    .filter((item) => CLIENT_VISIBLE_META_LABELS.has(item.label) && item.label !== "Revisión")
    .map((item) => ({
      label: PDF_META_LABEL_DISPLAY[item.label] ?? item.label,
      value: item.value,
    }));
}

function drawRightAlignedText(
  ctx: PdfDocumentContext,
  text: string,
  y: number,
  options: { size?: number; bold?: boolean; color?: RGB } = {},
) {
  const size = options.size ?? 11;
  const font = options.bold ? ctx.fonts.bold : ctx.fonts.regular;
  const color = options.color ?? ctx.colors.textPrimary;
  const width = font.widthOfTextAtSize(text, size);
  ctx.page.drawText(text, {
    x: ctx.width - ctx.margin - width,
    y,
    size,
    font,
    color,
  });
}

function drawLeftColumnText(
  ctx: PdfDocumentContext,
  startY: number,
  lines: Array<{ text: string; size: number; bold?: boolean; color?: RGB; lineHeight?: number }>,
): number {
  let y = startY;
  let bottomY = startY;

  for (const line of lines) {
    const font = line.bold ? ctx.fonts.bold : ctx.fonts.regular;
    const lineHeight = line.lineHeight ?? line.size + 4;
    ctx.page.drawText(line.text, {
      x: ctx.margin,
      y,
      size: line.size,
      font,
      color: line.color ?? ctx.colors.textPrimary,
    });
    y -= lineHeight;
    bottomY = y;
  }

  return bottomY;
}

async function drawProposalHeader(
  ctx: PdfDocumentContext,
  model: CommercialProposalModel,
  logoCandidates: string[],
) {
  const headerStartY = ctx.cursorY;
  const metaColumnX = ctx.margin + ctx.contentWidth * 0.54;
  const metaColumnWidth = ctx.contentWidth * 0.46;

  await drawLogoOrFallback(ctx, {
    logoUrls: logoCandidates,
    logoUrl: model.business.logoUrl,
    fallbackLabel: model.business.displayName || model.signatureName,
    maxWidth: 140,
    maxHeight: 72,
  });

  const leftLines: Array<{ text: string; size: number; bold?: boolean; color?: RGB; lineHeight?: number }> = [];

  if (model.business.displayName) {
    leftLines.push({
      text: model.business.displayName,
      size: 13,
      bold: true,
      lineHeight: 17,
    });
  }

  if (model.business.responsibleName) {
    leftLines.push({
      text: model.business.responsibleName,
      size: 10.5,
      color: ctx.colors.textSecondary,
      lineHeight: 14,
    });
  }

  for (const contact of model.business.contactLines) {
    const label =
      contact.label.toLowerCase().includes("tel") || contact.label.toLowerCase().includes("whatsapp")
        ? "WhatsApp"
        : contact.label === "Web"
          ? "Sitio web"
          : contact.label;
    leftLines.push({
      text: `${label}: ${contact.value}`,
      size: 9,
      color: ctx.colors.textMuted,
      lineHeight: 12,
    });
  }

  const leftColumnBottom = drawLeftColumnText(ctx, ctx.cursorY, leftLines);
  const clientMeta = filterClientMeta(model);

  ctx.cursorY = headerStartY;
  drawRightAlignedText(ctx, model.documentTitle.toUpperCase(), headerStartY, {
    size: 16,
    bold: true,
    color: ctx.colors.accent,
  });

  ctx.cursorY = headerStartY - 20;
  if (clientMeta.length > 0) {
    drawMetaColumn(ctx, clientMeta, {
      x: metaColumnX,
      width: metaColumnWidth,
      align: "right",
    });
  }

  const rightColumnBottom = ctx.cursorY;
  ctx.cursorY = Math.min(leftColumnBottom, rightColumnBottom) - 18;

  drawDivider(ctx, { thickness: 0.35, spacingBefore: 0, spacingAfter: 10, color: ctx.colors.border });
}

function drawLetterIntro(ctx: PdfDocumentContext, message: string) {
  moveY(ctx, 6);
  drawWrappedText(ctx, message, {
    size: 11.5,
    color: ctx.colors.textPrimary,
    lineHeight: 18,
    maxWidth: ctx.contentWidth * 0.94,
  });
  moveY(ctx, 16);
}

function drawIncludesBlock(ctx: PdfDocumentContext, model: CommercialProposalModel) {
  drawBlockHeading(ctx, model.includesTitle);

  for (const item of model.includes) {
    const blockHeight = measureCheckItemHeight(ctx, {
      title: item.title,
      description: item.description,
      titleSize: 12,
      descriptionSize: 10.5,
    });
    ensureSpace(ctx, blockHeight, PDF_FOOTER_RESERVE_PT);
    drawCheckItem(ctx, {
      title: item.title,
      description: item.description,
      titleSize: 12,
      descriptionSize: 10.5,
    });
  }

  moveY(ctx, 10);
}

function drawInvestmentBlock(ctx: PdfDocumentContext, model: CommercialProposalModel) {
  moveY(ctx, 12);
  const heroHeight = measureInvestmentHeroHeight({ amountSize: 38, paddingTop: 36, paddingBottom: 28 });
  ensureSpace(ctx, heroHeight + 8, PDF_FOOTER_RESERVE_PT);

  drawInvestmentHero(ctx, model.investmentAmount, {
    label: "Inversión estimada",
    amountSize: 38,
    paddingTop: 36,
    paddingBottom: 28,
  });

  if (model.paymentCards.length > 0) {
    moveY(ctx, 6);
    drawText(ctx, "Todas las opciones de pago disponibles", {
      size: 10,
      color: ctx.colors.textMuted,
      align: "center",
      lineHeight: 14,
    });
  }

  moveY(ctx, 20);
}

function drawPaymentCardsBlock(ctx: PdfDocumentContext, model: CommercialProposalModel) {
  if (model.paymentCards.length === 0) return;

  drawBlockHeading(ctx, "Formas de pago", { size: 17, lineHeight: 22 });

  for (const card of model.paymentCards) {
    const cardHeight = measurePaymentCardHeight(ctx, {
      title: card.title,
      amount: card.amount,
      subtitle: card.subtitle,
      note: card.note,
    });
    ensureSpace(ctx, cardHeight, PDF_FOOTER_RESERVE_PT);
    drawPaymentCard(ctx, {
      title: card.title,
      amount: card.amount,
      subtitle: card.subtitle,
      note: card.note,
    });
  }
}

function drawConditionsBlock(ctx: PdfDocumentContext, model: CommercialProposalModel) {
  moveY(ctx, 8);
  drawText(ctx, model.conditionsTitle.toUpperCase(), {
    size: 8,
    semibold: true,
    color: ctx.colors.textMuted,
    lineHeight: 11,
  });
  moveY(ctx, 8);

  const lines = model.conditionsText
    .split(/\n+/)
    .map((line) => line.trim())
    .filter(Boolean);

  if (lines.length === 0) return;

  for (const line of lines) {
    ensureSpace(ctx, 20, PDF_FOOTER_RESERVE_PT);
    drawWrappedText(ctx, line, {
      size: 10.5,
      color: ctx.colors.textSecondary,
      lineHeight: 15,
      maxWidth: ctx.contentWidth - 8,
    });
    moveY(ctx, 6);
  }

  moveY(ctx, 10);
}

function formatClosingContactLabel(label: string): string {
  const key = label.toLowerCase();
  if (key.includes("tel") || key.includes("whatsapp")) return "WhatsApp";
  if (key.includes("email")) return "Email";
  if (key.includes("instagram")) return "Instagram";
  if (key.includes("web")) return "Sitio web";
  return label;
}

function drawClosingBlock(ctx: PdfDocumentContext, model: CommercialProposalModel) {
  moveY(ctx, 16);
  drawDivider(ctx, { thickness: 0.35, spacingBefore: 0, spacingAfter: 14 });

  drawWrappedText(ctx, model.closingMessage, {
    size: 11.5,
    color: ctx.colors.textPrimary,
    lineHeight: 18,
    maxWidth: ctx.contentWidth * 0.88,
  });

  moveY(ctx, 18);

  const responsible = model.business.responsibleName?.trim();
  const businessName = model.business.displayName?.trim();

  if (responsible) {
    drawText(ctx, responsible, { size: 12, bold: true, lineHeight: 16 });
  }

  if (businessName && businessName !== responsible) {
    drawText(ctx, businessName, {
      size: 11,
      semibold: true,
      color: ctx.colors.textSecondary,
      lineHeight: 15,
    });
  } else if (!responsible && businessName) {
    drawText(ctx, businessName, { size: 12, bold: true, lineHeight: 16 });
  }

  moveY(ctx, 6);

  for (const contact of model.business.contactLines) {
    const label = formatClosingContactLabel(contact.label);
    drawText(ctx, `${label}: ${contact.value}`, {
      size: 10,
      color: ctx.colors.textMuted,
      lineHeight: 14,
    });
  }
}

export function assertPremiumQuotePdfHasNoInternalExposure(pdfBytes: Uint8Array): void {
  const searchable = new TextDecoder("latin1").decode(pdfBytes);
  for (const pattern of PDF_INTERNAL_FORBIDDEN_PATTERNS) {
    if (pattern.test(searchable)) {
      throw new Error(`PDF contiene contenido interno prohibido: ${pattern}`);
    }
  }
}

export async function buildQuotePdfFromFrozenSnapshot(snapshot: FrozenQuoteCommercialSnapshot): Promise<Uint8Array> {
  const photographerAccent = resolvePdfPhotographerAccentHex(snapshot.businessProfile);
  const logoCandidates = collectPdfLogoCandidates(snapshot.businessProfile);

  const model = buildCommercialProposalModel({
    quote: snapshot.quote,
    calculation: snapshot.calculation,
    businessProfile: snapshot.businessProfile,
    paymentOptionsSnapshot: snapshot.paymentOptionsSnapshot,
    quoteNumber: snapshot.quoteNumber,
    versionNumber: snapshot.versionNumber,
    accentColor: photographerAccent,
  });

  if (commercialProposalModelExposesInternalData(model)) {
    throw new Error("El modelo comercial no debe exponer datos internos en PDF");
  }

  const ctx = await createPdfDocumentContext({
    accentColorHex: photographerAccent,
    metadata: {
      quoteNumber: snapshot.quoteNumber,
      versionNumber: String(snapshot.versionNumber),
    },
  });

  await drawProposalHeader(ctx, model, logoCandidates);
  drawLetterIntro(ctx, model.introMessage);
  drawIncludesBlock(ctx, model);
  drawInvestmentBlock(ctx, model);
  drawPaymentCardsBlock(ctx, model);
  drawConditionsBlock(ctx, model);
  drawClosingBlock(ctx, model);

  const businessName = model.business.displayName.trim();
  drawFootersOnAllPages(ctx, {
    leftTextBuilder: () => businessName,
    centerTextBuilder: () => snapshot.quoteNumber,
    rightTextBuilder: (pageNumber, totalPages) =>
      totalPages > 1 ? `Página ${pageNumber} de ${totalPages}` : "",
    showPageNumber: false,
  });

  const bytes = await savePdfDocument(ctx);
  assertPremiumQuotePdfHasNoInternalExposure(bytes);
  return bytes;
}
