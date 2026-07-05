/** Resultado de subir un archivo (sync = Photo ya creada; async = job encolado). */
export type AlbumPhotoUploadOutcome =
  | { kind: "sync"; photoId: number }
  | { kind: "async"; jobId: string };

export function isAsyncUploadOutcome(
  outcome: AlbumPhotoUploadOutcome
): outcome is Extract<AlbumPhotoUploadOutcome, { kind: "async" }> {
  return outcome.kind === "async";
}
