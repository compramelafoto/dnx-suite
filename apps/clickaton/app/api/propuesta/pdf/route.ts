import { NextResponse } from "next/server";
import {
  buildProposalPdf,
  resolveProposalPlan,
  ProposalWithoutSpacesError,
} from "@/lib/propuesta/pdf";
import { guardarPropuesta } from "@/lib/propuesta/persistencia";
import {
  PDF_LIMIT,
  clientKeyFrom,
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
/** Compone dieciocho imágenes y arma el documento: es el pedido más caro del generador. */
export const maxDuration = 60;

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
 *
 * Guarda la propuesta antes de dibujarla: el código que va impreso en la portada
 * sale de la fila ya escrita. Si guardar falla —tabla sin migrar, R2 sin
 * configurar—, el PDF sale igual pero sin código. La pantalla es una herramienta
 * de venta: que no se pueda recuperar después es peor que nada, pero no vender
 * es peor todavía.
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
    const { plan, plate } = await resolveProposalPlan({
      brandName,
      industry: industry || null,
      logo: logo.buffer,
      excludePieceIds: excluidas,
      period,
      availability: await disponibilidadONada(period, issuedAt),
    });

    const guardada = await guardarPropuesta({
      plan,
      logo: logo.buffer,
      period,
      contactUrl: String(form.get("contactUrl") ?? "").trim() || null,
      clientKeyHash: clientKeyFrom(request),
      now: issuedAt,
    });

    const pdf = await buildProposalPdf({
      brandName,
      industry: industry || null,
      logo: logo.buffer,
      excludePieceIds: excluidas,
      issuedAt,
      period,
      plan,
      plate,
      code: guardada?.code ?? null,
      expiresAt: guardada?.expiresAt ?? null,
    });

    const headers = new Headers({
      "content-type": "application/pdf",
      "content-disposition": `attachment; filename="${nombreDeArchivo(brandName)}"`,
      "cache-control": "no-store",
    });
    // El PDF es binario: el código viaja por cabecera para que la pantalla lo
    // muestre sin tener que pedir la propuesta otra vez.
    if (guardada) {
      headers.set("x-propuesta-codigo", guardada.code);
      headers.set("x-propuesta-vence", guardada.expiresAt.toISOString());
    }

    return new NextResponse(new Uint8Array(pdf), { headers });
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
