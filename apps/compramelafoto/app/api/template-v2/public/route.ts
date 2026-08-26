import { jsonError } from "@/lib/template-v2/server";
import { listPublicTemplates } from "@/lib/template-v2/server";
import { requireAuth } from "@/lib/auth";
import { Role } from "@prisma/client";
import { NextResponse } from "next/server";
import { TemplateV2DomainError } from "@/lib/template-v2/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** GET /api/template-v2/public — catálogo público (requiere sesión diseñador). */
export async function GET() {
  try {
    const { error, user } = await requireAuth([
      Role.PHOTOGRAPHER,
      Role.LAB_PHOTOGRAPHER,
      Role.ADMIN,
    ]);
    if (error || !user) {
      throw new TemplateV2DomainError("TEMPLATE_UNAUTHORIZED", "No autenticado", 401);
    }
    const data = await listPublicTemplates();
    return NextResponse.json(data);
  } catch (err) {
    return jsonError(err);
  }
}
