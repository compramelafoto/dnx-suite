import { notFound } from "next/navigation";
import { prisma } from "@repo/db";
import { estadoDeAcceso } from "@/lib/acceso-evento";
import { resolverTema } from "@/lib/tema";
import { Cargador } from "./cargador";

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
    },
  });

  if (!evento) notFound();

  const tema = resolverTema(evento.themeTokens);
  const acceso = estadoDeAcceso(evento, new Date());

  return (
    <main
      className="flex min-h-[100svh] flex-col items-center justify-center px-6 py-14 text-center"
      style={{
        background: tema.fondo,
        color: tema.texto,
        fontFamily: `${tema.tipografia}, system-ui, sans-serif`,
      }}
    >
      <h1 className="max-w-[18ch] text-balance text-[clamp(1.5rem,6vw,2.2rem)] font-extrabold leading-tight">
        {evento.name}
      </h1>

      {acceso.puedeSubir && evento.allowPhotos ? (
        <>
          <p className="mt-4 mb-10 max-w-[34ch] opacity-80">
            Elegí las fotos de tu galería o sacá una nueva.
          </p>
          <Cargador codigo={clave} tema={tema} />
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
