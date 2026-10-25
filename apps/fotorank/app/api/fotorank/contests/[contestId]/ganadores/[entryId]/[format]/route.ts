import { NextResponse } from "next/server";
import { parseWinnerFormat } from "../../../../../../../lib/fotorank/design/constants";
import { requireContestOrganizer } from "../../../../../../../lib/fotorank/design/route-auth";
import { renderWinnerImage } from "../../../../../../../lib/fotorank/design/winner-image";
import { listContestWinners } from "../../../../../../../lib/fotorank/design/winners";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

type Ctx = { params: Promise<{ contestId: string; entryId: string; format: string }> };

/**
 * GET /api/fotorank/contests/{contestId}/ganadores/{entryId|muestra}/{cuadrada|historia}
 *
 * La imagen de un ganador (o una de muestra, para ver el diseño). `?download=1` la baja como
 * archivo; sin eso se muestra en el navegador.
 */
export async function GET(req: Request, ctx: Ctx) {
  const { contestId, entryId, format: rawFormat } = await ctx.params;
  const format = parseWinnerFormat(rawFormat);
  if (!format) return NextResponse.json({ error: "Formato no válido." }, { status: 400 });

  const acceso = await requireContestOrganizer(contestId);
  if (!acceso.ok) return NextResponse.json({ error: acceso.error }, { status: acceso.status });

  let winner = null;
  if (entryId !== "muestra") {
    const lista = await listContestWinners(contestId);
    winner = lista.ok ? (lista.winners.find((w) => w.entryId === entryId) ?? null) : null;
    if (!winner) return NextResponse.json({ error: "Esa obra no está entre los premiados." }, { status: 404 });
  }

  const r = await renderWinnerImage({
    organizationId: acceso.organizationId,
    contestId,
    format,
    winner,
  });
  if (!r.ok) return NextResponse.json({ error: r.errors.join(" ") }, { status: 422 });

  const descargar = new URL(req.url).searchParams.get("download") === "1";
  return new NextResponse(new Uint8Array(r.jpg), {
    headers: {
      "Content-Type": "image/jpeg",
      "Content-Disposition": `${descargar ? "attachment" : "inline"}; filename="${r.fileName}"`,
      "Cache-Control": "private, no-store",
    },
  });
}
