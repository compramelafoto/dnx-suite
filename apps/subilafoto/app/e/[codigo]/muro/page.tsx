import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@repo/db";
import { condicionDePublicadas, puedeVerElMuro } from "@/lib/album";
import { estadoDeAcceso } from "@/lib/acceso-evento";
import { estiloLegible } from "@/lib/estilo-de-tema";
import { SELECT_DE_VARIANTES, DURACION, enlacesDeVariantes } from "@/lib/moderacion/vista";
import { resolverTema } from "@/lib/tema";
import type { ItemEnVivo } from "@/app/pantalla/[codigo]/proyeccion";
import { Mural } from "./mural";

export const dynamic = "force-dynamic";

type Props = { params: Promise<{ codigo: string }> };

/**
 * El muro en vivo del invitado: lo que se está subiendo, ahora.
 *
 * Es la pantalla del salón cuando no hay pantalla. La fiesta del 10/10/2026 no se hizo
 * porque el salón no tenía televisor, y sin él el invitado sube una foto y no recibe
 * nada a cambio.
 */
export default async function Muro({ params }: Props) {
  const { codigo } = await params;
  const clave = codigo.toUpperCase();

  const evento = await prisma.subilafotoEvent.findUnique({
    where: { code: clave },
    select: {
      id: true,
      name: true,
      status: true,
      activationAt: true,
      deactivationAt: true,
      themeTokens: true,
      guestsCanSeeLive: true,
    },
  });
  if (!evento) notFound();

  const { momento } = estadoDeAcceso(evento, new Date());
  if (!puedeVerElMuro({ guestsCanSeeLive: evento.guestsCanSeeLive, momento })) notFound();

  const ultimas = await prisma.subilafotoMedia.findMany({
    where: { ...condicionDePublicadas(evento.id), kind: { in: ["PHOTO", "MESSAGE"] } },
    orderBy: [{ publishedAt: "desc" }, { id: "desc" }],
    take: 12,
    select: { id: true, kind: true, caption: true, guestName: true, variants: SELECT_DE_VARIANTES },
  });

  // La variante, nunca el original: la misma regla anti-bypass que la proyección.
  const enlaces = await enlacesDeVariantes(ultimas, "pantalla", DURACION.proyeccion);

  const iniciales: ItemEnVivo[] = ultimas.flatMap((m, i): ItemEnVivo[] => {
    if (m.kind === "MESSAGE") {
      return m.caption
        ? [{ tipo: "MENSAJE" as const, id: m.id, texto: m.caption, nombre: m.guestName }]
        : [];
    }
    const url = enlaces[i];
    return url ? [{ tipo: "FOTO" as const, id: m.id, url, pie: m.caption, nombre: m.guestName }] : [];
  });

  const tema = resolverTema(evento.themeTokens);

  return (
    <main
      className="flex min-h-[100svh] flex-col items-center px-4 py-10"
      style={estiloLegible(tema)}
    >
      <h1 className="text-center text-xl font-extrabold">Lo que se está subiendo</h1>
      <p className="mt-2 text-center text-sm opacity-75">{evento.name}</p>

      <div className="w-full max-w-md">
        <Mural codigo={clave} iniciales={iniciales} />
      </div>

      <Link
        href={`/e/${clave}/subir`}
        className="mt-10 min-h-[56px] rounded-2xl px-8 py-4 text-base font-extrabold"
        style={{ background: tema.acento, color: tema.textoSobreAcento }}
      >
        Sumar mi foto
      </Link>

      <p className="mt-6 max-w-sm text-center text-xs opacity-60">
        Se ven las últimas que llegaron, en chico. Las fotos completas se las lleva quien
        organizó la fiesta.
      </p>
    </main>
  );
}
