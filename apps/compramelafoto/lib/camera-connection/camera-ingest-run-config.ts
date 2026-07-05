export type CameraIngestRunConfig = {
  CAMERA_INGEST_MAX_ATTEMPTS: number;
  CAMERA_INGEST_STALE_MINUTES: number;
  CAMERA_INGEST_BATCH_CONCURRENCY: number;
};

function parsePositiveInt(raw: string | undefined, fallback: number): number {
  if (raw == null || raw.trim() === "") return fallback;
  const n = Number.parseInt(raw, 10);
  return Number.isFinite(n) && n > 0 ? n : fallback;
}

export function getCameraIngestRunConfigFromEnv(): CameraIngestRunConfig {
  return {
    CAMERA_INGEST_MAX_ATTEMPTS: parsePositiveInt(process.env.CAMERA_INGEST_MAX_ATTEMPTS, 3),
    CAMERA_INGEST_STALE_MINUTES: parsePositiveInt(process.env.CAMERA_INGEST_STALE_MINUTES, 30),
    CAMERA_INGEST_BATCH_CONCURRENCY: parsePositiveInt(process.env.CAMERA_INGEST_BATCH_CONCURRENCY, 2),
  };
}
