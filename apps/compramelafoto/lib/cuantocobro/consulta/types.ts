import type {
  CuantoCobroConsultaActivityKind,
  CuantoCobroConsultaPipelineStage,
  CuantoCobroConsultaPriority,
  CuantoCobroConsultaSourceChannel,
  CuantoCobroConsultaStatus,
} from "@prisma/client";

export const CUANTO_COBRO_CONSULTA_SCHEMA_VERSION = 1;

export { CUANTO_COBRO_CONSULTA_NUMBER_PREFIX } from "./consulta-number-format";

export type CuantoCobroConsultaInput = {
  title: string;
  pipelineStage: CuantoCobroConsultaPipelineStage;
  status: CuantoCobroConsultaStatus;
  priority: CuantoCobroConsultaPriority;
  probability: number | null;
  jobType: string;
  eventDate: string;
  eventEndDate: string;
  eventLocation: string;
  eventCity: string;
  eventProvince: string;
  eventCountry: string;
  eventLatitude: string;
  eventLongitude: string;
  brief: string;
  currency: string;
  estimatedValue: string;
  clfClientKey: string;
  clientDisplayName: string;
  clientCompany: string;
  clientEmail: string;
  clientPhone: string;
  sourceChannel: CuantoCobroConsultaSourceChannel;
  sourceDetail: string;
  nextActionTitle: string;
  nextActionDueAt: string;
  tags: string[];
  lostReason: string;
};

export type CuantoCobroConsultaActivityDto = {
  id: number;
  kind: CuantoCobroConsultaActivityKind;
  title: string;
  body: string;
  actorUserId: number | null;
  occurredAt: string;
};

export type CuantoCobroConsultaNoteDto = {
  id: number;
  body: string;
  authorUserId: number;
  createdAt: string;
  updatedAt: string;
};

export type CuantoCobroConsultaFileDto = {
  id: number;
  fileName: string;
  mimeType: string;
  r2Key: string | null;
  sizeBytes: number | null;
  uploadedAt: string;
};

export type CuantoCobroConsultaDto = {
  id: number;
  consultaNumber: string;
  schemaVersion: number;
  title: string;
  pipelineStage: CuantoCobroConsultaPipelineStage;
  status: CuantoCobroConsultaStatus;
  priority: CuantoCobroConsultaPriority;
  probability: number | null;
  jobType: string;
  eventDate: string | null;
  eventEndDate: string | null;
  eventLocation: string;
  eventCity: string;
  eventProvince: string;
  eventCountry: string;
  eventLatitude: string;
  eventLongitude: string;
  brief: string;
  currency: string;
  estimatedValueCents: number | null;
  clfClientKey: string | null;
  clientDisplayName: string;
  clientCompany: string;
  clientEmail: string;
  clientPhone: string;
  sourceChannel: CuantoCobroConsultaSourceChannel;
  sourceDetail: string;
  sourceCapturedAt: string;
  nextActionTitle: string;
  nextActionDueAt: string | null;
  primaryQuoteId: number | null;
  primaryQuoteNumber: string | null;
  primaryQuoteStatus: string | null;
  wonQuoteId: number | null;
  confirmedOrderId: number | null;
  fotoOfficeJobId: string | null;
  tags: string[];
  lostReason: string;
  wonAt: string | null;
  lostAt: string | null;
  archivedAt: string | null;
  lastActivityAt: string;
  createdAt: string;
  updatedAt: string;
};

export type CuantoCobroConsultaDetailDto = CuantoCobroConsultaDto & {
  activities: CuantoCobroConsultaActivityDto[];
  notes: CuantoCobroConsultaNoteDto[];
  files: CuantoCobroConsultaFileDto[];
};

export type CuantoCobroConsultaListItemDto = Pick<
  CuantoCobroConsultaDto,
  | "id"
  | "consultaNumber"
  | "title"
  | "pipelineStage"
  | "status"
  | "priority"
  | "probability"
  | "jobType"
  | "eventDate"
  | "eventCity"
  | "clientDisplayName"
  | "clientCompany"
  | "estimatedValueCents"
  | "currency"
  | "nextActionTitle"
  | "nextActionDueAt"
  | "tags"
  | "primaryQuoteId"
  | "confirmedOrderId"
  | "lastActivityAt"
  | "createdAt"
>;

export const INITIAL_CUANTO_COBRO_CONSULTA_INPUT: CuantoCobroConsultaInput = {
  title: "",
  pipelineStage: "NEW",
  status: "OPEN",
  priority: "NORMAL",
  probability: null,
  jobType: "",
  eventDate: "",
  eventEndDate: "",
  eventLocation: "",
  eventCity: "",
  eventProvince: "",
  eventCountry: "",
  eventLatitude: "",
  eventLongitude: "",
  brief: "",
  currency: "",
  estimatedValue: "",
  clfClientKey: "",
  clientDisplayName: "",
  clientCompany: "",
  clientEmail: "",
  clientPhone: "",
  sourceChannel: "MANUAL",
  sourceDetail: "",
  nextActionTitle: "",
  nextActionDueAt: "",
  tags: [],
  lostReason: "",
};

export const CC_CONSULTA_PIPELINE_STAGE_LABELS: Record<CuantoCobroConsultaPipelineStage, string> = {
  NEW: "Nueva",
  CONTACTED: "Contactada",
  QUALIFIED: "Calificada",
  PROPOSAL_SENT: "Propuesta enviada",
  NEGOTIATION: "Negociación",
  WON: "Ganada",
  LOST: "Perdida",
};

export const CC_CONSULTA_STATUS_LABELS: Record<CuantoCobroConsultaStatus, string> = {
  OPEN: "Abierta",
  WON: "Ganada",
  LOST: "Perdida",
  ARCHIVED: "Archivada",
};

export const CC_CONSULTA_SOURCE_LABELS: Record<CuantoCobroConsultaSourceChannel, string> = {
  MANUAL: "Manual",
  REFERRAL: "Referido",
  CLF: "ComprameLaFoto",
  WEBSITE_FORM: "Formulario web",
  META_ADS: "Meta Ads",
  WHATSAPP: "WhatsApp",
  INSTAGRAM: "Instagram",
  OTHER: "Otro",
};

export const CC_CONSULTA_PRIORITY_LABELS: Record<CuantoCobroConsultaPriority, string> = {
  LOW: "Baja",
  NORMAL: "Normal",
  HIGH: "Alta",
};

export const CC_CONSULTA_JOB_TYPE_OPTIONS = [
  { value: "", label: "Sin especificar" },
  { value: "boda", label: "Boda" },
  { value: "evento", label: "Evento" },
  { value: "retrato", label: "Retrato / sesión" },
  { value: "producto", label: "Producto / comercial" },
  { value: "escolar", label: "Fotografía escolar" },
  { value: "otro", label: "Otro" },
] as const;
