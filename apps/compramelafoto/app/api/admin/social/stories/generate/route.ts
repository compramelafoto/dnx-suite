import { NextResponse } from "next/server";
import { Role } from "@prisma/client";
import { requireAuth } from "@/lib/auth";
import { generateDailyAlbumStories } from "@/lib/social/album-stories";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;

/** «Armar ahora»: corre la generación diaria sin esperar al cron. Es idempotente. */
export async function POST() {
  const { error, user } = await requireAuth([Role.ADMIN]);
  if (error || !user) return NextResponse.json({ error: error ?? "No autorizado" }, { status: 401 });
  return NextResponse.json(await generateDailyAlbumStories());
}
