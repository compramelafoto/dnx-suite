import { prisma } from "@/lib/prisma";
import { NextRequest, NextResponse } from "next/server";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { userId, name, email } = body;

    if (!userId || !name || !email) {
      return NextResponse.json(
        { error: "userId, name y email son requeridos" },
        { status: 400 }
      );
    }

    // Verificar que el usuario existe y es LAB
    const user = await prisma.user.findUnique({
      where: { id: parseInt(String(userId)) },
      select: { id: true, role: true },
    });

    if (!user) {
      return NextResponse.json(
        { error: "Usuario no encontrado" },
        { status: 404 }
      );
    }

    if (user.role !== "LAB") {
      return NextResponse.json(
        { error: "El usuario debe tener rol LAB" },
        { status: 400 }
      );
    }

    // Verificar que el email no esté en uso por otro lab
    const existingLab = await prisma.lab.findUnique({
      where: { email: email.trim().toLowerCase() },
    });

    if (existingLab) {
      return NextResponse.json(
        { error: "Este email ya está registrado para otro laboratorio" },
        { status: 400 }
      );
    }

    // Verificar que el usuario no tenga ya un lab asociado
    const existingLabByUser = await prisma.lab.findUnique({
      where: { userId: user.id },
    });

    if (existingLabByUser) {
      return NextResponse.json(
        { error: "Este usuario ya tiene un laboratorio asociado" },
        { status: 400 }
      );
    }

    // Crear laboratorio
    const lab = await prisma.lab.create({
      data: {
        name: name.trim(),
        email: email.trim().toLowerCase(),
        userId: user.id,
        isActive: true,
      },
      select: {
        id: true,
        name: true,
        email: true,
        userId: true,
      },
    });

    return NextResponse.json(lab, { status: 201 });
  } catch (error: any) {
    console.error("Error creando laboratorio:", error);
    
    if (error.code === "P2002") {
      return NextResponse.json(
        { error: "Este email ya está registrado para otro laboratorio" },
        { status: 400 }
      );
    }

    return NextResponse.json(
      { error: "Error creando laboratorio", detail: error.message },
      { status: 500 }
    );
  }
}
