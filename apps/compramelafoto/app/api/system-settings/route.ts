import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Obtener configuración del sistema
export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const key = searchParams.get("key");

    if (key) {
      // Obtener un setting específico
      const setting = await prisma.systemSettings.findUnique({
        where: { key },
      });

      if (!setting || !setting.isActive) {
        return NextResponse.json(
          { error: "Setting no encontrado" },
          { status: 404 }
        );
      }

      return NextResponse.json(setting, { status: 200 });
    }

    // Obtener todos los settings activos
    const settings = await prisma.systemSettings.findMany({
      where: { isActive: true },
    });

    // Convertir a objeto clave-valor
    const settingsMap: Record<string, string> = {};
    settings.forEach((s) => {
      settingsMap[s.key] = s.value;
    });

    return NextResponse.json(settingsMap, { status: 200 });
  } catch (err: any) {
    console.error("GET /api/system-settings ERROR >>>", err);
    return NextResponse.json(
      { error: "Error obteniendo configuración del sistema" },
      { status: 500 }
    );
  }
}
