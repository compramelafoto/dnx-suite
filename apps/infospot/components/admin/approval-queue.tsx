"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import {
  archiveArticleAction,
  publishArticleAction,
  returnArticleWithObservationAction,
} from "@/app/actions/editorial-workflow";

export type ApprovalQueueItem = {
  id: string;
  title: string;
  authorId: number;
  authorLabel: string;
  categoryId: string | null;
  categoryLabel: string;
  coverUrl: string | null;
  submittedAtLabel: string;
  updatedAtLabel: string;
  checklistDone: number;
  checklistTotal: number;
  checklistMissing: string[];
  checklistComplete: boolean;
  sourceName: string | null;
  observation: { message: string; author: string; at: string } | null;
  expectedAction: string;
};

type Props = {
  items: ApprovalQueueItem[];
  filters: {
    redactor: string;
    categoria: string;
    orden: string;
    checklist: string;
  };
  redactores: { id: string; label: string }[];
  categorias: { id: string; label: string }[];
};

export function ApprovalQueue({ items, filters, redactores, categorias }: Props) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [returnFor, setReturnFor] = useState<string | null>(null);
  const [observation, setObservation] = useState("");

  function applyFilters(next: Partial<typeof filters>) {
    const merged = { ...filters, ...next };
    const q = new URLSearchParams();
    if (merged.redactor) q.set("redactor", merged.redactor);
    if (merged.categoria) q.set("categoria", merged.categoria);
    if (merged.orden && merged.orden !== "recientes") q.set("orden", merged.orden);
    if (merged.checklist && merged.checklist !== "todas") q.set("checklist", merged.checklist);
    const qs = q.toString();
    router.push(qs ? `/admin/aprobaciones?${qs}` : "/admin/aprobaciones");
  }

  function run(
    action: () => Promise<{ ok: boolean; message?: string; error?: string }>,
  ) {
    setMessage(null);
    setError(null);
    startTransition(async () => {
      const result = await action();
      if (result.ok) {
        setMessage(result.message ?? "Listo");
        setReturnFor(null);
        setObservation("");
        router.refresh();
      } else {
        setError(result.error ?? "No se pudo completar la acción");
      }
    });
  }

  return (
    <div className="space-y-8">
      <form
        className="grid gap-4 rounded-[var(--is-radius-md)] border border-[var(--is-border)] bg-[var(--is-surface)] p-4 sm:grid-cols-2 lg:grid-cols-4 sm:p-6"
        onSubmit={(e) => e.preventDefault()}
      >
        <label className="space-y-2 text-sm">
          <span className="block text-xs font-semibold uppercase tracking-wide text-[var(--is-muted)]">
            Redactor
          </span>
          <select
            className="min-h-11 w-full rounded-[var(--is-radius-sm)] border border-[var(--is-border)] bg-[var(--is-bg)] px-3"
            value={filters.redactor}
            onChange={(e) => applyFilters({ redactor: e.target.value })}
          >
            <option value="">Todos los redactores</option>
            {redactores.map((r) => (
              <option key={r.id} value={r.id}>
                {r.label}
              </option>
            ))}
          </select>
        </label>
        <label className="space-y-2 text-sm">
          <span className="block text-xs font-semibold uppercase tracking-wide text-[var(--is-muted)]">
            Categoría
          </span>
          <select
            className="min-h-11 w-full rounded-[var(--is-radius-sm)] border border-[var(--is-border)] bg-[var(--is-bg)] px-3"
            value={filters.categoria}
            onChange={(e) => applyFilters({ categoria: e.target.value })}
          >
            <option value="">Todas</option>
            {categorias.map((c) => (
              <option key={c.id} value={c.id}>
                {c.label}
              </option>
            ))}
          </select>
        </label>
        <label className="space-y-2 text-sm">
          <span className="block text-xs font-semibold uppercase tracking-wide text-[var(--is-muted)]">
            Orden
          </span>
          <select
            className="min-h-11 w-full rounded-[var(--is-radius-sm)] border border-[var(--is-border)] bg-[var(--is-bg)] px-3"
            value={filters.orden}
            onChange={(e) => applyFilters({ orden: e.target.value })}
          >
            <option value="recientes">Más recientes</option>
            <option value="antiguas">Más antiguas</option>
          </select>
        </label>
        <label className="space-y-2 text-sm">
          <span className="block text-xs font-semibold uppercase tracking-wide text-[var(--is-muted)]">
            Checklist
          </span>
          <select
            className="min-h-11 w-full rounded-[var(--is-radius-sm)] border border-[var(--is-border)] bg-[var(--is-bg)] px-3"
            value={filters.checklist}
            onChange={(e) => applyFilters({ checklist: e.target.value })}
          >
            <option value="todas">Todas</option>
            <option value="incompleto">Con checklist incompleto</option>
            <option value="listas">Listas para publicar</option>
          </select>
        </label>
      </form>

      {message ? (
        <p className="rounded-[var(--is-radius-sm)] border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-900">
          {message}
        </p>
      ) : null}
      {error ? (
        <p className="rounded-[var(--is-radius-sm)] border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
          {error}
        </p>
      ) : null}

      {items.length === 0 ? (
        <div className="rounded-[var(--is-radius-md)] border border-dashed border-[var(--is-border)] bg-[var(--is-surface)] px-8 py-16 text-center">
          <p className="text-lg font-semibold tracking-tight">No hay notas por aprobar</p>
          <p className="mx-auto mt-3 max-w-md text-sm leading-relaxed text-[var(--is-muted)]">
            Cuando un redactor o colaborador envíe una nota a revisión, aparecerá acá.
          </p>
        </div>
      ) : (
        <ul className="space-y-8">
          {items.map((item) => (
            <li
              key={item.id}
              className="overflow-hidden rounded-[var(--is-radius-md)] border border-[var(--is-border)] bg-[var(--is-surface)]"
            >
              <div className="flex flex-col md:flex-row">
                <div className="relative aspect-[16/10] w-full shrink-0 bg-[var(--is-bg-secondary)] md:aspect-auto md:w-44">
                  {item.coverUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={item.coverUrl}
                      alt=""
                      className="h-full min-h-[9rem] w-full object-cover md:absolute md:inset-0"
                    />
                  ) : (
                    <div className="flex h-full min-h-[9rem] items-center justify-center text-xs text-[var(--is-muted)]">
                      Sin portada
                    </div>
                  )}
                </div>
                <div className="flex min-w-0 flex-1 flex-col gap-4 p-5 sm:p-6">
                  <div className="space-y-2">
                    <p className="text-xs font-semibold uppercase tracking-wide text-[var(--is-muted)]">
                      En revisión · {item.categoryLabel}
                    </p>
                    <h2 className="font-[family-name:var(--font-source-serif)] text-xl font-semibold tracking-tight sm:text-2xl">
                      {item.title}
                    </h2>
                    <p className="text-sm text-[var(--is-text-secondary)]">
                      {item.authorLabel}
                      <span className="mx-2 text-[var(--is-border-strong)]">·</span>
                      Enviada {item.submittedAtLabel}
                      <span className="mx-2 text-[var(--is-border-strong)]">·</span>
                      Actualizada {item.updatedAtLabel}
                    </p>
                    <p className="text-sm text-[var(--is-muted)]">
                      Acción esperada: {item.expectedAction}
                    </p>
                  </div>

                  <div className="flex flex-wrap gap-x-4 gap-y-2 text-xs text-[var(--is-muted)]">
                    <p>
                      Checklist{" "}
                      <span className="font-semibold tabular-nums text-[var(--is-text-secondary)]">
                        {item.checklistDone}/{item.checklistTotal}
                      </span>
                    </p>
                    <p>
                      Fuente:{" "}
                      <span className="text-[var(--is-text-secondary)]">
                        {item.sourceName?.trim() || "Sin indicar"}
                      </span>
                    </p>
                  </div>

                  {item.checklistMissing.length > 0 ? (
                    <p className="text-xs text-amber-900">
                      Falta: {item.checklistMissing.join(" · ")}
                    </p>
                  ) : null}

                  {item.observation ? (
                    <div className="rounded-[var(--is-radius-sm)] border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-950">
                      <span className="font-semibold">Observación previa: </span>
                      {item.observation.message}
                      <span className="mt-1 block text-amber-800/80">
                        {item.observation.author} · {item.observation.at}
                      </span>
                    </div>
                  ) : null}

                  {returnFor === item.id ? (
                    <div className="space-y-3 rounded-[var(--is-radius-sm)] border border-[var(--is-border)] bg-[var(--is-bg)] p-4">
                      <label className="block text-sm font-semibold" htmlFor={`obs-${item.id}`}>
                        Observación para devolver
                      </label>
                      <textarea
                        id={`obs-${item.id}`}
                        value={observation}
                        onChange={(e) => setObservation(e.target.value)}
                        rows={3}
                        className="w-full rounded-[var(--is-radius-sm)] border border-[var(--is-border)] px-3 py-2 text-sm"
                        placeholder="Ej.: Confirmar el nombre completo del organizador y revisar el crédito de portada."
                      />
                      <div className="flex flex-wrap gap-3">
                        <button
                          type="button"
                          disabled={pending || observation.trim().length < 8}
                          className="inline-flex min-h-11 items-center rounded-[var(--is-radius-sm)] bg-amber-700 px-4 text-sm font-semibold text-white disabled:opacity-60"
                          onClick={() =>
                            run(() =>
                              returnArticleWithObservationAction(item.id, observation.trim()),
                            )
                          }
                        >
                          Confirmar devolución
                        </button>
                        <button
                          type="button"
                          className="inline-flex min-h-11 items-center rounded-[var(--is-radius-sm)] border border-[var(--is-border)] px-4 text-sm font-medium"
                          onClick={() => {
                            setReturnFor(null);
                            setObservation("");
                          }}
                        >
                          Cancelar
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div className="flex flex-wrap gap-3 border-t border-[var(--is-border)] pt-4">
                      <a
                        href={`/redaccion/noticias/${item.id}/editar`}
                        className="inline-flex min-h-11 items-center rounded-[var(--is-radius-sm)] border border-[var(--is-border)] px-4 text-sm font-medium"
                      >
                        Abrir nota
                      </a>
                      <button
                        type="button"
                        disabled={pending}
                        className="inline-flex min-h-11 items-center rounded-[var(--is-radius-sm)] bg-[var(--is-accent)] px-4 text-sm font-semibold text-[var(--is-bg)] disabled:opacity-60"
                        onClick={() => {
                          if (
                            !window.confirm(
                              "¿Publicar ahora en el sitio? Debe cumplir el checklist.",
                            )
                          ) {
                            return;
                          }
                          run(() => publishArticleAction(item.id));
                        }}
                      >
                        Publicar ahora
                      </button>
                      <button
                        type="button"
                        disabled={pending}
                        className="inline-flex min-h-11 items-center rounded-[var(--is-radius-sm)] border border-amber-300 px-4 text-sm font-medium text-amber-900 disabled:opacity-60"
                        onClick={() => setReturnFor(item.id)}
                      >
                        Devolver
                      </button>
                      <button
                        type="button"
                        disabled={pending}
                        className="inline-flex min-h-11 items-center px-2 text-sm font-medium text-[var(--is-muted)] underline-offset-2 hover:underline disabled:opacity-60"
                        onClick={() => {
                          if (!window.confirm("¿Archivar esta nota?")) return;
                          run(() => archiveArticleAction(item.id));
                        }}
                      >
                        Archivar
                      </button>
                    </div>
                  )}
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
