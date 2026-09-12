import { notFound, redirect } from "next/navigation";
import { cookies } from "next/headers";
import { DNX_SESSION_COOKIE, getSessionUserByRawToken } from "@repo/auth";
import { prisma } from "@repo/db";
import { PLANTILLAS } from "@/lib/plantillas";
import { resolverTema } from "@/lib/tema";
import { SelectorDePlantilla } from "./selector";

export const dynamic = "force-dynamic";

type Props = { params: Promise<{ id: string }> };

export default async function ElegirPlantilla({ params }: Props) {
  const { id } = await params;

  const almacen = await cookies();
  const token = almacen.get(DNX_SESSION_COOKIE)?.value;
  const usuario = token ? await getSessionUserByRawToken(token) : null;
  if (!usuario) redirect(`/login?next=${encodeURIComponent(`/panel/eventos/${id}/plantilla`)}`);

  const evento = await prisma.subilafotoEvent.findFirst({
    where: { id, sellerProfile: { userId: usuario.id } },
    select: { name: true, code: true, themeTokens: true },
  });
  if (!evento) notFound();

  // Se compara el snapshot guardado contra el catálogo para saber cuál está elegida.
  const tema = resolverTema(evento.themeTokens);
  const actual =
    PLANTILLAS.find((p) => p.tokens.fondo === tema.fondo && p.tokens.acento === tema.acento)
      ?.clave ?? null;

  return (
    <main className="sobre-claro mx-auto max-w-2xl px-6 py-16">
      <h1 className="text-3xl font-extrabold leading-tight">Elegí cómo se ve</h1>
      <p className="mt-3" style={{ color: "var(--slf-tinta-suave)" }}>
        Así van a ver el evento tus invitados en el celular y en la pantalla del salón.
        Podés cambiarla las veces que quieras antes de que arranque.
      </p>

      <SelectorDePlantilla eventoId={id} claveActual={actual} />

      <p className="mt-10 text-sm" style={{ color: "var(--slf-tinta-suave)" }}>
        Para verlo de verdad, abrí{" "}
        <a
          href={`/e/${evento.code}`}
          className="underline decoration-2 underline-offset-4"
          style={{ color: "var(--slf-violeta)" }}
        >
          la página de tus invitados
        </a>
        .
      </p>
    </main>
  );
}
