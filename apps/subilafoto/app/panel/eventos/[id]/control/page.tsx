import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import { cookies } from "next/headers";
import { DNX_SESSION_COOKIE, getSessionUserByRawToken } from "@repo/auth";
import { prisma } from "@repo/db";
import { condicionDePublicadas } from "@/lib/album";
import { DURACION, SELECT_DE_VARIANTES, enlacesDeVariantes } from "@/lib/moderacion/vista";
import { revisarFoto } from "@/app/actions/moderacion";

export const dynamic = "force-dynamic";
/** Se recarga sola: el fotógrafo no va a estar tocando "actualizar" en la fiesta. */
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
    where: { id, sellerProfile: { userId: usuario.id } },
    select: { id: true, name: true, screenCode: true },
  });
  if (!evento) notFound();

  const enPantalla = await prisma.subilafotoMedia.findMany({
    where: { ...condicionDePublicadas(evento.id), kind: "PHOTO" },
    orderBy: [{ publishedAt: "desc" }],
    take: 60,
    select: { id: true, caption: true, guestName: true, variants: SELECT_DE_VARIANTES },
  });

  // La variante, nunca el original: regla anti-bypass.
  const enlaces = await enlacesDeVariantes(enPantalla, "pantalla", DURACION.proyeccion);

  return (
    <main className="sobre-claro mx-auto max-w-3xl px-4 py-8">
      <Link
        href={`/panel/eventos/${evento.id}`}
        className="text-sm font-extrabold"
        style={{ color: "var(--slf-violeta)" }}
      >
        ← {evento.name}
      </Link>

      <h1 className="mt-4 text-2xl font-extrabold tracking-[-0.02em]">En la pantalla</h1>
      <p className="mt-2 leading-relaxed" style={{ color: "var(--slf-tinta-suave)" }}>
        {enPantalla.length === 0
          ? "Todavía no hay nada proyectándose."
          : "Tocá Sacar y desaparece de la pantalla en el momento. Podés volver a mostrarla después desde Moderación."}
      </p>

      <ul className="mt-8 grid gap-5 sm:grid-cols-2">
        {enPantalla.map((foto, i) => (
          <li
            key={foto.id}
            className="overflow-hidden rounded-2xl border"
            style={{ borderColor: "var(--slf-borde)" }}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={enlaces[i]!}
              alt={foto.caption ?? "Foto en pantalla"}
              className="aspect-[4/3] w-full bg-black/5 object-cover"
              loading={i < 4 ? "eager" : "lazy"}
            />

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
