import Link from "next/link";
import { prisma } from "@repo/db";
import { PublicarClaseForm } from "@/components/en-vivo/formularios";
import { ReproductorStream } from "@/components/en-vivo/reproductor";
import { requireLive } from "@/lib/en-vivo/acceso";
import { LIVE_RECORDINGS_PATH } from "@/lib/en-vivo/constantes";
import { duracionLegible } from "@/lib/en-vivo/grabaciones";
import { sincronizarGrabaciones, urlDeReproduccion } from "@/lib/en-vivo/store";
import { ETIQUETA_VISIBILIDAD } from "@/lib/en-vivo/visibilidad";

export const dynamic = "force-dynamic";

const FECHA = new Intl.DateTimeFormat("es-AR", {
  timeZone: "America/Argentina/Buenos_Aires",
  weekday: "short",
  day: "2-digit",
  month: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
});

/**
 * Grabaciones: cada vivo grabado, con su reproductor (se arma sólo el de la que se elige, porque
 * cada uno lleva un permiso firmado) y «Publicar como clase» en un curso grabado.
 *
 * Al abrir, se traen de Cloudflare las grabaciones que todavía no estén anotadas: así funciona
 * aunque los avisos (webhooks) no estén configurados.
 */
export default async function GrabacionesPage({ searchParams }: { searchParams: Promise<{ ver?: string }> }) {
  const { workspace } = await requireLive();
  const { ver } = await searchParams;
  await sincronizarGrabaciones(workspace.id);

  const [grabaciones, cursos] = await Promise.all([
    prisma.fotofficeLiveRecording.findMany({
      where: { workspaceId: workspace.id },
      orderBy: { createdAt: "desc" },
      take: 60,
      select: {
        id: true,
        videoUid: true,
        status: true,
        durationSeconds: true,
        recordedAt: true,
        createdAt: true,
        publishedCourseId: true,
        publishedLessonId: true,
        session: { select: { title: true, visibility: true } },
      },
    }),
    prisma.course.findMany({
      where: { workspaceId: workspace.id, deliveryMode: "RECORDED" },
      orderBy: { title: "asc" },
      select: { id: true, title: true },
    }),
  ]);

  if (grabaciones.length === 0) {
    return (
      <p className="fo-card p-6 text-sm text-[var(--fo-muted)]">
        Todavía no hay grabaciones. Cada vivo queda grabado solo y aparece acá unos minutos después de terminar.
      </p>
    );
  }

  const nombreCurso = new Map(cursos.map((c) => [c.id, c.title]));

  return (
    <ul className="space-y-4">
      {grabaciones.map((g) => {
        const abierta = ver === g.id && g.status === "LISTA";
        const url = abierta ? urlDeReproduccion(g.videoUid) : null;
        return (
          <li key={g.id} className="fo-card space-y-3 p-5">
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <h2 className="font-semibold">{g.session.title}</h2>
              <span className="text-xs text-[var(--fo-muted)]">
                {FECHA.format(g.recordedAt ?? g.createdAt)}
                {g.durationSeconds ? ` · ${duracionLegible(g.durationSeconds)}` : ""}
              </span>
            </div>
            <p className="text-xs text-[var(--fo-muted)]">{ETIQUETA_VISIBILIDAD[g.session.visibility]}</p>

            {g.status === "PROCESANDO" ? <p className="text-sm">Procesando la grabación…</p> : null}
            {g.status === "ERROR" ? (
              <p className="text-sm text-[var(--fo-danger)]">Cloudflare no pudo procesar esta grabación.</p>
            ) : null}

            {g.status === "LISTA" ? (
              abierta ? (
                url ? (
                  <ReproductorStream key={g.id} url={url} titulo={g.session.title} />
                ) : (
                  <p className="text-sm text-[var(--fo-muted)]">No se puede reproducir: falta configurar la plataforma.</p>
                )
              ) : (
                <Link href={`${LIVE_RECORDINGS_PATH}?ver=${g.id}`} className="fo-btn fo-btn-secondary text-sm">
                  Ver grabación
                </Link>
              )
            ) : null}

            {g.status === "LISTA" ? (
              g.publishedLessonId ? (
                <p className="text-sm text-[var(--fo-success)]">
                  Publicada como clase
                  {g.publishedCourseId ? (
                    <>
                      {" "}en{" "}
                      <Link href={`/dashboard/courses/${g.publishedCourseId}`} className="underline">
                        {nombreCurso.get(g.publishedCourseId) ?? "el curso"}
                      </Link>
                    </>
                  ) : null}
                  .
                </p>
              ) : (
                <PublicarClaseForm recordingId={g.id} tituloSugerido={g.session.title} cursos={cursos} />
              )
            ) : null}
          </li>
        );
      })}
    </ul>
  );
}
