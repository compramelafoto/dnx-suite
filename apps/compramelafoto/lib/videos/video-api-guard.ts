import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { Role } from "@/lib/prisma";
import { isVideoMvpEnabled } from "@/lib/videos/video-feature-flag";

export function videoMvpDisabledResponse() {
  return NextResponse.json(
    { error: "El módulo de videos no está habilitado.", code: "VIDEO_MVP_DISABLED" },
    { status: 404 }
  );
}

export async function requireVideoMvpPhotographer() {
  if (!isVideoMvpEnabled()) {
    return { error: videoMvpDisabledResponse(), user: null as null };
  }

  const { error, user } = await requireAuth([Role.PHOTOGRAPHER]);
  if (error || !user) {
    return {
      error: NextResponse.json(
        { error: error || "No autorizado. Se requiere rol PHOTOGRAPHER." },
        { status: 401 }
      ),
      user: null as null,
    };
  }

  return { error: null, user };
}
