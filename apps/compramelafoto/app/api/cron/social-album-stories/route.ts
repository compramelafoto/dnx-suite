import { NextResponse } from "next/server";
import { assertCronAuth } from "@/lib/cron-auth";
import { generateDailyAlbumStories } from "@/lib/social/album-stories";
import { runSocialTokenRefresh } from "@/lib/social/connect-account";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
/** Cada collage descarga 3-4 fotos y renderiza: con 20 álbumes hace falta margen. */
export const maxDuration = 300;

/**
 * Cron diario (08:00 hora argentina). Hace dos cosas, para no gastar un cron por cada una:
 *
 * 1. Renueva el permiso de Instagram si le quedan menos de 10 días (dura 60). Va primero:
 *    sin permiso vigente no se publica nada.
 * 2. Arma la historia de cada álbum público de más de 50 fotos y la deja agendada.
 *    Publicar lo hace `social-publish`, que corre solo en los diez horarios del día.
 */
export async function GET(request: Request) {
  const unauthorized = assertCronAuth(request);
  if (unauthorized) return unauthorized;

  let tokenRefresh: unknown;
  try {
    tokenRefresh = await runSocialTokenRefresh();
  } catch (error) {
    // Que falle la renovación no frena el armado: el permiso actual puede seguir vigente.
    const message = error instanceof Error ? error.message : String(error);
    console.error(`[cron social-album-stories] renovación del permiso: ${message}`);
    tokenRefresh = { ok: false, error: message };
  }

  const stories = await generateDailyAlbumStories();
  return NextResponse.json({ ...stories, tokenRefresh });
}
