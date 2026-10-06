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
  /** Cómo se podría conseguir el dinero para cumplir el proyecto. */
  fundingIdea: string | null;
  /** En qué se compromete a colaborar quien propone. */
  proposerCommitment: string | null;
};

const MAX_RENGLON = 2_000;

export function parseProposal(input: {
  title?: unknown;
  description?: unknown;
  approxCost?: unknown;
  deadline?: unknown;
  fundingIdea?: unknown;
  commitment?: unknown;
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
  const fundingIdea = String(input.fundingIdea ?? "").trim() || null;
  if (fundingIdea && fundingIdea.length > MAX_RENGLON) return { ok: false, error: "La idea para conseguir los fondos es demasiado larga." };
  const proposerCommitment = String(input.commitment ?? "").trim() || null;
  if (!proposerCommitment) {
    return { ok: false, error: "Contanos cómo podrías colaborar: qué tarea te comprometés a hacer para que el proyecto salga." };
  }
  if (proposerCommitment.length > MAX_RENGLON) return { ok: false, error: "Tu compromiso es demasiado largo." };
  return { ok: true, values: { title, description, approxCostArs, deadlineAt, fundingIdea, proposerCommitment } };
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
