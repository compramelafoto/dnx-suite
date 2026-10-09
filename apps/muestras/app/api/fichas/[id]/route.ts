import { NextResponse } from "next/server";
import { cargarFichas } from "@/lib/fichas/cargar";
import { esTamanoFicha, pdfDeFichas } from "@/lib/fichas/pdf";
import { frenarPorUsuario } from "@/lib/limite";
import { getUsuario } from "@/lib/usuario";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** PDF de fichas de sala: todas (`?tamano=A6`) o una (`&obra=<id>`). Sólo dueño o super admin. */
export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const usuario = await getUsuario();
  // Se llega con un enlace del panel: sin sesión, a ingresar y de vuelta a Montaje. No se usa el
  // id pedido para nada, así no se revela si la muestra existe.
  if (!usuario) return NextResponse.redirect(new URL(`/login?next=${encodeURIComponent("/panel/montaje")}`, req.url), 307);
  if (!frenarPorUsuario("fichas", usuario.id).allowed) {
    return NextResponse.json({ error: "Pediste muchas fichas seguidas. Esperá unos minutos." }, { status: 429 });
  }
  const { id } = await params;
  const sp = new URL(req.url).searchParams;
  const pedido = sp.get("tamano");
  const tamano = esTamanoFicha(pedido) ? pedido : "A6";
  const datos = await cargarFichas(id, usuario, sp.get("obra"));
  if (!datos) return NextResponse.json({ error: "No encontramos esa muestra publicada entre las tuyas." }, { status: 404 });
  try {
    const pdf = await pdfDeFichas(datos.fichas, tamano);
    // El slug sólo tiene a-z, 0-9 y guiones: va seguro en la cabecera.
    return new Response(pdf as BodyInit, {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="${datos.nombre}-${tamano}.pdf"`,
        "Cache-Control": "private, no-store",
      },
    });
  } catch (err) {
    console.error("GET /api/fichas:", err instanceof Error ? err.message : String(err));
    return NextResponse.json({ error: "No pudimos armar el PDF. Probá de nuevo." }, { status: 500 });
  }
}
