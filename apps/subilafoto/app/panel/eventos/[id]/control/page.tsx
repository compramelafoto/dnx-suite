import { notFound, redirect } from "next/navigation";
import { cookies } from "next/headers";
import { DNX_SESSION_COOKIE, getSessionUserByRawToken } from "@repo/auth";
import { prisma } from "@repo/db";
import { condicionDePublicadas } from "@/lib/album";
import {
  DURACION,
  SELECT_DE_VARIANTES,
  enlaceParaMirar,
  enlacesDeVariantes,
} from "@/lib/moderacion/vista";
import { revisarFoto } from "@/app/actions/moderacion";
import { Vigilancia } from "./vigilancia";
import { eventoQueAdministra } from "@/lib/acceso-al-evento";

export const dynamic = "force-dynamic";
/*
  `revalidate = 0` evita que la respuesta quede en caché, pero NO hace que la página se
  vuelva a pedir. De eso se encarga el vigía, que cada ocho segundos pregunta cuántas cosas
  llegaron y lo avisa — pero **no mueve la lista**: eso lo decide el fotógrafo tocando.

  La lista está ordenada por lo último que llegó, así que refrescarla corre las fotos de
  lugar, y acá un toque saca algo de la pared sin preguntar. Moviéndose sola, una foto que
  aparece justo mientras el dedo baja hace que se saque la de al lado.
*/
export const revalidate = 0;

type Props = { params: Promise<{ id: string }> };

/**
 * El control remoto de la pantalla, para el celular del fotógrafo.
 *
 * Es una pantalla que se usa parado, de noche, con una mano y con música
 * fuerte. De ahí sale todo el diseño: fotos grandes, un solo botón por foto,
 * sin confirmación y sin menús. Si hay que sacar algo de la pantalla, hay que
 * poder hacerlo en un toque y sin leer.
 *
 * La revisión fina —recuperar falsos positivos, ver lo bloqueado— está en
 * `/moderacion`, que es para hacer sentado.
 */
