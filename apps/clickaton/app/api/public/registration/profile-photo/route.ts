import { randomUUID } from "node:crypto";
import { NextResponse } from "next/server";
import { uploadProfilePhoto } from "@/lib/welcome-card/profile-photo";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MAX_REQUEST_BYTES = 9 * 1024 * 1024;

/** Session-less draft upload. The asset is attached transactionally on registration creation. */
export async function POST(request: Request) {
  const length = Number(request.headers.get("content-length") ?? 0);
  if (length > MAX_REQUEST_BYTES) {
    return NextResponse.json({ ok: false, error: "PHOTO_TOO_LARGE" }, { status: 413 });
  }
  try {
    const data = await request.formData();
    const file = data.get("file");
    if (!(file instanceof File)) {
      return NextResponse.json({ ok: false, error: "PHOTO_REQUIRED" }, { status: 400 });
    }
    const result = await uploadProfilePhoto({
      buffer: Buffer.from(await file.arrayBuffer()),
      mimeType: file.type,
      draftId: `draft_${randomUUID()}`,
    });
    return NextResponse.json({ ok: true, assetId: result.assetId });
  } catch (error) {
    const code = error instanceof Error ? error.message : "PHOTO_UPLOAD_FAILED";
    return NextResponse.json({ ok: false, error: code }, { status: 400 });
  }
}
