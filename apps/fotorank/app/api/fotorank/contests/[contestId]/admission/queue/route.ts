import { NextResponse } from "next/server";
import { getAuthUser } from "../../../../../../lib/auth";
import {
  AdmissionError,
  listAdmissionQueue,
  type AdmissionQueueFilter,
} from "../../../../../../lib/fotorank/admission";

type Ctx = { params: Promise<{ contestId: string }> };

const FILTERS = new Set<AdmissionQueueFilter>([
  "all",
  "requires_review",
  "date_observed",
  "territory_observed",
  "device_observed",
  "argra_pending",
  "drone_unidentified",
  "possible_duplicate",
  "evidence_requested",
  "replacement_pending",
  "ready_to_admit",
  "rejected",
  "admitted",
  "frozen",
]);

export async function GET(req: Request, ctx: Ctx) {
  const user = await getAuthUser();
  if (!user) {
    return NextResponse.json(
      { error: { code: "UNAUTHENTICATED", message: "Debés iniciar sesión." } },
      { status: 401 },
    );
  }
  const { contestId } = await ctx.params;
  const url = new URL(req.url);
  const filterRaw = url.searchParams.get("filter") ?? "all";
  const filter = (FILTERS.has(filterRaw as AdmissionQueueFilter)
    ? filterRaw
    : "all") as AdmissionQueueFilter;
  const page = Number(url.searchParams.get("page") ?? "1");
  const pageSize = Number(url.searchParams.get("pageSize") ?? "25");

  try {
    const result = await listAdmissionQueue({
      contestId,
      organizerUserId: user.id,
      filter,
      page: Number.isFinite(page) ? page : 1,
      pageSize: Number.isFinite(pageSize) ? pageSize : 25,
    });
    return NextResponse.json({ ok: true, ...result });
  } catch (err) {
    if (err instanceof AdmissionError) {
      return NextResponse.json(
        { error: { code: err.code, message: err.message } },
        { status: err.status },
      );
    }
    console.error("[admission queue]", err);
    return NextResponse.json(
      { error: { code: "INTERNAL", message: "No se pudo listar la cola." } },
      { status: 500 },
    );
  }
}
