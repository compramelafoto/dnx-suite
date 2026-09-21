/**
 * Sirve la vista previa de una obra al jurado.
 *
 * No hay sesión de jurado en Clickatón: la autorización viaja en la firma que
 * emite FotoRank. Por eso el enlace vence rápido y la regla de acceso vuelve a
 * comprobarse acá contra la base, nunca sólo contra la firma.
 */
import { NextResponse } from "next/server";
import { prisma } from "@/lib/admin/db";
import { resolveJuryPreviewAccess } from "@/lib/jury-media/resolve-preview";
import { verifyJuryPreviewLink } from "@/lib/jury-media/signed-link";
import { getPrivateEntryStorage } from "@/lib/photo-upload/storage";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

type Params = { params: Promise<{ assetId: string }> };

function notFound() {
  return NextResponse.json({ ok: false, error: "NOT_FOUND" }, { status: 404 });
}

export async function GET(request: Request, { params }: Params) {
  const { assetId } = await params;
  const url = new URL(request.url);

  const verification = verifyJuryPreviewLink({
    assetId,
    exp: url.searchParams.get("exp") ?? "",
    sig: url.searchParams.get("sig") ?? "",
  });
  if (!verification.ok) {
    // Un enlace vencido merece un código propio: es el caso normal, no un ataque.
    const status = verification.reason === "EXPIRED" ? 410 : 403;
    return NextResponse.json({ ok: false, error: verification.reason }, { status });
  }

  const access = await resolveJuryPreviewAccess({
    assetId,
    repo: {
      findAsset: (id) =>
        prisma.fotorankContestEntryAsset.findUnique({
          where: { id },
          select: {
            id: true,
            storageKey: true,
            mimeType: true,
            isActive: true,
            kind: true,
            storageProvider: true,
          },
        }),
    },
  });
  if (!access.ok) return notFound();

  try {
    const body = await getPrivateEntryStorage().get(access.storageKey);
    return new NextResponse(new Uint8Array(body), {
      status: 200,
      headers: {
        "Content-Type": access.contentType,
        // Privada y corta: el enlace vence, la caché no debe sobrevivirlo.
        "Cache-Control": "private, max-age=60, no-store",
        "X-Content-Type-Options": "nosniff",
        "X-Robots-Tag": "noindex, nofollow",
      },
    });
  } catch {
    return notFound();
  }
}
