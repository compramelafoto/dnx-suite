"use server";

import { previewClickatonPromotion } from "@/lib/promotions/prisma-promotions-adapter";
import { getPublicRegistrationService } from "./runtime";

export type PreviewPromotionActionResult =
  | {
      ok: true;
      quote: {
        code: string;
        name: string;
        originalAmount: number;
        discountAmount: number;
        finalAmount: number;
        currency: string;
      };
    }
  | { ok: false; message: string };

/**
 * Preview de descuento (no consume usos). Monto original lo recalcula el backend.
 */
export async function previewPublicPromotionAction(input: {
  editionSlug: string;
  ticketTypeId: string;
  promoCode: string;
}): Promise<PreviewPromotionActionResult> {
  try {
    const svc = getPublicRegistrationService();
    const ctx = await svc.getContext(input.editionSlug);
    const ticket = ctx.tickets.find((t) => t.id === input.ticketTypeId);
    if (!ticket) {
      return { ok: false, message: "Entrada no disponible." };
    }

    // Reusa la misma lógica de fase vigente vía create path preview local:
    const { resolveCurrentPricePhase } = await import(
      "@/lib/pricing/domain/resolve-price-phase"
    );
    const { createPrismaPublicRegistrationRepository } = await import(
      "../infrastructure/prisma-public-registration-repository"
    );
    const repo = createPrismaPublicRegistrationRepository();
    const edition = await repo.getEditionBySlug(input.editionSlug);
    if (!edition) return { ok: false, message: "Edición no disponible." };

    let originalAmount = ticket.priceAmount;
    if (ticket.priceAmount > 0) {
      const phases = await repo.listPricePhases(edition.id);
      if (phases.some((p) => p.isActive)) {
        const resolved = resolveCurrentPricePhase(phases, new Date());
        if (!resolved) {
          return { ok: false, message: "No hay fase de precio vigente." };
        }
        originalAmount = resolved.phase.amount;
      }
    }

    const preview = await previewClickatonPromotion({
      code: input.promoCode,
      originalAmount,
      currency: ticket.currency,
      editionId: edition.id,
    });
    if (!preview.ok) {
      return { ok: false, message: preview.message };
    }
    return {
      ok: true,
      quote: {
        code: preview.quote.code,
        name: preview.quote.name,
        originalAmount: preview.quote.originalAmount,
        discountAmount: preview.quote.discountAmount,
        finalAmount: preview.quote.finalAmount,
        currency: preview.quote.currency,
      },
    };
  } catch (err) {
    return {
      ok: false,
      message: err instanceof Error ? err.message : "No se pudo validar el código.",
    };
  }
}
