import { NextRequest, NextResponse } from "next/server";
import { Role } from "@prisma/client";
import { requireAuth } from "@/lib/auth";
import { cancelStory, publishStoryNow } from "@/lib/social/album-stories";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Veto del admin: `{ action: "cancel" }` la saca de la cola; `{ action: "now" }` la adelanta. */
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { error, user } = await requireAuth([Role.ADMIN]);
  if (error || !user) return NextResponse.json({ error: error ?? "No autorizado" }, { status: 401 });
  const { id } = await params;
  const body = (await req.json().catch(() => ({}))) as { action?: string };
  const ok =
    body.action === "cancel"
      ? await cancelStory(id, user.id)
      : body.action === "now"
        ? await publishStoryNow(id, user.id)
        : null;
  if (ok === null) return NextResponse.json({ error: "Acción inválida" }, { status: 400 });
  if (!ok) return NextResponse.json({ error: "La historia ya no está en la cola" }, { status: 409 });
  return NextResponse.json({ ok: true });
}
