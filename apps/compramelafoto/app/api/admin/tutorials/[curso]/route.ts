import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/auth";
import { Role } from "@prisma/client";
import { parseCourseVideos, validateCourseVideos } from "@/lib/tutorials/course";
import { getTutorialCourse } from "@/lib/tutorials/courses";

type Params = { params: Promise<{ curso: string }> };

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

export async function GET(_req: NextRequest, { params }: Params) {
  try {
    const course = getTutorialCourse((await params).curso);
    if (!course) return NextResponse.json({ error: "Curso inexistente" }, { status: 404 });
    const { error } = await requireAuth([Role.ADMIN]);
    if (error) {
      return NextResponse.json({ error: error || "No autorizado" }, { status: 401 });
    }
    const row = await prisma.systemSettings.findUnique({
      where: { key: course.settingsKey },
    });
    return NextResponse.json({ videos: parseCourseVideos(row?.value, course.lessonCount) });
  } catch (e) {
    console.error("GET /api/admin/tutorials/[curso]", e);
    return NextResponse.json({ error: "Error obteniendo el curso" }, { status: 500 });
  }
}

export async function PUT(req: NextRequest, { params }: Params) {
  try {
    const course = getTutorialCourse((await params).curso);
    if (!course) return NextResponse.json({ error: "Curso inexistente" }, { status: 404 });
    const { error } = await requireAuth([Role.ADMIN]);
    if (error) {
      return NextResponse.json({ error: error || "No autorizado" }, { status: 401 });
    }
    const body = await req.json().catch(() => null);
    const parsed = validateCourseVideos((body as { videos?: unknown } | null)?.videos, course.lessonCount);
    if ("error" in parsed) {
      return NextResponse.json({ error: parsed.error }, { status: 400 });
    }
    const value = JSON.stringify({ videos: parsed.videos });
    await prisma.systemSettings.upsert({
      where: { key: course.settingsKey },
      create: {
        key: course.settingsKey,
        value,
        description: `${course.title}: { videos: { [número de clase]: link de YouTube } }`,
      },
      update: { value },
    });
    const notPlayable: number[] = [];
    for (const [number, url] of Object.entries(parsed.videos)) {
      if (!(await isPubliclyPlayable(url))) notPlayable.push(Number(number));
    }
    return NextResponse.json({ ok: true, notPlayable });
  } catch (e) {
    console.error("PUT /api/admin/tutorials/[curso]", e);
    return NextResponse.json({ error: "Error guardando el curso" }, { status: 500 });
  }
}
