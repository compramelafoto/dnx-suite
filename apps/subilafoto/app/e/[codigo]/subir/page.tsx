import { notFound } from "next/navigation";
import { cookies } from "next/headers";
import { DNX_SESSION_COOKIE, getSessionUserByRawToken } from "@repo/auth";
import { prisma } from "@repo/db";
import { estadoDeAcceso } from "@/lib/acceso-evento";
import { estiloLegible } from "@/lib/estilo-de-tema";
import { urlDelBanner } from "@/lib/banner-url";
import { enlaceDeBannerValido } from "@/lib/banner";
import { urlDelLogo } from "@/lib/logo-url";
import { BannerDelFotografo } from "../banner-del-fotografo";
import { LogoDelFotografo } from "../logo-del-fotografo";
import { urlDePortada } from "@/lib/portada-url";
import { resolverTema } from "@/lib/tema";
import { puedeElegirVarias } from "@/lib/quien-sube";
import { Cargador } from "./cargador";
import { GrabarAudio } from "./grabar-audio";
import { DejarMensaje } from "./mensaje";
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
      allowMessages: true,
      hostsLabel: true,
      coverUrl: true,
      sellerProfile: {
        select: {
          userId: true,
          logoUrl: true,
          displayName: true,
          bannerUrl: true,
          bannerLinkUrl: true,
        },
      },
    },
  });

  if (!evento) notFound();

  /*
    Quién está mirando. El invitado entra por el QR sin cuenta y elige las fotos de a una;
    el organizador entra con su sesión de la suite y las elige de a muchas, porque está
    cargando el material del evento. La regla está en `lib/quien-sube.ts`.
  */
  const almacen = await cookies();
  const token = almacen.get(DNX_SESSION_COOKIE)?.value;
  const usuario = token ? await getSessionUserByRawToken(token) : null;
  const variasALaVez = puedeElegirVarias({
    usuarioId: usuario?.id ?? null,
    duenoId: evento.sellerProfile.userId,
  });

  const tema = resolverTema(evento.themeTokens);
  const logo = await urlDelLogo(evento.sellerProfile.logoUrl);
  const banner = await urlDelBanner(evento.sellerProfile.bannerUrl);
  const acceso = estadoDeAcceso(evento, new Date());
  const portada = await urlDePortada(evento.coverUrl);

  return (
    <main
      className="flex min-h-[100svh] flex-col items-center justify-center px-6 py-14 text-center"
      style={estiloLegible(tema)}
    >
      {/*
        La portada y de quién es la fiesta, igual que en la puerta. El invitado llega acá
        desde la puerta o desde el historial del navegador, y sin esto la pantalla donde
        realmente sube sus fotos es la única del recorrido que no dice de qué fiesta es.
      */}
      <LogoDelFotografo url={logo} nombre={evento.sellerProfile.displayName} />

      {portada ? (
        /*
          Sin `next/image`: la dirección viene firmada y vence. El optimizador guarda el
          resultado con la dirección entera como clave —firma incluida—, así que cada
          visita genera una clave nueva y vuelve a bajar y recomprimir la foto. Además el
          host del bucket no está en `images.remotePatterns` y contesta 400.

          Tampoco lleva alto y ancho fijos: eran cuadrados y recortaban cualquier foto que
          no lo fuera. Con `max-w` y `max-h` la foto entra entera y conserva su forma.
        */
        /* eslint-disable-next-line @next/next/no-img-element */
        <img
          src={portada}
          alt=""
          decoding="async"
          className="mb-8 max-h-[28vh] max-w-[min(11rem,42vw)] rounded-2xl"
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
          <Cargador codigo={clave} tema={tema} variasALaVez={variasALaVez} />
          <BarraDeReacciones codigo={clave} acento={tema.acento} />
          {evento.allowMessages ? (
            <>
              <DejarMensaje codigo={clave} acento={tema.acento} />
              <GrabarAudio codigo={clave} acento={tema.acento} />
            </>
          ) : null}
        </>
      ) : (
        <p className="mt-6 max-w-[32ch] opacity-80">
          {acceso.momento === "ANTES"
            ? "El evento todavía no arrancó. Volvé más tarde."
            : "El evento terminó y ya no se pueden subir fotos."}
        </p>
      )}
      <BannerDelFotografo
        url={banner}
        enlace={enlaceDeBannerValido(evento.sellerProfile.bannerLinkUrl)}
        nombre={evento.sellerProfile.displayName}
      />
    </main>
  );
}
