export type PreCompraSelfieSubject = {
  id: number;
  label: string;
  selfies: { id: number; imageUrl: string }[];
};

export type PreCompraSelfieSnapshot = {
  subjects: PreCompraSelfieSubject[];
  items: { status: string }[];
  album?: { id: number; title: string; publicSlug: string };
};

export type PreventaSelfieUxPhase =
  | "needs_upload"
  | "received"
  | "searching"
  | "no_matches"
  | "photos_ready"
  | "can_redeem";

const POST_MATCH_STATUSES = new Set([
  "APPROVED_BY_MATCH",
  "WAITING_SELECTION",
  "READY_TO_DESIGN",
  "DESIGN_SUBMITTED",
  "NEEDS_CHANGES",
  "APPROVED",
  "EXPORTED",
  "PHYSICAL_IN_PROGRESS",
  "AT_SCHOOL",
  "DELIVERED",
]);

export function derivePreventaSelfieUxPhase(
  snapshot: PreCompraSelfieSnapshot,
  hasPhotos: boolean
): PreventaSelfieUxPhase {
  const { subjects, items } = snapshot;

  const needsUpload =
    subjects.length === 0 || subjects.some((subject) => subject.selfies.length === 0);

  if (needsUpload) return "needs_upload";

  const hasApprovedMatch = items.some((item) => POST_MATCH_STATUSES.has(item.status));
  const stillAwaitingMatch = items.some(
    (item) => item.status === "WAITING_SELFIE" || item.status === "WAITING_UPLOAD"
  );

  if (hasPhotos && hasApprovedMatch) return "can_redeem";
  if (hasPhotos && stillAwaitingMatch && !hasApprovedMatch) return "no_matches";
  if (hasPhotos) return "photos_ready";
  if (stillAwaitingMatch) return "searching";

  return "received";
}

export function isPreventaSelfieValidated(phase: PreventaSelfieUxPhase): boolean {
  return phase === "photos_ready" || phase === "can_redeem";
}

export function shouldEmbedPreventaSelfieStep(input: {
  uxV2: boolean;
  isSchoolAlbum: boolean;
  preCompraOrderId: number | null;
  isPaid: boolean;
  alreadyRedeemed: boolean;
  phase: PreventaSelfieUxPhase | null;
}): boolean {
  if (!input.uxV2) return false;
  if (!input.isSchoolAlbum || input.preCompraOrderId == null) return false;
  if (!input.isPaid || input.alreadyRedeemed) return false;
  if (input.phase == null) return true;
  return !isPreventaSelfieValidated(input.phase);
}

export type PreventaSelfieUxCopy = {
  title: string;
  description: string;
};

export function preventaSelfieUxCopy(phase: PreventaSelfieUxPhase): PreventaSelfieUxCopy {
  switch (phase) {
    case "needs_upload":
      return {
        title: "Subí una selfie para encontrar las fotos del alumno",
        description:
          "Agregá el nombre del niño/a y subí una selfie clara. La usamos para ubicar sus fotos en el álbum.",
      };
    case "received":
      return {
        title: "Selfie recibida",
        description:
          "Recibimos tu selfie. En breve empezamos a buscar coincidencias con las fotos del álbum.",
      };
    case "searching":
      return {
        title: "Estamos buscando coincidencias",
        description:
          "Tu selfie ya está en el sistema. Te avisamos cuando las fotos estén disponibles para elegir.",
      };
    case "no_matches":
      return {
        title: "No encontramos coincidencias todavía",
        description:
          "Las fotos del álbum ya están publicadas, pero aún no identificamos al alumno. Podés esperar o subir otra selfie.",
      };
    case "photos_ready":
      return {
        title: "Fotos listas para elegir",
        description: "El fotógrafo ya publicó las fotos. Ya podés elegir las que van en tu pack.",
      };
    case "can_redeem":
      return {
        title: "Podés continuar al canje",
        description: "Identificamos las fotos del alumno. Entrá al álbum para completar tu preventa.",
      };
  }
}
