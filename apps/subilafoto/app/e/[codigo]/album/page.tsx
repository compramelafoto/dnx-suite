import { notFound } from "next/navigation";
import { prisma } from "@repo/db";
import { puedeVerElAlbum } from "@/lib/album";
import { AlbumDelEvento } from "@/app/components/album-evento";

export const dynamic = "force-dynamic";

type Props = { params: Promise<{ codigo: string }> };

/** El álbum, entrando por el código del evento: la puerta del invitado. */
export default async function Album({ params }: Props) {
  const { codigo } = await params;
  const code = codigo.toUpperCase();

  const evento = await prisma.subilafotoEvent.findUnique({
    where: { code },
    select: {
      id: true,
      name: true,
      hostsLabel: true,
      themeTokens: true,
      guestsCanSeeAlbum: true,
    },
  });
  if (!evento) notFound();

  // Si el organizador apagó el álbum, para el invitado no existe. Al cliente sí lo ve,
  // pero entra por su propio enlace.
  if (!puedeVerElAlbum({ guestsCanSeeAlbum: evento.guestsCanSeeAlbum, esElCliente: false })) {
    notFound();
  }

  return (
    <AlbumDelEvento evento={evento} volver={{ href: `/e/${code}`, texto: "Volver al evento" }} />
  );
}
