import type { ReactNode } from "react";
import { notFound, redirect } from "next/navigation";
import { cookies } from "next/headers";
import { DNX_SESSION_COOKIE, getSessionUserByRawToken } from "@repo/auth";
import { prisma } from "@repo/db";
import { seccionesDelEvento } from "@/lib/panel-navegacion";
import { Navegacion } from "../../navegacion";

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

  return (
    <div className="mx-auto max-w-6xl px-4 lg:px-6">
      <h2 className="mt-8 text-sm font-extrabold" style={{ color: "var(--slf-tinta-suave)" }}>
        {evento.name}
      </h2>

      <div className="mt-4 lg:grid lg:grid-cols-[15rem_1fr] lg:gap-10">
        <div className="lg:sticky lg:top-6 lg:self-start">
          <Navegacion secciones={seccionesDelEvento(id)} titulo="Este evento" />
        </div>
        <div className="min-w-0">{children}</div>
      </div>
    </div>
  );
}
