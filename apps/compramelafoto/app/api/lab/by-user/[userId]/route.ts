import { prisma } from "@/lib/prisma";
import { NextRequest, NextResponse } from "next/server";

export async function GET(
  req: NextRequest,
  { params }: { params: { userId: string } | Promise<{ userId: string }> }
) {
  try {
    const { userId } = await Promise.resolve(params);
    const userIdNum = parseInt(userId);

    if (isNaN(userIdNum)) {
      return NextResponse.json({ error: "userId inválido" }, { status: 400 });
    }

    const lab = await prisma.lab.findUnique({
      where: { userId: userIdNum },
      select: {
        id: true,
        name: true,
        email: true,
        phone: true,
        address: true,
        city: true,
        province: true,
        country: true,
        userId: true,
      },
    });

    if (!lab) {
      return NextResponse.json(
        { error: "Laboratorio no encontrado para este usuario" },
        { status: 404 }
      );
    }

    return NextResponse.json(lab);
  } catch (error: any) {
    console.error("Error obteniendo laboratorio por usuario:", error);
    return NextResponse.json(
      { error: "Error obteniendo laboratorio", detail: error.message },
      { status: 500 }
    );
  }
}
