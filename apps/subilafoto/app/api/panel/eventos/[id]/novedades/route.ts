import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { DNX_SESSION_COOKIE, getSessionUserByRawToken } from "@repo/auth";
import { prisma } from "@repo/db";
import { condicionDePublicadas } from "@/lib/album";
import { eventoQueAdministra } from "@/lib/acceso-al-evento";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Cuántas cosas se publicaron después de lo que el fotógrafo está viendo.
 *
 * Existe para que el control en vivo **no se mueva solo**. La lista está ordenada por lo
 * último que llegó, así que refrescarla corre las fotos de lugar, y ahí un toque saca algo
 * de la pared sin preguntar. Entonces se pregunta nada más que el número, y la lista se
 * actualiza cuando el fotógrafo decide.
 *
 * Devuelve un número y nada más: ni direcciones firmadas, ni nombres de archivo, ni
 * identificadores. Es una consulta que se repite cada ocho segundos durante horas, así que
 * tiene que ser lo más barata posible — y de paso, si algún día se filtra, no filtra nada.
 */
export async function GET(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;

  const almacen = await cookies();
  const cookie = almacen.get(DNX_SESSION_COOKIE)?.value;
  const usuario = cookie ? await getSessionUserByRawToken(cookie) : null;
  if (!usuario) return NextResponse.json({ error: "No autorizado." }, { status: 401 });

  // El evento tiene que ser de quien pregunta. Sin esto, cualquiera con cuenta sabría
  // cuánto se está subiendo en la fiesta de otro.
  const evento = await prisma.subilafotoEvent.findFirst({
    where: eventoQueAdministra(id, usuario.id),
    select: { id: true },
  });
  if (!evento) return NextResponse.json({ error: "No encontrado." }, { status: 404 });

  /*
    `desde` es la fecha de publicación de lo más nuevo que ya está en pantalla. Viene del
    servidor en el render anterior, no del reloj del teléfono: comparar contra la hora
    local daría de más o de menos según cómo ande ese reloj.

    Sin `desde` —la lista estaba vacía— se cuenta todo lo publicado.
  */
  const crudo = new URL(req.url).searchParams.get("desde");
  const desde = crudo ? new Date(crudo) : null;
  if (desde && Number.isNaN(desde.getTime())) {
    return NextResponse.json({ error: "Fecha ilegible." }, { status: 400 });
  }

  const cuantas = await prisma.subilafotoMedia.count({
    where: {
      ...condicionDePublicadas(evento.id),
      kind: { in: ["PHOTO", "MESSAGE", "AUDIO"] },
      ...(desde ? { publishedAt: { gt: desde } } : {}),
    },
  });

  return NextResponse.json({ cuantas });
}
