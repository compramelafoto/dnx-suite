import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { refreshMercadoPagoOwnerAccessToken } from "@/lib/mercadopago/mp-oauth-token-refresh";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;

/**
 * CLF-MP-OAUTH-REFRESH-100 — renovación preventiva de los access token OAuth de Mercado Pago.
 *
 * Los token de Mercado Pago vencen a los ~180 días y, si nadie los usa antes, el refresh token
 * muere junto con ellos: ahí el vendedor tiene que volver a conectar la cuenta a mano.
 * Este cron renueva a todos mucho antes de ese plazo.
 *
 * Para no renovar 250+ cuentas por día, cada vendedor cae en un "turno" según su id y le toca
 * una vez por semana (id % 7 === día de la semana). Nadie pasa más de 7 días sin renovar.
 */
function isAuthorized(req: Request): boolean {
  const secret = process.env.CRON_SECRET;
  const isVercelCron = req.headers.get("x-vercel-cron") === "1" && process.env.VERCEL === "1";
  if (!secret) return isVercelCron;
  const authHeader = req.headers.get("authorization") || "";
  if (authHeader.startsWith("Bearer ")) {
    return authHeader.replace("Bearer ", "").trim() === secret;
  }
  const url = new URL(req.url);
  const token = url.searchParams.get("token");
  return token === secret || isVercelCron;
}

const SHARDS = 7;

export async function GET(req: NextRequest) {
  if (!isAuthorized(req)) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const url = new URL(req.url);
  /** `?all=1` renueva a todos de una (uso manual, no el cron diario). */
  const renewAll = url.searchParams.get("all") === "1";
  const shard = new Date().getUTCDay() % SHARDS;

  try {
    const [users, labs] = await Promise.all([
      prisma.user.findMany({
        where: { mpAccessToken: { not: null }, mpRefreshToken: { not: null } },
        select: { id: true },
        orderBy: { id: "asc" },
      }),
      prisma.lab.findMany({
        where: { mpAccessToken: { not: null }, mpRefreshToken: { not: null } },
        select: { id: true },
        orderBy: { id: "asc" },
      }),
    ]);

    const owners = [
      ...users.map((u) => ({ ownerType: "USER" as const, ownerId: u.id })),
      ...labs.map((l) => ({ ownerType: "LAB" as const, ownerId: l.id })),
    ].filter((o) => renewAll || o.ownerId % SHARDS === shard);

    const failures: Array<{ ownerType: string; ownerId: number; code: string }> = [];
    let renewed = 0;

    for (const owner of owners) {
      const result = await refreshMercadoPagoOwnerAccessToken(owner);
      if (result.ok) {
        renewed++;
        continue;
      }
      failures.push({ ownerType: owner.ownerType, ownerId: owner.ownerId, code: result.code });
      console.error("[cron refresh-mp-oauth-tokens] no se pudo renovar", {
        ...owner,
        code: result.code,
        error: result.error,
      });
    }

    // Los que fallan necesitan que la persona vuelva a conectar Mercado Pago a mano.
    return NextResponse.json({
      ok: true,
      shard: renewAll ? "all" : shard,
      procesados: owners.length,
      renovados: renewed,
      requierenReconexionManual: failures,
    });
  } catch (err: any) {
    console.error("GET /api/cron/refresh-mp-oauth-tokens ERROR >>>", err);
    return NextResponse.json({ error: String(err?.message ?? err) }, { status: 500 });
  }
}
