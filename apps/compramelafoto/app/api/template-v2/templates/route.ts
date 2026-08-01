import {
  jsonError,
  jsonOk,
  readJsonWithLimit,
  requireTemplateV2ApiUser,
} from "@/lib/template-v2/services/template-v2-http";
import { createTemplateV2 } from "@/lib/template-v2/services/template-v2-command-service";
import { listTemplateV2Summaries } from "@/lib/template-v2/services/template-v2-query-service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** GET /api/template-v2/templates */
export async function GET(req: Request) {
  try {
    const user = await requireTemplateV2ApiUser();
    const url = new URL(req.url);
    const result = await listTemplateV2Summaries(user, {
      page: Number(url.searchParams.get("page") ?? "1"),
      pageSize: Number(url.searchParams.get("pageSize") ?? "20"),
      q: url.searchParams.get("q") ?? undefined,
      status: url.searchParams.get("status") ?? undefined,
      sort: url.searchParams.get("sort") ?? undefined,
      order: (url.searchParams.get("order") as "asc" | "desc" | null) ?? undefined,
      scope: (url.searchParams.get("scope") as "mine" | "public" | "all" | null) ?? undefined,
    });
    return jsonOk(result);
  } catch (err) {
    return jsonError(err);
  }
}

/** POST /api/template-v2/templates */
export async function POST(req: Request) {
  try {
    const user = await requireTemplateV2ApiUser();
    const body = (await readJsonWithLimit(req)) as Record<string, unknown>;
    const result = await createTemplateV2({
      user,
      name: typeof body.name === "string" ? body.name : undefined,
      description: typeof body.description === "string" ? body.description : undefined,
      payload: body.payload ?? body.document ?? undefined,
    });
    return jsonOk(result, 201);
  } catch (err) {
    return jsonError(err);
  }
}
