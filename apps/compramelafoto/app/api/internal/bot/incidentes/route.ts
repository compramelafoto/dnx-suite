import { timingSafeEqual } from "node:crypto";
import { BOT_PLATFORM } from "@/lib/bot/config";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const STATUSES = ["OPEN", "INVESTIGATING", "FIXED", "IGNORED"] as const;
type IncidentStatus = (typeof STATUSES)[number];

function authorized(req: Request): boolean {
  const secret = process.env.CLF_BOT_INCIDENTS_SECRET?.trim();
  if (!secret) return false;
  const header = req.headers.get("authorization") ?? "";
  const expected = Buffer.from(`Bearer ${secret}`);
  const received = Buffer.from(header);
  if (received.length !== expected.length) return false;
  return timingSafeEqual(received, expected);
}

export async function GET(req: Request) {
  if (!authorized(req)) return new Response("No autorizado", { status: 401 });
  const rows = await prisma.botIncident.findMany({
    where: { platform: BOT_PLATFORM, status: { in: ["OPEN", "INVESTIGATING"] } },
    orderBy: [{ urgent: "desc" }, { occurrences: "desc" }],
    take: 50,
  });
  return Response.json({ incidentes: rows });
}

export async function PATCH(req: Request) {
  if (!authorized(req)) return new Response("No autorizado", { status: 401 });
  const b = (await req.json().catch(() => ({}))) as { id?: unknown; status?: unknown; prUrl?: unknown };
  if (typeof b.id !== "string" || !b.id || typeof b.status !== "string" || !STATUSES.includes(b.status as IncidentStatus)) {
    return new Response("Datos inválidos", { status: 400 });
  }
  let prUrl: string | undefined;
  if (b.prUrl !== undefined && b.prUrl !== null && b.prUrl !== "") {
    if (typeof b.prUrl !== "string" || b.prUrl.length > 300 || !b.prUrl.startsWith("https://github.com/")) {
      return new Response("Datos inválidos", { status: 400 });
    }
    prUrl = b.prUrl;
  }
  // Se acota por plataforma: esta ruta sólo toca incidentes de CLF.
  const res = await prisma.botIncident.updateMany({
    where: { id: b.id, platform: BOT_PLATFORM },
    data: { status: b.status as IncidentStatus, ...(prUrl ? { prUrl } : {}) },
  });
  if (res.count === 0) return new Response("No encontrado", { status: 404 });
  return Response.json({ ok: true });
}
