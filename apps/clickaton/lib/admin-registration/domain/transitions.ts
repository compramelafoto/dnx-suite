import type { ClickatonPaymentStatus, ClickatonRegistrationStatus } from "@/lib/registration/domain/types";
import { AdminRegistrationTransitionError } from "./errors";
import type { AdminRegistrationAction } from "./types";

export type AdminTransitionPlan = {
  action: AdminRegistrationAction;
  label: string;
  description: string;
  nextStatus: ClickatonRegistrationStatus;
  nextPaymentStatus: (current: ClickatonPaymentStatus, totalAmount: number) => ClickatonPaymentStatus;
  from: readonly ClickatonRegistrationStatus[];
  /** Efectos documentados para UI/auditoría. */
  effects: string[];
  requiresReason: boolean;
};

/**
 * Transiciones administrativas MVP (dominio 10D2).
 * No incluye mark_paid de webhook ni refund monetario real.
 */
export const ADMIN_TRANSITION_PLANS: readonly AdminTransitionPlan[] = [
  {
    action: "confirm_admin",
    label: "Confirmar inscripción",
    description:
      "Confirmación administrativa excepcional (cortesía / excepción). No marca un cobro de Mercado Pago.",
    nextStatus: "CONFIRMED",
    nextPaymentStatus: (current, total) => {
      if (total === 0) return "NOT_REQUIRED";
      if (current === "APPROVED" || current === "NOT_REQUIRED") return current;
      return "APPROVED";
    },
    from: ["DRAFT", "PENDING_PAYMENT", "WAITLISTED"],
    effects: [
      "La inscripción quedará confirmada",
      "Se consume la reserva de cupo activa, si existe",
      "Se consumen las reservas de stock activas, si existen",
      "Queda registrado en el historial y la auditoría",
    ],
    requiresReason: true,
  },
  {
    action: "cancel",
    label: "Cancelar inscripción",
    description: "Cancela la inscripción y libera holds activos. No elimina el registro.",
    nextStatus: "CANCELLED",
    nextPaymentStatus: (current) => {
      if (current === "APPROVED") return "CANCELLED";
      if (current === "NOT_REQUIRED") return "CANCELLED";
      return "CANCELLED";
    },
    from: ["DRAFT", "PENDING_PAYMENT", "WAITLISTED", "CONFIRMED"],
    effects: [
      "La inscripción quedará cancelada",
      "Se liberan las reservas activas de cupo y stock",
      "No se borran el registro ni los productos asociados",
    ],
    requiresReason: true,
  },
  {
    action: "disqualify",
    label: "Descalificar",
    description: "Marca la inscripción confirmada como descalificada.",
    nextStatus: "DISQUALIFIED",
    nextPaymentStatus: (current) => current,
    from: ["CONFIRMED"],
    effects: [
      "La inscripción quedará descalificada",
      "No modifica reservas de cupo o stock ya consumidas",
    ],
    requiresReason: true,
  },
  {
    action: "reactivate",
    label: "Reactivar a borrador",
    description:
      "Vuelve una inscripción cancelada a borrador. No recrea reservas automáticamente; el cupo se reevalúa después.",
    nextStatus: "DRAFT",
    nextPaymentStatus: () => "NOT_REQUIRED",
    from: ["CANCELLED"],
    effects: [
      "La inscripción vuelve a borrador",
      "Se limpia la fecha de cancelación",
      "No crea reservas nuevas (evita cupo fantasma)",
    ],
    requiresReason: true,
  },
] as const;

export function planForAction(action: AdminRegistrationAction): AdminTransitionPlan {
  const plan = ADMIN_TRANSITION_PLANS.find((p) => p.action === action);
  if (!plan) throw new AdminRegistrationTransitionError(`Acción desconocida: ${action}`);
  return plan;
}

export function assertTransitionAllowed(
  action: AdminRegistrationAction,
  current: ClickatonRegistrationStatus,
): AdminTransitionPlan {
  const plan = planForAction(action);
  if (!plan.from.includes(current)) {
    throw new AdminRegistrationTransitionError(
      `No se puede ${plan.label.toLowerCase()} desde estado ${current}.`,
      { action, current, allowedFrom: plan.from },
    );
  }
  return plan;
}

export function availableActionsFor(
  status: ClickatonRegistrationStatus,
): AdminRegistrationAction[] {
  return ADMIN_TRANSITION_PLANS.filter((p) => p.from.includes(status)).map((p) => p.action);
}
