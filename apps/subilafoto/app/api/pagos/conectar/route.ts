import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { DNX_SESSION_COOKIE, getSessionUserByRawToken } from "@repo/auth";
import { prisma } from "@repo/db";
import { armarEstado } from "@/lib/pagos/estado-oauth";
import { urlDeAutorizacion } from "@/lib/pagos/oauth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Manda al vendedor a Mercado Pago para que conecte su cuenta. */
export async function GET() {
  const almacen = await cookies();
  const token = almacen.get(DNX_SESSION_COOKIE)?.value;
  const usuario = token ? await getSessionUserByRawToken(token) : null;
  if (!usuario) return NextResponse.redirect(new URL("/login?next=%2Fpanel", process.env.AUTH_URL));

  const perfil = await prisma.subilafotoSellerProfile.findFirst({
    where: { userId: usuario.id },
    select: { id: true },
  });
  if (!perfil) {
    return NextResponse.redirect(new URL("/panel?error=sin-perfil", process.env.AUTH_URL));
  }

  const secreto = process.env.AUTH_SECRET?.trim();
  if (!secreto) return NextResponse.json({ error: "Falta AUTH_SECRET." }, { status: 503 });

  return NextResponse.redirect(urlDeAutorizacion(armarEstado(perfil.id, secreto)));
}
