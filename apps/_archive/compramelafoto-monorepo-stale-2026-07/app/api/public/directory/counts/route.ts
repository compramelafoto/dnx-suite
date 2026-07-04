import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { Role } from "@prisma/client";
import { LabApprovalStatus } from "@prisma/client";
import { CommunityProfileType } from "@prisma/client";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const [photographersCount, labsCount, photographerServicesCount, eventVendorsCount] =
      await Promise.all([
        prisma.user.count({
          where: {
            role: { in: [Role.PHOTOGRAPHER, Role.LAB_PHOTOGRAPHER] },
            isPublicPageEnabled: true,
            isBlocked: false,
          },
        }),
        prisma.lab.count({
          where: {
            approvalStatus: LabApprovalStatus.APPROVED,
            isActive: true,
            isSuspended: false,
          },
        }),
        prisma.communityProfile.count({
          where: {
            type: CommunityProfileType.PHOTOGRAPHER_SERVICE,
            status: "ACTIVE",
            AND: [{ logoUrl: { not: null } }, { logoUrl: { not: "" } }],
          },
        }),
        prisma.communityProfile.count({
          where: {
            type: CommunityProfileType.EVENT_VENDOR,
            status: "ACTIVE",
            AND: [{ logoUrl: { not: null } }, { logoUrl: { not: "" } }],
          },
        }),
      ]);

    return NextResponse.json({
      photographers: photographersCount,
      labs: labsCount,
      photographerServices: photographerServicesCount,
      eventVendors: eventVendorsCount,
    });
  } catch (err: any) {
    console.error("GET /api/public/directory/counts ERROR >>>", err);
    return NextResponse.json(
      { error: "Error obteniendo conteos", detail: String(err?.message ?? err) },
      { status: 500 }
    );
  }
}
