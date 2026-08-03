export type WorkerConfig = {
  port: number;
  hmacSecret: string;
  maxBodyBytes: number;
  timestampSkewMs: number;
  replayTtlMs: number;
};

function readPort(): number {
  const raw = process.env.TEMPLATE_RENDER_WORKER_PORT?.trim();
  if (!raw) return 8787;
  const parsed = Number.parseInt(raw, 10);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    throw new Error("TEMPLATE_RENDER_WORKER_PORT inválido");
  }
  return parsed;
}

export function loadWorkerConfig(): WorkerConfig {
  const hmacSecret =
    process.env.DNX_TEMPLATE_RENDER_HMAC_SECRET?.trim() ||
    process.env.DNX_RENDER_HMAC_SECRET?.trim() ||
    "";
  if (!hmacSecret) {
    throw new Error(
      "DNX_TEMPLATE_RENDER_HMAC_SECRET (o DNX_RENDER_HMAC_SECRET) es obligatorio"
    );
  }

  return {
    port: readPort(),
    hmacSecret,
    maxBodyBytes: 2 * 1024 * 1024,
    timestampSkewMs: 60_000,
    replayTtlMs: 5 * 60_000,
  };
}
