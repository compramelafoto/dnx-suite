import { NextResponse } from "next/server";
import { Role } from "@prisma/client";
import { requireAuth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { generateDailyAlbumStories } from "@/lib/social/album-stories";
import { generateWelcomeStories } from "@/lib/social/welcome-stories";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;

/**
 * El álbum que pegó el admin: el número («1052»), el link corto («compramelafoto.com/a/1052»)
 * o el link con el nombre del álbum (`publicSlug`).
 */
async function resolverAlbum(texto: string): Promise<number | null> {
  const t = texto.trim();
  if (!t) return null;
  if (/^\d+$/.test(t)) return Number(t);
  const corto = t.match(/\/a\/(\d+)(?:[/?#]|$)/);
  if (corto) return Number(corto[1]);
  const slug = t.replace(/[?#].*$/, "").replace(/\/+$/, "").split("/").pop();
  if (!slug) return null;
  const a = await prisma.album.findFirst({ where: { publicSlug: slug }, select: { id: true } });
  return a?.id ?? null;
}

/**
 * «Armar ahora»: corre la generación diaria sin esperar al cron. Es idempotente.
 * Con `{ album }` arma las historias de ese álbum aunque no sea reciente. Sin álbum, también
 * arma las bienvenidas de los fotógrafos nuevos.
 */
export async function POST(req: Request) {
  const { error, user } = await requireAuth([Role.ADMIN]);
  if (error || !user) return NextResponse.json({ error: error ?? "No autorizado" }, { status: 401 });
  const body = (await req.json().catch(() => ({}))) as { album?: unknown };
  if (typeof body.album === "string" || typeof body.album === "number") {
    const id = await resolverAlbum(String(body.album));
    if (!id) return NextResponse.json({ error: "No encontré ese álbum. Pegá su número o su link." }, { status: 404 });
    return NextResponse.json({ ...(await generateDailyAlbumStories(new Date(), { albumIds: [id] })), albumId: id });
  }
  const stories = await generateDailyAlbumStories();
  const welcomes = await generateWelcomeStories();
  return NextResponse.json({ ...stories, welcomes });
}
