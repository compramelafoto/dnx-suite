import { NextResponse } from "next/server";
import { getClickatonAuthUser } from "@/lib/admin/auth";
import { PhotoUploadError } from "@/lib/photo-upload/errors";
import { requestPromptUpload } from "@/lib/photo-upload/service";

export const dynamic = "force-dynamic";
export const revalidate = 0;

type Ctx = { params: Promise<{ registrationId: string; promptId: string }> };

export async function POST(req: Request, ctx: Ctx) {
  const user = await getClickatonAuthUser();
  if (!user) return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });

  const { registrationId, promptId } = await ctx.params;
  const body = (await req.json().catch(() => ({}))) as { replace?: boolean };

  try {
    const data = await requestPromptUpload({
      registrationId,
      promptId,
      userId: user.id,
      isReplace: Boolean(body.replace),
    });
    return NextResponse.json(data, {
      headers: { "Cache-Control": "private, no-store" },
    });
  } catch (error) {
    if (error instanceof PhotoUploadError) {
      return NextResponse.json({ error: error.code, message: error.message }, { status: error.status });
    }
    throw error;
  }
}
