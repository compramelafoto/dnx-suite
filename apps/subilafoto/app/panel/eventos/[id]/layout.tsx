import type { ReactNode } from "react";
import { notFound, redirect } from "next/navigation";
import { cookies } from "next/headers";
import { DNX_SESSION_COOKIE, getSessionUserByRawToken } from "@repo/auth";
import { prisma } from "@repo/db";

export const dynamic = "force-dynamic";

/**
 * El marco de un evento: su nombre y las ocho secciones, siempre a la vista.
 *
 * Antes había que volver al resumen del evento para ir del QR a Moderación. En un salón,
 * de noche y apurado, eso son tres toques de más por cada cosa que se quiere mirar.
 *
 * La comprobación de dueño se hace acá además de en cada pantalla. Es redundante a
 * propósito: el nombre del evento se muestra en el marco, y mostrarlo sin verificar
 * filtraría el nombre de la fiesta de otro fotógrafo a cualquiera con el identificador.
 */
export default async function MarcoDelEvento({
  children,
  params,
}: {
  children: ReactNode;
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  const almacen = await cookies();
  const token = almacen.get(DNX_SESSION_COOKIE)?.value;
  const usuario = token ? await getSessionUserByRawToken(token) : null;
  if (!usuario) redirect(`/login?next=${encodeURIComponent(`/panel/eventos/${id}`)}`);

  const evento = await prisma.subilafotoEvent.findFirst({
    where: { id, sellerProfile: { userId: usuario.id } },
    select: { name: true },
  });
  if (!evento) notFound();

  /*
    Acá va sólo el nombre del evento. El menú lo dibuja `MarcoDelPanel`, que es el único
    de todo el panel: antes este marco dibujaba otro y se veían dos, uno encima del otro.

    La comprobación de dueño se queda igual, y es redundante a propósito: mostrar el
    nombre sin verificar filtraría el nombre de la fiesta de otro fotógrafo a cualquiera
    con el identificador.
  */
  return (
    <div className="mx-auto max-w-5xl px-4 lg:px-8">
      <h2
        className="mt-8 text-lg font-extrabold leading-tight"
        style={{ color: "var(--slf-tinta)" }}
      >
        {evento.name}
      </h2>
      <div className="mt-4 min-w-0">{children}</div>
    </div>
  );
}
