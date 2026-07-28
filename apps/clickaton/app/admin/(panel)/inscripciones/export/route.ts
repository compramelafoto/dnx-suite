import { NextResponse } from "next/server";
import { ARGENTINA_2026_SHIRT_SIZES } from "@/config/editions/argentina-2026";
import { requireClickatonAdmin } from "@/lib/admin/auth";
import { prisma } from "@/lib/admin/db";
import { filtersFromSearchParams } from "@/lib/admin-registration/actions/filters";
import { listRegistrationsAction } from "@/lib/admin-registration/actions/registrations";
import {
  buildRegistrationsCsv,
  buildShirtSizeSummaryCsv,
  summarizeShirtSizes,
  toExportRowsFromList,
} from "@/lib/admin-registration/export/registrations-csv";

export const dynamic = "force-dynamic";

/**
 * Export CSV de inscriptos (Etapa 4).
 * Query: mismos filtros del listado + `kind=rows|sizes`.
 * XLS queda pendiente (sin dependencia nueva en esta etapa).
 */
export async function GET(request: Request) {
  await requireClickatonAdmin();
  const url = new URL(request.url);
  const kind = url.searchParams.get("kind") === "sizes" ? "sizes" : "rows";
  const editionId = url.searchParams.get("editionId") ?? "";
  if (!editionId) {
    return NextResponse.json({ ok: false, message: "editionId requerido" }, { status: 400 });
  }

  const filters = filtersFromSearchParams({
    editionId,
    venueId: url.searchParams.get("venueId") ?? undefined,
    ticketTypeId: url.searchParams.get("ticketTypeId") ?? undefined,
    status: url.searchParams.get("status") ?? undefined,
    paymentStatus: url.searchParams.get("paymentStatus") ?? undefined,
    q: url.searchParams.get("q") ?? undefined,
    from: url.searchParams.get("from") ?? undefined,
    to: url.searchParams.get("to") ?? undefined,
    paymentOrder: url.searchParams.get("paymentOrder") ?? undefined,
    notes: url.searchParams.get("notes") ?? undefined,
    shirtSize: url.searchParams.get("shirtSize") ?? undefined,
    fulfillmentStatus: url.searchParams.get("fulfillmentStatus") ?? undefined,
  });

  const result = await listRegistrationsAction(filters);
  if (!result.ok || !result.data) {
    return NextResponse.json(
      { ok: false, message: result.message ?? "No se pudo exportar" },
      { status: 500 },
    );
  }

  const rows = toExportRowsFromList(result.data);
  const socialRegistrations = await prisma.clickatonRegistration.findMany({
      where: { id: { in: rows.map((row) => row.registrationId) } },
      select: {
        id: true, instagramHandle: true, profilePhotoAssetId: true,
        welcomeCardStatus: true, welcomePublicationStatus: true, welcomeCardAssetId: true,
      },
    });
  const urls = new Map(
    (await prisma.dnxMediaAsset.findMany({
      where: { id: { in: socialRegistrations.map((registration) => registration.welcomeCardAssetId).filter((id): id is string => Boolean(id)) } },
      select: { id: true, publicUrl: true },
    })).map((asset) => [asset.id, asset.publicUrl]),
  );
  const socialByRegistration = new Map(socialRegistrations.map((registration) => [registration.id, registration]));
  for (const row of rows) {
    const social = socialByRegistration.get(row.registrationId);
    row.instagramHandle = social?.instagramHandle ?? null;
    row.profilePhotoAssetId = social?.profilePhotoAssetId ?? null;
    row.welcomeCardStatus = social?.welcomeCardStatus ?? null;
    row.welcomePublicationStatus = social?.welcomePublicationStatus ?? null;
    row.welcomeUrl = social?.welcomeCardAssetId ? urls.get(social.welcomeCardAssetId) ?? null : null;
  }
  const orderedSizes = ARGENTINA_2026_SHIRT_SIZES.map((s) => s.code);

  if (kind === "sizes") {
    const summary = summarizeShirtSizes(rows, orderedSizes);
    const csv = buildShirtSizeSummaryCsv(summary, orderedSizes);
    return new NextResponse(csv, {
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="clickaton-talles-${editionId}.csv"`,
      },
    });
  }

  const csv = buildRegistrationsCsv(rows);
  return new NextResponse(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="clickaton-inscripciones-${editionId}.csv"`,
    },
  });
}