export default async function Control({ params }: Props) {
  const { id } = await params;

  const almacen = await cookies();
  const token = almacen.get(DNX_SESSION_COOKIE)?.value;
  const usuario = token ? await getSessionUserByRawToken(token) : null;
  if (!usuario) redirect(`/login?next=${encodeURIComponent(`/panel/eventos/${id}/control`)}`);

  const evento = await prisma.subilafotoEvent.findFirst({
    where: eventoQueAdministra(id, usuario.id),
    select: { id: true, name: true, screenCode: true },
  });
  if (!evento) notFound();

  const enPantalla = await prisma.subilafotoMedia.findMany({
    where: {
      ...condicionDePublicadas(evento.id),
      /*
        Fotos, mensajes y audios. Desde que no hay cola de revisión manual, sacar algo
        acá es la ÚNICA forma de frenar lo que no corresponde: si esta pantalla sólo
        mostrara fotos, un mensaje o un saludo grabado fuera de lugar no habría forma de
        bajarlo de la pared del salón.
      */
      kind: { in: ["PHOTO", "MESSAGE", "AUDIO"] },
    },
    orderBy: [{ publishedAt: "desc" }],
    take: 60,
    select: {
      id: true,
      kind: true,
      originalKey: true,
      caption: true,
      guestName: true,
      /* El corte contra el que el vigía cuenta lo que llegó después. */
      publishedAt: true,
      variants: SELECT_DE_VARIANTES,
    },
  });

  /*
    Lo más nuevo que esta lista ya muestra. El vigía pregunta cuántas cosas se publicaron
    después de esta fecha, y la lista no se mueve hasta que el fotógrafo toque.

    Sale de la base y no del reloj del teléfono: comparar contra la hora local daría de
    más o de menos según cómo ande ese reloj.
  */
  const corte = enPantalla[0]?.publishedAt?.toISOString() ?? null;

  // La variante, nunca el original: regla anti-bypass.
  const enlaces = await enlacesDeVariantes(enPantalla, "pantalla", DURACION.proyeccion);

  // Los audios no tienen variante: se firma el original para poder escucharlos acá.
  const audios: Record<string, string> = {};
  for (const m of enPantalla) {
    if (m.kind === "AUDIO" && m.originalKey) {
      audios[m.id] = await enlaceParaMirar(m.originalKey, DURACION.proyeccion);
    }
  }

  return (
    <main className="sobre-claro mx-auto max-w-3xl px-4 py-8">

      <h1 className="mt-4 text-2xl font-extrabold tracking-[-0.02em]">En la pantalla</h1>
      <p className="mt-2 leading-relaxed" style={{ color: "var(--slf-tinta-suave)" }}>
        {enPantalla.length === 0
          ? "Todavía no hay nada proyectándose."
          : "Tocá Sacar y desaparece de la pantalla en el momento. Podés volver a mostrarla después desde Moderación."}
      </p>

      <div className="mt-5">
        <Vigilancia key={corte ?? "vacio"} eventoId={evento.id} desde={corte} />
      </div>

      <ul className="mt-8 grid gap-5 sm:grid-cols-2">
        {enPantalla.map((foto, i) => (
          <li
            key={foto.id}
            className="overflow-hidden rounded-2xl border"
            style={{ borderColor: "var(--slf-borde)" }}
          >
            {foto.kind === "MESSAGE" ? (
              // El texto entero, para poder leer qué dice antes de decidir.
              <div
                className="flex aspect-[4/3] w-full items-center justify-center p-5"
                style={{ background: "var(--slf-crema)" }}
              >
                <p className="text-balance text-center text-base font-extrabold leading-snug">
                  {foto.caption}
                </p>
              </div>
            ) : foto.kind === "AUDIO" ? (
              // Se puede escuchar acá antes de decidir si sacarlo.
              <div
                className="flex aspect-[4/3] w-full flex-col items-center justify-center gap-4 p-5"
                style={{ background: "var(--slf-crema)" }}
              >
                <p className="text-sm font-extrabold">Saludo grabado</p>
                <audio src={audios[foto.id]} controls className="w-full" preload="none" />
              </div>
            ) : (
              /* eslint-disable-next-line @next/next/no-img-element */
              <img
                src={enlaces[i]!}
                alt={foto.caption ?? "Foto en pantalla"}
                className="aspect-[4/3] w-full bg-black/5 object-cover"
                loading={i < 4 ? "eager" : "lazy"}
              />
            )}

            {foto.caption || foto.guestName ? (
              <p className="px-4 pt-3 text-sm" style={{ color: "var(--slf-tinta-suave)" }}>
                {foto.caption}
                {foto.caption && foto.guestName ? " — " : ""}
                {foto.guestName}
              </p>
            ) : null}

            {/*
              Un solo botón, ancho y sin confirmación. Pedir "¿estás seguro?"
              en el momento en que hay que sacar algo de una pantalla es
              exactamente el momento en que no hay que preguntar nada.
            */}
            <form action={revisarFoto} className="p-4">
              <input type="hidden" name="eventoId" value={evento.id} />
              <input type="hidden" name="mediaId" value={foto.id} />
              <input type="hidden" name="accion" value="OCULTAR" />
              <button
                type="submit"
                className="w-full rounded-xl px-6 py-4 text-lg font-extrabold"
                style={{ background: "var(--slf-violeta)", color: "white" }}
              >
                Sacar de la pantalla
              </button>
            </form>
          </li>
        ))}
      </ul>

      <p className="mt-12 text-sm" style={{ color: "var(--slf-tinta-suave)" }}>
        La pantalla del salón se abre con el código{" "}
        <strong className="font-extrabold tracking-[0.15em]">{evento.screenCode}</strong>. No se
        comparte con los invitados.
      </p>
    </main>
  );
}
