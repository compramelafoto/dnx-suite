import { NextResponse } from "next/server";
import { isVideoMvpEnabled } from "@/lib/videos/video-feature-flag";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Flag de video MVP en runtime (lee .env del servidor, no depende del bundle cliente). */
export async function GET() {
  return NextResponse.json({ enabled: isVideoMvpEnabled() });
}
