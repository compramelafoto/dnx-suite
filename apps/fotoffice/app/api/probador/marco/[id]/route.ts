import { NextResponse } from "next/server";
import { prisma } from "@repo/db";

export const runtime = "nodejs";

/**
 * La foto de frente de un modelo de marco, servida desde el dominio de FOTOFFICE. El probador la
 * dibuja en un `<canvas>` que después sube a WebGL: una imagen de otro dominio sin permiso lo
 * "ensucia" y el navegador prohíbe leerlo. Sirviéndola desde acá, el problema no existe.
 */
export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!/^[A-Za-z0-9_-]{1,64}$/.test(id)) return new NextResponse(null, { status: 404 });
  const modelo = await prisma.fotofficeModeloMarco.findFirst({ where: { id, activo: true }, select: { imagenUrl: true } });
  if (!modelo) return new NextResponse(null, { status: 404 });
  // Sin almacenamiento configurado (desarrollo local) la imagen queda en /uploads del mismo dominio.
  if (modelo.imagenUrl.startsWith("/uploads/")) return NextResponse.redirect(new URL(modelo.imagenUrl, request.url));
  if (!modelo.imagenUrl.startsWith("https://")) return new NextResponse(null, { status: 404 });
  const r = await fetch(modelo.imagenUrl);
  if (!r.ok) return new NextResponse(null, { status: 502 });
  return new NextResponse(await r.arrayBuffer(), {
    headers: { "Content-Type": "image/png", "Cache-Control": "public, max-age=86400, stale-while-revalidate=604800" },
  });
}
