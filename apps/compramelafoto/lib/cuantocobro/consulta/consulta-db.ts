import type { Prisma } from "@prisma/client";
import { CuantoCobroConsultaActivityKind, CuantoCobroConsultaPipelineStage } from "@prisma/client";
import { allocateNextConsultaNumber } from "@/lib/cuantocobro/consulta/consulta-number";
import {
  consultaInputToDbFields,
  formatDateOnlyFromDb,
  formatIsoFromDb,
  normalizeCuantoCobroConsultaInput,
} from "@/lib/cuantocobro/consulta/normalize";
import type {
  CuantoCobroConsultaActivityDto,
  CuantoCobroConsultaDetailDto,
  CuantoCobroConsultaDto,
  CuantoCobroConsultaFileDto,
  CuantoCobroConsultaInput,
  CuantoCobroConsultaListItemDto,
  CuantoCobroConsultaNoteDto,
} from "@/lib/cuantocobro/consulta/types";
import { prisma } from "@/lib/prisma";

type ConsultaRow = Prisma.CuantoCobroConsultaGetPayload<object>;
type ActivityRow = Prisma.CuantoCobroConsultaActivityGetPayload<object>;
type NoteRow = Prisma.CuantoCobroConsultaNoteGetPayload<object>;
type FileRow = Prisma.CuantoCobroConsultaFileGetPayload<object>;

export type ListConsultasParams = {
  userId: number;
  cursor?: string | null;
  limit?: number;
  search?: string | null;
  status?: string | null;
  pipelineStage?: string | null;
  includeArchived?: boolean;
};

export type ListConsultasResult = {
  items: CuantoCobroConsultaListItemDto[];
  nextCursor: string | null;
};

function mapActivity(row: ActivityRow): CuantoCobroConsultaActivityDto {
  return {
    id: row.id,
    kind: row.kind,
    title: row.title,
    body: row.body,
    actorUserId: row.actorUserId,
    occurredAt: row.occurredAt.toISOString(),
  };
}

