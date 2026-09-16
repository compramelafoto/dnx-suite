/**
 * Baja todas las placas listas de una edición en un solo archivo comprimido.
 *
 * Con 37 inscripciones y dos placas cada una son 74 archivos: de a uno es inviable.
 *
 * Se arma al vuelo y se va enviando a medida que se comprime, sin juntarlo entero en memoria:
 * son unos 50 MB de imágenes y el servidor tiene poco margen. Por eso también la respuesta
 * empieza enseguida, aunque la descarga siga un rato.
 */
import archiver from "archiver";
import { prisma } from "@/lib/admin/db";
import { getClickatonAuthUser } from "@/lib/admin/auth";
import { hasClickatonAdminAccess } from "@/lib/admin/access";
import { loadParticipantCardPngFromAsset } from "@/lib/participant-cards/participant-card-asset-store";
import {
  nombreDeArchivoDePlaca,
  nombresSinRepetir,
} from "@/lib/participant-cards/participant-card-descarga-masiva";
import { normalizeParticipantCardType } from "@/lib/participant-cards/participant-card-presets";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
/** Comprimir 74 imágenes desde el almacenamiento lleva su tiempo. */
export const maxDuration = 300;

type Params = { params: Promise<{ editionId: string }> };

export async function GET(_req: Request, { params }: Params) {
  const user = await getClickatonAuthUser();
  if (!user || !hasClickatonAdminAccess(user)) {
    return Response.json(
      { ok: false, error: "No autorizado", code: "CLICKATON_CARD_FORBIDDEN" },
      { status: user ? 403 : 401 },
    );
  }

  const { editionId } = await params;

  const edicion = await prisma.clickatonEdition.findUnique({
    where: { id: editionId },
    select: { id: true, slug: true },
  });
  if (!edicion) {
    return Response.json({ ok: false, error: "Edición inexistente" }, { status: 404 });
  }

  const placas = await prisma.clickatonParticipantCard.findMany({
    where: { editionId, status: "READY", assetId: { not: null } },
    orderBy: [{ registration: { visibleCode: "asc" } }, { cardType: "asc" }],
    select: {
      assetId: true,
      cardType: true,
      registrationId: true,
      registration: { select: { visibleCode: true } },
    },
  });

  if (placas.length === 0) {
    return Response.json(
      { ok: false, error: "Todavía no hay placas generadas en esta edición." },
      { status: 404 },
    );
  }

  const nombres = nombresSinRepetir(
    placas.map((p) =>
      nombreDeArchivoDePlaca({
        visibleCode: p.registration?.visibleCode,
        registrationId: p.registrationId,
        cardType: normalizeParticipantCardType(p.cardType),
      }),
    ),
  );

  /*
   * Sin compresión: un PNG ya viene comprimido, así que apretarlo de nuevo sólo gasta tiempo de
   * servidor para ahorrar unos pocos kilobytes.
   */
  const zip = archiver("zip", { zlib: { level: 0 } });

  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      zip.on("data", (chunk: Buffer) => controller.enqueue(new Uint8Array(chunk)));
      zip.on("end", () => controller.close());
      zip.on("error", (e) => controller.error(e));

      void (async () => {
        for (const [i, placa] of placas.entries()) {
          try {
            const png = await loadParticipantCardPngFromAsset(placa.assetId!);
            zip.append(png, { name: nombres[i]! });
          } catch {
            /*
             * Una placa ilegible no puede arruinar la descarga de las otras 73: se anota en un
             * aviso adentro del comprimido y se sigue.
             */
            zip.append(
              `No se pudo leer esta placa al armar la descarga: ${nombres[i]}\n`,
              { name: `NO-SE-PUDO-${nombres[i]}.txt` },
            );
          }
        }
        await zip.finalize();
      })();
    },
    cancel() {
      zip.abort();
    },
  });

  const nombreDelArchivo = `placas-${edicion.slug || edicion.id}.zip`;
  return new Response(stream, {
    headers: {
      "Content-Type": "application/zip",
      "Content-Disposition": `attachment; filename="${nombreDelArchivo}"`,
      "Cache-Control": "no-store",
    },
  });
}
