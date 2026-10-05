import Link from "next/link";
import { Star } from "lucide-react";
import { prisma } from "@repo/db";
import { PageHeader } from "@/components/page-header";
import { CopyCaptionButton } from "@/components/placas/copy-caption-button";
import { requireCommunicationsViewer } from "@/lib/placas/access";
import { placaSpecialty, placaZone, placaPhoto } from "@/lib/placas/values";
import { spotlightCaption, answeredQuestions } from "@/lib/spotlight/about";
import {
  ensureCurrentSpotlightSafe,
  listSpotlightHistory,
  loadCurrentSpotlight,
  roundProgress,
} from "@/lib/spotlight/repository";
import { spotlightWeekLabel } from "@/lib/spotlight/week";
import { setSpotlightPublishedAction, skipSpotlightAction } from "@/app/actions/placas";
import type { PlacaFormat } from "@/lib/placas/constants";

export const dynamic = "force-dynamic";

const fecha = (v: Date) =>
  new Intl.DateTimeFormat("es-AR", { dateStyle: "medium", timeZone: "America/Argentina/Buenos_Aires" }).format(v);

function urlPlaca(memberId: string, format: PlacaFormat, descargar = false) {
  return `/api/comunicacion/placas/${memberId}/socio-semana/${format}${descargar ? "?descargar=1" : ""}`;
}

function esTablaAusente(error: unknown): boolean {
  const message = error instanceof Error ? error.message : String(error);
  return /(?:table|relation).*does not exist|P2021/i.test(message);
}

/**
 * Comunicación → Socio de la semana.
 *
 * Comunicación ve al socio recién el viernes, sin anticipación (diseño: decisión B). Si la tarea
 * de los viernes no corrió, abrir esta pantalla lo elige.
 */
