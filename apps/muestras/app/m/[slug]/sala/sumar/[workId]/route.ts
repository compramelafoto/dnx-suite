import { prisma } from "@repo/db";
import { roomPassCookieName } from "@repo/muestras";
import { frenarPorIp, ipDeLaPeticion } from "@/lib/limite";
import { escaneoValido, llaveExistente } from "@/lib/sala/llave";
import { cookieDePase, leerCookie, rutaDeSala } from "@/lib/sala/pase";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ slug: string; workId: string }> };

const SLUG = /^[a-z0-9-]{1,160}$/;
const ID = /^[A-Za-z0-9_-]{1,32}$/;

function redirigir(path: string, cookie?: string) {
  const headers = new Headers({ Location: path, "Cache-Control": "private, no-store", "X-Robots-Tag": "noindex" });
  if (cookie) headers.append("Set-Cookie", cookie);
  return new Response(null, { status: 302, headers });
}

/**
 * La sala suma al pase la obra que se acaba de escanear (spec D30). Llega desde `/q` con la firma
 * del escaneo; está dentro de `/m/<slug>/sala`, así que recibe la cookie del pase (que no viaja al
 * resto del sitio). Sin firma válida no suma nada: la vista de sala decide con el pase que haya.
 */
export async function GET(req: Request, { params }: Ctx) {
  const { slug, workId } = await params;
  if (!SLUG.test(slug) || !ID.test(workId)) return redirigir("/");
  const destino = `${rutaDeSala(slug)}/o/${encodeURIComponent(workId)}`;
  // El mismo freno holgado que `/q`: un grupo escolar en el Wi-Fi de la sala comparte IP.
  if (!frenarPorIp("qr", ipDeLaPeticion(req.headers), "sala").allowed) return redirigir(destino);
  try {
    const a = await prisma.culturalActivity.findUnique({ where: { slug }, select: { id: true, type: true, reviewStatus: true } });
    if (!a || a.type !== "MUESTRA" || a.reviewStatus !== "APPROVED") return redirigir(destino);
    const llave = await llaveExistente(a.id);
    const q = new URL(req.url).searchParams;
    const ahora = new Date();
    if (!llave || !escaneoValido({ activityId: a.id, workId, ts: Number(q.get("t")), firma: q.get("f") }, llave, ahora)) return redirigir(destino);
    const seguro = process.env.NODE_ENV === "production" || new URL(req.url).protocol === "https:";
    const cookie = cookieDePase({ previo: leerCookie(req, roomPassCookieName(a.id)), activityId: a.id, slug, workId, llave, ahora, seguro });
    return redirigir(destino, cookie);
  } catch (err) {
    console.error("[sala/sumar] no se pudo dar el pase:", err instanceof Error ? err.message : String(err));
    return redirigir(destino);
  }
}
