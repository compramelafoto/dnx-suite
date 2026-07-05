export type PreventaPackJourneyStepId =
  | "payment"
  | "selfie"
  | "waiting_photos"
  | "redeem"
  | "redeemed";

export type PreventaPackJourneyStepStatus = "done" | "current" | "upcoming" | "skipped";

import type { PreventaSelfieUxPhase } from "@/lib/preventa-canjeable/preventa-selfie-state";

export type PreventaPackJourneyStep = {
  id: PreventaPackJourneyStepId;
  label: string;
  description?: string;
  status: PreventaPackJourneyStepStatus;
  href?: string;
};

export type PreventaPackJourneyInput = {
  orderStatus: string;
  origin: string;
  redemptionOrderId: number | null;
  hasPhotos: boolean;
  isSchoolAlbum: boolean;
  preCompraOrderId: number | null;
  redeemHref: string | null;
  selfieHref: string | null;
  /** Con flag ON: selfie embebido en hub (sin link externo). */
  selfieEmbedded?: boolean;
  /** Fase UX selfie escolar (derivada del snapshot precompra). */
  selfiePhase?: PreventaSelfieUxPhase | null;
};

export function buildPreventaPackJourneySteps(
  input: PreventaPackJourneyInput
): PreventaPackJourneyStep[] {
  const isPreventa = input.origin === "PREVENTA_PACK";
  if (!isPreventa) return [];

  const paid = input.orderStatus === "PAID";
  const redeemed = input.redemptionOrderId != null;

  const steps: PreventaPackJourneyStep[] = [
    {
      id: "payment",
      label: "Pago confirmado",
      status: paid ? "done" : "current",
    },
  ];

  if (input.isSchoolAlbum && input.preCompraOrderId != null) {
    const selfieDone =
      input.selfiePhase != null && input.selfiePhase !== "needs_upload";
    steps.push({
      id: "selfie",
      label: "Identificación (selfie)",
      description: selfieDone
        ? "Selfie recibida. Seguimos con la identificación de las fotos."
        : "Ayuda a encontrar las fotos de tu hijo/a en el álbum.",
      status: !paid ? "upcoming" : redeemed || selfieDone ? "done" : "current",
      href:
        paid && !redeemed && !input.selfieEmbedded && !selfieDone
          ? input.selfieHref ?? undefined
          : undefined,
    });
  }

  const selfieStepApplies = input.isSchoolAlbum && input.preCompraOrderId != null;
  const selfieComplete =
    !selfieStepApplies ||
    (input.selfiePhase != null && input.selfiePhase !== "needs_upload");

  steps.push({
    id: "waiting_photos",
    label: "Fotos disponibles",
    description: input.hasPhotos
      ? "El fotógrafo ya publicó las fotos."
      : "Te avisamos cuando el fotógrafo suba las fotos.",
    status: !paid
      ? "upcoming"
      : input.hasPhotos
        ? "done"
        : redeemed
          ? "done"
          : selfieComplete
            ? "current"
            : "upcoming",
  });

  steps.push({
    id: "redeem",
    label: "Elegir fotos",
    description: "Seleccioná las fotos incluidas en tu pack.",
    status: redeemed ? "done" : paid && input.hasPhotos ? "current" : "upcoming",
    href:
      paid && input.hasPhotos && !redeemed && input.redeemHref
        ? input.redeemHref
        : undefined,
  });

  steps.push({
    id: "redeemed",
    label: "Pack canjeado",
    status: redeemed ? "done" : "upcoming",
  });

  return steps;
}
