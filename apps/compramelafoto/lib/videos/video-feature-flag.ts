function parseTruthyEnv(raw: string | undefined): boolean {
  if (raw == null || raw === "") return false;
  const v = raw.trim().toLowerCase();
  return v === "1" || v === "true" || v === "yes";
}

/** MVP venta de videos — APIs y lógica servidor. */
export function isVideoMvpEnabled(): boolean {
  return (
    parseTruthyEnv(process.env.ENABLE_VIDEO_MVP) ||
    parseTruthyEnv(process.env.NEXT_PUBLIC_ENABLE_VIDEO_MVP)
  );
}

/**
 * UI cliente: solo `NEXT_PUBLIC_*` se expone al bundle.
 * En dev/prod conviene confirmar con GET /api/dashboard/video-mvp-enabled.
 */
export function isVideoMvpEnabledClient(): boolean {
  return parseTruthyEnv(process.env.NEXT_PUBLIC_ENABLE_VIDEO_MVP);
}