function mapNote(row: NoteRow): CuantoCobroConsultaNoteDto {
  return {
    id: row.id,
    body: row.body,
    authorUserId: row.authorUserId,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

function mapFile(row: FileRow): CuantoCobroConsultaFileDto {
  return {
    id: row.id,
    fileName: row.fileName,
    mimeType: row.mimeType,
    r2Key: row.r2Key,
    sizeBytes: row.sizeBytes,
    uploadedAt: row.uploadedAt.toISOString(),
  };
}

export function mapConsultaToDto(row: ConsultaRow): CuantoCobroConsultaDto {
  return {
    id: row.id,
    consultaNumber: row.consultaNumber,
    schemaVersion: row.schemaVersion,
    title: row.title,
    pipelineStage: row.pipelineStage,
    status: row.status,
    priority: row.priority,
    probability: row.probability,
    jobType: row.jobType,
    eventDate: formatDateOnlyFromDb(row.eventDate),
    eventEndDate: formatDateOnlyFromDb(row.eventEndDate),
    eventLocation: row.eventLocation,
    eventCity: row.eventCity,
    eventProvince: row.eventProvince,
    eventCountry: row.eventCountry,
    eventLatitude: row.eventLatitude,
    eventLongitude: row.eventLongitude,
    brief: row.brief,
    currency: row.currency,
    estimatedValueCents: row.estimatedValueCents,
    clfClientKey: row.clfClientKey,
    clientDisplayName: row.clientDisplayName,
    clientCompany: row.clientCompany,
    clientEmail: row.clientEmail,
    clientPhone: row.clientPhone,
    sourceChannel: row.sourceChannel,
    sourceDetail: row.sourceDetail,
    sourceCapturedAt: row.sourceCapturedAt.toISOString(),
    nextActionTitle: row.nextActionTitle,
    nextActionDueAt: formatIsoFromDb(row.nextActionDueAt),
    primaryQuoteId: row.primaryQuoteId,
    primaryQuoteNumber: null,
    primaryQuoteStatus: null,
    wonQuoteId: row.wonQuoteId,
    confirmedOrderId: row.confirmedOrderId,
    fotoOfficeJobId: row.fotoOfficeJobId,
    tags: row.tags,
    lostReason: row.lostReason,
    wonAt: formatIsoFromDb(row.wonAt),
    lostAt: formatIsoFromDb(row.lostAt),
    archivedAt: formatIsoFromDb(row.archivedAt),
    lastActivityAt: row.lastActivityAt.toISOString(),
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

function mapConsultaToListItem(row: ConsultaRow): CuantoCobroConsultaListItemDto {
  const dto = mapConsultaToDto(row);
  return {
    id: dto.id,
    consultaNumber: dto.consultaNumber,
    title: dto.title,
    pipelineStage: dto.pipelineStage,
    status: dto.status,
    priority: dto.priority,
    probability: dto.probability,
    jobType: dto.jobType,
    eventDate: dto.eventDate,
    eventCity: dto.eventCity,
    clientDisplayName: dto.clientDisplayName,
    clientCompany: dto.clientCompany,
    estimatedValueCents: dto.estimatedValueCents,
    currency: dto.currency,
    nextActionTitle: dto.nextActionTitle,
    nextActionDueAt: dto.nextActionDueAt,
    tags: dto.tags,
    primaryQuoteId: dto.primaryQuoteId,
    confirmedOrderId: dto.confirmedOrderId,
    lastActivityAt: dto.lastActivityAt,
    createdAt: dto.createdAt,
  };
}

function encodeCursor(lastActivityAt: Date, id: number): string {
  return Buffer.from(`${lastActivityAt.toISOString()}|${id}`, "utf8").toString("base64url");
}

function decodeCursor(cursor: string): { lastActivityAt: Date; id: number } | null {
  try {
    const raw = Buffer.from(cursor, "base64url").toString("utf8");
    const [iso, idRaw] = raw.split("|");
    const id = Number(idRaw);
    const lastActivityAt = new Date(iso);
    if (!Number.isFinite(id) || Number.isNaN(lastActivityAt.getTime())) return null;
    return { lastActivityAt, id };
  } catch {
    return null;
  }
}

async function recordActivity(
  tx: Prisma.TransactionClient,
  consultaId: number,
  kind: CuantoCobroConsultaActivityKind,
  title: string,
  body: string,
  actorUserId: number | null,
  metadata?: Prisma.InputJsonValue,
) {
  await tx.cuantoCobroConsultaActivity.create({
    data: {
      consultaId,
      kind,
      title,
      body,
      actorUserId,
      metadata,
    },
  });
}

function buildStatusTimestamps(input: CuantoCobroConsultaInput, existing?: ConsultaRow) {
  const now = new Date();
  const timestamps: {
    wonAt?: Date | null;
    lostAt?: Date | null;
    archivedAt?: Date | null;
  } = {};

  if (input.status === "WON" && existing?.status !== "WON") {
    timestamps.wonAt = now;
  }
  if (input.status === "LOST" && existing?.status !== "LOST") {
    timestamps.lostAt = now;
  }
  if (input.status === "ARCHIVED" && existing?.status !== "ARCHIVED") {
    timestamps.archivedAt = now;
  }

  return timestamps;
}

export async function listConsultasForUser(params: ListConsultasParams): Promise<ListConsultasResult> {
  const limit = Math.min(Math.max(params.limit ?? 50, 1), 100);
  const cursor = params.cursor ? decodeCursor(params.cursor) : null;
  const search = params.search?.trim() ?? "";

  const where: Prisma.CuantoCobroConsultaWhereInput = {
    userId: params.userId,
    deletedAt: null,
    ...(params.includeArchived ? {} : { status: { not: "ARCHIVED" } }),
    ...(params.status ? { status: params.status as ConsultaRow["status"] } : {}),
    ...(params.pipelineStage
      ? { pipelineStage: params.pipelineStage as ConsultaRow["pipelineStage"] }
      : {}),
    ...(search
      ? {
          OR: [
            { consultaNumber: { contains: search, mode: "insensitive" } },
            { title: { contains: search, mode: "insensitive" } },
            { clientDisplayName: { contains: search, mode: "insensitive" } },
            { clientCompany: { contains: search, mode: "insensitive" } },
            { clientEmail: { contains: search, mode: "insensitive" } },
            { eventLocation: { contains: search, mode: "insensitive" } },
            { eventCity: { contains: search, mode: "insensitive" } },
            { brief: { contains: search, mode: "insensitive" } },
          ],
        }
      : {}),
  };

  const rows = await prisma.cuantoCobroConsulta.findMany({
    where: {
      AND: [
        where,
        ...(cursor
          ? [
              {
                OR: [
                  { lastActivityAt: { lt: cursor.lastActivityAt } },
                  { lastActivityAt: cursor.lastActivityAt, id: { lt: cursor.id } },
                ],
              },
            ]
          : []),
      ],
    },
    orderBy: [{ lastActivityAt: "desc" }, { id: "desc" }],
    take: limit + 1,
  });

  const hasMore = rows.length > limit;
  const page = hasMore ? rows.slice(0, limit) : rows;
  const last = page[page.length - 1];

  return {
    items: page.map(mapConsultaToListItem),
    nextCursor: hasMore && last ? encodeCursor(last.lastActivityAt, last.id) : null,
  };
}

export async function getConsultaForUser(userId: number, consultaId: number): Promise<CuantoCobroConsultaDetailDto | null> {
  const row = await prisma.cuantoCobroConsulta.findFirst({
    where: { id: consultaId, userId, deletedAt: null },
    include: {
      activities: { orderBy: { occurredAt: "desc" }, take: 100 },
      notes: { orderBy: { createdAt: "desc" }, take: 100 },
      files: { orderBy: { uploadedAt: "desc" } },
    },
  });

  if (!row) return null;

  let primaryQuoteNumber: string | null = null;
  let primaryQuoteStatus: string | null = null;
  if (row.primaryQuoteId) {
    const primaryQuote = await prisma.cuantoCobroQuote.findFirst({
      where: { id: row.primaryQuoteId, userId },
      select: { quoteNumber: true, status: true },
    });
    if (primaryQuote) {
      primaryQuoteNumber = primaryQuote.quoteNumber;
      primaryQuoteStatus = primaryQuote.status;
    }
  }

  return {
    ...mapConsultaToDto(row),
    primaryQuoteNumber,
    primaryQuoteStatus,
    activities: row.activities.map(mapActivity),
    notes: row.notes.map(mapNote),
    files: row.files.map(mapFile),
  };
}

export async function createConsultaForUser(
  userId: number,
  rawInput: Partial<CuantoCobroConsultaInput>,
): Promise<CuantoCobroConsultaDetailDto> {
  const input = normalizeCuantoCobroConsultaInput(rawInput);
  const fields = consultaInputToDbFields(input);
  const consultaNumber = await allocateNextConsultaNumber(userId);
  const now = new Date();

  const row = await prisma.$transaction(async (tx) => {
    const created = await tx.cuantoCobroConsulta.create({
      data: {
        userId,
        consultaNumber,
        ...fields,
        lastActivityAt: now,
        ...buildStatusTimestamps(input),
      },
    });

    await recordActivity(
      tx,
      created.id,
      CuantoCobroConsultaActivityKind.CONSULTA_CREATED,
      "Consulta creada",
      input.title || consultaNumber,
      userId,
    );

    if (input.nextActionTitle) {
      await recordActivity(
        tx,
        created.id,
        CuantoCobroConsultaActivityKind.NEXT_ACTION_SET,
        "Próxima acción definida",
        input.nextActionTitle,
        userId,
      );
    }

    return created;
  });

  const detail = await getConsultaForUser(userId, row.id);
  if (!detail) throw new Error("No se pudo cargar la consulta creada");
  return detail;
}

export async function updateConsultaForUser(
  userId: number,
  consultaId: number,
  rawInput: Partial<CuantoCobroConsultaInput>,
): Promise<CuantoCobroConsultaDetailDto | null> {
  const existing = await prisma.cuantoCobroConsulta.findFirst({
    where: { id: consultaId, userId, deletedAt: null },
  });
  if (!existing) return null;

  const input = normalizeCuantoCobroConsultaInput({
    ...mapConsultaToInputShape(existing),
    ...rawInput,
  });
  const fields = consultaInputToDbFields(input);
  const now = new Date();

  await prisma.$transaction(async (tx) => {
    await tx.cuantoCobroConsulta.update({
      where: { id: consultaId },
      data: {
        ...fields,
        lastActivityAt: now,
        ...buildStatusTimestamps(input, existing),
      },
    });

    if (existing.pipelineStage !== input.pipelineStage) {
      await recordActivity(
        tx,
        consultaId,
        CuantoCobroConsultaActivityKind.STAGE_CHANGED,
        "Etapa actualizada",
        `${existing.pipelineStage} → ${input.pipelineStage}`,
        userId,
        { from: existing.pipelineStage, to: input.pipelineStage },
      );
    }

    if (existing.status !== input.status) {
      await recordActivity(
        tx,
        consultaId,
        CuantoCobroConsultaActivityKind.STATUS_CHANGED,
        "Estado actualizado",
        `${existing.status} → ${input.status}`,
        userId,
        { from: existing.status, to: input.status },
      );
    }

    const tagsChanged =
      existing.tags.length !== input.tags.length ||
      existing.tags.some((tag, index) => tag !== input.tags[index]);
    if (tagsChanged) {
      await recordActivity(
        tx,
        consultaId,
        CuantoCobroConsultaActivityKind.TAGS_UPDATED,
        "Etiquetas actualizadas",
        input.tags.join(", "),
        userId,
        { tags: input.tags },
      );
    }

    if (
      existing.nextActionTitle !== input.nextActionTitle ||
      existing.nextActionDueAt?.toISOString() !==
        (input.nextActionDueAt ? new Date(input.nextActionDueAt).toISOString() : null)
    ) {
      if (input.nextActionTitle) {
        await recordActivity(
          tx,
          consultaId,
          CuantoCobroConsultaActivityKind.NEXT_ACTION_SET,
          "Próxima acción actualizada",
          input.nextActionTitle,
          userId,
        );
      }
    }

    if (
      existing.clfClientKey !== fields.clfClientKey ||
      existing.clientEmail !== fields.clientEmail ||
      existing.clientDisplayName !== fields.clientDisplayName
    ) {
      if (fields.clientDisplayName || fields.clientEmail) {
        await recordActivity(
          tx,
          consultaId,
          CuantoCobroConsultaActivityKind.CLIENT_LINKED,
          "Cliente actualizado",
          [fields.clientDisplayName, fields.clientEmail].filter(Boolean).join(" · "),
          userId,
        );
      }
    }

    await recordActivity(
      tx,
      consultaId,
      CuantoCobroConsultaActivityKind.CONSULTA_UPDATED,
      "Consulta actualizada",
      input.title || existing.consultaNumber,
      userId,
    );
  });

  return getConsultaForUser(userId, consultaId);
}

export async function softDeleteConsultaForUser(userId: number, consultaId: number): Promise<boolean> {
  const existing = await prisma.cuantoCobroConsulta.findFirst({
    where: { id: consultaId, userId, deletedAt: null },
    select: { id: true, status: true },
  });
  if (!existing) return false;
  if (existing.status !== "OPEN") return false;

  await prisma.cuantoCobroConsulta.update({
    where: { id: consultaId },
    data: { deletedAt: new Date() },
  });
  return true;
}

export async function addConsultaNoteForUser(
  userId: number,
  consultaId: number,
  body: string,
): Promise<CuantoCobroConsultaNoteDto | null> {
  const trimmed = body.trim();
  if (!trimmed) return null;

  const consulta = await prisma.cuantoCobroConsulta.findFirst({
    where: { id: consultaId, userId, deletedAt: null },
    select: { id: true },
  });
  if (!consulta) return null;

  const now = new Date();

  const note = await prisma.$transaction(async (tx) => {
    const created = await tx.cuantoCobroConsultaNote.create({
      data: {
        consultaId,
        body: trimmed,
        authorUserId: userId,
      },
    });

    await tx.cuantoCobroConsulta.update({
      where: { id: consultaId },
      data: { lastActivityAt: now },
    });

    await recordActivity(
      tx,
      consultaId,
      CuantoCobroConsultaActivityKind.NOTE_ADDED,
      "Nota agregada",
      trimmed.slice(0, 200),
      userId,
    );

    return created;
  });

  return mapNote(note);
}

function mapConsultaToInputShape(row: ConsultaRow): CuantoCobroConsultaInput {
  return {
    title: row.title,
    pipelineStage: row.pipelineStage,
    status: row.status,
    priority: row.priority,
    probability: row.probability,
    jobType: row.jobType,
    eventDate: formatDateOnlyFromDb(row.eventDate) ?? "",
    eventEndDate: formatDateOnlyFromDb(row.eventEndDate) ?? "",
    eventLocation: row.eventLocation,
    eventCity: row.eventCity,
    eventProvince: row.eventProvince,
    eventCountry: row.eventCountry,
    eventLatitude: row.eventLatitude,
    eventLongitude: row.eventLongitude,
    brief: row.brief,
    currency: row.currency,
    estimatedValue: row.estimatedValueCents != null ? String(row.estimatedValueCents) : "",
    clfClientKey: row.clfClientKey ?? "",
    clientDisplayName: row.clientDisplayName,
    clientCompany: row.clientCompany,
    clientEmail: row.clientEmail,
    clientPhone: row.clientPhone,
    sourceChannel: row.sourceChannel,
    sourceDetail: row.sourceDetail,
    nextActionTitle: row.nextActionTitle,
    nextActionDueAt: formatIsoFromDb(row.nextActionDueAt) ?? "",
    tags: row.tags,
    lostReason: row.lostReason,
  };
}

export async function linkConsultaPrimaryQuote(
  tx: Prisma.TransactionClient,
  userId: number,
  consultaId: number,
  quoteId: number,
  quoteNumber: string,
): Promise<void> {
  const consulta = await tx.cuantoCobroConsulta.findFirst({
    where: { id: consultaId, userId, deletedAt: null },
    select: { id: true, pipelineStage: true },
  });

  if (!consulta) {
    throw new Error("Consulta no encontrada");
  }

  const shouldAdvanceStage =
    consulta.pipelineStage === "NEW" ||
    consulta.pipelineStage === "CONTACTED" ||
    consulta.pipelineStage === "QUALIFIED";

  const now = new Date();

  await tx.cuantoCobroConsulta.update({
    where: { id: consultaId },
    data: {
      primaryQuoteId: quoteId,
      lastActivityAt: now,
      ...(shouldAdvanceStage ? { pipelineStage: CuantoCobroConsultaPipelineStage.PROPOSAL_SENT } : {}),
    },
  });

  await recordActivity(
    tx,
    consultaId,
    CuantoCobroConsultaActivityKind.QUOTE_LINKED,
    "Presupuesto vinculado",
    quoteNumber,
    userId,
    { quoteId },
  );

  if (shouldAdvanceStage) {
    await recordActivity(
      tx,
      consultaId,
      CuantoCobroConsultaActivityKind.STAGE_CHANGED,
      "Etapa actualizada",
      "Propuesta enviada",
      userId,
    );
  }
}

export async function recordQuoteVersionCreated(
  tx: Prisma.TransactionClient,
  userId: number,
  consultaId: number,
  quoteNumber: string,
  versionNumber: number,
  quoteId: number,
  versionId: number,
): Promise<void> {
  const now = new Date();

  await tx.cuantoCobroConsulta.update({
    where: { id: consultaId },
    data: { lastActivityAt: now },
  });

  await recordActivity(
    tx,
    consultaId,
    CuantoCobroConsultaActivityKind.QUOTE_VERSION_CREATED,
    `Presupuesto ${versionNumber === 1 ? "V1" : `V${versionNumber}`} creado`,
    quoteNumber,
    userId,
    { quoteId, versionId, versionNumber },
  );
}

export async function recordQuoteSent(
  tx: Prisma.TransactionClient,
  userId: number,
  consultaId: number,
  quoteNumber: string,
  versionNumber: number,
  quoteId: number,
  versionId: number,
  recipientEmail: string,
): Promise<void> {
  const now = new Date();

  await tx.cuantoCobroConsulta.update({
    where: { id: consultaId },
    data: { lastActivityAt: now },
  });

  await recordActivity(
    tx,
    consultaId,
    CuantoCobroConsultaActivityKind.QUOTE_SENT,
    "Presupuesto enviado al cliente",
    `${quoteNumber} · V${versionNumber} → ${recipientEmail}`,
    userId,
    { quoteId, versionId, versionNumber, recipientEmail },
  );
}

export async function recordQuoteViewedByClient(
  tx: Prisma.TransactionClient,
  userId: number,
  consultaId: number,
  quoteNumber: string,
  versionNumber: number,
  quoteId: number,
  versionId: number,
): Promise<void> {
  const now = new Date();

  await tx.cuantoCobroConsulta.update({
    where: { id: consultaId },
    data: { lastActivityAt: now },
  });

  await recordActivity(
    tx,
    consultaId,
    CuantoCobroConsultaActivityKind.QUOTE_VIEWED_BY_CLIENT,
    "El cliente vio el presupuesto",
    `${quoteNumber} · V${versionNumber}`,
    userId,
    { quoteId, versionId, versionNumber },
  );
}
