import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getR2PublicUrl } from "@/lib/r2-client";
import { LabApprovalStatus } from "@prisma/client";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const labs = await prisma.lab.findMany({
      where: {
        approvalStatus: LabApprovalStatus.APPROVED,
        isActive: true,
        isSuspended: false,
      },
      select: {
        id: true,
        name: true,
        logoUrl: true,
        phone: true,
        city: true,
        province: true,
        publicPageHandler: true,
        user: {
          select: {
            instagram: true,
            facebook: true,
            whatsapp: true,
          },
        },
      },
    });

    const result = labs.map((lab) => ({
      id: lab.id,
      name: lab.name,
      logoUrl:
        lab.logoUrl && lab.logoUrl.trim()
          ? lab.logoUrl.startsWith("http")
            ? lab.logoUrl
            : getR2PublicUrl(lab.logoUrl.replace(/^\//, ""))
          : null,
      phone: lab.phone ?? null,
      city: lab.city ?? null,
      province: lab.province ?? null,
      instagram: lab.user?.instagram ?? null,
      facebook: lab.user?.facebook ?? null,
      whatsapp: lab.user?.whatsapp ?? null,
      publicPageHandler: lab.publicPageHandler ?? null,
    }));

    return NextResponse.json(result);
  } catch (err: any) {
    console.error("GET /api/public/directory/labs ERROR >>>", err);
    return NextResponse.json(
      { error: "Error obteniendo laboratorios", detail: String(err?.message ?? err) },
      { status: 500 }
    );
  }
}
