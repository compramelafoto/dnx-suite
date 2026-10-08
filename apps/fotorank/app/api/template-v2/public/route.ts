import { NextResponse } from "next/server";
import {
  jsonError,
  listPublicTemplates,
  requireTemplateV2ApiUser,
} from "../../../lib/fotorank/design/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** GET /api/template-v2/public — catálogo público de plantillas del sistema. */
export async function GET() {
  try {
    await requireTemplateV2ApiUser();
    const data = await listPublicTemplates();
    return NextResponse.json(data);
  } catch (err) {
    return jsonError(err);
  }
}
