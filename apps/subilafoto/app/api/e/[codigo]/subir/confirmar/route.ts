import { NextResponse, after } from "next/server";
import { cookies } from "next/headers";
import { HeadObjectCommand } from "@aws-sdk/client-s3";
import { prisma } from "@repo/db";
import { almacenamiento, bucket } from "@/lib/almacenamiento";
import { COOKIE_INVITADO } from "@/lib/invitado-cookie";
import { moderarFoto } from "@/lib/moderacion";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * El invitado avisa que terminó de subir.
 *
 * No se cree el aviso: se le pregunta a R2 si el archivo está y cuánto pesa. Si el wifi se
 * cortó a mitad, la foto queda incompleta y el aviso igual llegaría — y publicaríamos un
 * archivo roto.
 *
 * Pasa a PROCESSING, no a APPROVED: nada se publica sin que la IA lo mire (capítulo 10.2).
 *
 * La moderación se dispara con `after()`, que corre **después** de contestarle al invitado.
 * Él ve "listo" enseguida y la foto aparece en la pantalla cuando se aprueba; hacerlo antes
 * de responder lo dejaría mirando una rueda girar en medio de la fiesta.
 */
export async function POST(req: Request, ctx: { params: Promise<{ codigo: string }> }) {
  const { codigo } = await ctx.params;

  let cuerpo: { mediaId?: string; nombre?: string };
  try {
    cuerpo = await req.json();
  } catch {
    return NextResponse.json({ error: "Pedido inválido." }, { status: 400 });
  }

  const almacenCookies = await cookies();
  const tokenInvitado = almacenCookies.get(COOKIE_INVITADO)?.value ?? null;
  if (!tokenInvitado) {
    return NextResponse.json({ error: "No encontramos tu sesión." }, { status: 401 });
  }

  // La foto tiene que ser de este invitado y de este evento: no alcanza con saber el id.
  const media = await prisma.subilafotoMedia.findFirst({
    where: {
      id: String(cuerpo.mediaId ?? ""),
      status: "UPLOADING",
      event: { code: codigo.toUpperCase() },
      guest: { token: tokenInvitado },
    },
    select: { id: true, originalKey: true, guestSessionId: true },
  });

  if (!media) {
    return NextResponse.json({ error: "No encontramos esa foto." }, { status: 404 });
  }

  let bytes: number | undefined;
  try {
    const cabecera = await almacenamiento().send(
      new HeadObjectCommand({ Bucket: bucket(), Key: media.originalKey }),
    );
    bytes = cabecera.ContentLength;
  } catch {
    return NextResponse.json(
      { error: "La foto no llegó completa. Probá de nuevo." },
      { status: 409 },
    );
  }

  if (!bytes || bytes <= 0) {
    return NextResponse.json(
      { error: "La foto llegó vacía. Probá de nuevo." },
      { status: 409 },
    );
  }

  await prisma.$transaction([
    prisma.subilafotoMedia.update({
      where: { id: media.id },
      data: {
        status: "PROCESSING",
        originalBytes: bytes,
        caption: typeof cuerpo.nombre === "string" ? cuerpo.nombre.slice(0, 140) : null,
      },
    }),
    // El contador sube junto con el estado: si se hiciera aparte, un reintento podría
    // contar dos veces la misma foto.
    prisma.subilafotoGuestSession.update({
      where: { id: media.guestSessionId! },
      data: { uploadCount: { increment: 1 } },
    }),
  ]);

  // Después de responder, no antes. Si esta invocación se muere sin llegar a
  // moderar, la foto queda en PROCESSING y la recoge /api/moderacion/procesar.
  after(async () => {
    try {
      await moderarFoto(media.id);
    } catch (error) {
      // Nunca revienta acá: la respuesta al invitado ya salió y la red de
      // seguridad va a reintentarlo.
      console.error("[subilafoto] falló la moderación de", media.id, error);
    }
  });

  return NextResponse.json({ ok: true, estado: "PROCESSING" });
}
