import { formatCuantoCobroCurrency } from "@/lib/cuantocobro/calculate-cuanto-cobro";
import {
  CC_CONSULTA_JOB_TYPE_OPTIONS,
  CC_CONSULTA_PIPELINE_STAGE_LABELS,
  CC_CONSULTA_PRIORITY_LABELS,
  CC_CONSULTA_SOURCE_LABELS,
  CC_CONSULTA_STATUS_LABELS,
} from "@/lib/cuantocobro/consulta/types";
import type {
  CuantoCobroConsultaPipelineStage,
  CuantoCobroConsultaPriority,
  CuantoCobroConsultaSourceChannel,
  CuantoCobroConsultaStatus,
} from "@prisma/client";

export function formatConsultaJobType(value: string): string {
  return CC_CONSULTA_JOB_TYPE_OPTIONS.find((opt) => opt.value === value)?.label ?? (value || "—");
}

export function formatConsultaPipelineStage(stage: CuantoCobroConsultaPipelineStage): string {
  return CC_CONSULTA_PIPELINE_STAGE_LABELS[stage] ?? stage;
}

export function formatConsultaStatus(status: CuantoCobroConsultaStatus): string {
  return CC_CONSULTA_STATUS_LABELS[status] ?? status;
}

export function formatConsultaSource(channel: CuantoCobroConsultaSourceChannel): string {
  return CC_CONSULTA_SOURCE_LABELS[channel] ?? channel;
}

export function formatConsultaPriority(priority: CuantoCobroConsultaPriority): string {
  return CC_CONSULTA_PRIORITY_LABELS[priority] ?? priority;
}

export function formatConsultaMoney(cents: number | null | undefined, currency: string): string {
  if (cents == null) return "—";
  return formatCuantoCobroCurrency(cents, currency || "ARS");
}

export function formatConsultaDate(value: string | null | undefined): string {
  if (!value) return "—";
  try {
    const [year, month, day] = value.split("-").map(Number);
    if (!year || !month || !day) return value;
    return new Date(year, month - 1, day).toLocaleDateString("es-AR", {
      day: "numeric",
      month: "short",
      year: "numeric",
    });
  } catch {
    return value;
  }
}

export function formatConsultaDateTime(value: string | null | undefined): string {
  if (!value) return "—";
  try {
    return new Date(value).toLocaleString("es-AR", {
      day: "numeric",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return value;
  }
}

export function formatConsultaRelativeTime(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  const diffMs = Date.now() - date.getTime();
  const diffMin = Math.floor(diffMs / 60000);
  if (diffMin < 1) return "ahora";
  if (diffMin < 60) return `hace ${diffMin} min`;
  const diffHours = Math.floor(diffMin / 60);
  if (diffHours < 24) return `hace ${diffHours} h`;
  const diffDays = Math.floor(diffHours / 24);
  if (diffDays < 30) return `hace ${diffDays} d`;
  return formatConsultaDateTime(value);
}

export function formatClientLine(name: string, company: string): string {
  const n = name.trim();
  const c = company.trim();
  if (n && c) return `${n} (${c})`;
  return n || c || "Sin cliente";
}
