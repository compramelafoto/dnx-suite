import { NextResponse } from "next/server";
import { Role } from "@prisma/client";
import { requireAuth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export type CamOfDutyMemberAdminRow = {
  userId: number;
  email: string;
  name: string | null;
  whatsapp: string | null;
  instagram: string | null;
  company: string | null;
  city: string | null;
  province: string | null;
  country: string | null;
  latitude: number | null;
  longitude: number | null;
  emailVerified: boolean;
  jobAlerts: boolean;
  jobAlertsAt: string | null;
  /** La cuenta se creó para entrar a Cam Of Duty (no era fotógrafo de CLF de antes). */
  fromCamOfDuty: boolean;
  profileCompletedAt: string | null;
  firstVisitAt: string;
  lastVisitAt: string;
  visits: number;
};

/** GET /api/admin/camofduty-members — fotógrafos de CLF que entraron a Cam Of Duty, con sus datos. */
export async function GET() {
  const { error, user } = await requireAuth([Role.ADMIN]);
  if (error || !user) {
    return NextResponse.json({ error: error || "No autenticado" }, { status: 401 });
  }

  const members = await prisma.camOfDutyMember.findMany({
    orderBy: { lastVisitAt: "desc" },
    take: 5000,
    include: {
      user: {
        select: {
          email: true,
          name: true,
          whatsapp: true,
          instagram: true,
          companyName: true,
          city: true,
          province: true,
          country: true,
          latitude: true,
          longitude: true,
          emailVerifiedAt: true,
        },
      },
    },
  });

  const rows: CamOfDutyMemberAdminRow[] = members.map((m) => ({
    userId: m.userId,
    email: m.user.email,
    name: m.user.name,
    whatsapp: m.user.whatsapp,
    instagram: m.user.instagram,
    company: m.user.companyName,
    city: m.user.city,
    province: m.user.province,
    country: m.user.country,
    latitude: m.user.latitude,
    longitude: m.user.longitude,
    emailVerified: !!m.user.emailVerifiedAt,
    jobAlerts: m.jobAlertsOptIn,
    jobAlertsAt: m.jobAlertsOptInAt?.toISOString() ?? null,
    fromCamOfDuty: m.accountFromCamOfDuty,
    profileCompletedAt: m.profileCompletedAt?.toISOString() ?? null,
    firstVisitAt: m.firstVisitAt.toISOString(),
    lastVisitAt: m.lastVisitAt.toISOString(),
    visits: m.visits,
  }));
  const total = await prisma.camOfDutyMember.count();
  return NextResponse.json({ rows, total });
}
