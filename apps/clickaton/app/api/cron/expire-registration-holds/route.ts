import { NextResponse } from "next/server";
import { createPrismaPublicRegistrationRepository } from "@/lib/public-registration/infrastructure/prisma-public-registration-repository";
import { createExpirePendingRegistrationsUseCase } from "@/lib/public-registration/application/expire-pending-registrations";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/**
 * Durable hold expiry for Clickatón registrations (11B).
 * Auth: Authorization Bearer CRON_SECRET, or Vercel Cron header.
 */
export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET?.trim() || process.env.CLICKATON_CRON_SECRET?.trim();
  const auth = request.headers.get("authorization");
  const vercelCron = request.headers.get("x-vercel-cron");
  const ok =
    (Boolean(secret) && auth === `Bearer ${secret}`) ||
    (process.env.VERCEL === "1" && vercelCron === "1");
  if (!ok) {
    return NextResponse.json({ ok: false, error: "UNAUTHORIZED" }, { status: 401 });
  }

  const dryRun = new URL(request.url).searchParams.get("dryRun") === "1";
  const repo = createPrismaPublicRegistrationRepository();
  const useCase = createExpirePendingRegistrationsUseCase({ repo });
  const result = await useCase.execute({ dryRun, limit: 100 });

  return NextResponse.json({
    ok: true,
    ...result,
  });
}
