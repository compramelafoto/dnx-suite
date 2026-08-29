import { NextResponse } from "next/server";
import { buildProposalPdf, ProposalWithoutSpacesError } from "@/lib/propuesta/pdf";
import {
  PDF_LIMIT,
  leerLogoDelFormulario,
  rejectIfRateLimited,
} from "@/lib/propuesta/public-guard";
import { PROPOSAL_SELLER } from "@/lib/propuesta/seller";
import {
  defaultProposalPeriod,
  listSellableSpaces,
  type InventoryRange,
  type ProposalSpaceAvailability,
} from "@repo/partners";
import { getProposalSpacesAvailability } from "@repo/db/partners-inventory-bookings";

/** Lee una fecha `AAAA-MM-DD` del formulario. */
function leerFecha(valor: FormDataEntryValue | null): Date | null {
  const texto = String(valor ?? "").trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(texto)) return null;
  const fecha = new Date(`${texto}T00:00:00.000Z`);
  return Number.isNaN(fecha.getTime()) ? null : fecha;
}

/**
 * Qué espacios tienen lugar en el período.
 *
 * Si la consulta falla —típicamente porque la migración del inventario todavía
 * no se aplicó— la propuesta sale sin filtrar por cupo, que es como salía antes.
 * Un generador que anda no se rompe por una tabla que todavía no existe.
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
    console.warn("[propuesta.pdf] sin datos de cupo, la propuesta sale sin filtrar", err);
    return undefined;
  }
}

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Nombre de archivo seguro a partir de la marca. */
function nombreDeArchivo(brandName: string): string {
  const base = brandName
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-zA-Z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .toLowerCase();
  return `propuesta-${base || "marca"}.pdf`;
}

/**
 * Devuelve el dossier en PDF con las piezas compuestas.
 * No guarda nada: recibe, compone y devuelve.
 */
export async function POST(request: Request) {
  const frenado = rejectIfRateLimited(request, PDF_LIMIT);
  if (frenado) return frenado;

  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    return NextResponse.json({ error: "No se pudo leer el formulario." }, { status: 400 });
  }

  const archivo = form.get("logo");
  const brandName = String(form.get("brandName") ?? "").trim();
  const industry = String(form.get("industry") ?? "").trim();
  const excluidas = form
    .getAll("excludePieceId")
    .map((v) => String(v).trim())
    .filter(Boolean);

  const logo = await leerLogoDelFormulario(archivo);
  if (!logo.ok) return logo.response;
  if (!brandName) {
    return NextResponse.json({ error: "Falta el nombre de la marca." }, { status: 400 });
  }

  const issuedAt = new Date();
  const desde = leerFecha(form.get("startsAt"));
  const hasta = leerFecha(form.get("endsAt"));
  const period =
    desde && hasta && hasta.getTime() > desde.getTime()
      ? { startsAt: desde, endsAt: hasta }
      : defaultProposalPeriod(issuedAt);

  try {
    const pdf = await buildProposalPdf({
      brandName,
      industry: industry || null,
      logo: logo.buffer,
      excludePieceIds: excluidas,
      issuedAt,
      period,
      availability: await disponibilidadONada(period, issuedAt),
    });

    return new NextResponse(new Uint8Array(pdf), {
      headers: {
        "content-type": "application/pdf",
        "content-disposition": `attachment; filename="${nombreDeArchivo(brandName)}"`,
        "cache-control": "no-store",
      },
    });
  } catch (err) {
    if (err instanceof ProposalWithoutSpacesError) {
      return NextResponse.json({ error: err.message }, { status: 409 });
    }
    console.error("[propuesta.pdf]", err);
    return NextResponse.json(
      { error: "No se pudo armar el PDF. Probá con otro archivo." },
      { status: 422 },
    );
  }
}
