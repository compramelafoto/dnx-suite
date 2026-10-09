import Image from "next/image";
import { notFound } from "next/navigation";
import { prisma } from "@repo/db";
import { estadoDeAcceso } from "@/lib/acceso-evento";
import { estiloDeTema } from "@/lib/estilo-de-tema";
import { urlDePortada } from "@/lib/portada-url";
import { resolverTema } from "@/lib/tema";
import { Cargador } from "./cargador";
import { BarraDeReacciones } from "./reacciones";

export const dynamic = "force-dynamic";

type Props = { params: Promise<{ codigo: string }> };

export default async function Subir({ params }: Props) {
  const { codigo } = await params;
  const clave = codigo.toUpperCase();

  const evento = await prisma.subilafotoEvent.findUnique({
    where: { code: clave },
    select: {
      name: true,
      status: true,
      activationAt: true,
      deactivationAt: true,
      themeTokens: true,
      allowPhotos: true,
      hostsLabel: true,
      coverUrl: true,
    },
  });

  if (!evento) notFound();

  const tema = resolverTema(evento.themeTokens);
  const acceso = estadoDeAcceso(evento, new Date());
  const portada = await urlDePortada(evento.coverUrl);

  return (
    <main
      className="flex min-h-[100svh] flex-col items-center justify-center px-6 py-14 text-center"
      style={estiloDeTema(tema)}
    >
      {/*
        La portada y de quién es la fiesta, igual que en la puerta. El invitado llega acá
        desde la puerta o desde el historial del navegador, y sin esto la pantalla donde
        realmente sube sus fotos es la única del recorrido que no dice de qué fiesta es.
      */}
      {portada ? (
        <Image
          src={portada}
          alt=""
          width={400}
          height={400}
          priority
          className="mb-8 h-auto w-[min(11rem,42vw)] rounded-2xl object-cover"
        />
      ) : null}

      <h1 className="max-w-[18ch] text-balance text-[clamp(1.5rem,6vw,2.2rem)] font-extrabold leading-tight">
        {evento.name}
      </h1>

      {evento.hostsLabel ? (
        <p className="mt-2 text-lg" style={{ color: tema.texto, opacity: 0.78 }}>
          {evento.hostsLabel}
        </p>
      ) : null}

      {acceso.puedeSubir && evento.allowPhotos ? (
        <>
          <p className="mt-4 mb-10 max-w-[34ch] opacity-80">
            Elegí las fotos de tu galería o sacá una nueva.
          </p>
          <Cargador codigo={clave} tema={tema} />
          <BarraDeReacciones codigo={clave} acento={tema.acento} />
        </>
      ) : (
        <p className="mt-6 max-w-[32ch] opacity-80">
          {acceso.momento === "ANTES"
            ? "El evento todavía no arrancó. Volvé más tarde."
            : "El evento terminó y ya no se pueden subir fotos."}
        </p>
      )}
    </main>
  );
}
