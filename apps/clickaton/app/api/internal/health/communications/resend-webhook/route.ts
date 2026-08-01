import { NextResponse } from "next/server";
import { prisma } from "@repo/db";
import { loadResendWebhookConfig } from "@repo/communications/tracking/resend";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Health operativo del webhook Resend.
 * Requiere Authorization: Bearer <CRON_SECRET|CLICKATON_CRON_SECRET|COMMUNICATIONS_WEBHOOK_HEALTH_TOKEN>
 * No expone secretos, URLs de DB ni allowlist completa.
 */
function authorize(request: Request): boolean {
  const header = request.headers.get("authorization") ?? "";
  const token = header.startsWith("Bearer ")
    ? header.slice("Bearer ".length).trim()
    : "";
  if (!token) return false;
  const allowed = [
    process.env.COMMUNICATIONS_WEBHOOK_HEALTH_TOKEN,
    process.env.CRON_SECRET,
    process.env.CLICKATON_CRON_SECRET,
  ]
    .map((v) => v?.trim())
    .filter(Boolean) as string[];
  return allowed.includes(token);
}

export async function GET(request: Request) {
  if (!authorize(request)) {
    return NextResponse.json({ ok: false }, { status: 401 });
  }

  const loaded = loadResendWebhookConfig(process.env);
  let database: "reachable" | "unreachable" | "unknown" = "unknown";
  let schema: "ready" | "missing" | "unknown" = "unknown";

  try {
    await prisma.$queryRaw`SELECT 1`;
    database = "reachable";
    const tables = await prisma.$queryRawUnsafe<Array<{ exists: boolean }>>(
      `SELECT EXISTS (
        SELECT 1 FROM information_schema.tables
        WHERE table_schema = 'public'
          AND table_name = 'DnxCommunicationWebhookEvent'
      ) AS exists`,
    );
    schema = tables[0]?.exists ? "ready" : "missing";
  } catch {
    database = "unreachable";
    schema = "unknown";
  }

  const enabled = loaded.ok ? loaded.config.enabled : false;
  const mode = loaded.ok ? loaded.config.mode : "disabled";
  const rateLimit = !loaded.ok
    ? "unknown"
    : loaded.config.rateLimit.enabled
      ? "best_effort_memory"
      : "noop";
  const alerts = !loaded.ok
    ? "unknown"
    : loaded.config.alerts.enabled
      ? "enabled"
      : "disabled";

  return NextResponse.json(
    {
      ok: database === "reachable" && (schema === "ready" || !enabled),
      enabled,
      mode,
      database,
      schema,
      allowedEventsConfigured: loaded.ok,
      rateLimit,
      alerts,
      environment: loaded.ok
        ? loaded.config.environmentPolicy.environment
        : "unknown",
      productEffectsEnabled: false,
      persistBehavioralEvents: loaded.ok
        ? loaded.config.environmentPolicy.persistBehavioralEvents
        : false,
    },
    {
      headers: {
        "Cache-Control": "no-store",
      },
    },
  );
}
