import { NextResponse } from "next/server";
import { getClickatonAuthUser } from "@/lib/admin/auth";
import { PhotoUploadError } from "@/lib/photo-upload/errors";
import { processPromptUpload } from "@/lib/photo-upload/service";

export const dynamic = "force-dynamic";
export const revalidate = 0;

type Ctx = { params: Promise<{ registrationId: string; promptId: string }> };

export async function POST(req: Request, ctx: Ctx) {
  const user = await getClickatonAuthUser();
  if (!user) return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });

  const { registrationId, promptId } = await ctx.params;
  const form = await req.formData();
  const file = form.get("file");
  if (!(file instanceof File)) {
    return NextResponse.json({ error: "FILE_REQUIRED" }, { status: 400 });
  }
  const buffer = Buffer.from(await file.arrayBuffer());
  const isReplace = String(form.get("replace") ?? "") === "1";

  try {
    const data = await processPromptUpload({
      registrationId,
      promptId,
      userId: user.id,
      buffer,
      originalFileName: file.name || "photo.jpg",
      declaredMime: file.type,
      isReplace,
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
