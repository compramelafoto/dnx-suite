import { NextResponse } from "next/server";
import { assertCronAuth } from "@/lib/cron-auth";
import { generateDailyAlbumStories } from "@/lib/social/album-stories";
import { runSocialTokenCheck } from "@/lib/social/connect-account";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
/** Cada collage descarga 3-4 fotos y renderiza: con 20 álbumes hace falta margen. */
export const maxDuration = 300;

/**
 * Cron de las 08, 09, 12 y 15 h (hora argentina). Hace dos cosas, para no gastar un cron por cada una:
 *
 * 1. Controla que Meta siga aceptando el token de Instagram (token de usuario del sistema,
 *    no vence). Si lo rechaza, la cuenta queda caída y el panel pide reconectar.
 * 2. Arma la historia de cada álbum público de más de 50 fotos y la deja agendada.
 *    Publicar lo hace `social-publish`, que corre solo en los diez horarios del día.
 */
export async function GET(request: Request) {
  const unauthorized = assertCronAuth(request);
  if (unauthorized) return unauthorized;

  let tokenCheck: unknown;
  try {
    tokenCheck = await runSocialTokenCheck();
  } catch (error) {
    // Que falle el control no frena el armado: el token puede seguir vigente.
    const message = error instanceof Error ? error.message : String(error);
    console.error(`[cron social-album-stories] control del token: ${message}`);
    tokenCheck = { ok: false, error: message };
  }

  const stories = await generateDailyAlbumStories();
  return NextResponse.json({ ...stories, tokenCheck });
}
