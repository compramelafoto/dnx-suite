import { NextResponse } from "next/server";
import { cerrarSesion } from "@/lib/sesion";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  await cerrarSesion();
  return NextResponse.redirect(new URL("/", new URL(req.url).origin), { status: 303 });
}
