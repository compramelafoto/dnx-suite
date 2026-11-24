import { NextRequest, NextResponse } from "next/server";
import { Role } from "@prisma/client";
import { requireAuth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { normalizeGearSerial } from "@/lib/stolen-gear/serial";
import { isAllowedStolenGearMime, MAX_STOLEN_GEAR_FILE_BYTES, uploadStolenGearFile } from "@/lib/stolen-gear/files";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const PHOTOGRAPHER_ROLES = [Role.PHOTOGRAPHER, Role.LAB_PHOTOGRAPHER];

/**
 * Las denuncias del propio fotógrafo (sólo su estado: nunca coincidencias) y los
 * equipos con número de serie que CLF ya le detectó, para completar el formulario.
 */
export async function GET() {
  const { error, user } = await requireAuth(PHOTOGRAPHER_ROLES);
  if (error || !user) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const [reports, detected] = await Promise.all([
    prisma.stolenGearReport.findMany({
      where: { reporterId: user.id },
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        kind: true,
        make: true,
        model: true,
        serialRaw: true,
        stolenAt: true,
        status: true,
        rejectionReason: true,
        createdAt: true,
        recoveredAt: true,
      },
    }),
    prisma.gearSerialSighting.findMany({
      where: { photographerId: user.id },
      orderBy: [{ kind: "asc" }, { lastSeenAt: "desc" }],
      select: { kind: true, make: true, model: true, serialRaw: true, lastSeenAt: true, photosCount: true },
      take: 50,
    }),
  ]);

  return NextResponse.json({ reports, detected });
}

function text(form: FormData, name: string, max = 300): string {
  const v = form.get(name);
  return typeof v === "string" ? v.trim().slice(0, max) : "";
}

/** Nueva denuncia. Queda en revisión hasta que el administrador mire la factura. */
export async function POST(req: NextRequest) {
  const { error, user } = await requireAuth(PHOTOGRAPHER_ROLES);
  if (error || !user) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  let form: FormData;
  try {
    form = await req.formData();
  } catch {
    return NextResponse.json({ error: "El formulario llegó incompleto. Probá con archivos más livianos." }, { status: 400 });
  }

  const kind = text(form, "kind") === "LENS" ? "LENS" : "BODY";
  const make = text(form, "make", 80);
  const model = text(form, "model", 120);
  const serialRaw = text(form, "serial", 80);
  const serialNormalized = normalizeGearSerial(serialRaw);
  const stolenAtRaw = text(form, "stolenAt", 20);
  const stolenAt = /^\d{4}-\d{2}-\d{2}$/.test(stolenAtRaw) ? new Date(`${stolenAtRaw}T12:00:00-03:00`) : null;
  const invoice = form.get("invoice");
  const police = form.get("policeReport");

  if (!make || !model) return NextResponse.json({ error: "Completá marca y modelo." }, { status: 400 });
  if (!serialNormalized) {
    return NextResponse.json({ error: "El número de serie no es válido (mínimo 4 letras o números)." }, { status: 400 });
  }
  if (!stolenAt || Number.isNaN(stolenAt.getTime()) || stolenAt.getTime() > Date.now() + 86_400_000) {
    return NextResponse.json({ error: "Indicá la fecha del robo." }, { status: 400 });
  }
  if (!(invoice instanceof File) || invoice.size === 0) {
    return NextResponse.json({ error: "Adjuntá la factura de compra." }, { status: 400 });
  }
  for (const f of [invoice, police]) {
    if (f instanceof File && f.size > 0) {
      if (!isAllowedStolenGearMime(f.type)) {
        return NextResponse.json({ error: "Los archivos tienen que ser JPG, PNG, WEBP o PDF." }, { status: 400 });
      }
      if (f.size > MAX_STOLEN_GEAR_FILE_BYTES) {
        return NextResponse.json({ error: "Cada archivo puede pesar hasta 4 MB." }, { status: 400 });
      }
    }
  }

  const duplicate = await prisma.stolenGearReport.findFirst({
    where: {
      reporterId: user.id,
      kind,
      serialNormalized,
      status: { in: ["PENDING_REVIEW", "ACTIVE"] },
    },
    select: { id: true },
  });
  if (duplicate) {
    return NextResponse.json({ error: "Ya tenés una denuncia abierta por ese número de serie." }, { status: 409 });
  }

  try {
    const inv = await uploadStolenGearFile(invoice);
    const pol = police instanceof File && police.size > 0 ? await uploadStolenGearFile(police) : null;
    const report = await prisma.stolenGearReport.create({
      data: {
        reporterId: user.id,
        kind,
        make,
        model,
        serialRaw,
        serialNormalized,
        stolenAt,
        stolenPlace: text(form, "stolenPlace", 200) || null,
        description: text(form, "description", 2000) || null,
        policeReportNumber: text(form, "policeReportNumber", 80) || null,
        invoiceKey: inv.key,
        invoiceMime: inv.mime,
        policeReportKey: pol?.key ?? null,
        policeReportMime: pol?.mime ?? null,
      },
      select: { id: true },
    });
    return NextResponse.json({ ok: true, id: report.id });
  } catch (e) {
    console.error("[fotografo/equipos-robados] alta", e);
    return NextResponse.json({ error: "No se pudo guardar la denuncia. Probá de nuevo." }, { status: 500 });
  }
}
