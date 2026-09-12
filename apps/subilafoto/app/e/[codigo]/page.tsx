import { notFound } from "next/navigation";
import Image from "next/image";
import { prisma } from "@repo/db";
import { estadoDeAcceso } from "@/lib/acceso-evento";
import { resolverTema } from "@/lib/tema";

/**
 * La puerta del invitado: lo que se ve al escanear el QR.
 *
 * Sin cuenta, sin instalar nada. Sólo el nombre del evento, qué va a pasar con sus fotos
 * y el botón para subir. Es la pantalla que se mira con una mano ocupada y poca luz.
 */

export const dynamic = "force-dynamic";

type Props = { params: Promise<{ codigo: string }> };

const FORMATO_HORA = (zona: string) =>
  new Intl.DateTimeFormat("es-AR", {
    weekday: "long",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: zona,
  });

export default async function PuertaDelInvitado({ params }: Props) {
  const { codigo } = await params;

  const evento = await prisma.subilafotoEvent.findUnique({
    // El código llega de un QR: se normaliza a mayúsculas porque algunos teclados de
    // celular escriben en minúscula al tipearlo a mano.
    where: { code: codigo.toUpperCase() },
    select: {
      name: true,
      hostsLabel: true,
      venueName: true,
      coverUrl: true,
      status: true,
      activationAt: true,
      deactivationAt: true,
      timezone: true,
      allowMessages: true,
      guestsCanSeeAlbum: true,
      themeTokens: true,
    },
  });

  if (!evento) notFound();

  const acceso = estadoDeAcceso(evento, new Date());
  // El tema sale del snapshot del evento. Si está vacío o corrupto, cae en la marca.
  const tema = resolverTema(evento.themeTokens);
  const hora = FORMATO_HORA(evento.timezone);

  return (
    <main
      className="flex min-h-[100svh] flex-col items-center justify-center px-6 py-14 text-center"
      style={{
        background: tema.fondo,
        color: tema.texto,
        fontFamily: `${tema.tipografia}, system-ui, sans-serif`,
      }}
    >
      {evento.coverUrl ? (
        <Image
          src={evento.coverUrl}
          alt=""
          width={520}
          height={520}
          priority
          className="mb-10 h-auto w-[min(20rem,72vw)] rounded-2xl object-cover"
        />
      ) : (
        // Monocromo y no el isotipo a color: el fondo lo pone la plantilla del evento y
        // el manual prohíbe usar el logo sobre fondos que no le dan contraste. Además la
        // marca que manda acá es la del evento, no la nuestra.
        <Image
          src="/brand/subilafoto-isotipo-monocromo-blanco.png"
          alt=""
          width={160}
          height={160}
          priority
          className="mb-10 h-auto w-[min(5rem,20vw)] opacity-70"
        />
      )}

      <h1 className="max-w-[20ch] text-balance text-[clamp(1.8rem,7vw,2.8rem)] font-extrabold leading-[1.1]">
        {evento.name}
      </h1>

      {evento.hostsLabel ? (
        <p className="mt-3 text-lg" style={{ color: tema.texto, opacity: 0.78 }}>
          {evento.hostsLabel}
        </p>
      ) : null}

      {acceso.puedeSubir ? (
        <>
          <p
            className="mt-8 max-w-[38ch] text-[1.05rem] leading-relaxed"
            style={{ color: tema.texto, opacity: 0.78 }}
          >
            Subí las fotos que sacaste{evento.allowMessages ? " y dejá tu mensaje" : ""}.
            {evento.guestsCanSeeAlbum
              ? " Van a aparecer en la pantalla y en el álbum del evento."
              : " Van a aparecer en la pantalla del evento."}
          </p>

          <a
            href={`/e/${codigo.toUpperCase()}/subir`}
            className="mt-10 w-full max-w-sm rounded-2xl px-8 py-5 text-lg font-extrabold"
            style={{ background: tema.acento, color: tema.textoSobreAcento }}
          >
            Subir mis fotos
          </a>

          {evento.deactivationAt ? (
            <p className="mt-6 text-sm" style={{ color: tema.texto, opacity: 0.78 }}>
              Podés subir hasta el {hora.format(evento.deactivationAt)}
            </p>
          ) : null}
        </>
      ) : acceso.momento === "ANTES" ? (
        <p
          className="mt-8 max-w-[34ch] text-[1.05rem] leading-relaxed"
          style={{ color: tema.texto, opacity: 0.78 }}
        >
          Todavía no arrancó.
          {evento.activationAt ? ` Abre el ${hora.format(evento.activationAt)}` : ""}. Guardá
          este código y volvé entonces.
        </p>
      ) : (
        <p
          className="mt-8 max-w-[34ch] text-[1.05rem] leading-relaxed"
          style={{ color: tema.texto, opacity: 0.78 }}
        >
          El evento terminó y ya no se pueden subir fotos. Gracias por participar.
        </p>
      )}
    </main>
  );
}
