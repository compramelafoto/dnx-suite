import { NextResponse } from "next/server";
import { assertCronAuth } from "@/lib/cron-auth";
import { generateDailyAlbumStories } from "@/lib/social/album-stories";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
/** Cada collage descarga 3-4 fotos y renderiza: con 20 álbumes hace falta margen. */
export const maxDuration = 300;

/**
 * Cron diario (08:00 hora argentina): arma la historia de cada álbum público de más de
 * 50 fotos subido en los últimos días y la deja agendada. Publicar lo hace
 * `social-publish` cuando llega la hora.
 */
export async function GET(request: Request) {
  const unauthorized = assertCronAuth(request);
  if (unauthorized) return unauthorized;
  const summary = await generateDailyAlbumStories();
  return NextResponse.json(summary);
}
