import { NextResponse } from "next/server";
import {
  jsonError,
  listPublicTemplates,
  requireTemplateV2ApiUser,
} from "@/lib/template-v2/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** GET /api/template-v2/public — catálogo público (requiere admin de Clickatón). */
export async function GET() {
  try {
    await requireTemplateV2ApiUser();
    const data = await listPublicTemplates();
    return NextResponse.json(data);
  } catch (err) {
    return jsonError(err);
  }
}
