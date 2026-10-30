import { NextResponse } from "next/server";
import { esPlataforma, urlDelPrograma } from "@/lib/recuperacion/programa";

export const dynamic = "force-dynamic";

/** Descarga del programa: redirige al ejecutable de la versión vigente. */
export async function GET(_: Request, { params }: { params: Promise<{ plataforma: string }> }) {
  const { plataforma } = await params;
  if (!esPlataforma(plataforma)) return new NextResponse(null, { status: 404 });
  return NextResponse.redirect(urlDelPrograma(plataforma), { status: 302, headers: { "Cache-Control": "no-store" } });
}
