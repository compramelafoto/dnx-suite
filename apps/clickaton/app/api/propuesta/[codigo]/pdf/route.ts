import { NextResponse } from "next/server";
import { getProposalByCode } from "@repo/db/partners-proposals";
import { getProposalSpacesAvailability } from "@repo/db/partners-inventory-bookings";
import {
  PROPOSAL_PIECES,
  listSellableSpaces,
  type InventoryRange,
  type ProposalSpaceAvailability,
} from "@repo/partners";
import { PROPOSAL_SELLER } from "@/lib/propuesta/seller";
import { buildProposalPdf, ProposalWithoutSpacesError } from "@/lib/propuesta/pdf";
import { leerLogoGuardado } from "@/lib/propuesta/persistencia";
import { CODE_LIMIT, rejectIfRateLimited } from "@/lib/propuesta/public-guard";

/**
 * Vuelve a armar el dossier de una propuesta guardada.
 *
 * **Se rearma, no se sirve un archivo cacheado.** Entre que se guardó y que se
 * la recupera pueden haberse vendido espacios, y mandar un PDF que ofrece un
 * lugar ya tomado es peor que tardar veinte segundos en rehacerlo.
 *
 * Lo único que se guarda es el logo. Si se borró —una propuesta vencida pierde
 * el archivo antes que la fila— no hay dossier que rearmar.
 */

/**
 * Qué espacios tienen lugar hoy. Si la consulta falla, la propuesta sale sin
 * filtrar, como cuando se armó.
 */
async function disponibilidadONada(
  period: InventoryRange,
  now: Date,
): Promise<Readonly<Record<string, ProposalSpaceAvailability>> | undefined> {
  try {
    const claves = listSellableSpaces(PROPOSAL_SELLER).map((espacio) => espacio.placementKey);
    return (await getProposalSpacesAvailability({
      placementKeys: claves,
      range: period,
      now,
    })) as Record<string, ProposalSpaceAvailability>;
  } catch (err) {
    console.warn("[propuesta.recuperar] sin datos de cupo", err);
    return undefined;
  }
}

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

function nombreDeArchivo(brandName: string, code: string): string {
  const base = brandName
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-zA-Z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .toLowerCase();
  return `propuesta-${base || "marca"}-${code}.pdf`;
}

export async function GET(
  request: Request,
  { params }: { params: Promise<{ codigo: string }> },
) {
  const frenado = rejectIfRateLimited(request, CODE_LIMIT);
  if (frenado) return frenado;

  const { codigo } = await params;
  const ahora = new Date();

  let propuesta: Awaited<ReturnType<typeof getProposalByCode>>;
  try {
    propuesta = await getProposalByCode({ code: codigo, now: ahora });
  } catch (err) {
    console.error("[propuesta.recuperar]", err);
    return NextResponse.json({ error: "No se pudo buscar la propuesta." }, { status: 503 });
  }

  if (!propuesta) {
    return NextResponse.json(
      { error: "No encontramos esa propuesta. Puede que el código esté mal o que haya vencido." },
      { status: 404 },
    );
  }

  const logo = await leerLogoGuardado(propuesta.logoStorageKey);
  if (!logo) {
    return NextResponse.json(
      { error: "El logo de esta propuesta ya no está guardado. Hay que armarla de nuevo." },
      { status: 410 },
    );
  }

  // El plan se rearma con las piezas que tenía la propuesta, no con todas las
  // vendibles: si el vendedor sacó dos, sacadas siguen.
  const guardadas = new Set(propuesta.items.map((item) => item.pieceId).filter(Boolean));
  const excluidas = PROPOSAL_PIECES.filter((p) => !guardadas.has(p.id)).map((p) => p.id);
  const period = { startsAt: propuesta.periodStart, endsAt: propuesta.periodEnd };

  try {
    const pdf = await buildProposalPdf({
      brandName: propuesta.brandName,
      industry: propuesta.industry,
      logo,
      excludePieceIds: excluidas,
      issuedAt: propuesta.createdAt,
      period,
      availability: await disponibilidadONada(period, ahora),
      code: propuesta.code,
      expiresAt: propuesta.expiresAt,
    });

    return new NextResponse(new Uint8Array(pdf), {
      headers: {
        "content-type": "application/pdf",
        "content-disposition": `attachment; filename="${nombreDeArchivo(propuesta.brandName, propuesta.code)}"`,
        "cache-control": "no-store",
      },
    });
  } catch (err) {
    if (err instanceof ProposalWithoutSpacesError) {
      return NextResponse.json(
        { error: "Los espacios de esta propuesta ya no están disponibles. Armá una nueva." },
        { status: 409 },
      );
    }
    console.error("[propuesta.recuperar.pdf]", err);
    return NextResponse.json({ error: "No se pudo rearmar el PDF." }, { status: 422 });
  }
}
