import type { AdminRegistrationAuthorization } from "../auth/admin-registration-auth";
import {
  AdminRegistrationNotFoundError,
  AdminRegistrationTransitionError,
  AdminRegistrationValidationError,
  AdminRegistrationError,
} from "../domain/errors";
import type { ClickatonAdminRegistrationRepository } from "../domain/repository";
import { assertTransitionAllowed } from "../domain/transitions";
import type {
  AdminRegistrationAction,
  AdminRegistrationActor,
  AdminRegistrationDetail,
  AdminRegistrationFilters,
  AdminRegistrationListItem,
  TransitionResult,
} from "../domain/types";

export function createAdminRegistrationService(deps: {
  repo: ClickatonAdminRegistrationRepository;
  auth: AdminRegistrationAuthorization;
}) {
  const { repo, auth } = deps;

  return {
    async listRegistrations(
      actor: AdminRegistrationActor,
      filters: AdminRegistrationFilters,
    ): Promise<AdminRegistrationListItem[]> {
      auth.assertCapability(actor, "registration.read");
      return repo.list(filters);
    },

    async getRegistration(
      actor: AdminRegistrationActor,
      id: string,
    ): Promise<AdminRegistrationDetail> {
      auth.assertCapability(actor, "registration.read");
      const row = await repo.getById(id);
      if (!row) throw new AdminRegistrationNotFoundError(id);
      return row;
    },

    async transitionRegistration(
      actor: AdminRegistrationActor,
      input: {
        registrationId: string;
        action: AdminRegistrationAction;
        reason: string;
      },
    ): Promise<TransitionResult> {
      auth.assertCapability(actor, "registration.mutate_exceptional");
      const reason = input.reason.trim();
      if (reason.length < 3) {
        throw new AdminRegistrationValidationError({
          reason: "Indicá un motivo (mín. 3 caracteres).",
        });
      }

      const existing = await repo.getById(input.registrationId);
      if (!existing) throw new AdminRegistrationNotFoundError(input.registrationId);

      if (existing.status === "CANCELLED" && input.action === "cancel") {
        throw new AdminRegistrationError("ALREADY_CANCELLED", "La inscripción ya está cancelada.");
      }
      if (existing.status === "CONFIRMED" && input.action === "confirm_admin") {
        throw new AdminRegistrationError(
          "ALREADY_CONFIRMED",
          "La inscripción ya está confirmada.",
        );
      }

      const plan = assertTransitionAllowed(input.action, existing.status);
      const nextPayment = plan.nextPaymentStatus(existing.paymentStatus, existing.totalAmount);

      let holdMode: "consume" | "release" | "none" = "none";
      if (input.action === "confirm_admin") holdMode = "consume";
      if (input.action === "cancel") holdMode = "release";

      if (input.action === "confirm_admin") {
        const ticket = await repo.getTicketType(existing.ticketTypeId);
        if (!ticket) throw new AdminRegistrationError("TICKET_MISMATCH", "Entrada no encontrada.");
        if (ticket.capacity != null) {
          const usage = await repo.countConfirmedAndActiveHolds(existing.ticketTypeId);
          // La propia inscripción puede tener hold ACTIVE: no contar doble al confirmar.
          const selfHold =
            existing.capacityHold?.status === "ACTIVE" &&
            existing.capacityHold.expiresAt > new Date()
              ? 1
              : 0;
          const used = usage.confirmed + Math.max(0, usage.activeHolds - selfHold);
          if (used >= ticket.capacity) {
            throw new AdminRegistrationError(
              "CAPACITY_EXCEEDED",
              `Cupo agotado para la entrada (${ticket.capacity}).`,
              { capacity: ticket.capacity, used },
            );
          }
        }
      }

      const updated = await repo.applyTransition({
        registrationId: existing.id,
        previousStatus: existing.status,
        previousPaymentStatus: existing.paymentStatus,
        nextStatus: plan.nextStatus,
        nextPaymentStatus: nextPayment,
        actorUserId: actor.userId,
        source: "admin",
        reason,
        action: `ADMIN_${input.action.toUpperCase()}`,
        holdMode,
        setConfirmedAt: input.action === "confirm_admin",
        setCancelledAt: input.action === "cancel",
        clearCancelledAt: input.action === "reactivate",
      });

      return {
        registration: updated,
        previousStatus: existing.status,
        previousPaymentStatus: existing.paymentStatus,
      };
    },

    async updateAssignment(
      actor: AdminRegistrationActor,
      input: {
        registrationId: string;
        venueId: string | null;
        ticketTypeId: string;
        reason: string;
      },
    ): Promise<AdminRegistrationDetail> {
      auth.assertCapability(actor, "registration.mutate_exceptional");
      const reason = input.reason.trim();
      if (reason.length < 3) {
        throw new AdminRegistrationValidationError({ reason: "Motivo obligatorio." });
      }
      const existing = await repo.getById(input.registrationId);
      if (!existing) throw new AdminRegistrationNotFoundError(input.registrationId);
      if (!["DRAFT", "PENDING_PAYMENT", "WAITLISTED"].includes(existing.status)) {
        throw new AdminRegistrationTransitionError(
          "Solo se puede reasignar sede/entrada en DRAFT, PENDING_PAYMENT o WAITLISTED.",
        );
      }

      const ticket = await repo.getTicketType(input.ticketTypeId);
      if (!ticket) throw new AdminRegistrationError("TICKET_MISMATCH", "Entrada inválida.");
      if (ticket.editionId !== existing.editionId) {
        throw new AdminRegistrationError(
          "EDITION_MISMATCH",
          "La entrada no pertenece a la misma edición.",
        );
      }
      if (input.venueId) {
        const venue = await repo.getVenue(input.venueId);
        if (!venue) throw new AdminRegistrationError("VENUE_MISMATCH", "Sede inválida.");
        if (venue.editionId !== existing.editionId) {
          throw new AdminRegistrationError(
            "EDITION_MISMATCH",
            "La sede no pertenece a la misma edición.",
          );
        }
      }

      return repo.updateAssignment({
        registrationId: existing.id,
        venueId: input.venueId,
        ticketTypeId: input.ticketTypeId,
        actorUserId: actor.userId,
        reason,
      });
    },

    async addInternalNote(
      actor: AdminRegistrationActor,
      input: { registrationId: string; note: string },
    ): Promise<AdminRegistrationDetail> {
      auth.assertCapability(actor, "registration.mutate_exceptional");
      const note = input.note.trim();
      if (note.length < 2) {
        throw new AdminRegistrationValidationError({ note: "Nota demasiado corta." });
      }
      if (note.length > 2000) {
        throw new AdminRegistrationValidationError({ note: "Máximo 2000 caracteres." });
      }
      const existing = await repo.getById(input.registrationId);
      if (!existing) throw new AdminRegistrationNotFoundError(input.registrationId);
      return repo.addInternalNote({
        registrationId: existing.id,
        actorUserId: actor.userId,
        note,
      });
    },
  };
}

export type AdminRegistrationService = ReturnType<typeof createAdminRegistrationService>;
