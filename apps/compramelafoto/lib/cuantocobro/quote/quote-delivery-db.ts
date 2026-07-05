import type { Prisma } from "@prisma/client";
import { CuantoCobroQuoteStatus } from "@prisma/client";
import { recordQuoteSent, recordQuoteViewedByClient } from "@/lib/cuantocobro/consulta/consulta-db";
import type { CuantoCobroBusinessProfile } from "@/lib/cuantocobro/business-profile";
import { hashIp } from "@/lib/hidden-album-audit";
import { prisma } from "@/lib/prisma";
import { buildQuotePdfFromFrozenSnapshot } from "./build-quote-pdf";
import {
  enrichBusinessProfileSnapshotForStorage,
} from "./quote-branding-snapshot";
import { fetchPhotographerBrandingSourceForUser } from "./quote-branding-source";
import {
  buildFrozenQuoteCommercialSnapshot,
  type FrozenQuoteCommercialSnapshot,
} from "./quote-commercial-snapshot";
import {
  addDays,
  buildQuotePublicViewUrl,
  generateQuotePublicViewToken,
  hashQuotePublicViewToken,
  isQuotePublicViewTokenActive,
  resolveQuotePublicViewTokenTtlDays,
} from "./quote-public-token";
import {
  canTransitionQuoteStatusOnView,
  quoteStatusAfterClientView,
} from "./quote-version-lock";
import { sendQuoteDeliveryEmail } from "./quote-send-email";

const versionWithQuoteSelect = {
  id: true,
  versionNumber: true,
  status: true,
  quotePayload: true,
  calculationSnapshot: true,
  paymentOptionsSnapshot: true,
  businessProfileSnapshot: true,
  publicViewTokenHash: true,
  publicViewTokenExpiresAt: true,
  publicViewTokenRevokedAt: true,
  sentAt: true,
  firstViewedAt: true,
  lastViewedAt: true,
  viewCount: true,
  quote: {
    select: {
      id: true,
      userId: true,
      quoteNumber: true,
      consultaId: true,
      archivedAt: true,
    },
  },
} as const;

type VersionDeliveryRow = Prisma.CuantoCobroQuoteVersionGetPayload<{
  select: typeof versionWithQuoteSelect;
}>;

export type QuotePublicViewDto = {
  quoteNumber: string;
  versionNumber: number;
  businessProfile: CuantoCobroBusinessProfile | null;
  snapshot: FrozenQuoteCommercialSnapshot;
};

export type SendQuoteToClientInput = {
  to: string;
  subject: string;
  message: string;
  includePdf: boolean;
  includeLink: boolean;
  confirmed: boolean;
};

export type SendQuoteToClientResult = {
  sentAt: string;
  publicUrl: string | null;
};

async function buildSnapshotFromRow(row: VersionDeliveryRow): Promise<FrozenQuoteCommercialSnapshot | null> {
  const photographer = await fetchPhotographerBrandingSourceForUser(row.quote.userId);
  const businessProfileSnapshot = enrichBusinessProfileSnapshotForStorage(
    row.businessProfileSnapshot,
    photographer,
  );

  return buildFrozenQuoteCommercialSnapshot({
    quoteNumber: row.quote.quoteNumber,
    versionNumber: row.versionNumber,
    quotePayload: row.quotePayload,
    calculationSnapshot: row.calculationSnapshot,
    paymentOptionsSnapshot: row.paymentOptionsSnapshot,
    businessProfileSnapshot,
  });
}

async function getVersionDeliveryRowForUser(
  userId: number,
  quoteId: number,
  versionNumber: number,
): Promise<VersionDeliveryRow | null> {
  return prisma.cuantoCobroQuoteVersion.findFirst({
    where: {
      quoteId,
      versionNumber,
      quote: { userId, archivedAt: null },
    },
    select: versionWithQuoteSelect,
  });
}

export async function getFrozenSnapshotForVersion(
  userId: number,
  quoteId: number,
  versionNumber: number,
): Promise<FrozenQuoteCommercialSnapshot | null> {
  const row = await getVersionDeliveryRowForUser(userId, quoteId, versionNumber);
  if (!row) return null;
  return buildSnapshotFromRow(row);
}

export async function buildQuotePdfForVersion(
  userId: number,
  quoteId: number,
  versionNumber: number,
): Promise<{ bytes: Uint8Array; filename: string } | null> {
  const row = await getVersionDeliveryRowForUser(userId, quoteId, versionNumber);
  if (!row) return null;
  const snapshot = await buildSnapshotFromRow(row);
  if (!snapshot) return null;
  const bytes = await buildQuotePdfFromFrozenSnapshot(snapshot);
  const safeNumber = row.quote.quoteNumber.replace(/[^\w.-]+/g, "_");
  return {
    bytes,
    filename: `presupuesto-${safeNumber}-v${row.versionNumber}.pdf`,
  };
}

export async function issueQuotePublicViewToken(versionId: number): Promise<{
  token: string;
  publicUrl: string;
  expiresAt: Date;
}> {
  const { token, tokenHash } = generateQuotePublicViewToken();
  const expiresAt = addDays(new Date(), resolveQuotePublicViewTokenTtlDays());

  await prisma.cuantoCobroQuoteVersion.update({
    where: { id: versionId },
    data: {
      publicViewTokenHash: tokenHash,
      publicViewTokenExpiresAt: expiresAt,
      publicViewTokenRevokedAt: null,
    },
  });

  return {
    token,
    publicUrl: buildQuotePublicViewUrl(token),
    expiresAt,
  };
}

