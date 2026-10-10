import { NextResponse } from "next/server";
import {
  SOCIAL_FORMAT_PARAMS, SOCIAL_VARIANT_PARAMS, availableSocialVariants, isFormatAllowed, isPrintFormat, socialFileName,
} from "@repo/muestras";
import { baseUrlPublica } from "@/lib/fichas/cargar";
import { frenarPorUsuario } from "@/lib/limite";
import { errorEnTexto } from "@/lib/piezas/entregar";
import { cargarMuestraParaRedes, motivoNoDisponible } from "@/lib/redes/cargar";
import { armarPiezaRedes } from "@/lib/redes/componer";
import { invitacionImprimible } from "@/lib/redes/pdf";
import { getUsuario } from "@/lib/usuario";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 30;

/**
 * Una pieza para redes (D29): JPEG para posteo, historia y cuadrado; PDF de una página para la
 * invitación impresa. Se arma en cada pedido (no se guarda). Dueño, coorganización o super admin
 * (`promote`), con la muestra publicada. Si el texto no se dibuja, 500 en texto: nunca una imagen
 * sin texto.
 */
export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const usuario = await getUsuario();
  if (!usuario) return NextResponse.redirect(new URL(`/login?next=${encodeURIComponent("/panel/difusion")}`, req.url), 307);
  const { id } = await params;
  const q = new URL(req.url).searchParams;
  const formato = SOCIAL_FORMAT_PARAMS[q.get("formato") ?? ""];
  const variante = SOCIAL_VARIANT_PARAMS[q.get("variante") ?? ""];
  if (!/^[A-Za-z0-9_-]{1,64}$/.test(id) || !formato || !variante || !isFormatAllowed(variante, formato)) {
    return errorEnTexto("Esa pieza no existe.", 404);
  }
  if (!frenarPorUsuario("redes", usuario.id).allowed) return errorEnTexto("Pediste muchas piezas seguidas. Esperá unos minutos.", 429);

  const a = await cargarMuestraParaRedes(id, usuario);
  if (!a) return errorEnTexto("No encontramos esa muestra entre las tuyas. Las piezas para redes piden la muestra publicada.", 404);
  const muestra = { ...a, worksCount: a.works.length };
  if (!availableSocialVariants(muestra, new Date()).includes(variante)) return errorEnTexto(motivoNoDisponible(variante, a), 404);

  const pedida = q.get("obra");
  const obra = variante === "WORK"
    ? (pedida ? a.works.find((w) => w.id === pedida) : a.works.find((w) => w.isHighlight) ?? a.works[0]) ?? null
    : null;
  if (variante === "WORK" && !obra) return errorEnTexto("Esa obra no es de esta muestra.", 404);

  try {
    const jpg = await armarPiezaRedes({ muestra, obra, formato, variante, urlInvitacion: `${baseUrlPublica()}/m/${a.slug}/inauguracion` });
    const pdf = isPrintFormat(formato);
    const cuerpo = pdf ? await invitacionImprimible(jpg, formato) : jpg;
    // El slug sólo tiene a-z, 0-9 y guiones; variante y formato salen de listas cerradas.
    const nombre = socialFileName(a.slug, variante, formato);
    return new Response(cuerpo as BodyInit, {
      headers: {
        "Content-Type": pdf ? "application/pdf" : "image/jpeg",
        "Content-Disposition": `${q.get("descargar") === "1" || pdf ? "attachment" : "inline"}; filename="${nombre}"`,
        "Cache-Control": "private, max-age=300",
      },
    });
  } catch (err) {
    console.error("GET /api/redes:", err instanceof Error ? err.message : String(err));
    return errorEnTexto("No pudimos armar la pieza. Probá de nuevo.", 500);
  }
}
