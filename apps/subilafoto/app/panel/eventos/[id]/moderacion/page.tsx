import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import { cookies } from "next/headers";
import { DNX_SESSION_COOKIE, getSessionUserByRawToken } from "@repo/auth";
import { prisma } from "@repo/db";
import { revisarFoto } from "@/app/actions/moderacion";
import { SELECT_DE_VARIANTES, enlacesDeVariantes } from "@/lib/moderacion/vista";
import { accionesPosibles, exigeMotivo, type AccionDeRevision, type EstadoFoto } from "@/lib/moderacion/revision";
import { estiloBotonDnx } from "@/lib/boton-dnx";

export const dynamic = "force-dynamic";

type Props = {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ error?: string }>;
};

/** Lo que hay que mirar primero va primero. */
const ORDEN: readonly EstadoFoto[] = ["REVIEW_REQUIRED", "BLOCKED", "APPROVED", "HIDDEN"];

const TITULOS: Record<EstadoFoto, string> = {
  REVIEW_REQUIRED: "Esperan que las mires",
  BLOCKED: "Bloqueadas",
  APPROVED: "Publicadas",
  HIDDEN: "Ocultas",
  PROCESSING: "Analizándose",
};

const AYUDAS: Record<EstadoFoto, string> = {
  REVIEW_REQUIRED:
    "El análisis automático no se decidió. No están en la pantalla ni en el álbum hasta que vos digas.",
  BLOCKED: "No se publicaron. Si alguna es un error, podés aprobarla explicando por qué.",
  APPROVED: "Están en la pantalla y en el álbum. Podés ocultar cualquiera en un toque.",
  HIDDEN: "Las sacaste vos de la pantalla. Podés volver a mostrarlas.",
  PROCESSING: "",
};

const TEXTO_DEL_BOTON: Record<AccionDeRevision, string> = {
  APROBAR: "Publicar",
  BLOQUEAR: "Bloquear",
  OCULTAR: "Ocultar",
  RESTAURAR: "Volver a mostrar",
};

