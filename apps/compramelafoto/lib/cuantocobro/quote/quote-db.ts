import type { Prisma } from "@prisma/client";
import { linkConsultaPrimaryQuote, recordQuoteVersionCreated } from "@/lib/cuantocobro/consulta/consulta-db";
import { normalizeCuantoCobroQuote } from "@/lib/cuantocobro/normalize-quote";
import { extractQuoteDenormalizedFields } from "@/lib/cuantocobro/quote/quote-denormalize";
import { allocateNextQuoteNumber } from "@/lib/cuantocobro/quote/quote-number";
import { buildQuoteVersionSnapshots } from "@/lib/cuantocobro/quote/quote-snapshot";
import {
  enrichBusinessProfileSnapshotForStorage,
} from "@/lib/cuantocobro/quote/quote-branding-snapshot";
import { fetchPhotographerBrandingSourceForUser } from "@/lib/cuantocobro/quote/quote-branding-source";
import { isQuoteVersionImmutable } from "@/lib/cuantocobro/quote/quote-version-lock";
import type {
  CreateCuantoCobroQuoteInput,
  CuantoCobroQuoteDetailDto,
  CuantoCobroQuoteListItemDto,
  CuantoCobroQuoteVersionDetailDto,
  CuantoCobroQuoteVersionSummaryDto,
  ListQuotesParams,
  ListQuotesResult,
} from "@/lib/cuantocobro/quote/types";
import { CUANTO_COBRO_QUOTE_SCHEMA_VERSION } from "@/lib/cuantocobro/quote/types";
import type { CuantoCobroProfileInput, CuantoCobroQuoteInput } from "@/lib/cuantocobro/types";
import { INITIAL_CUANTO_COBRO_PROFILE } from "@/lib/cuantocobro/types";
import { prisma } from "@/lib/prisma";

const quoteInclude = {
  consulta: { select: { consultaNumber: true } },
} as const;

const versionInclude = {
  createdBy: { select: { name: true, email: true } },
} as const;

type QuoteRow = Prisma.CuantoCobroQuoteGetPayload<{ include: typeof quoteInclude }>;

type VersionRow = Prisma.CuantoCobroQuoteVersionGetPayload<{ include: typeof versionInclude }>;

type QuoteWithVersionsRow = Prisma.CuantoCobroQuoteGetPayload<{
  include: typeof quoteInclude & {
    versions: { include: typeof versionInclude; orderBy: { versionNumber: "desc" } };
  };
}>;

function formatDateOnlyFromDb(value: Date | null): string | null {
  return value ? value.toISOString().slice(0, 10) : null;
}

function formatIsoFromDb(value: Date | null): string | null {
  return value ? value.toISOString() : null;
}

function parseJobDate(value: string): Date | null {
  const trimmed = value.trim();
  if (!trimmed) return null;
  const date = new Date(`${trimmed}T12:00:00.000Z`);
  return Number.isNaN(date.getTime()) ? null : date;
}

function parseFilterDate(value: string | null | undefined): Date | null {
  if (!value?.trim()) return null;
  const date = new Date(`${value.trim()}T12:00:00.000Z`);
  return Number.isNaN(date.getTime()) ? null : date;
}

function encodeCursor(updatedAt: Date, id: number): string {
  return Buffer.from(`${updatedAt.toISOString()}|${id}`, "utf8").toString("base64url");
}

function decodeCursor(cursor: string): { updatedAt: Date; id: number } | null {
  try {
    const raw = Buffer.from(cursor, "base64url").toString("utf8");
    const [iso, idRaw] = raw.split("|");
    const id = Number(idRaw);
    const updatedAt = new Date(iso);
    if (!Number.isFinite(id) || Number.isNaN(updatedAt.getTime())) return null;
    return { updatedAt, id };
  } catch {
    return null;
  }
}

function parseQuotePayload(payload: unknown): CuantoCobroQuoteInput {
  return normalizeCuantoCobroQuote(
    payload && typeof payload === "object" && !Array.isArray(payload)
      ? (payload as Parameters<typeof normalizeCuantoCobroQuote>[0])
      : {},
  );
}

function parseProfileSnapshot(payload: unknown): CuantoCobroProfileInput | null {
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) return null;
  return payload as CuantoCobroProfileInput;
}

function resolveCreatedByName(row: VersionRow): string | null {
  const name = row.createdBy.name?.trim();
  if (name) return name;
  const email = row.createdBy.email?.trim();
  return email || null;
}

