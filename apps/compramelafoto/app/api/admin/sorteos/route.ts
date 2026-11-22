import { NextRequest, NextResponse } from "next/server";
import { listRafflesForAdmin } from "@/lib/raffles/consultas";
import { createRaffle } from "@/lib/raffles/motor";
import { fromArgentinaInput } from "@/lib/raffles/fechas";
import { requireRaffleAdmin } from "./_actor";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** GET: los sorteos. POST: crea un sorteo manual en borrador. */
export async function GET() {
  const auth = await requireRaffleAdmin();
  if (!auth.ok) return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  return NextResponse.json({ raffles: await listRafflesForAdmin() });
}

export async function POST(req: NextRequest) {
  const auth = await requireRaffleAdmin();
  if (!auth.ok) return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;

  const salesFrom = fromArgentinaInput(String(body.salesFrom ?? ""));
  const salesTo = fromArgentinaInput(String(body.salesTo ?? ""));
  const drawsAt = fromArgentinaInput(String(body.drawsAt ?? ""));
  const entriesCloseAt = body.entriesCloseAt ? fromArgentinaInput(String(body.entriesCloseAt)) : salesTo;
  if (!salesFrom || !salesTo || !drawsAt || !entriesCloseAt) {
    return NextResponse.json({ error: "Completá todas las fechas." }, { status: 400 });
  }
  const r = await createRaffle({
    title: String(body.title ?? ""),
    description: typeof body.description === "string" ? body.description : null,
    kind: "MANUAL",
    salesFrom,
    salesTo,
    minSales: Number(body.minSales ?? 1),
    entriesCloseAt,
    drawsAt,
    actor: auth.actor,
  });
  if (!r.ok) return NextResponse.json({ error: r.error }, { status: 400 });
  return NextResponse.json({ id: r.id });
}
