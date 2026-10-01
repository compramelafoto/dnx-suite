import { notFound } from "next/navigation";
import { prisma } from "@repo/db";
import { AlbumDelEvento } from "@/app/components/album-evento";

export const dynamic = "force-dynamic";

type Props = { params: Promise<{ token: string }> };

/**
 * El álbum, entrando por el enlace del cliente.
 *
 * Existe aparte de la puerta del invitado por una sola razón: el interruptor que apaga el
 * álbum es sobre los invitados. Al cliente que contrató el evento no lo alcanza — es su
 * material, y el enlace ya es la prueba de quién es.
 */
export default async function AlbumDelCliente({ params }: Props) {
  const { token } = await params;

  const enlace = await prisma.subilafotoAccessLink.findUnique({
    where: { token },
    select: {
      kind: true,
      revokedAt: true,
      expiresAt: true,
      event: { select: { id: true, name: true, hostsLabel: true, themeTokens: true } },
    },
  });

  const ahora = new Date();
  const vigente =
    enlace &&
    enlace.kind === "CLIENT" &&
    !enlace.revokedAt &&
    (!enlace.expiresAt || enlace.expiresAt > ahora);
  if (!vigente) notFound();

  return (
    <AlbumDelEvento
      evento={enlace.event}
      volver={{ href: `/cliente/${token}`, texto: "Volver a tu panel" }}
    />
  );
}
