import { NextResponse } from "next/server";
import { origenDelPedido } from "@/lib/base-oauth";
import { cerrarSesion } from "@/lib/sesion";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  await cerrarSesion();
  return NextResponse.redirect(new URL("/", origenDelPedido(req)), { status: 303 });
}
