import { parseArsToMinor, minorToDecimalString } from "@/lib/membership/money";
import { parseDateOnly } from "./forms";

/**
 * La propuesta de proyecto que presenta un socio desde el portal (diseño §10). Módulo PURO.
 *
 * Entra como "Propuesta de socio": la comisión la acepta (pasa a Propuesto y al temario) o la
 * archiva con motivo. El socio ve en qué quedó.
 */

export type ProposalValues = {
  title: string;
  description: string;
  /** Costo aproximado, como texto decimal para `Decimal(12,2)`, o `null` si no lo sabe. */
  approxCostArs: string | null;
  deadlineAt: Date | null;
};

export function parseProposal(input: {
  title?: unknown;
  description?: unknown;
  approxCost?: unknown;
  deadline?: unknown;
}): { ok: true; values: ProposalValues } | { ok: false; error: string } {
  const title = String(input.title ?? "").trim();
  if (title === "") return { ok: false, error: "Poné un título para tu propuesta." };
  if (title.length > 160) return { ok: false, error: "El título es demasiado largo." };
  const description = String(input.description ?? "").trim();
  if (description.length < 20) {
    return { ok: false, error: "Contá un poco más: qué es, para qué sirve y qué hace falta (al menos un par de renglones)." };
  }
  if (description.length > 10_000) return { ok: false, error: "La descripción es demasiado larga." };
  const costoCrudo = String(input.approxCost ?? "").trim();
  let approxCostArs: string | null = null;
  if (costoCrudo) {
    const minor = parseArsToMinor(costoCrudo);
    if (minor === null) return { ok: false, error: "El costo aproximado no se entiende. Escribilo como 150.000" };
    approxCostArs = minorToDecimalString(minor);
  }
  const fechaCruda = String(input.deadline ?? "").trim();
  const deadlineAt = fechaCruda ? parseDateOnly(fechaCruda) : null;
  if (fechaCruda && !deadlineAt) return { ok: false, error: "La fecha no se entiende." };
  return { ok: true, values: { title, description, approxCostArs, deadlineAt } };
}

/** Cómo se le cuenta al socio en qué quedó su propuesta. */
export function proposalStateForMember(status: string): { label: string; tone: "warning" | "success" | "danger" | "info" } {
  if (status === "MEMBER_PROPOSAL") return { label: "En revisión de la comisión", tone: "warning" };
  if (status === "ARCHIVED") return { label: "Archivada", tone: "danger" };
  if (status === "REJECTED") return { label: "No aprobada", tone: "danger" };
  if (status === "CANCELLED") return { label: "Cancelada", tone: "danger" };
  if (status === "APPROVED" || status === "IN_PROGRESS") return { label: "Aprobada", tone: "success" };
  if (status === "DONE") return { label: "Realizada", tone: "success" };
  return { label: "Aceptada: la comisión la está tratando", tone: "info" };
}
