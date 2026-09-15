import Link from "next/link";
import { prisma } from "@repo/db";
import { condicionDePublicadas } from "@/lib/album";
import { resolverTema } from "@/lib/tema";
import { DURACION, SELECT_DE_VARIANTES, enlacesDeVariantes } from "@/lib/moderacion/vista";

/**
 * El álbum del evento: lo que subieron todos y ya está aprobado.
 *
 * Es la pantalla que se mira al otro día, en el sillón. Por eso no tiene controles ni
 * filtros: son las fotos, grandes, y nada más.
 *
 * Vive acá y no en una ruta porque hay dos puertas al mismo álbum —la del invitado y la
 * del cliente que contrató— y tienen que mostrar exactamente lo mismo. Si fueran dos
 * pantallas distintas, una se corregiría y la otra no.
 */
export async function AlbumDelEvento({
  evento,
  volver,
}: {
  evento: { id: string; name: string; hostsLabel: string | null; themeTokens: unknown };
  volver: { href: string; texto: string };
}) {
  const fotos = await prisma.subilafotoMedia.findMany({
    where: { ...condicionDePublicadas(evento.id), kind: "PHOTO" },
    orderBy: { publishedAt: "desc" },
    take: 300,
    select: { id: true, caption: true, guestName: true, variants: SELECT_DE_VARIANTES },
  });

  // La variante reducida, nunca el original: regla anti-bypass. Las que todavía no la
  // tienen no se muestran; aparecen solas en la próxima carga.
  const enlaces = await enlacesDeVariantes(fotos, "pantalla", DURACION.proyeccion);
  const visibles = fotos
    .map((foto, i) => ({ foto, enlace: enlaces[i] }))
    .filter((x): x is { foto: (typeof fotos)[number]; enlace: string } => Boolean(x.enlace));
  const tema = resolverTema(evento.themeTokens);

  return (
    <main
      className="min-h-[100svh] px-4 py-12 sm:px-6"
      style={{
        background: tema.fondo,
        color: tema.texto,
        fontFamily: `${tema.tipografia}, system-ui, sans-serif`,
      }}
    >
      <header className="mx-auto max-w-5xl text-center">
        <h1 className="text-balance text-[clamp(1.6rem,6vw,2.5rem)] font-extrabold leading-[1.1]">
          {evento.name}
        </h1>
        {evento.hostsLabel ? (
          <p className="mt-2 text-lg" style={{ opacity: 0.78 }}>
            {evento.hostsLabel}
          </p>
        ) : null}
        <p className="mt-4 text-sm" style={{ opacity: 0.7 }}>
          {visibles.length === 0
            ? "Todavía no hay fotos publicadas."
            : visibles.length === 1
              ? "1 foto"
              : `${visibles.length} fotos`}
        </p>
      </header>

      {visibles.length === 0 ? (
        <p
          className="mx-auto mt-16 max-w-[34ch] text-center leading-relaxed"
          style={{ opacity: 0.78 }}
        >
          Cuando los invitados empiecen a subir, las fotos aparecen acá. Cada una pasa antes
          por una revisión automática.
        </p>
      ) : (
        /*
          Columnas de mampostería con CSS: las fotos de una fiesta vienen verticales y
          horizontales mezcladas, y una grilla de recuadros iguales las recorta todas. Acá
          cada una se ve entera.
        */
        <ul className="mx-auto mt-12 max-w-5xl [column-gap:0.75rem] [columns:2] sm:[columns:3] lg:[columns:4]">
          {visibles.map(({ foto, enlace }, i) => (
            <li key={foto.id} className="mb-3 break-inside-avoid">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={enlace}
                alt={foto.caption ?? "Foto del evento"}
                className="w-full rounded-xl"
                loading={i < 8 ? "eager" : "lazy"}
                decoding="async"
              />
              {foto.caption || foto.guestName ? (
                <p className="px-1 pt-1.5 text-xs leading-snug" style={{ opacity: 0.7 }}>
                  {foto.caption}
                  {foto.caption && foto.guestName ? " — " : ""}
                  {foto.guestName}
                </p>
              ) : null}
            </li>
          ))}
        </ul>
      )}

      <p className="mt-16 text-center text-sm" style={{ opacity: 0.62 }}>
        {/* Relleno para llegar a los 44 píxeles de alto: es un enlace suelto, no uno
            adentro de una oración. */}
        <Link
          href={volver.href}
          className="inline-flex min-h-[44px] items-center px-3 py-3 underline underline-offset-4"
        >
          {volver.texto}
        </Link>
      </p>
    </main>
  );
}
