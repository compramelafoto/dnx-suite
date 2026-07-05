import { NextResponse } from "next/server";
import { Role } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/auth";
import {
  DNX_FOTO_BASICA_FUNES_COURSE_KEY,
  isDnxFotoBasicaFunesSlug,
} from "@/lib/dnx-foto-basica-funes";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * GET /api/admin/dnx-course/[slug]
 * Resumen para panel: interesados (leads) + inscripciones por estado.
 */
export async function GET(_req: Request, { params }: { params: Promise<{ slug: string }> }) {
  const { error } = await requireAuth([Role.ADMIN]);
  if (error) return NextResponse.json({ error }, { status: 401 });

  const { slug } = await params;
  if (!isDnxFotoBasicaFunesSlug(slug)) {
    return NextResponse.json({ error: "Curso no encontrado" }, { status: 404 });
  }

  const courseKey = DNX_FOTO_BASICA_FUNES_COURSE_KEY;

  const [leads, enrollments] = await Promise.all([
    prisma.dnxCourseLead.findMany({
      where: { courseKey },
      orderBy: { updatedAt: "desc" },
      select: {
        id: true,
        createdAt: true,
        updatedAt: true,
        firstName: true,
        lastName: true,
        email: true,
        phone: true,
        message: true,
      },
    }),
    prisma.dnxCourseEnrollment.findMany({
      where: { courseKey },
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        createdAt: true,
        updatedAt: true,
        firstName: true,
        lastName: true,
        email: true,
        phone: true,
        status: true,
        amountArs: true,
        mpPaymentId: true,
        paidAt: true,
        mpPreferenceId: true,
      },
    }),
  ]);

  const pendingPayment = enrollments.filter((e) => e.status === "PENDING_PAYMENT");
  const approved = enrollments.filter((e) => e.status === "APPROVED");
  const cancelled = enrollments.filter((e) => e.status === "CANCELLED");

  return NextResponse.json({
    courseKey,
    slug: slug.trim(),
    stats: {
      interesados: leads.length,
      enProcesoPago: pendingPayment.length,
      inscriptosPagos: approved.length,
      canceladosORechazados: cancelled.length,
      totalInscripcIntentos: enrollments.length,
    },
    leads,
    enrollments: {
      pendientePago: pendingPayment,
      aprobados: approved,
      cancelados: cancelled,
    },
  });
}
