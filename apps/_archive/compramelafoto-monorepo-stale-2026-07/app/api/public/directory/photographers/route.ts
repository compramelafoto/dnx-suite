import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getR2PublicUrl } from "@/lib/r2-client";
import { Role } from "@prisma/client";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const users = await prisma.user.findMany({
      where: {
        role: { in: [Role.PHOTOGRAPHER, Role.LAB_PHOTOGRAPHER] },
        isPublicPageEnabled: true,
        isBlocked: false,
      },
      select: {
        id: true,
        name: true,
        companyName: true,
        logoUrl: true,
        phone: true,
        city: true,
        province: true,
        address: true,
        companyAddress: true,
        instagram: true,
        facebook: true,
        whatsapp: true,
        publicPageHandler: true,
      },
    });

    const photographers = users.map((u) => ({
      id: u.id,
      name: u.name ?? null,
      companyName: u.companyName ?? null,
      logoUrl:
        u.logoUrl && u.logoUrl.trim()
          ? u.logoUrl.startsWith("http")
            ? u.logoUrl
            : getR2PublicUrl(u.logoUrl.replace(/^\//, ""))
          : null,
      phone: u.phone ?? null,
      city: u.city ?? null,
      province: u.province ?? null,
      address: u.address?.trim() || null,
      companyAddress: u.companyAddress?.trim() || null,
      instagram: u.instagram ?? null,
      facebook: u.facebook ?? null,
      whatsapp: u.whatsapp ?? null,
      publicPageHandler: u.publicPageHandler ?? null,
    }));

    return NextResponse.json(photographers);
  } catch (err: any) {
    console.error("GET /api/public/directory/photographers ERROR >>>", err);
    return NextResponse.json(
      { error: "Error obteniendo fotógrafos", detail: String(err?.message ?? err) },
      { status: 500 }
    );
  }
}
