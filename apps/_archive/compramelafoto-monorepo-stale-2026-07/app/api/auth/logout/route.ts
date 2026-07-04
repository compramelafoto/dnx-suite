import { NextResponse } from "next/server";
import { clearAuthCookie } from "@/lib/auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  try {
    await clearAuthCookie();

    return NextResponse.json(
      {
        success: true,
        message: "Sesión cerrada correctamente",
      },
      { status: 200 }
    );
  } catch (err: any) {
    console.error("LOGOUT ERROR >>>", err);
    return NextResponse.json(
      { error: "Error al cerrar sesión", detail: String(err?.message ?? err) },
      { status: 500 }
    );
  }
}
