import { NextRequest, NextResponse } from "next/server";
import { checkRateLimit } from "@/lib/rate-limit";
import {
  claimSharedGift,
  loadSharedGiftLinkByToken,
  validateFamilyData,
} from "@/lib/canje-externo/shared-voucher-link";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * POST /api/canje/compartido/[token]
 *
 * La familia deja sus datos en el link compartido de regalo y recibe el link de SU combo
 * (`/canje/<token de la familia>`). Público: sin el token del link compartido no se crea nada.
 */
export async function POST(req: NextRequest, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "sin-ip";
  const limit = checkRateLimit({ key: `canje-compartido:${ip}`, limit: 10, windowMs: 10 * 60 * 1000 });
  if (!limit.allowed) {
    return NextResponse.json(
      { ok: false, error: "Hiciste muchos intentos seguidos. Esperá unos minutos y probá de nuevo." },
      { status: 429 }
    );
  }

  const lookup = token ? await loadSharedGiftLinkByToken(token) : null;
  if (!lookup || !lookup.ok) {
    return NextResponse.json(
      { ok: false, error: "Este link ya no está disponible. Escribile al fotógrafo." },
      { status: 404 }
    );
  }

  const body = (await req.json().catch(() => null)) as Record<string, unknown> | null;
  const valid = validateFamilyData(body ?? {});
  if (!valid.ok) return NextResponse.json({ ok: false, error: valid.error }, { status: 400 });

  const result = await claimSharedGift(lookup.link, valid.data);
  if (!result.ok) {
    return NextResponse.json(
      {
        ok: false,
        error:
          "Con este email o WhatsApp ya se pidieron las fotos de regalo. Si querés más fotos, las podés comprar en la galería.",
        albumHref: result.albumSlug ? `/album/${result.albumSlug}` : null,
      },
      { status: 409 }
    );
  }
  return NextResponse.json({ ok: true, href: `/canje/${result.familyToken}`, reused: result.reused });
}
