import { NextResponse } from "next/server";
import { requireClickatonAdmin } from "@/lib/admin/auth";
import { AccreditationError } from "@/lib/accreditation/errors";
import { enqueueOfflineEvent, syncOfflineEvents } from "@/lib/accreditation/service";

export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ editionId: string }> };

export async function POST(req: Request, ctx: Ctx) {
  const user = await requireClickatonAdmin();
  const { editionId } = await ctx.params;
  const body = (await req.json().catch(() => ({}))) as {
    mode?: "enqueue" | "sync";
    idempotencyKey?: string;
    action?: string;
    clientOccurredAt?: string;
    qr?: string;
    registrationIdHint?: string;
    deviceId?: string;
  };

  try {
    if (body.mode === "sync") {
      const results = await syncOfflineEvents({
        editionId,
        actor: { id: user.id, email: user.email, globalRole: user.globalRole },
      });
      return NextResponse.json({ results }, { headers: { "Cache-Control": "private, no-store" } });
    }

    if (!body.idempotencyKey || !body.action || !body.clientOccurredAt) {
      return NextResponse.json({ error: "INVALID_OFFLINE_PAYLOAD" }, { status: 400 });
    }

    const ev = await enqueueOfflineEvent({
      editionId,
      deviceId: body.deviceId ?? null,
      idempotencyKey: body.idempotencyKey,
      action: body.action,
      clientOccurredAt: new Date(body.clientOccurredAt),
      qrPlaintext: body.qr ?? null,
      registrationIdHint: body.registrationIdHint ?? null,
    });
    return NextResponse.json(
      { id: ev.id, syncStatus: ev.syncStatus },
      { headers: { "Cache-Control": "private, no-store" } },
    );
  } catch (error) {
    if (error instanceof AccreditationError) {
      return NextResponse.json({ error: error.code, message: error.message }, { status: error.status });
    }
    throw error;
  }
}
