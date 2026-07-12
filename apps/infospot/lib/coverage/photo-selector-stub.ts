/**
 * Preparación del selector editorial de fotografías (Etapa 9).
 */

export type PhotoSelectorPrep = {
  status: "NOT_READY" | "READY" | "IN_PROGRESS";
  canOpenSelector: boolean;
  clfAlbumId: number;
  reasons: string[];
  endpointHint: string;
};

export function buildPhotoSelectorPrep(input: {
  clfAlbumId: number;
  photoCount: number;
  syncStatus: string;
  commercialStatus: string;
  currentStatus?: string;
}): PhotoSelectorPrep {
  const reasons: string[] = [];
  if (input.syncStatus === "STALE" || input.syncStatus === "DISABLED") {
    reasons.push("Sync STALE/DISABLED.");
  }
  if (input.photoCount <= 0) reasons.push("Sin fotos en el álbum.");
  if (input.commercialStatus === "UNAVAILABLE") {
    reasons.push(
      "Álbum eliminado o purgado; selector limitado a assets editoriales ya importados.",
    );
  }

  const blocking = reasons.filter((r) => r.includes("Sin fotos"));
  const canOpen = blocking.length === 0;
  const status =
    input.currentStatus === "IN_PROGRESS"
      ? "IN_PROGRESS"
      : canOpen
        ? "READY"
        : "NOT_READY";

  return {
    status,
    canOpenSelector: canOpen,
    clfAlbumId: input.clfAlbumId,
    reasons,
    endpointHint: `/api/redaccion/clf-albums/${input.clfAlbumId}/photos`,
  };
}
