import { cookies } from "next/headers";
import { DNX_SESSION_COOKIE, getSessionUserByRawToken } from "@repo/auth";
import { prisma } from "@repo/db";
import { pdfDelCentroDeMesa } from "@/lib/impresos/centro-de-mesa";
import { resolverTema } from "@/lib/tema";
import { urlDelCodigo } from "@/lib/url-invitado";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Si el logo tarda más que esto, la tarjeta sale sin logo. */
const ESPERA_DEL_LOGO_MS = 4_000;

/**
 * Descarga el PDF del centro de mesa.
 *
 * Si el QR no se puede leer, esto devuelve un error en lugar de un archivo. Es
 * a propósito: preferimos que el fotógrafo vea un mensaje a que se lleve a la
 * imprenta un código que no escanea.
 */
export async function GET(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;

  const almacen = await cookies();
  const token = almacen.get(DNX_SESSION_COOKIE)?.value;
  const usuario = token ? await getSessionUserByRawToken(token) : null;
  if (!usuario) return new Response("Iniciá sesión.", { status: 401 });

  const evento = await prisma.subilafotoEvent.findFirst({
    where: { id, sellerProfile: { userId: usuario.id } },
    select: {
      name: true,
      code: true,
      themeTokens: true,
      sellerProfile: { select: { logoUrl: true } },
    },
  });
  if (!evento) return new Response("No existe.", { status: 404 });

  const tema = resolverTema(evento.themeTokens);
  const logoPng = await bajarLogo(evento.sellerProfile.logoUrl);

  let pdf: Uint8Array;
  try {
    pdf = await pdfDelCentroDeMesa({
      nombreDelEvento: evento.name,
      codigo: evento.code,
      url: urlDelCodigo(new URL(req.url).origin, evento.code),
      fondo: tema.fondo,
      texto: tema.texto,
      acento: tema.acento,
      logoPng,
    });
  } catch (error) {
    return new Response(
      error instanceof Error ? error.message : "No se pudo generar el material.",
      { status: 500 },
    );
  }

  return new Response(pdf as BodyInit, {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="centro-de-mesa-${evento.code}.pdf"`,
      "Cache-Control": "no-store",
    },
  });
}

/**
 * Trae el logo del vendedor.
 *
 * Nunca revienta: si el logo no está, no responde o no es un PNG, la tarjeta
 * sale sin logo. Peor sería que no salga ninguna tarjeta la tarde antes de la
 * fiesta por culpa de una imagen.
 */
async function bajarLogo(url: string | null): Promise<Uint8Array | null> {
  if (!url) return null;
  try {
    const respuesta = await fetch(url, { signal: AbortSignal.timeout(ESPERA_DEL_LOGO_MS) });
    if (!respuesta.ok) return null;
    return new Uint8Array(await respuesta.arrayBuffer());
  } catch {
    return null;
  }
}
