import { notFound } from "next/navigation";
import { prisma } from "@repo/db";
import { condicionDePublicadas } from "@/lib/album";
import { resolverTema } from "@/lib/tema";
import { DURACION, enlacesParaMirar } from "@/lib/moderacion/vista";
import { Proyeccion, type FotoEnVivo } from "./proyeccion";

export const dynamic = "force-dynamic";

type Props = { params: Promise<{ codigo: string }> };

/**
 * La pantalla del salón.
 *
 * Se abre con el **código de pantalla**, que es distinto del código de los
 * invitados y no se comparte: quien lo tiene puede proyectar. Por eso la URL no
 * se pone en ningún cartel.
 *
 * Las primeras fotos vienen del servidor, no del canal en vivo: si la pantalla
 * se enciende a mitad de la fiesta, arranca mostrando lo que ya hay en lugar de
 * esperar a que alguien suba la próxima.
 */
export default async function Pantalla({ params }: Props) {
  const { codigo } = await params;

  const evento = await prisma.subilafotoEvent.findUnique({
    where: { screenCode: codigo.toUpperCase() },
    select: { id: true, code: true, themeTokens: true },
  });
  if (!evento) notFound();

  const ultimas = await prisma.subilafotoMedia.findMany({
    where: { ...condicionDePublicadas(evento.id), kind: "PHOTO" },
    orderBy: [{ publishedAt: "desc" }, { id: "desc" }],
    take: 20,
    select: { id: true, originalKey: true, caption: true, guestName: true },
  });

  // Se dan vuelta: la pantalla las recorre en el orden en que se publicaron.
  const enOrden = [...ultimas].reverse();
  const enlaces = await enlacesParaMirar(
    enOrden.map((f) => f.originalKey),
    DURACION.proyeccion,
  );

  const iniciales: FotoEnVivo[] = enOrden.map((f, i) => ({
    id: f.id,
    url: enlaces[i]!,
    pie: f.caption,
    nombre: f.guestName,
  }));

  const tema = resolverTema(evento.themeTokens);

  return (
    <Proyeccion
      codigo={evento.code}
      iniciales={iniciales}
      fondo={tema.fondo}
      texto={tema.texto}
    />
  );
}
