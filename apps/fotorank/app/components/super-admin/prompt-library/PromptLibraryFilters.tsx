import type { PhotoPromptDifficulty, PhotoPromptStatus } from "@repo/photo-prompt-library";
import {
  DIFFICULTY_LABELS,
  PHOTO_PROMPT_DIFFICULTIES,
  PHOTO_PROMPT_LIBRARY_STATUSES,
  STATUS_LABELS,
} from "./filter-constants";

export type PromptLibraryFilterValues = {
  q?: string;
  themeId?: string;
  status?: string;
  difficulty?: string;
  universal?: string;
  inspiration?: string;
};

type ThemeOption = { id: string; name: string };

export function PromptLibraryFilters({
  themes,
  values,
  action = "/super-admin/consignas",
}: {
  themes: ThemeOption[];
  values: PromptLibraryFilterValues;
  action?: string;
}) {
  return (
    <form
      method="get"
      action={action}
      className="fr-recuadro space-y-4 border border-fr-border bg-fr-card"
      data-testid="prompt-library-filters"
    >
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        <label className="block space-y-2 text-sm">
          <span className="text-fr-muted">Buscar</span>
          <input
            name="q"
            defaultValue={values.q ?? ""}
            placeholder="Título, descripción, etiquetas…"
            className="w-full rounded-lg border border-fr-border bg-fr-bg px-3 py-2.5"
          />
        </label>
        <label className="block space-y-2 text-sm">
          <span className="text-fr-muted">Temática</span>
          <select
            name="themeId"
            defaultValue={values.themeId ?? ""}
            className="w-full rounded-lg border border-fr-border bg-fr-bg px-3 py-2.5"
          >
            <option value="">Todas</option>
            {themes.map((t) => (
              <option key={t.id} value={t.id}>
                {t.name}
              </option>
            ))}
          </select>
        </label>
        <label className="block space-y-2 text-sm">
          <span className="text-fr-muted">Estado</span>
          <select
            name="status"
            defaultValue={values.status ?? ""}
            className="w-full rounded-lg border border-fr-border bg-fr-bg px-3 py-2.5"
          >
            <option value="">Todos</option>
            {PHOTO_PROMPT_LIBRARY_STATUSES.map((s) => (
              <option key={s} value={s}>
                {STATUS_LABELS[s as PhotoPromptStatus]}
              </option>
            ))}
          </select>
        </label>
        <label className="block space-y-2 text-sm">
          <span className="text-fr-muted">Dificultad</span>
          <select
            name="difficulty"
            defaultValue={values.difficulty ?? ""}
            className="w-full rounded-lg border border-fr-border bg-fr-bg px-3 py-2.5"
          >
            <option value="">Todas</option>
            {PHOTO_PROMPT_DIFFICULTIES.map((d) => (
              <option key={d} value={d}>
                {DIFFICULTY_LABELS[d as PhotoPromptDifficulty]}
              </option>
            ))}
          </select>
        </label>
        <label className="block space-y-2 text-sm">
          <span className="text-fr-muted">Universal</span>
          <select
            name="universal"
            defaultValue={values.universal ?? ""}
            className="w-full rounded-lg border border-fr-border bg-fr-bg px-3 py-2.5"
          >
            <option value="">Todas</option>
            <option value="1">Sí</option>
            <option value="0">No</option>
          </select>
        </label>
        <label className="block space-y-2 text-sm">
          <span className="text-fr-muted">Inspiración</span>
          <select
            name="inspiration"
            defaultValue={values.inspiration ?? ""}
            className="w-full rounded-lg border border-fr-border bg-fr-bg px-3 py-2.5"
          >
            <option value="">Todas</option>
            <option value="1">Con inspiración</option>
            <option value="0">Sin inspiración</option>
          </select>
        </label>
      </div>
      <div className="flex flex-wrap gap-3">
        <button type="submit" className="fr-btn fr-btn-primary px-5 py-2.5 text-sm">
          Filtrar
        </button>
        <a href={action} className="fr-btn fr-btn-secondary px-5 py-2.5 text-sm">
          Limpiar
        </a>
      </div>
    </form>
  );
}
