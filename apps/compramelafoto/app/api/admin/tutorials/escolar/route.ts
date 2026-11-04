import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/auth";
import { Role } from "@prisma/client";
import {
  ESCOLAR_COURSE_SETTINGS_KEY,
  parseEscolarCourseVideos,
  validateEscolarCourseVideos,
} from "@/lib/tutorials/escolar-course";

/** YouTube no da el oEmbed de un video privado: así avisamos que en CLF no se va a poder ver. */
async function isPubliclyPlayable(youtubeUrl: string): Promise<boolean> {
  try {
    const res = await fetch(
      `https://www.youtube.com/oembed?format=json&url=${encodeURIComponent(youtubeUrl)}`
    );
    return res.ok;
  } catch {
    return true;
  }
}

export async function GET() {
  try {
    const { error } = await requireAuth([Role.ADMIN]);
    if (error) {
      return NextResponse.json({ error: error || "No autorizado" }, { status: 401 });
    }
    const row = await prisma.systemSettings.findUnique({
      where: { key: ESCOLAR_COURSE_SETTINGS_KEY },
    });
    return NextResponse.json({ videos: parseEscolarCourseVideos(row?.value) });
  } catch (e) {
    console.error("GET /api/admin/tutorials/escolar", e);
    return NextResponse.json({ error: "Error obteniendo el curso" }, { status: 500 });
  }
}

export async function PUT(req: NextRequest) {
  try {
    const { error } = await requireAuth([Role.ADMIN]);
    if (error) {
      return NextResponse.json({ error: error || "No autorizado" }, { status: 401 });
    }
    const body = await req.json().catch(() => null);
    const parsed = validateEscolarCourseVideos((body as { videos?: unknown } | null)?.videos);
    if ("error" in parsed) {
      return NextResponse.json({ error: parsed.error }, { status: 400 });
    }
    const value = JSON.stringify({ videos: parsed.videos });
    await prisma.systemSettings.upsert({
      where: { key: ESCOLAR_COURSE_SETTINGS_KEY },
      create: {
        key: ESCOLAR_COURSE_SETTINGS_KEY,
        value,
        description: "Curso de fotografía escolar: { videos: { [número de clase]: link de YouTube } }",
      },
      update: { value },
    });
    const notPlayable: number[] = [];
    for (const [number, url] of Object.entries(parsed.videos)) {
      if (!(await isPubliclyPlayable(url))) notPlayable.push(Number(number));
    }
    return NextResponse.json({ ok: true, notPlayable });
  } catch (e) {
    console.error("PUT /api/admin/tutorials/escolar", e);
    return NextResponse.json({ error: "Error guardando el curso" }, { status: 500 });
  }
}
