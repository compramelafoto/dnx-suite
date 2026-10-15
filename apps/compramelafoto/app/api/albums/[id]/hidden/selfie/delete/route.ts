import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { deleteFromR2 } from "@/lib/r2-client";
import { checkRateLimit } from "@/lib/rate-limit";
import { getClientIp, hashIp } from "@/lib/hidden-album-audit";
import {
  getHiddenSelfieDeletionSecret,
  verifyHiddenSelfieDeletionToken,
} from "@/lib/hidden-album-selfie-deletion";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Outcome = { status: number; ok: boolean; message: string };

function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);
}

function htmlPage(title: string, body: string, status = 200): NextResponse {
  const html = `<!doctype html><html lang="es"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><meta name="robots" content="noindex"><title>${escapeHtml(title)}</title>
<style>body{font-family:system-ui,-apple-system,sans-serif;background:#f8fafc;color:#1e293b;margin:0;padding:24px 16px}main{max-width:480px;margin:40px auto;background:#fff;border:1px solid #e2e8f0;border-radius:16px;padding:24px}h1{font-size:20px;margin:0 0 12px}p{line-height:1.5;font-size:15px}button{background:#c27b3d;color:#fff;border:0;border-radius:10px;padding:12px 18px;font-size:15px;font-weight:600;cursor:pointer;width:100%}a{color:#c27b3d}</style></head>
<body><main><h1>${escapeHtml(title)}</h1>${body}</main></body></html>`;
  return new NextResponse(html, { status, headers: { "content-type": "text/html; charset=utf-8", "cache-control": "no-store" } });
}

function wantsHtml(req: NextRequest): boolean {
  const accept = req.headers.get("accept") || "";
  const ct = req.headers.get("content-type") || "";
  return accept.includes("text/html") || ct.includes("application/x-www-form-urlencoded");
}

async function deleteStoredSelfie(req: NextRequest, albumId: number, token: string): Promise<Outcome> {
  const rate = checkRateLimit({ key: `hidden-selfie-delete:${hashIp(getClientIp(req))}`, limit: 20, windowMs: 60 * 1000 });
  if (!rate.allowed) {
    return { status: 429, ok: false, message: "Demasiados intentos. Probá de nuevo en un minuto." };
  }

  const secret = getHiddenSelfieDeletionSecret();
  if (!secret) {
    console.error("[hidden-album] borrado de selfie sin secreto configurado (BIOMETRIC_DELETION_SECRET/CRON_SECRET)");
    return { status: 503, ok: false, message: "No pudimos procesar el pedido. Escribinos desde /privacidad/solicitud." };
  }

  const data = verifyHiddenSelfieDeletionToken(token, { secret, albumId });
  if (!data) {
    return {
      status: 401,
      ok: false,
      message: "El enlace no es válido o ya venció. Si tu selfie todavía figura guardada, pedí el borrado desde /privacidad/solicitud.",
    };
  }

  const attempt = await prisma.hiddenAlbumAttempt.findFirst({
    where: { id: data.attemptId, albumId },
    select: { id: true, selfieObjectKey: true },
  });

  // Idempotente: si el intento ya no existe o no tiene selfie, no hay nada que borrar.
  if (!attempt || !attempt.selfieObjectKey) {
    return { status: 200, ok: true, message: "Tu selfie ya no está guardada. No hace falta hacer nada más." };
  }

  try {
    await deleteFromR2(attempt.selfieObjectKey);
  } catch (err) {
    console.error("[hidden-album] no se pudo borrar la selfie de R2", {
      attemptId: attempt.id,
      error: err instanceof Error ? err.message : String(err),
    });
    // Se deja la clave para que el cron lo reintente.
    return { status: 502, ok: false, message: "No pudimos borrar tu selfie en este momento. Probá de nuevo en unos minutos." };
  }

  await prisma.hiddenAlbumAttempt.update({
    where: { id: attempt.id },
    data: { selfieStored: false, selfieObjectKey: null, selfieExpiresAt: null },
  });

  return { status: 200, ok: true, message: "Listo: borramos tu selfie. Las fotos que ya estás viendo siguen disponibles mientras dure tu sesión." };
}

function parseAlbumId(raw: string): number | null {
  const n = parseInt(raw, 10);
  return Number.isFinite(n) && n > 0 ? n : null;
}

/** GET: página de confirmación (no borra nada; evita que un previsualizador de enlaces lo dispare). */
export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const albumId = parseAlbumId(id);
  const token = req.nextUrl.searchParams.get("token") || "";
  if (!albumId || !token) {
    return htmlPage("Enlace inválido", "<p>El enlace para borrar la selfie no es válido.</p>", 400);
  }
  return htmlPage(
    "Borrar mi selfie",
    `<p>Vas a borrar la selfie que usaste para buscar tus fotos en este álbum. Esto no se puede deshacer.</p>
<form method="post" action="/api/albums/${albumId}/hidden/selfie/delete"><input type="hidden" name="token" value="${escapeHtml(token)}"><button type="submit">Borrar mi selfie ahora</button></form>`,
  );
}

/** POST: borra la selfie guardada (JSON `{ token }` o formulario). Idempotente. */
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const albumId = parseAlbumId(id);
  const html = wantsHtml(req);

  let token = "";
  try {
    const ct = req.headers.get("content-type") || "";
    if (ct.includes("application/json")) {
      const body = await req.json();
      token = typeof body?.token === "string" ? body.token : "";
    } else {
      const form = await req.formData();
      token = form.get("token")?.toString() || "";
    }
  } catch {
    token = "";
  }
  if (!token) token = req.nextUrl.searchParams.get("token") || "";

  const outcome: Outcome =
    !albumId || !token
      ? { status: 400, ok: false, message: "Falta el enlace de borrado." }
      : await deleteStoredSelfie(req, albumId, token).catch((err) => {
          console.error("[hidden-album] error borrando selfie", err);
          return { status: 500, ok: false, message: "No pudimos borrar tu selfie. Probá de nuevo más tarde." };
        });

  if (html) {
    return htmlPage(outcome.ok ? "Selfie borrada" : "No se pudo borrar", `<p>${escapeHtml(outcome.message)}</p>`, outcome.status);
  }
  return NextResponse.json(outcome.ok ? { ok: true, message: outcome.message } : { error: outcome.message }, { status: outcome.status });
}
