import { hasClickatonAdminAccess } from "@/lib/admin/access";
import { getClickatonAuthUser } from "@/lib/admin/auth";
import {
  SponsorThankYouCardError,
  buildSponsorThankYouFilename,
  renderClickatonSponsorThankYouCard,
} from "@/lib/sponsor-cards/sponsor-thankyou-card";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

type Params = { params: Promise<{ partnerId: string }> };

/**
 * GET /api/admin/sponsors/[partnerId]/thankyou-card?editionId=...
 * Devuelve la placa PNG de agradecimiento (1080×1920) lista para redes.
 *
 * Query opcional: `disposition=attachment`, `message`, `tierLabel`.
 */
export async function GET(req: Request, { params }: Params) {
  const user = await getClickatonAuthUser();
  if (!user) {
    return Response.json(
      { ok: false, error: "No autenticado", code: "SPONSOR_CARD_UNAUTHORIZED" },
      { status: 401 }
    );
  }
  if (!hasClickatonAdminAccess({ email: user.email, globalRole: user.globalRole })) {
    return Response.json(
      { ok: false, error: "Sin permisos administrativos", code: "SPONSOR_CARD_FORBIDDEN" },
      { status: 403 }
    );
  }

  const { partnerId } = await params;
  const url = new URL(req.url);
  const editionId = url.searchParams.get("editionId")?.trim();
  if (!editionId) {
    return Response.json(
      { ok: false, error: "Falta editionId", code: "SPONSOR_CARD_EDITION_REQUIRED" },
      { status: 400 }
    );
  }

  try {
    const card = await renderClickatonSponsorThankYouCard({
      partnerId,
      editionId,
      message: url.searchParams.get("message"),
      tierLabel: url.searchParams.get("tierLabel"),
    });

    const disposition =
      url.searchParams.get("disposition") === "attachment" ? "attachment" : "inline";
    const filename = buildSponsorThankYouFilename(
      url.searchParams.get("name") ?? partnerId
    );

    return new Response(new Uint8Array(card.png), {
      status: 200,
      headers: {
        "Content-Type": "image/png",
        "Content-Length": String(card.png.length),
        "Content-Disposition": `${disposition}; filename="${filename}"`,
        "Cache-Control": "private, no-store",
        "X-Template-Key": card.templateKey,
        // El admin ve por qué salió sin logo sin tener que abrir los logs.
        ...(card.logoWarnings.length > 0
          ? { "X-Sponsor-Logo-Warning": card.logoWarnings.join(" | ").slice(0, 400) }
          : {}),
      },
    });
  } catch (err) {
    if (err instanceof SponsorThankYouCardError) {
      const status = err.code === "PARTNER_NOT_FOUND" || err.code === "EDITION_NOT_FOUND" ? 404 : 422;
      return Response.json({ ok: false, error: err.message, code: err.code }, { status });
    }
    const message = err instanceof Error ? err.message : "Error al generar la placa";
    return Response.json(
      { ok: false, error: message, code: "SPONSOR_CARD_RENDER_FAILED" },
      { status: 500 }
    );
  }
}
