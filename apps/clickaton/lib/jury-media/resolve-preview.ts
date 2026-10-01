/**
 * Regla de acceso a una vista previa de jurado, separada de la entrega de bytes.
 * Se prueba sola, con un repositorio falso.
 */

/** Prefijo del almacenamiento privado de Clickatón. Nada fuera de acá se sirve. */
const PRIVATE_PREFIX = "clickaton/private/";

export type JuryPreviewAsset = {
  id: string;
  storageKey: string;
  mimeType: string | null;
  isActive: boolean;
  kind: string;
  storageProvider: string;
};

export type JuryPreviewRepo = {
  findAsset(assetId: string): Promise<JuryPreviewAsset | null>;
};

export type JuryPreviewAccess =
  | { ok: true; storageKey: string; contentType: string }
  | {
      ok: false;
      reason: "NOT_FOUND" | "NOT_A_JURY_PREVIEW" | "INACTIVE" | "FOREIGN_STORAGE";
    };

export async function resolveJuryPreviewAccess(input: {
  assetId: string;
  repo: JuryPreviewRepo;
}): Promise<JuryPreviewAccess> {
  const asset = await input.repo.findAsset(input.assetId);
  if (!asset) return { ok: false, reason: "NOT_FOUND" };
  if (asset.kind !== "JURY_PREVIEW") return { ok: false, reason: "NOT_A_JURY_PREVIEW" };
  if (!asset.isActive) return { ok: false, reason: "INACTIVE" };
  if (
    asset.storageProvider !== "clickaton_private" ||
    !asset.storageKey.startsWith(PRIVATE_PREFIX)
  ) {
    return { ok: false, reason: "FOREIGN_STORAGE" };
  }

  return {
    ok: true,
    storageKey: asset.storageKey,
    contentType: asset.mimeType ?? "image/jpeg",
  };
}
