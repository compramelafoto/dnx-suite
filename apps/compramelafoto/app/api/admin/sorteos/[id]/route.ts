import { NextRequest, NextResponse } from "next/server";
import { getRaffleForAdmin } from "@/lib/raffles/consultas";
import {
  addPrize,
  announceRaffle,
  cancelRaffle,
  notifyWinners,
  removePrize,
  resolveRaffle,
  sealRaffle,
  setAwardStatus,
  updateDraft,
} from "@/lib/raffles/motor";
import { fromArgentinaInput } from "@/lib/raffles/fechas";
import { RAFFLE_PRIZE_STATUSES, type RafflePrizeStatus } from "@/lib/raffles/constants";
import { parsePrizeTemplates } from "@/lib/raffles/mensajes";
import { requireRaffleAdmin } from "../_actor";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

type Ctx = { params: Promise<{ id: string }> };

export async function GET(_req: NextRequest, { params }: Ctx) {
  const auth = await requireRaffleAdmin();
  if (!auth.ok) return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  const { id } = await params;
  const data = await getRaffleForAdmin(id);
  if (!data) return NextResponse.json({ error: "Ese sorteo no existe." }, { status: 404 });
  return NextResponse.json(data);
}

/** POST { action, ... }: todas las acciones sobre un sorteo. */
export async function POST(req: NextRequest, { params }: Ctx) {
  const auth = await requireRaffleAdmin();
  if (!auth.ok) return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  const { id } = await params;
  const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
  const fecha = (k: string) => (body[k] ? fromArgentinaInput(String(body[k])) ?? undefined : undefined);

  let r: { ok: boolean; error?: string; waiting?: boolean };
  switch (body.action) {
    case "update":
      r = await updateDraft(id, {
        title: typeof body.title === "string" ? body.title : undefined,
        description: typeof body.description === "string" ? body.description : undefined,
        minSales: body.minSales !== undefined ? Number(body.minSales) : undefined,
        salesFrom: fecha("salesFrom"),
        salesTo: fecha("salesTo"),
        entriesCloseAt: fecha("entriesCloseAt"),
        drawsAt: fecha("drawsAt"),
      });
      break;
    case "addPrize": {
      const [premio] = parsePrizeTemplates([body.prize]);
      r = premio ? await addPrize(id, premio) : { ok: false, error: "El premio necesita un nombre." };
      break;
    }
    case "removePrize":
      r = await removePrize(String(body.prizeId ?? ""));
      break;
    case "announce":
      r = await announceRaffle(id, auth.actor);
      break;
    case "cancel":
      r = await cancelRaffle(id, String(body.reason ?? ""), auth.actor);
      break;
    case "seal":
      r = await sealRaffle(id, new Date(), auth.actor);
      break;
    case "resolve": {
      r = await resolveRaffle(id, new Date(), auth.actor);
      if (r.ok) await notifyWinners(id);
      break;
    }
    case "notify":
      await notifyWinners(id);
      r = { ok: true };
      break;
    case "awardStatus": {
      const to = String(body.status ?? "") as RafflePrizeStatus;
      r = RAFFLE_PRIZE_STATUSES.includes(to)
        ? await setAwardStatus(String(body.awardId ?? ""), to, typeof body.note === "string" ? body.note : null, auth.actor)
        : { ok: false, error: "Estado inválido." };
      break;
    }
    default:
      r = { ok: false, error: "Acción desconocida." };
  }
  if (!r.ok) return NextResponse.json({ error: r.error, waiting: r.waiting ?? false }, { status: 400 });
  return NextResponse.json({ ok: true });
}
