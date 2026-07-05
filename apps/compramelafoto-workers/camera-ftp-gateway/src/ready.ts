import type { GatewayConfig } from "./config.js";
import { getPrisma } from "./prisma.js";

export type ReadinessCheck = {
  name: string;
  ok: boolean;
  detail?: string;
};

export type ReadinessResult = {
  ready: boolean;
  checks: ReadinessCheck[];
};

function checkR2Config(config: GatewayConfig): ReadinessCheck {
  const required = [
    ["R2_ACCOUNT_ID", config.R2_ACCOUNT_ID],
    ["R2_ACCESS_KEY_ID", config.R2_ACCESS_KEY_ID],
    ["R2_SECRET_ACCESS_KEY", config.R2_SECRET_ACCESS_KEY ? "set" : ""],
    ["R2_ENDPOINT", config.R2_ENDPOINT],
    ["R2_BUCKET", config.r2BucketName],
  ] as const;

  const missing = required.filter(([, value]) => !value || String(value).trim() === "").map(([name]) => name);

  if (missing.length > 0) {
    return {
      name: "r2_config",
      ok: false,
      detail: `Faltan variables: ${missing.join(", ")}`,
    };
  }

  return { name: "r2_config", ok: true };
}

export async function checkReadiness(config: GatewayConfig): Promise<ReadinessResult> {
  const checks: ReadinessCheck[] = [];

  checks.push(checkR2Config(config));

  try {
    const prisma = getPrisma();
    await prisma.$queryRaw`SELECT 1`;
    checks.push({ name: "database", ok: true });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    checks.push({ name: "database", ok: false, detail: message });
  }

  return {
    ready: checks.every((c) => c.ok),
    checks,
  };
}
