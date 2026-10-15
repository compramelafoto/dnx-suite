import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { loadPortalContext } from "@/lib/portal/access";
import { loadMemberNotices, markNoticesSeen } from "@/lib/notifications/sources";
import { unreadCount } from "@/lib/notifications/feed";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Las novedades del socio para la campanita del portal. Todo sale de la sesión: el socio y su
 * institución nunca vienen del navegador.
 */
export async function GET() {
  const user = await requireAuth();
  const ctx = await loadPortalContext(user.id);
  if (!ctx) return NextResponse.json({ items: [], unread: 0, lastSeenAt: null });
  const { items, lastSeenAt } = await loadMemberNotices({ workspaceId: ctx.workspace.id, memberId: ctx.member.id, userId: user.id });
  return NextResponse.json(
    { items, unread: unreadCount(items, lastSeenAt), lastSeenAt },
    { headers: { "Cache-Control": "private, no-store" } },
  );
}

/** Abrió la campanita: el numerito vuelve a cero. */
export async function POST() {
  const user = await requireAuth();
  const ctx = await loadPortalContext(user.id);
  if (!ctx) return NextResponse.json({ ok: false }, { status: 403 });
  await markNoticesSeen(ctx.member.id);
  return NextResponse.json({ ok: true });
}
