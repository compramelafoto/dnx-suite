import { randomUUID } from "node:crypto";
import JSZip from "jszip";
import { NextResponse } from "next/server";
import { prisma } from "@repo/db";
import { parseWinnerFormat, WINNER_FORMATS, type WinnerFormat } from "../../../../../../lib/fotorank/design/constants";
import { requireContestOrganizer } from "../../../../../../lib/fotorank/design/route-auth";
import { renderWinnerImage } from "../../../../../../lib/fotorank/design/winner-image";
import { listContestWinners } from "../../../../../../lib/fotorank/design/winners";
import { slugArchivo } from "../../../../../../lib/fotorank/design/render";
import { getPrivateContestStorageProvider } from "../../../../../../lib/fotorank/storage/provider";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
/** Cada imagen tarda uno o dos segundos: un concurso con 40 premiados necesita margen. */
export const maxDuration = 300;

type Ctx = { params: Promise<{ contestId: string }> };

/**
 * GET /api/fotorank/contests/{contestId}/ganadores/zip?format=cuadrada|historia|todos
 *
 * Todas las imágenes de ganadores en un ZIP. Las que fallan no frenan el resto: quedan
 * anotadas en `errores.txt` dentro del ZIP.
 */
export async function GET(req: Request, ctx: Ctx) {
  const { contestId } = await ctx.params;
  const pedido = new URL(req.url).searchParams.get("format");
  const formatos: WinnerFormat[] =
    pedido === "todos" || !pedido ? [...WINNER_FORMATS] : [parseWinnerFormat(pedido)].filter((f): f is WinnerFormat => f !== null);
  if (formatos.length === 0) return NextResponse.json({ error: "Formato no válido." }, { status: 400 });

  const acceso = await requireContestOrganizer(contestId);
  if (!acceso.ok) return NextResponse.json({ error: acceso.error }, { status: acceso.status });

  const lista = await listContestWinners(contestId);
  if (!lista.ok || lista.winners.length === 0) {
    return NextResponse.json({ error: "Este concurso todavía no tiene premiados." }, { status: 404 });
  }

  const zip = new JSZip();
  const errores: string[] = [];
  const usados = new Set<string>();
  for (const winner of lista.winners) {
    for (const format of formatos) {
      const r = await renderWinnerImage({ organizationId: acceso.organizationId, contestId, format, winner });
      if (!r.ok) {
        errores.push(`${winner.recipientName ?? winner.entryId} (${format}): ${r.errors.join(" ")}`);
        continue;
      }
      let nombre = `${format}/${r.fileName}`;
      for (let i = 2; usados.has(nombre); i++) nombre = `${format}/${i}-${r.fileName}`;
      usados.add(nombre);
      zip.file(nombre, r.jpg);
    }
  }
  if (errores.length) zip.file("errores.txt", errores.join("\n"));

  const concurso = await prisma.fotorankContest.findUnique({ where: { id: contestId }, select: { slug: true } });
  const fileName = `ganadores-${slugArchivo(concurso?.slug ?? "concurso")}.zip`;
  const cuerpo = await zip.generateAsync({ type: "uint8array" });

  /*
   * Vercel corta cualquier respuesta de más de 4,5 MB, y un ZIP con decenas de imágenes lo pasa
   * enseguida. En producción se sube a R2 y se redirige a un enlace firmado de 10 minutos que
   * baja directo del bucket. En desarrollo (disco local) no hay tope: se entrega tal cual.
   */
  const storage = getPrivateContestStorageProvider();
  if (storage.presignDownload) {
    const key = `fotorank/contests/${contestId}/ganadores-zip/${randomUUID()}.zip`;
    await storage.putObject(key, cuerpo, "application/zip");
    const url = await storage.presignDownload(key, {
      fileName,
      contentType: "application/zip",
      expiresInSeconds: 600,
    });
    return NextResponse.redirect(url, 303);
  }

  return new NextResponse(cuerpo as unknown as BodyInit, {
    headers: {
      "Content-Type": "application/zip",
      "Content-Disposition": `attachment; filename="${fileName}"`,
      "Cache-Control": "private, no-store",
    },
  });
}