function mapVersionSummary(row: VersionRow): CuantoCobroQuoteVersionSummaryDto {
  return {
    id: row.id,
    versionNumber: row.versionNumber,
    isCurrent: row.isCurrent,
    status: row.status,
    currency: row.currency,
    chosenPriceCents: row.chosenPriceCents,
    recommendedPriceCents: row.recommendedPriceCents,
    minimumPriceCents: row.minimumPriceCents,
    comment: row.comment,
    createdByUserId: row.createdByUserId,
    createdByName: resolveCreatedByName(row),
    createdAt: row.createdAt.toISOString(),
    sentAt: formatIsoFromDb(row.sentAt),
    firstViewedAt: formatIsoFromDb(row.firstViewedAt),
    lastViewedAt: formatIsoFromDb(row.lastViewedAt),
    viewCount: row.viewCount,
    isImmutable: isQuoteVersionImmutable(row),
  };
}

function mapQuoteListItem(row: QuoteRow): CuantoCobroQuoteListItemDto {
  return {
    id: row.id,
    quoteNumber: row.quoteNumber,
    currentVersionNumber: row.currentVersionNumber,
    acceptedVersionId: row.acceptedVersionId,
    status: row.status,
    currency: row.currency,
    chosenPriceCents: row.chosenPriceCents,
    recommendedPriceCents: row.recommendedPriceCents,
    minimumPriceCents: row.minimumPriceCents,
    clientDisplayName: row.clientDisplayName,
    clientCompany: row.clientCompany,
    jobType: row.jobType,
    jobDate: formatDateOnlyFromDb(row.jobDate),
    consultaId: row.consultaId,
    consultaNumber: row.consulta?.consultaNumber ?? null,
    archivedAt: formatIsoFromDb(row.archivedAt),
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

function mapQuoteDetail(row: QuoteWithVersionsRow, currentVersion: VersionRow): CuantoCobroQuoteDetailDto {
  return {
    ...mapQuoteListItem(row),
    quote: parseQuotePayload(currentVersion.quotePayload),
    profileSnapshot: parseProfileSnapshot(currentVersion.profileSnapshot),
    calculationSnapshot: currentVersion.calculationSnapshot,
    paymentOptionsSnapshot: currentVersion.paymentOptionsSnapshot,
    versions: row.versions.map(mapVersionSummary),
  };
}

function mapVersionDetail(row: VersionRow): CuantoCobroQuoteVersionDetailDto {
  return {
    ...mapVersionSummary(row),
    quote: parseQuotePayload(row.quotePayload),
    profileSnapshot: parseProfileSnapshot(row.profileSnapshot) ?? INITIAL_CUANTO_COBRO_PROFILE,
    calculationSnapshot: row.calculationSnapshot,
    paymentOptionsSnapshot: row.paymentOptionsSnapshot,
    businessProfileSnapshot: row.businessProfileSnapshot,
  };
}

type VersionWriteInput = {
  quote: CuantoCobroQuoteInput;
  profile: CuantoCobroProfileInput;
  calculationSnapshot: unknown;
  currency: string;
  chosenPriceCents: number | null;
  recommendedPriceCents: number | null;
  minimumPriceCents: number | null;
  comment: string;
  status?: QuoteRow["status"];
};

function buildVersionSnapshotsFromInput(
  rawInput: CreateCuantoCobroQuoteInput,
  quote: CuantoCobroQuoteInput,
): {
  quotePayload: CuantoCobroQuoteInput;
  profileSnapshot: CuantoCobroProfileInput;
  calculationSnapshot: unknown;
  paymentOptionsSnapshot: unknown;
  businessProfileSnapshot: unknown;
} {
  const paymentOptionsSnapshot = rawInput.paymentOptionsSnapshot ?? {};
  const businessProfileSnapshot = rawInput.businessProfileSnapshot ?? {};

  if (rawInput.profile && rawInput.calculationSnapshot) {
    const built = buildQuoteVersionSnapshots({
      profile: rawInput.profile,
      quote,
      calculation: rawInput.calculationSnapshot as Parameters<
        typeof buildQuoteVersionSnapshots
      >[0]["calculation"],
      paymentOptionsSnapshot,
    });
    return { ...built, businessProfileSnapshot };
  }

  return {
    quotePayload: quote,
    profileSnapshot: rawInput.profile ?? INITIAL_CUANTO_COBRO_PROFILE,
    calculationSnapshot: rawInput.calculationSnapshot ?? {
      status: "incomplete",
      frozenAt: new Date().toISOString(),
    },
    paymentOptionsSnapshot,
    businessProfileSnapshot,
  };
}

async function resolveBusinessProfileSnapshotForVersion(
  userId: number,
  stored: unknown,
): Promise<Record<string, unknown>> {
  const photographer = await fetchPhotographerBrandingSourceForUser(userId);
  return enrichBusinessProfileSnapshotForStorage(stored, photographer);
}

async function syncQuoteHeaderFromVersion(
  tx: Prisma.TransactionClient,
  quoteId: number,
  versionNumber: number,
  versionData: VersionWriteInput,
): Promise<QuoteRow> {
  const denormalized = extractQuoteDenormalizedFields(versionData.quote);
  const jobDate = parseJobDate(versionData.quote.client.jobDate);

  return tx.cuantoCobroQuote.update({
    where: { id: quoteId },
    data: {
      currentVersionNumber: versionNumber,
      schemaVersion: CUANTO_COBRO_QUOTE_SCHEMA_VERSION,
      status: versionData.status ?? "DRAFT",
      currency: versionData.currency,
      chosenPriceCents: versionData.chosenPriceCents,
      recommendedPriceCents: versionData.recommendedPriceCents,
      minimumPriceCents: versionData.minimumPriceCents,
      clientDisplayName: denormalized.clientDisplayName,
      clientCompany: denormalized.clientCompany,
      clientEmail: denormalized.clientEmail,
      clientPhone: denormalized.clientPhone,
      jobLocation: denormalized.jobLocation,
      jobType: denormalized.jobType,
      jobDate,
      updatedAt: new Date(),
    },
    include: quoteInclude,
  });
}

async function insertQuoteVersion(
  tx: Prisma.TransactionClient,
  options: {
    quoteId: number;
    versionNumber: number;
    createdByUserId: number;
    versionData: VersionWriteInput;
    snapshots: ReturnType<typeof buildVersionSnapshotsFromInput>;
  },
): Promise<VersionRow> {
  const denormalized = extractQuoteDenormalizedFields(options.versionData.quote);
  const jobDate = parseJobDate(options.versionData.quote.client.jobDate);

  await tx.cuantoCobroQuoteVersion.updateMany({
    where: { quoteId: options.quoteId, isCurrent: true },
    data: { isCurrent: false },
  });

  return tx.cuantoCobroQuoteVersion.create({
    data: {
      quoteId: options.quoteId,
      versionNumber: options.versionNumber,
      isCurrent: true,
      schemaVersion: CUANTO_COBRO_QUOTE_SCHEMA_VERSION,
      status: options.versionData.status ?? "DRAFT",
      currency: options.versionData.currency,
      chosenPriceCents: options.versionData.chosenPriceCents,
      recommendedPriceCents: options.versionData.recommendedPriceCents,
      minimumPriceCents: options.versionData.minimumPriceCents,
      clientDisplayName: denormalized.clientDisplayName,
      clientCompany: denormalized.clientCompany,
      clientEmail: denormalized.clientEmail,
      clientPhone: denormalized.clientPhone,
      jobLocation: denormalized.jobLocation,
      jobType: denormalized.jobType,
      jobDate,
      comment: options.versionData.comment,
      createdByUserId: options.createdByUserId,
      quotePayload: options.snapshots.quotePayload as unknown as Prisma.InputJsonValue,
      profileSnapshot: options.snapshots.profileSnapshot as unknown as Prisma.InputJsonValue,
      calculationSnapshot: options.snapshots.calculationSnapshot as unknown as Prisma.InputJsonValue,
      paymentOptionsSnapshot: options.snapshots.paymentOptionsSnapshot as Prisma.InputJsonValue,
      businessProfileSnapshot: options.snapshots.businessProfileSnapshot as Prisma.InputJsonValue,
    },
    include: versionInclude,
  });
}

export async function listQuotesForUser(params: ListQuotesParams): Promise<ListQuotesResult> {
  const limit = Math.min(Math.max(params.limit ?? 50, 1), 100);
  const cursor = params.cursor ? decodeCursor(params.cursor) : null;
  const search = params.search?.trim() ?? "";
  const jobDateFrom = parseFilterDate(params.jobDateFrom);
  const jobDateTo = parseFilterDate(params.jobDateTo);

  const amountFilters: Prisma.CuantoCobroQuoteWhereInput[] = [];
  if (params.amountMin != null) {
    amountFilters.push({
      OR: [
        { chosenPriceCents: { gte: params.amountMin } },
        { chosenPriceCents: null, recommendedPriceCents: { gte: params.amountMin } },
      ],
    });
  }
  if (params.amountMax != null) {
    amountFilters.push({
      OR: [
        { chosenPriceCents: { lte: params.amountMax } },
        { chosenPriceCents: null, recommendedPriceCents: { lte: params.amountMax } },
      ],
    });
  }

  const where: Prisma.CuantoCobroQuoteWhereInput = {
    userId: params.userId,
    ...(params.includeArchived ? {} : { archivedAt: null }),
    ...(params.status ? { status: params.status as QuoteRow["status"] } : {}),
    ...(params.hasConsulta === "1" ? { consultaId: { not: null } } : {}),
    ...(params.hasConsulta === "0" ? { consultaId: null } : {}),
    ...(jobDateFrom ? { jobDate: { gte: jobDateFrom } } : {}),
    ...(jobDateTo ? { jobDate: { lte: jobDateTo } } : {}),
    ...(search
      ? {
          OR: [
            { quoteNumber: { contains: search, mode: "insensitive" } },
            { clientDisplayName: { contains: search, mode: "insensitive" } },
            { clientCompany: { contains: search, mode: "insensitive" } },
            { clientEmail: { contains: search, mode: "insensitive" } },
            { clientPhone: { contains: search, mode: "insensitive" } },
            { jobType: { contains: search, mode: "insensitive" } },
            { jobLocation: { contains: search, mode: "insensitive" } },
          ],
        }
      : {}),
    ...(amountFilters.length > 0 ? { AND: amountFilters } : {}),
  };

  const rows = await prisma.cuantoCobroQuote.findMany({
    where: {
      AND: [
        where,
        ...(cursor
          ? [
              {
                OR: [
                  { updatedAt: { lt: cursor.updatedAt } },
                  { updatedAt: cursor.updatedAt, id: { lt: cursor.id } },
                ],
              },
            ]
          : []),
      ],
    },
    include: quoteInclude,
    orderBy: [{ updatedAt: "desc" }, { id: "desc" }],
    take: limit + 1,
  });

  const hasMore = rows.length > limit;
  const page = hasMore ? rows.slice(0, limit) : rows;
  const last = page[page.length - 1];

  return {
    items: page.map(mapQuoteListItem),
    nextCursor: hasMore && last ? encodeCursor(last.updatedAt, last.id) : null,
  };
}

export async function getQuoteDetailForUser(
  userId: number,
  quoteId: number,
): Promise<CuantoCobroQuoteDetailDto | null> {
  const row = await prisma.cuantoCobroQuote.findFirst({
    where: { id: quoteId, userId },
    include: {
      ...quoteInclude,
      versions: {
        include: versionInclude,
        orderBy: { versionNumber: "desc" },
      },
    },
  });
  if (!row) return null;

  const currentVersion = row.versions.find((v) => v.isCurrent) ?? row.versions[0];
  if (!currentVersion) return null;

  const photographer = await fetchPhotographerBrandingSourceForUser(userId);
  const businessProfileSnapshot = enrichBusinessProfileSnapshotForStorage(
    currentVersion.businessProfileSnapshot,
    photographer,
  );

  return {
    ...mapQuoteDetail(row, currentVersion),
    businessProfileSnapshot,
  };
}

export async function getQuoteVersionDetailForUser(
  userId: number,
  quoteId: number,
  versionNumber: number,
): Promise<CuantoCobroQuoteVersionDetailDto | null> {
  const row = await prisma.cuantoCobroQuoteVersion.findFirst({
    where: {
      quoteId,
      versionNumber,
      quote: { userId },
    },
    include: versionInclude,
  });
  if (!row) return null;

  const photographer = await fetchPhotographerBrandingSourceForUser(userId);
  return {
    ...mapVersionDetail(row),
    businessProfileSnapshot: enrichBusinessProfileSnapshotForStorage(
      row.businessProfileSnapshot,
      photographer,
    ),
  };
}

export async function archiveQuoteForUser(userId: number, quoteId: number): Promise<boolean> {
  const row = await prisma.cuantoCobroQuote.findFirst({
    where: { id: quoteId, userId, archivedAt: null },
    select: { id: true },
  });
  if (!row) return false;

  await prisma.cuantoCobroQuote.update({
    where: { id: quoteId },
    data: { archivedAt: new Date() },
  });

  return true;
}

export async function duplicateQuoteForUser(
  userId: number,
  quoteId: number,
): Promise<CuantoCobroQuoteDetailDto | null> {
  const source = await prisma.cuantoCobroQuote.findFirst({
    where: { id: quoteId, userId },
    include: {
      versions: {
        where: { isCurrent: true },
        take: 1,
      },
    },
  });
  if (!source) return null;

  const currentVersion = source.versions[0];
  if (!currentVersion) return null;

  const quote = parseQuotePayload(currentVersion.quotePayload);
  const quoteNumber = await allocateNextQuoteNumber(userId);

  const versionData: VersionWriteInput = {
    quote,
    profile: parseProfileSnapshot(currentVersion.profileSnapshot) ?? INITIAL_CUANTO_COBRO_PROFILE,
    calculationSnapshot: currentVersion.calculationSnapshot,
    currency: currentVersion.currency,
    chosenPriceCents: currentVersion.chosenPriceCents,
    recommendedPriceCents: currentVersion.recommendedPriceCents,
    minimumPriceCents: currentVersion.minimumPriceCents,
    comment: "",
    status: "DRAFT",
  };

  const snapshots = {
    quotePayload: quote,
    profileSnapshot: versionData.profile,
    calculationSnapshot: currentVersion.calculationSnapshot,
    paymentOptionsSnapshot: currentVersion.paymentOptionsSnapshot ?? {},
    businessProfileSnapshot: await resolveBusinessProfileSnapshotForVersion(
      userId,
      currentVersion.businessProfileSnapshot ?? {},
    ),
  };

  const created = await prisma.$transaction(async (tx) => {
    const header = await tx.cuantoCobroQuote.create({
      data: {
        userId,
        consultaId: null,
        quoteNumber,
        currentVersionNumber: 1,
        schemaVersion: CUANTO_COBRO_QUOTE_SCHEMA_VERSION,
        status: "DRAFT",
        currency: versionData.currency,
        chosenPriceCents: versionData.chosenPriceCents,
        recommendedPriceCents: versionData.recommendedPriceCents,
        minimumPriceCents: versionData.minimumPriceCents,
        clientDisplayName: currentVersion.clientDisplayName,
        clientCompany: currentVersion.clientCompany,
        clientEmail: currentVersion.clientEmail,
        clientPhone: currentVersion.clientPhone,
        jobLocation: currentVersion.jobLocation,
        jobType: currentVersion.jobType,
        jobDate: currentVersion.jobDate,
      },
    });

    await insertQuoteVersion(tx, {
      quoteId: header.id,
      versionNumber: 1,
      createdByUserId: userId,
      versionData,
      snapshots,
    });

    return tx.cuantoCobroQuote.findFirstOrThrow({
      where: { id: header.id },
      include: {
        ...quoteInclude,
        versions: {
          include: versionInclude,
          orderBy: { versionNumber: "desc" },
        },
      },
    });
  });

  const newCurrent = created.versions.find((v) => v.isCurrent) ?? created.versions[0];
  if (!newCurrent) return null;

  return mapQuoteDetail(created, newCurrent);
}

export async function createQuoteVersionForUser(
  userId: number,
  quoteId: number,
  rawInput: CreateCuantoCobroQuoteInput,
): Promise<CuantoCobroQuoteListItemDto> {
  const expediente = await prisma.cuantoCobroQuote.findFirst({
    where: { id: quoteId, userId, archivedAt: null },
    select: { id: true, consultaId: true, quoteNumber: true, currentVersionNumber: true },
  });
  if (!expediente) {
    throw new Error("Presupuesto no encontrado");
  }

  const quote = normalizeCuantoCobroQuote(rawInput.quote);
  const snapshots = buildVersionSnapshotsFromInput(rawInput, quote);
  snapshots.businessProfileSnapshot = await resolveBusinessProfileSnapshotForVersion(
    userId,
    snapshots.businessProfileSnapshot,
  );
  const versionData: VersionWriteInput = {
    quote,
    profile: snapshots.profileSnapshot,
    calculationSnapshot: snapshots.calculationSnapshot,
    currency: (rawInput.currency ?? "").trim(),
    chosenPriceCents: rawInput.chosenPriceCents ?? null,
    recommendedPriceCents: rawInput.recommendedPriceCents ?? null,
    minimumPriceCents: rawInput.minimumPriceCents ?? null,
    comment: (rawInput.versionComment ?? "").trim(),
    status: "DRAFT",
  };

  const nextVersionNumber = expediente.currentVersionNumber + 1;

  const row = await prisma.$transaction(async (tx) => {
    const version = await insertQuoteVersion(tx, {
      quoteId: expediente.id,
      versionNumber: nextVersionNumber,
      createdByUserId: userId,
      versionData,
      snapshots,
    });

    const header = await syncQuoteHeaderFromVersion(tx, expediente.id, nextVersionNumber, versionData);

    if (expediente.consultaId) {
      await recordQuoteVersionCreated(
        tx,
        userId,
        expediente.consultaId,
        expediente.quoteNumber,
        nextVersionNumber,
        expediente.id,
        version.id,
      );
    }

    return header;
  });

  return mapQuoteListItem(row);
}

export async function createQuoteForUser(
  userId: number,
  rawInput: CreateCuantoCobroQuoteInput,
): Promise<CuantoCobroQuoteListItemDto> {
  const quoteExpedienteId =
    typeof rawInput.quoteExpedienteId === "number" && rawInput.quoteExpedienteId > 0
      ? rawInput.quoteExpedienteId
      : null;

  if (quoteExpedienteId) {
    return createQuoteVersionForUser(userId, quoteExpedienteId, rawInput);
  }

  const quote = normalizeCuantoCobroQuote(rawInput.quote);
  const consultaId = typeof rawInput.consultaId === "number" && rawInput.consultaId > 0 ? rawInput.consultaId : null;
  const snapshots = buildVersionSnapshotsFromInput(rawInput, quote);
  snapshots.businessProfileSnapshot = await resolveBusinessProfileSnapshotForVersion(
    userId,
    snapshots.businessProfileSnapshot,
  );
  const denormalized = extractQuoteDenormalizedFields(quote);

  if (consultaId) {
    const consulta = await prisma.cuantoCobroConsulta.findFirst({
      where: { id: consultaId, userId, deletedAt: null },
      select: { id: true },
    });
    if (!consulta) {
      throw new Error("Consulta no encontrada");
    }
  }

  const quoteNumber = await allocateNextQuoteNumber(userId);
  const jobDate = parseJobDate(quote.client.jobDate);

  const versionData: VersionWriteInput = {
    quote,
    profile: snapshots.profileSnapshot,
    calculationSnapshot: snapshots.calculationSnapshot,
    currency: (rawInput.currency ?? "").trim(),
    chosenPriceCents: rawInput.chosenPriceCents ?? null,
    recommendedPriceCents: rawInput.recommendedPriceCents ?? null,
    minimumPriceCents: rawInput.minimumPriceCents ?? null,
    comment: (rawInput.versionComment ?? "").trim(),
    status: "DRAFT",
  };

  const row = await prisma.$transaction(async (tx) => {
    const header = await tx.cuantoCobroQuote.create({
      data: {
        userId,
        consultaId,
        quoteNumber,
        currentVersionNumber: 1,
        schemaVersion: CUANTO_COBRO_QUOTE_SCHEMA_VERSION,
        status: "DRAFT",
        currency: versionData.currency,
        chosenPriceCents: versionData.chosenPriceCents,
        recommendedPriceCents: versionData.recommendedPriceCents,
        minimumPriceCents: versionData.minimumPriceCents,
        clientDisplayName: denormalized.clientDisplayName,
        clientCompany: denormalized.clientCompany,
        clientEmail: denormalized.clientEmail,
        clientPhone: denormalized.clientPhone,
        jobLocation: denormalized.jobLocation,
        jobType: denormalized.jobType,
        jobDate,
      },
    });

    const version = await insertQuoteVersion(tx, {
      quoteId: header.id,
      versionNumber: 1,
      createdByUserId: userId,
      versionData,
      snapshots,
    });

    if (consultaId) {
      await linkConsultaPrimaryQuote(tx, userId, consultaId, header.id, header.quoteNumber);
      await recordQuoteVersionCreated(
        tx,
        userId,
        consultaId,
        header.quoteNumber,
        1,
        header.id,
        version.id,
      );
    }

    return tx.cuantoCobroQuote.findFirstOrThrow({
      where: { id: header.id },
      include: quoteInclude,
    });
  });

  return mapQuoteListItem(row);
}

export async function getQuoteSummaryForUser(
  userId: number,
  quoteId: number,
): Promise<CuantoCobroQuoteListItemDto | null> {
  const row = await prisma.cuantoCobroQuote.findFirst({
    where: { id: quoteId, userId },
    include: quoteInclude,
  });
  if (!row) return null;
  return mapQuoteListItem(row);
}
