/**
 * Exportación CSV de interesados.
 *
 * Protegida: exige sesión y que el concurso pertenezca a la organización activa.
 * El CSV no incluye correo ni documento.
 */
import { NextResponse } from "next/server";

import { requireAdminContestScope } from "../../../../../lib/fotorank/upcoming/admin-access";
import { buildInterestCsv, getAdminInterestPanel } from "../../../../../lib/fotorank/upcoming/service";

export const dynamic = "force-dynamic";

export async function GET(
  _request: Request,
  context: { params: Promise<{ contestId: string }> },
): Promise<NextResponse> {
  const { contestId } = await context.params;
  const scope = await requireAdminContestScope(contestId);
  if (!scope.ok) {
    return NextResponse.json({ error: scope.error }, { status: scope.status });
  }

  const panel = await getAdminInterestPanel({
    contestId: scope.scope.contestId,
    organizationId: scope.scope.organizationId,
    limit: 10_000,
  });
  if (!panel) return NextResponse.json({ error: "Concurso no encontrado." }, { status: 404 });

  const csv = buildInterestCsv(panel.rows);
  return new NextResponse(csv, {
    status: 200,
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="interesados-${contestId}.csv"`,
      "Cache-Control": "no-store",
    },
  });
}
