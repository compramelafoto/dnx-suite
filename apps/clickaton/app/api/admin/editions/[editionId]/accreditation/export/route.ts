import { requireClickatonAdmin } from "@/lib/admin/auth";
import { exportAccreditationCsv } from "@/lib/accreditation/service";

export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ editionId: string }> };

export async function GET(_req: Request, ctx: Ctx) {
  const user = await requireClickatonAdmin();
  const { editionId } = await ctx.params;
  const csv = await exportAccreditationCsv(editionId, {
    id: user.id,
    email: user.email,
    globalRole: user.globalRole,
  });
  return new Response(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="acreditacion-${editionId}.csv"`,
      "Cache-Control": "private, no-store",
    },
  });
}
