import { notFound, redirect } from "next/navigation";
import { cookies } from "next/headers";
import { DNX_SESSION_COOKIE, getSessionUserByRawToken } from "@repo/auth";
import { prisma } from "@repo/db";
import { urlDePortada } from "@/lib/portada-url";
import { FormularioDePortada } from "./formulario";

export const dynamic = "force-dynamic";

type Props = { params: Promise<{ id: string }> };

export default async function PortadaDelEvento({ params }: Props) {
  const { id } = await params;

  const almacen = await cookies();
  const token = almacen.get(DNX_SESSION_COOKIE)?.value;
  const usuario = token ? await getSessionUserByRawToken(token) : null;
  if (!usuario) redirect(`/login?next=${encodeURIComponent(`/panel/eventos/${id}/portada`)}`);

  const evento = await prisma.subilafotoEvent.findFirst({
    where: { id, sellerProfile: { userId: usuario.id } },
    select: { name: true, code: true, hostsLabel: true, coverUrl: true },
  });
  if (!evento) notFound();

  return (
    <main className="sobre-claro mx-auto max-w-2xl px-6 py-16">
      <h1 className="text-3xl font-extrabold leading-tight">La portada del evento</h1>
      <p className="mt-3" style={{ color: "var(--slf-tinta-suave)" }}>
        Es lo primero que ve el invitado cuando escanea el código: la foto y de quién es
        la fiesta. Después viene el botón para subir las suyas.
      </p>

      <FormularioDePortada
        eventoId={id}
        anfitrionesIniciales={evento.hostsLabel ?? ""}
        vistaPreviaInicial={await urlDePortada(evento.coverUrl)}
      />

      <p className="mt-10 text-sm" style={{ color: "var(--slf-tinta-suave)" }}>
        Para verlo de verdad, abrí{" "}
        <a
          href={`/e/${evento.code}`}
          className="underline decoration-2 underline-offset-4"
          style={{ color: "var(--slf-violeta-texto)" }}
        >
          la página de tus invitados
        </a>
        .
      </p>
    </main>
  );
}
