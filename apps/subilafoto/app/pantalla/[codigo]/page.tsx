import { notFound } from "next/navigation";
import { prisma } from "@repo/db";
import { condicionDePublicadas } from "@/lib/album";
import { estadoDeAcceso } from "@/lib/acceso-evento";
import { resolverTema } from "@/lib/tema";
import { DURACION, SELECT_DE_VARIANTES, enlacesDeVariantes } from "@/lib/moderacion/vista";
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
    La placa de cierre. Cuando el evento termina, la pantalla deja de rotar y
    queda con un mensaje fijo: si siguiera pasando fotos, el salón vacío tendría
    una pantalla encendida toda la noche.

    Se mira el acceso y no sólo el estado: el cron corre cada cinco minutos, así
    que entre que vence la ventana y se marca `CLOSED` hay un rato en el que la
    base todavía dice `ACTIVE`. La pantalla no tiene por qué esperar al cron.
  */
  if (!estadoDeAcceso(evento, new Date()).puedeSubir) {
    return (
      <main
        className="flex h-[100svh] w-full flex-col items-center justify-center px-16 text-center"
        style={{
          background: tema.fondo,
          color: tema.texto,
          fontFamily: `${tema.tipografia}, system-ui, sans-serif`,
        }}
      >
        <p className="text-balance text-[clamp(2rem,6vw,4.5rem)] font-extrabold leading-[1.1]">
          {evento.closingCardText?.trim() || "Gracias por la noche"}
        </p>
        <p className="mt-8 text-[clamp(1rem,2vw,1.75rem)]" style={{ opacity: 0.7 }}>
          {evento.name}
        </p>
      </main>
    );
  }

  const ultimas = await prisma.subilafotoMedia.findMany({
    where: { ...condicionDePublicadas(evento.id), kind: "PHOTO" },
    orderBy: [{ publishedAt: "desc" }, { id: "desc" }],
    take: 20,
    select: { id: true, caption: true, guestName: true, variants: SELECT_DE_VARIANTES },
  });

  // Se dan vuelta: la pantalla las recorre en el orden en que se publicaron.
  const enOrden = [...ultimas].reverse();
  // La variante, nunca el original: regla anti-bypass. Una foto sin variante no se
  // proyecta —un recuadro roto en la pared del salón es peor que una foto de menos.
  const enlaces = await enlacesDeVariantes(enOrden, "pantalla", DURACION.proyeccion);

  const iniciales: FotoEnVivo[] = enOrden.flatMap((f, i) => {
    const url = enlaces[i];
    if (!url) return [];
    return [{ id: f.id, url, pie: f.caption, nombre: f.guestName }];
  });

  return (
    <Proyeccion
      codigo={evento.code}
      iniciales={iniciales}
      fondo={tema.fondo}
      texto={tema.texto}
    />
  );
}
