import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { getHistory, getItem, getUsage, listThemes } from "@repo/photo-prompt-library";
import { ParticipantPromptPreview } from "../../../../components/super-admin/prompt-library/ParticipantPromptPreview";
import { PromptLibraryForm } from "../../../../components/super-admin/prompt-library/PromptLibraryForm";
import { PromptStatusBadge } from "../../../../components/super-admin/prompt-library/PromptStatusBadge";
import {
  DIFFICULTY_LABELS,
  INSPIRATION_TYPE_LABELS,
  formatDateTime,
} from "../../../../components/super-admin/prompt-library/labels";
import { requireAuth } from "../../../../lib/auth";
import { userIsFotorankSuperAdmin } from "../../../../lib/fotorank/access/super-admin";
import { routes } from "../../../../lib/routes";
import {
  approveConsignaAction,
  archiveConsignaAction,
  duplicateConsignaAction,
  rejectConsignaAction,
  restoreConsignaAction,
  submitConsignaReviewAction,
  updateConsignaAction,
} from "../actions";

type Params = Promise<{ id: string }>;
type SearchParams = Promise<Record<string, string | string[] | undefined>>;

export default async function ConsignaDetailPage({
  params,
  searchParams,
}: {
  params: Params;
  searchParams: SearchParams;
}) {
  const user = await requireAuth();
  if (!userIsFotorankSuperAdmin(user)) {
    redirect("/mi-actividad");
  }

  const { id } = await params;
  const sp = await searchParams;
  const errorRaw = sp.error;
  const error = Array.isArray(errorRaw) ? errorRaw[0] : errorRaw;

  const [item, history, usage, themes] = await Promise.all([
    getItem(id),
    getHistory(id),
    getUsage(id),
    listThemes(),
  ]);
  if (!item) notFound();

  const canEdit = item.status === "DRAFT" || item.status === "IN_REVIEW" || item.status === "REJECTED";
  const updateAction = updateConsignaAction.bind(null, id);
  const submitAction = submitConsignaReviewAction.bind(null, id);
  const approveAction = approveConsignaAction.bind(null, id);
  const archiveAction = archiveConsignaAction.bind(null, id);
  const restoreAction = restoreConsignaAction.bind(null, id);
  const duplicateAction = duplicateConsignaAction.bind(null, id);
  const rejectAction = rejectConsignaAction.bind(null, id);

  return (
    <div className="space-y-10" data-testid="super-admin-consigna-detail">
      <header className="space-y-4">
        <p className="fr-eyebrow text-gold">Biblioteca de Consignas</p>
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="space-y-3">
            <h1 className="font-sans text-3xl font-semibold tracking-tight">{item.title}</h1>
            <div className="flex flex-wrap items-center gap-3">
              <PromptStatusBadge status={item.status} />
              <span className="text-sm text-fr-muted">v{item.version}</span>
              <span className="text-sm text-fr-muted">
                {item.theme.name}
                {item.subtheme ? ` · ${item.subtheme.name}` : ""}
              </span>
            </div>
          </div>
          <Link
            href={routes.superAdmin.consignas()}
            className="text-sm text-gold hover:underline"
          >
            ← Listado
          </Link>
        </div>
        {error ? (
          <p className="rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-100">
            {error}
          </p>
        ) : null}
        {item.rejectionReason ? (
          <p className="rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-100">
            Motivo de rechazo: {item.rejectionReason}
          </p>
        ) : null}
      </header>

      <section className="flex flex-wrap gap-3" data-testid="consigna-workflow-actions">
        {item.status === "DRAFT" && (
          <form action={submitAction}>
            <button type="submit" className="fr-btn fr-btn-primary px-5 py-2.5 text-sm">
              Enviar a revisión
            </button>
          </form>
        )}
        {item.status === "IN_REVIEW" && (
          <>
            <form action={approveAction}>
              <button type="submit" className="fr-btn fr-btn-primary px-5 py-2.5 text-sm">
                Aprobar
              </button>
            </form>
            <form action={rejectAction} className="flex flex-wrap items-center gap-2">
              <input
                name="reason"
                required
                placeholder="Motivo del rechazo"
                className="min-w-[220px] rounded-lg border border-fr-border bg-fr-bg px-3 py-2 text-sm"
              />
              <button type="submit" className="fr-btn fr-btn-secondary px-5 py-2.5 text-sm">
                Rechazar
              </button>
            </form>
          </>
        )}
        {item.status === "APPROVED" && (
          <form action={archiveAction}>
            <button type="submit" className="fr-btn fr-btn-secondary px-5 py-2.5 text-sm">
              Archivar
            </button>
          </form>
        )}
        {(item.status === "ARCHIVED" || item.status === "REJECTED") && (
          <form action={restoreAction}>
            <button type="submit" className="fr-btn fr-btn-primary px-5 py-2.5 text-sm">
              {item.status === "REJECTED" ? "Restaurar a borrador" : "Restaurar a aprobada"}
            </button>
          </form>
        )}
        <form action={duplicateAction}>
          <button type="submit" className="fr-btn fr-btn-secondary px-5 py-2.5 text-sm">
            Duplicar
          </button>
        </form>
      </section>

      <section className="grid gap-6 lg:grid-cols-2">
        <div className="fr-recuadro space-y-3 border border-fr-border bg-fr-card text-sm">
          <h2 className="text-lg font-semibold">Detalle</h2>
          <p className="whitespace-pre-wrap text-fr-muted">{item.description}</p>
          <dl className="grid gap-2 text-fr-muted">
            <div>
              <dt className="inline text-fr-primary">Dificultad: </dt>
              <dd className="inline">{DIFFICULTY_LABELS[item.difficulty]}</dd>
            </div>
            <div>
              <dt className="inline text-fr-primary">Idioma: </dt>
              <dd className="inline">{item.language}</dd>
            </div>
            <div>
              <dt className="inline text-fr-primary">Universal: </dt>
              <dd className="inline">{item.universal ? "Sí" : "No"}</dd>
            </div>
            <div>
              <dt className="inline text-fr-primary">Etiquetas: </dt>
              <dd className="inline">{item.tags.length ? item.tags.join(", ") : "—"}</dd>
            </div>
            <div>
              <dt className="inline text-fr-primary">Inspiración: </dt>
              <dd className="inline">
                {item.inspirationType
                  ? `${INSPIRATION_TYPE_LABELS[item.inspirationType]}${
                      item.inspirationLabel ? ` · ${item.inspirationLabel}` : ""
                    }`
                  : "—"}
              </dd>
            </div>
            {item.inspirationNotes ? (
              <div>
                <dt className="text-fr-primary">Notas</dt>
                <dd className="mt-1 whitespace-pre-wrap">{item.inspirationNotes}</dd>
              </div>
            ) : null}
            <div>
              <dt className="inline text-fr-primary">Usos: </dt>
              <dd className="inline">{item.usageCount}</dd>
            </div>
            <div>
              <dt className="inline text-fr-primary">Actualizada: </dt>
              <dd className="inline">{formatDateTime(item.updatedAt)}</dd>
            </div>
          </dl>
        </div>

        <ParticipantPromptPreview
          title={item.title}
          description={item.description}
          inspirationLabel={item.inspirationLabel}
          inspirationNotes={item.inspirationNotes}
        />
      </section>

      {canEdit ? (
        <section className="space-y-4">
          <h2 className="text-xl font-semibold tracking-tight">Editar</h2>
          <div className="fr-recuadro border border-fr-border bg-fr-card">
            <PromptLibraryForm
              action={updateAction}
              themes={themes.map((t) => ({
                id: t.id,
                name: t.name,
                subthemes: t.subthemes.map((s) => ({
                  id: s.id,
                  name: s.name,
                  themeId: s.themeId,
                })),
              }))}
              values={{
                title: item.title,
                description: item.description,
                themeId: item.themeId,
                subthemeId: item.subthemeId,
                inspirationType: item.inspirationType,
                inspirationLabel: item.inspirationLabel,
                inspirationNotes: item.inspirationNotes,
                tags: item.tags,
                difficulty: item.difficulty,
                language: item.language,
                universal: item.universal,
              }}
              submitLabel="Guardar cambios"
              showChangeSummary
            />
          </div>
        </section>
      ) : null}

      <section className="grid gap-6 lg:grid-cols-3">
        <div className="space-y-3">
          <h2 className="text-lg font-semibold">Historial de versiones</h2>
          <ul className="space-y-3">
            {history.versions.length === 0 ? (
              <li className="fr-recuadro border border-fr-border bg-fr-card text-sm text-fr-muted">
                Sin versiones.
              </li>
            ) : (
              history.versions.map((v) => (
                <li
                  key={v.id}
                  className="rounded-lg border border-fr-border bg-fr-card px-4 py-3 text-sm"
                >
                  <p className="font-medium text-fr-primary">
                    v{v.version} · {v.title}
                  </p>
                  <p className="mt-1 text-fr-muted">
                    {v.changeSummary || "—"} · {formatDateTime(v.createdAt)}
                  </p>
                </li>
              ))
            )}
          </ul>
        </div>

        <div className="space-y-3">
          <h2 className="text-lg font-semibold">Aprobaciones / auditoría</h2>
          <ul className="space-y-3">
            {history.audits.length === 0 ? (
              <li className="fr-recuadro border border-fr-border bg-fr-card text-sm text-fr-muted">
                Sin eventos.
              </li>
            ) : (
              history.audits.map((a) => (
                <li
                  key={a.id}
                  className="rounded-lg border border-fr-border bg-fr-card px-4 py-3 text-sm"
                >
                  <p className="font-medium text-fr-primary">{a.action}</p>
                  <p className="mt-1 text-fr-muted">
                    {formatDateTime(a.createdAt)}
                    {a.comment ? ` · ${a.comment}` : ""}
                  </p>
                </li>
              ))
            )}
          </ul>
        </div>

        <div className="space-y-3">
          <h2 className="text-lg font-semibold">Usos en ediciones</h2>
          <ul className="space-y-3">
            {usage.assignments.length === 0 ? (
              <li className="fr-recuadro border border-fr-border bg-fr-card text-sm text-fr-muted">
                Nunca utilizada.
              </li>
            ) : (
              usage.assignments.map((u) => (
                <li
                  key={u.id}
                  className="rounded-lg border border-fr-border bg-fr-card px-4 py-3 text-sm"
                >
                  <p className="font-medium text-fr-primary">
                    Edición {u.editionId.slice(0, 8)}… · seq {u.sequence}
                  </p>
                  <p className="mt-1 text-fr-muted">
                    {u.status} · {formatDateTime(u.assignedFromLibraryAt)}
                    {u.libraryVersion != null ? ` · lib v${u.libraryVersion}` : ""}
                  </p>
                </li>
              ))
            )}
          </ul>
        </div>
      </section>
    </div>
  );
}
