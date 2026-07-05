import { parseCuantoCobroAmount } from "../amount-format";
import {
  CUANTO_COBRO_CONSULTA_SCHEMA_VERSION,
  type CuantoCobroConsultaInput,
} from "./types";
import type {
  CuantoCobroConsultaPipelineStage,
  CuantoCobroConsultaPriority,
  CuantoCobroConsultaSourceChannel,
  CuantoCobroConsultaStatus,
} from "@prisma/client";

function asTrimmedString(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function asNullableTrimmedString(value: unknown): string | null {
  const trimmed = asTrimmedString(value);
  return trimmed || null;
}

function parseDateOnly(value: unknown): string {
  const trimmed = asTrimmedString(value);
  if (!trimmed) return "";
  if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) return trimmed;
  return "";
}

function parseIsoDateTime(value: unknown): string {
  const trimmed = asTrimmedString(value);
  if (!trimmed) return "";
  const date = new Date(trimmed);
  return Number.isNaN(date.getTime()) ? "" : date.toISOString();
}

function parseProbability(value: unknown): number | null {
  if (value === null || value === undefined || value === "") return null;
  const num = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(num)) return null;
  return Math.max(0, Math.min(100, Math.round(num)));
}

function parseEnumValue<T extends string>(value: unknown, allowed: readonly T[], fallback: T): T {
  if (typeof value === "string" && (allowed as readonly string[]).includes(value)) {
    return value as T;
  }
  return fallback;
}

const PIPELINE_STAGES = [
  "NEW",
  "CONTACTED",
  "QUALIFIED",
  "PROPOSAL_SENT",
  "NEGOTIATION",
  "WON",
  "LOST",
] as const satisfies readonly CuantoCobroConsultaPipelineStage[];

const STATUSES = ["OPEN", "WON", "LOST", "ARCHIVED"] as const satisfies readonly CuantoCobroConsultaStatus[];

const PRIORITIES = ["LOW", "NORMAL", "HIGH"] as const satisfies readonly CuantoCobroConsultaPriority[];

const SOURCE_CHANNELS = [
  "MANUAL",
  "REFERRAL",
  "CLF",
  "WEBSITE_FORM",
  "META_ADS",
  "WHATSAPP",
  "INSTAGRAM",
  "OTHER",
] as const satisfies readonly CuantoCobroConsultaSourceChannel[];

function parseTags(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  const unique = new Set<string>();
  for (const item of value) {
    const tag = asTrimmedString(item);
    if (tag) unique.add(tag);
  }
  return Array.from(unique);
}

export function parseEstimatedValueCents(value: unknown): number | null {
  const parsed = parseCuantoCobroAmount(asTrimmedString(value));
  if (parsed === null || parsed < 0) return null;
  return Math.round(parsed);
}

export function normalizeCuantoCobroConsultaInput(raw: Partial<CuantoCobroConsultaInput>): CuantoCobroConsultaInput {
  return {
    title: asTrimmedString(raw.title),
    pipelineStage: parseEnumValue(raw.pipelineStage, PIPELINE_STAGES, "NEW"),
    status: parseEnumValue(raw.status, STATUSES, "OPEN"),
    priority: parseEnumValue(raw.priority, PRIORITIES, "NORMAL"),
    probability: parseProbability(raw.probability),
    jobType: asTrimmedString(raw.jobType),
    eventDate: parseDateOnly(raw.eventDate),
    eventEndDate: parseDateOnly(raw.eventEndDate),
    eventLocation: asTrimmedString(raw.eventLocation),
    eventCity: asTrimmedString(raw.eventCity),
    eventProvince: asTrimmedString(raw.eventProvince),
    eventCountry: asTrimmedString(raw.eventCountry),
    eventLatitude: asTrimmedString(raw.eventLatitude),
    eventLongitude: asTrimmedString(raw.eventLongitude),
    brief: asTrimmedString(raw.brief),
    currency: asTrimmedString(raw.currency).toUpperCase(),
    estimatedValue: asTrimmedString(raw.estimatedValue),
    clfClientKey: asTrimmedString(raw.clfClientKey),
    clientDisplayName: asTrimmedString(raw.clientDisplayName),
    clientCompany: asTrimmedString(raw.clientCompany),
    clientEmail: asTrimmedString(raw.clientEmail),
    clientPhone: asTrimmedString(raw.clientPhone),
    sourceChannel: parseEnumValue(raw.sourceChannel, SOURCE_CHANNELS, "MANUAL"),
    sourceDetail: asTrimmedString(raw.sourceDetail),
    nextActionTitle: asTrimmedString(raw.nextActionTitle),
    nextActionDueAt: parseIsoDateTime(raw.nextActionDueAt),
    tags: parseTags(raw.tags),
    lostReason: asTrimmedString(raw.lostReason),
  };
}

export function consultaInputToDbFields(input: CuantoCobroConsultaInput) {
  return {
    schemaVersion: CUANTO_COBRO_CONSULTA_SCHEMA_VERSION,
    title: input.title,
    pipelineStage: input.pipelineStage,
    status: input.status,
    priority: input.priority,
    probability: input.probability,
    jobType: input.jobType,
    eventDate: input.eventDate ? new Date(`${input.eventDate}T12:00:00.000Z`) : null,
    eventEndDate: input.eventEndDate ? new Date(`${input.eventEndDate}T12:00:00.000Z`) : null,
    eventLocation: input.eventLocation,
    eventCity: input.eventCity,
    eventProvince: input.eventProvince,
    eventCountry: input.eventCountry,
    eventLatitude: input.eventLatitude,
    eventLongitude: input.eventLongitude,
    brief: input.brief,
    currency: input.currency,
    estimatedValueCents: parseEstimatedValueCents(input.estimatedValue),
    clfClientKey: asNullableTrimmedString(input.clfClientKey),
    clientDisplayName: input.clientDisplayName,
    clientCompany: input.clientCompany,
    clientEmail: input.clientEmail,
    clientPhone: input.clientPhone,
    sourceChannel: input.sourceChannel,
    sourceDetail: input.sourceDetail,
    nextActionTitle: input.nextActionTitle,
    nextActionDueAt: input.nextActionDueAt ? new Date(input.nextActionDueAt) : null,
    tags: input.tags,
    lostReason: input.lostReason,
  };
}

export function formatDateOnlyFromDb(value: Date | null | undefined): string | null {
  if (!value) return null;
  return value.toISOString().slice(0, 10);
}

export function formatIsoFromDb(value: Date | null | undefined): string | null {
  if (!value) return null;
  return value.toISOString();
}