export default async function SocioDeLaSemanaPage({
  searchParams,
}: {
  searchParams: Promise<{ ok?: string; error?: string }>;
}) {
  const { workspace, canManage } = await requireCommunicationsViewer();
  const params = await searchParams;

  let faltaMigracion = false;
  let actual: Awaited<ReturnType<typeof loadCurrentSpotlight>> = null;
  let historia: Awaited<ReturnType<typeof listSpotlightHistory>> = [];
  let vuelta = { round: 1, done: 0, total: 0 };
  try {
    await ensureCurrentSpotlightSafe(workspace.id);
    [actual, historia, vuelta] = await Promise.all([
      loadCurrentSpotlight(workspace.id),
      listSpotlightHistory(workspace.id),
      roundProgress(workspace.id),
    ]);
  } catch (error) {
    if (!esTablaAusente(error)) throw error;
    faltaMigracion = true;
  }

  const branding = await prisma.fotofficeWorkspaceBranding.findUnique({
    where: { workspaceId: workspace.id },
    select: { commercialName: true },
  });
  const institucion = branding?.commercialName?.trim() || workspace.name;

  return (
    <div className="space-y-8">
      <PageHeader
        title="Socio de la semana"
        description="Cada viernes a las 00:00 el sistema elige un socio al azar, sin repetir hasta que salieron todos. Acá está su placa y el texto para compartirlo en redes."
        actions={
          canManage ? (
            <Link href="/comunicacion/plantillas" className="fo-btn fo-btn-secondary text-sm">
              Diseñar la placa
            </Link>
          ) : null
        }
      />

      {params.error ? (
        <p className="fo-alert-error p-4 text-sm" role="alert">
          {params.error}
        </p>
      ) : null}
      {params.ok ? (
        <p className="fo-alert-success p-4 text-sm" role="status">
          {params.ok}
        </p>
      ) : null}

      {faltaMigracion ? (
        <section className="fo-card space-y-2 p-8">
          <p className="text-sm font-medium">El Socio de la semana todavía no está habilitado.</p>
          <p className="text-xs leading-relaxed text-[var(--fo-muted)]">
            Falta crear sus tablas en la base de datos. Es una migración pendiente, no un error de
            esta pantalla.
          </p>
        </section>
      ) : actual ? (
        <Actual actual={actual} institucion={institucion} canManage={canManage} />
      ) : (
        <div className="fo-card flex items-center gap-3 p-6 text-sm text-[var(--fo-muted)]">
          <Star className="h-5 w-5" aria-hidden />
          Esta semana no hay socio destacado: no hay socios activos para elegir.
        </div>
      )}

      {!faltaMigracion && vuelta.total > 0 ? (
        <p className="text-xs text-[var(--fo-muted)]">
          Vuelta {vuelta.round}: ya salieron {vuelta.done} de {vuelta.total} socios activos.
        </p>
      ) : null}

      {historia.length > 0 ? (
        <section className="space-y-3">
          <h2 className="text-sm font-semibold">Historial</h2>
          <div className="fo-card overflow-x-auto p-0">
            <table className="min-w-full text-left text-sm">
              <thead className="border-b border-[var(--fo-border)] text-[var(--fo-muted-soft)]">
                <tr>
                  <th className="px-5 py-3 font-medium">Semana</th>
                  <th className="px-5 py-3 font-medium">Socio</th>
                  <th className="px-5 py-3 font-medium">Placa</th>
                </tr>
              </thead>
              <tbody>
                {historia.map((h) => (
                  <tr key={h.id} className="border-b border-[var(--fo-border)]">
                    <td className="px-5 py-3 text-[var(--fo-muted)]">
                      {spotlightWeekLabel(h.weekStart)}
                      <span className="block text-xs">Vuelta {h.round}</span>
                    </td>
                    <td className="px-5 py-3">
                      <span className={h.skippedAt ? "text-[var(--fo-muted)] line-through" : ""}>
                        {h.memberName}
                      </span>
                      {h.skippedAt ? (
                        <span className="block text-xs text-[var(--fo-muted)]">
                          Salteado{h.skippedByName ? ` por ${h.skippedByName}` : ""}
                          {h.skipReason ? `: ${h.skipReason}` : ""}
                        </span>
                      ) : null}
                    </td>
                    <td className="px-5 py-3 text-xs">
                      {h.skippedAt ? null : (
                        <span className="flex flex-wrap items-center gap-3">
                          <a href={urlPlaca(h.memberId, "cuadrada", true)} className="underline underline-offset-2">
                            Cuadrada
                          </a>
                          <a href={urlPlaca(h.memberId, "historia", true)} className="underline underline-offset-2">
                            Historia
                          </a>
                          <span className="text-[var(--fo-muted)]">
                            {h.publishedAt ? `Publicada el ${fecha(h.publishedAt)}` : "Sin publicar"}
                          </span>
                        </span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      ) : null}
    </div>
  );
}

function Actual({
  actual,
  institucion,
  canManage,
}: {
  actual: NonNullable<Awaited<ReturnType<typeof loadCurrentSpotlight>>>;
  institucion: string;
  canManage: boolean;
}) {
  const m = actual.member;
  const foto = placaPhoto(m);
  const texto = spotlightCaption({
    firstName: m.firstName,
    lastName: m.lastName,
    instagram: m.instagram,
    institutionName: institucion,
    specialty: placaSpecialty(m.specialties),
    zone: placaZone(m),
    about: actual.about,
  });
  const respuestas = answeredQuestions(actual.about).length;
  const fotosElegidas = actual.about?.featuredPhotoUrls.length ?? 0;

  return (
    <section className="fo-card space-y-5 p-5">
      <div className="flex flex-wrap items-start gap-4">
        {foto ? (
          // eslint-disable-next-line @next/next/no-img-element -- foto de R2
          <img src={foto} alt="" className="h-16 w-16 rounded-full object-cover" />
        ) : (
          <div className="flex h-16 w-16 items-center justify-center rounded-full bg-[var(--fo-surface-muted)] text-xs text-[var(--fo-muted)]">
            sin foto
          </div>
        )}
        <div className="min-w-0 flex-1 space-y-1">
          <p className="text-xs font-medium uppercase tracking-wide text-[var(--fo-muted)]">
            {spotlightWeekLabel(actual.weekStart)}
          </p>
          <h2 className="text-lg font-semibold">
            {m.firstName} {m.lastName}
          </h2>
          <p className="text-xs text-[var(--fo-muted)]">
            Contestó {respuestas} de 8 preguntas de «Más sobre mí» · eligió {fotosElegidas} de 3 fotos
            {actual.publishedAt
              ? ` · publicada el ${fecha(actual.publishedAt)}${actual.publishedByName ? ` por ${actual.publishedByName}` : ""}`
              : ""}
          </p>
          {!foto ? (
            <p className="text-xs text-[var(--fo-warning)]">
              No tiene foto de perfil: la placa sale con sus iniciales. Conviene pedírsela.
            </p>
          ) : null}
        </div>
      </div>

      <div className="flex flex-wrap gap-2">
        <a href={urlPlaca(m.id, "cuadrada", true)} className="fo-btn fo-btn-primary text-xs">
          Descargar cuadrada
        </a>
        <a href={urlPlaca(m.id, "historia", true)} className="fo-btn fo-btn-secondary text-xs">
          Descargar historia
        </a>
        <CopyCaptionButton text={texto} />
        <form action={setSpotlightPublishedAction}>
          <input type="hidden" name="spotlightId" value={actual.id} />
          <input type="hidden" name="published" value={actual.publishedAt ? "0" : "1"} />
          <button type="submit" className="fo-btn fo-btn-ghost text-xs">
            {actual.publishedAt ? "Marcar como no publicada" : "Marcar como publicada"}
          </button>
        </form>
      </div>

      <div className="grid gap-4 md:grid-cols-[1fr_auto]">
        <div className="flex flex-wrap items-start gap-3">
          {/* eslint-disable-next-line @next/next/no-img-element -- PNG que se dibuja al pedirlo */}
          <img
            src={urlPlaca(m.id, "cuadrada")}
            alt={`Placa del socio de la semana ${m.firstName} ${m.lastName}, cuadrada`}
            className="w-full max-w-xs rounded-lg border border-[var(--fo-border)]"
          />
          {/* eslint-disable-next-line @next/next/no-img-element -- PNG que se dibuja al pedirlo */}
          <img
            src={urlPlaca(m.id, "historia")}
            alt={`Placa del socio de la semana ${m.firstName} ${m.lastName}, historia`}
            loading="lazy"
            className="w-40 rounded-lg border border-[var(--fo-border)]"
          />
        </div>
        <p className="max-w-sm whitespace-pre-line rounded-lg border border-[var(--fo-border)] p-3 text-xs leading-relaxed">
          {texto}
        </p>
      </div>

      {canManage ? (
        <details>
          <summary className="cursor-pointer text-xs text-[var(--fo-muted)] underline underline-offset-2">
            Saltear a este socio
          </summary>
          <form action={skipSpotlightAction} className="mt-3 flex flex-wrap items-end gap-2">
            <input type="hidden" name="spotlightId" value={actual.id} />
            <label className="fo-field-stack min-w-64 flex-1">
              <span className="fo-label">Motivo (opcional)</span>
              <input
                name="reason"
                maxLength={200}
                placeholder="Pidió no salir, dejó de estar activo…"
                className="fo-input"
              />
            </label>
            <button type="submit" className="fo-btn fo-btn-danger-outline text-xs">
              Saltear y elegir otro
            </button>
          </form>
          <p className="fo-helper mt-2">
            Se elige otro socio al azar para esta semana. El salteado no vuelve a salir en esta
            vuelta.
          </p>
        </details>
      ) : null}
    </section>
  );
}