export async function sendQuoteVersionToClient(
  userId: number,
  quoteId: number,
  versionNumber: number,
  input: SendQuoteToClientInput,
): Promise<SendQuoteToClientResult> {
  if (!input.confirmed) {
    throw new Error("Confirmá el envío antes de mandar el email al cliente");
  }

  const to = input.to.trim();
  if (!to) throw new Error("Email del cliente requerido");

  const row = await getVersionDeliveryRowForUser(userId, quoteId, versionNumber);
  if (!row) throw new Error("Versión no encontrada");

  const snapshot = await buildSnapshotFromRow(row);
  if (!snapshot) throw new Error("La versión no tiene un cálculo congelado válido");

  let publicUrl: string | null = null;
  if (input.includeLink) {
    const issued = await issueQuotePublicViewToken(row.id);
    publicUrl = issued.publicUrl;
  }

  let pdfAttachment: { filename: string; content: Uint8Array } | undefined;
  if (input.includePdf) {
    const bytes = await buildQuotePdfFromFrozenSnapshot(snapshot);
    pdfAttachment = {
      filename: `presupuesto-${row.quote.quoteNumber.replace(/[^\w.-]+/g, "_")}-v${row.versionNumber}.pdf`,
      content: bytes,
    };
  }

  if (!input.includePdf && !input.includeLink) {
    throw new Error("Elegí adjuntar el PDF o incluir un enlace al presupuesto");
  }

  const businessProfile = snapshot.businessProfile;
  const replyTo = businessProfile?.commercialEmail?.trim() || undefined;

  const sendResult = await sendQuoteDeliveryEmail({
    to,
    subject: input.subject.trim() || `Presupuesto ${row.quote.quoteNumber}`,
    message: input.message.trim(),
    publicUrl,
    businessName: businessProfile?.tradeName?.trim() || undefined,
    replyTo,
    pdfAttachment,
    userId,
  });

  if (!sendResult.success) {
    throw new Error(sendResult.error || "No se pudo enviar el email");
  }

  const sentAt = new Date();

  await prisma.$transaction(async (tx) => {
    await tx.cuantoCobroQuoteVersion.update({
      where: { id: row.id },
      data: {
        status: "SENT",
        sentAt,
      },
    });

    await tx.cuantoCobroQuote.update({
      where: { id: quoteId },
      data: {
        status: "SENT",
        updatedAt: sentAt,
      },
    });

    if (row.quote.consultaId) {
      await recordQuoteSent(
        tx,
        userId,
        row.quote.consultaId,
        row.quote.quoteNumber,
        versionNumber,
        quoteId,
        row.id,
        to,
      );
    }
  });

  return {
    sentAt: sentAt.toISOString(),
    publicUrl,
  };
}

export async function getQuoteVersionByPublicToken(token: string): Promise<VersionDeliveryRow | null> {
  const trimmed = token.trim();
  if (!trimmed) return null;
  const tokenHash = hashQuotePublicViewToken(trimmed);

  const row = await prisma.cuantoCobroQuoteVersion.findFirst({
    where: { publicViewTokenHash: tokenHash },
    select: versionWithQuoteSelect,
  });
  if (!row) return null;

  if (
    !isQuotePublicViewTokenActive({
      tokenHash: row.publicViewTokenHash,
      revokedAt: row.publicViewTokenRevokedAt,
      expiresAt: row.publicViewTokenExpiresAt,
    })
  ) {
    return null;
  }

  if (row.quote.archivedAt) return null;
  return row;
}

export async function recordQuotePublicView(
  token: string,
  meta: { userAgent?: string; ip?: string },
): Promise<QuotePublicViewDto | null> {
  const row = await getQuoteVersionByPublicToken(token);
  if (!row) return null;

  const snapshot = await buildSnapshotFromRow(row);
  if (!snapshot) return null;

  const now = new Date();
  const ipHash = meta.ip?.trim() ? hashIp(meta.ip.trim()) : "";
  const userAgent = (meta.userAgent ?? "").slice(0, 500);
  const isFirstView = row.firstViewedAt == null;
  const nextStatus = quoteStatusAfterClientView(row.status);

  await prisma.$transaction(async (tx) => {
    await tx.cuantoCobroQuoteVersion.update({
      where: { id: row.id },
      data: {
        firstViewedAt: row.firstViewedAt ?? now,
        lastViewedAt: now,
        viewCount: { increment: 1 },
        lastViewUserAgent: userAgent,
        lastViewIpHash: ipHash,
        ...(canTransitionQuoteStatusOnView(row.status) ? { status: nextStatus as CuantoCobroQuoteStatus } : {}),
      },
    });

    await tx.cuantoCobroQuote.update({
      where: { id: row.quote.id },
      data: {
        ...(canTransitionQuoteStatusOnView(row.status) ? { status: nextStatus as CuantoCobroQuoteStatus } : {}),
        updatedAt: now,
      },
    });

    if (isFirstView && row.quote.consultaId) {
      await recordQuoteViewedByClient(
        tx,
        row.quote.userId,
        row.quote.consultaId,
        row.quote.quoteNumber,
        row.versionNumber,
        row.quote.id,
        row.id,
      );
    }
  });

  return {
    quoteNumber: row.quote.quoteNumber,
    versionNumber: row.versionNumber,
    businessProfile: snapshot.businessProfile,
    snapshot,
  };
}
