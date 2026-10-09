import { notFound } from "next/navigation";
import { prisma } from "@repo/db";
import { condicionDePublicadas } from "@/lib/album";
import { cartelDePantalla } from "@/lib/pantalla-cartel";
import { estadoDeAcceso } from "@/lib/acceso-evento";
import { qrDelEvento } from "@/lib/qr";
import { estiloDeTema } from "@/lib/estilo-de-tema";
import { resolverTema } from "@/lib/tema";
import { urlDelCodigo } from "@/lib/url-invitado";
import { DURACION, SELECT_DE_VARIANTES, enlacesDeVariantes } from "@/lib/moderacion/vista";
import { Proyeccion, type ItemEnVivo } from "./proyeccion";

export const dynamic = "force-dynamic";

type Props = { params: Promise<{ codigo: string }> };

function baseUrl(): string {
  return (
    process.env.NEXT_PUBLIC_APP_URL?.trim() ||
    process.env.AUTH_URL?.trim() ||
    "http://localhost:3012"
  );
}

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
    select: {
      id: true,
      code: true,
      themeTokens: true,
      name: true,
      status: true,
      activationAt: true,
      deactivationAt: true,
      closingCardText: true,
    },
  });
  if (!evento) notFound();

  const tema = resolverTema(evento.themeTokens);

  /*
    La pantalla fuera del horario del evento.

    Son DOS momentos distintos y no uno: antes de empezar invita, después se despide.
    Hasta el 2026-10-09 los dos caían en la placa de cierre, porque se miraba sólo
    `puedeSubir` —que es falso en los dos casos—. El televisor enchufado media hora
    antes decía "Gracias por la noche" a un salón que recién se estaba llenando.

    Se mira el acceso y no sólo el estado: el cron corre cada cinco minutos, así
    que entre que vence la ventana y se marca `CLOSED` hay un rato en el que la
    base todavía dice `ACTIVE`. La pantalla no tiene por qué esperar al cron.
  */
  const cartel = cartelDePantalla({
    momento: estadoDeAcceso(evento, new Date()).momento,
    textoDeCierre: evento.closingCardText,
  });

  if (cartel.tipo !== "PROYECTANDO") {
    return (
      <main
        className="flex h-[100svh] w-full flex-col items-center justify-center px-16 text-center"
        style={estiloDeTema(tema)}
      >
        <p className="text-balance text-[clamp(2rem,6vw,4.5rem)] font-extrabold leading-[1.1]">
          {cartel.titulo}
        </p>
        {cartel.tipo === "ESPERANDO" ? (
          <p
            className="mt-8 text-balance text-[clamp(1.1rem,2.4vw,2rem)]"
            style={{ opacity: 0.85 }}
          >
            {cartel.bajada}
          </p>
        ) : null}
        <p className="mt-8 text-[clamp(1rem,2vw,1.75rem)]" style={{ opacity: 0.7 }}>
          {evento.name}
        </p>
      </main>
    );
  }

  const ultimas = await prisma.subilafotoMedia.findMany({
    where: {
      ...condicionDePublicadas(evento.id),
      // Los mensajes se proyectan entre las fotos, como un globo de chat.
      kind: { in: ["PHOTO", "MESSAGE"] },
    },
    orderBy: [{ publishedAt: "desc" }, { id: "desc" }],
    take: 20,
    select: {
      id: true,
      kind: true,
      caption: true,
      guestName: true,
      variants: SELECT_DE_VARIANTES,
    },
  });

  // Se dan vuelta: la pantalla las recorre en el orden en que se publicaron.
  const enOrden = [...ultimas].reverse();
  // La variante, nunca el original: regla anti-bypass. Una foto sin variante no se
  // proyecta —un recuadro roto en la pared del salón es peor que una foto de menos.
  const enlaces = await enlacesDeVariantes(enOrden, "pantalla", DURACION.proyeccion);

  const iniciales: ItemEnVivo[] = enOrden.flatMap((f, i): ItemEnVivo[] => {
    if (f.kind === "MESSAGE") {
      // Un mensaje no tiene archivo: su contenido es el texto.
      return f.caption
        ? [{ tipo: "MENSAJE", id: f.id, texto: f.caption, nombre: f.guestName }]
        : [];
    }
    const url = enlaces[i];
    if (!url) return [];
    return [{ tipo: "FOTO", id: f.id, url, pie: f.caption, nombre: f.guestName }];
  });

  /*
    El QR se dibuja en el servidor y viaja ya hecho. El televisor del salón suele ser un
    aparato lento: no tiene por qué calcular un código que nunca cambia en toda la noche.
  */
  const urlDelEvento = urlDelCodigo(baseUrl(), evento.code);
  const qrSvg = await qrDelEvento(urlDelEvento);

  return (
    <Proyeccion
      qrSvg={qrSvg}
      urlDelEvento={urlDelEvento.replace(/^https?:\/\//, "")}
      codigo={evento.code}
      iniciales={iniciales}
      estilo={estiloDeTema(tema)}
      fondo={tema.fondo}
    />
  );
}
