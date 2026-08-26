import { NextResponse } from "next/server";
import { getAuthUser } from "../../../../../../lib/auth";
import {
  ContestSponsorCardError,
  buildContestSponsorCardFilename,
  listContestSponsorsForOrganizer,
  renderContestSponsorThankYouCard,
} from "../../../../../../lib/fotorank/partners/contest-sponsor-card";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

type Ctx = { params: Promise<{ contestId: string }> };

/**
 * GET /api/fotorank/contests/[contestId]/sponsors/thankyou-card
 *
 * Sin `sponsor`: devuelve JSON con los sponsors del concurso (para armar el menú).
 * Con `sponsor=<nombre>`: devuelve la placa PNG 1080×1920 de agradecimiento.
 *
 * Query opcional: `disposition=attachment`, `message`, `tierLabel`.
 */
export async function GET(req: Request, ctx: Ctx) {
  const user = await getAuthUser();
  if (!user) {
    return NextResponse.json(
      { error: { code: "UNAUTHENTICATED", message: "Debés iniciar sesión." } },
      { status: 401 }
    );
  }

  const { contestId } = await ctx.params;
  const url = new URL(req.url);
  const sponsorName = url.searchParams.get("sponsor")?.trim() ?? "";

  try {
    if (!sponsorName) {
      const sponsors = await listContestSponsorsForOrganizer({
        contestId,
        userId: user.id,
      });
      return NextResponse.json({ ok: true, sponsors });
    }

    const card = await renderContestSponsorThankYouCard({
      contestId,
      sponsorName,
      userId: user.id,
      message: url.searchParams.get("message"),
      tierLabel: url.searchParams.get("tierLabel"),
    });

    const disposition =
      url.searchParams.get("disposition") === "attachment" ? "attachment" : "inline";

    return new NextResponse(new Uint8Array(card.png), {
      status: 200,
      headers: {
        "Content-Type": "image/png",
        "Content-Length": String(card.png.length),
        "Content-Disposition": `${disposition}; filename="${buildContestSponsorCardFilename(sponsorName)}"`,
        "Cache-Control": "private, no-store",
        "X-Template-Key": card.templateKey,
        // El organizador ve por qué salió sin logo sin abrir los logs.
        ...(card.logoWarnings.length > 0
          ? { "X-Sponsor-Logo-Warning": card.logoWarnings.join(" | ").slice(0, 400) }
          : {}),
      },
    });
  } catch (err) {
    if (err instanceof ContestSponsorCardError) {
      return NextResponse.json(
        { error: { code: err.code, message: err.message } },
        { status: err.httpStatus }
      );
    }
    console.error("[sponsor thankyou card]", err);
    return NextResponse.json(
      { error: { code: "INTERNAL", message: "Error al generar la placa." } },
      { status: 500 }
    );
  }
}
