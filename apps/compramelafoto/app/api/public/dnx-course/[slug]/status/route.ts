import { NextResponse } from "next/server";
import {
  DNX_FOTO_BASICA_FUNES_COURSE_KEY,
  DNX_FOTO_BASICA_FUNES_MAX_SEATS,
  isDnxFotoBasicaFunesSlug,
} from "@/lib/dnx-foto-basica-funes";
import { countApprovedForCourse, countOccupiedCourseSeats } from "@/lib/dnx-foto-basica-funes-seats";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(_req: Request, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  if (!isDnxFotoBasicaFunesSlug(slug)) {
    return NextResponse.json({ error: "Curso no encontrado" }, { status: 404 });
  }
  const courseKey = DNX_FOTO_BASICA_FUNES_COURSE_KEY;
  const [approvedCount, occupiedCount] = await Promise.all([
    countApprovedForCourse(courseKey),
    countOccupiedCourseSeats(courseKey),
  ]);
  const full = occupiedCount >= DNX_FOTO_BASICA_FUNES_MAX_SEATS;
  return NextResponse.json({
    slug: slug.trim(),
    maxSeats: DNX_FOTO_BASICA_FUNES_MAX_SEATS,
    approvedCount,
    occupiedCount,
    full,
  });
}