export default async function Moderacion({ params, searchParams }: Props) {
  const { id } = await params;
  const { error } = await searchParams;

  const almacen = await cookies();
  const token = almacen.get(DNX_SESSION_COOKIE)?.value;
  const usuario = token ? await getSessionUserByRawToken(token) : null;
  if (!usuario) {
    redirect(`/login?next=${encodeURIComponent(`/panel/eventos/${id}/moderacion`)}`);
  }

  const evento = await prisma.subilafotoEvent.findFirst({
    where: { id, sellerProfile: { userId: usuario.id } },
    select: { id: true, name: true, moderationProfile: true },
  });
  if (!evento) notFound();

  const fotos = await prisma.subilafotoMedia.findMany({
    where: { eventId: evento.id, status: { not: "DELETED" } },
    orderBy: { createdAt: "desc" },
    take: 200,
    select: {
      id: true,
      status: true,
      caption: true,
      createdAt: true,
      variants: SELECT_DE_VARIANTES,
      moderation: {
        orderBy: { decidedAt: "desc" },
        take: 1,
        select: { topLabel: true, topConfidence: true, errorCode: true, overrideReason: true },
      },
    },
  });

  /*
    Se mira la variante reducida, nunca el original: es la regla anti-bypass. Una foto sin
    variante se muestra como un recuadro vacío y se puede decidir igual —lo que no se hace
    es caer al original para tapar el hueco.
  */
  const enlaces = await enlacesDeVariantes(fotos, "panel");
  const conEnlace = fotos.map((f, i) => ({ ...f, enlace: enlaces[i] ?? null }));

  const porEstado = (estado: EstadoFoto) => conEnlace.filter((f) => f.status === estado);
  const enCola = conEnlace.filter((f) => f.status === "PROCESSING").length;

  return (
    <main className="sobre-claro mx-auto max-w-6xl px-6 py-14">
      <Link
        href={`/panel/eventos/${evento.id}`}
        className="text-sm font-extrabold"
        style={{ color: "var(--slf-violeta)" }}
      >
        ← {evento.name}
      </Link>

      <h1 className="mt-5 text-3xl font-extrabold tracking-[-0.02em]">Moderación</h1>
      <p className="mt-3 max-w-[60ch] leading-relaxed" style={{ color: "var(--slf-tinta-suave)" }}>
        Este evento usa el perfil <strong className="font-extrabold">{evento.moderationProfile}</strong>.
        Ninguna foto llega a la pantalla sin pasar por el análisis automático.
        {enCola > 0 ? ` Hay ${enCola} analizándose en este momento.` : ""}
      </p>

      {error ? (
        <p
          role="alert"
          className="mt-6 max-w-[60ch] rounded-xl px-5 py-4"
          style={{ background: "#ff9a9a22", color: "#8a1c1c" }}
        >
          {error}
        </p>
      ) : null}

      {conEnlace.length === 0 ? (
        <p className="mt-14 text-lg" style={{ color: "var(--slf-tinta-suave)" }}>
          Todavía no subió nadie.
        </p>
      ) : (
        ORDEN.map((estado) => {
          const grupo = porEstado(estado);
          if (grupo.length === 0) return null;

          return (
            <section key={estado} className="mt-14">
              <h2 className="text-xl font-extrabold">
                {TITULOS[estado]}{" "}
                <span className="font-normal" style={{ color: "var(--slf-tinta-suave)" }}>
                  ({grupo.length})
                </span>
              </h2>
              <p className="mt-2 max-w-[60ch] text-sm" style={{ color: "var(--slf-tinta-suave)" }}>
                {AYUDAS[estado]}
              </p>

              <ul className="mt-6 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
                {grupo.map((foto) => {
                  const decision = foto.moderation[0];
                  return (
                    <li
                      key={foto.id}
                      className="overflow-hidden rounded-2xl border"
                      style={{ borderColor: "var(--slf-borde)" }}
                    >
                      {/*
                        Sin `next/image`: la URL viene firmada y vence en un
                        minuto, así que no tiene sentido que el optimizador la
                        cachee. Y sin botón de descarga, por la regla del
                        documento 03.
                      */}
                      {foto.enlace ? (
                        /* eslint-disable-next-line @next/next/no-img-element */
                        <img
                          src={foto.enlace}
                          alt={foto.caption ?? "Foto subida por un invitado"}
                          className="aspect-[4/3] w-full bg-black/5 object-cover"
                          loading="lazy"
                        />
                      ) : (
                        <div
                          className="flex aspect-[4/3] w-full items-center justify-center bg-black/5 px-4 text-center text-xs"
                          style={{ color: "var(--slf-tinta-suave)" }}
                        >
                          Todavía no está lista la vista de esta foto.
                        </div>
                      )}

                      <div className="p-4">
                        {decision?.errorCode ? (
                          <p className="text-sm font-extrabold" style={{ color: "#8a1c1c" }}>
                            No se pudo analizar ({decision.errorCode})
                          </p>
                        ) : decision?.topLabel ? (
                          <p className="text-sm font-extrabold">
                            {decision.topLabel}
                            {decision.topConfidence != null
                              ? ` · ${Math.round(decision.topConfidence)}%`
                              : ""}
                          </p>
                        ) : (
                          <p className="text-sm" style={{ color: "var(--slf-tinta-suave)" }}>
                            Sin observaciones
                          </p>
                        )}

                        {decision?.overrideReason ? (
                          <p className="mt-2 text-sm" style={{ color: "var(--slf-tinta-suave)" }}>
                            Lo revisaste: «{decision.overrideReason}»
                          </p>
                        ) : null}

                        {accionesPosibles(foto.status as EstadoFoto).map((accion) => (
                          <form key={accion} action={revisarFoto} className="mt-4">
                            <input type="hidden" name="eventoId" value={evento.id} />
                            <input type="hidden" name="mediaId" value={foto.id} />
                            <input type="hidden" name="accion" value={accion} />

                            {exigeMotivo(foto.status as EstadoFoto, accion) ? (
                              <input
                                type="text"
                                name="motivo"
                                required
                                minLength={10}
                                maxLength={280}
                                placeholder="¿Por qué esta foto sí puede publicarse?"
                                className="mb-3 w-full rounded-lg border px-3 py-2 text-sm"
                                style={{ borderColor: "var(--slf-borde)" }}
                              />
                            ) : null}

                            <button
                              type="submit"
                              style={
                                accion === "APROBAR" || accion === "RESTAURAR"
                                  ? estiloBotonDnx("primario")
                                  : {
                                      ...estiloBotonDnx("secundario"),
                                      color: "var(--slf-violeta)",
                                      border: "1px solid var(--slf-violeta)",
                                    }
                              }
                            >
                              {TEXTO_DEL_BOTON[accion]}
                            </button>
                          </form>
                        ))}
                      </div>
                    </li>
                  );
                })}
              </ul>
            </section>
          );
        })
      )}
    </main>
  );
}
