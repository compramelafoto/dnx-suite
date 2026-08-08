import type {
  PhotoPromptDifficulty,
  PhotoPromptInspirationType,
} from "@repo/photo-prompt-library";
import {
  PHOTO_PROMPT_DIFFICULTIES,
  PHOTO_PROMPT_INSPIRATION_TYPES,
} from "@repo/photo-prompt-library";
import { DIFFICULTY_LABELS, INSPIRATION_TYPE_LABELS } from "./labels";

export type PromptLibraryFormTheme = {
  id: string;
  name: string;
  subthemes: { id: string; name: string; themeId: string }[];
};

export type PromptLibraryFormValues = {
  title?: string;
  description?: string;
  themeId?: string;
  subthemeId?: string | null;
  inspirationType?: PhotoPromptInspirationType | null;
  inspirationLabel?: string | null;
  inspirationNotes?: string | null;
  tags?: string[];
  difficulty?: PhotoPromptDifficulty;
  language?: string;
  universal?: boolean;
};

export function PromptLibraryForm({
  action,
  themes,
  values,
  submitLabel,
  showChangeSummary = false,
}: {
  action: (formData: FormData) => void | Promise<void>;
  themes: PromptLibraryFormTheme[];
  values?: PromptLibraryFormValues;
  submitLabel: string;
  showChangeSummary?: boolean;
}) {
  const v = values ?? {};
  return (
    <form action={action} className="space-y-6" data-testid="prompt-library-form">
      <label className="block space-y-2 text-sm">
        <span className="text-fr-muted">Título</span>
        <input
          name="title"
          required
          defaultValue={v.title ?? ""}
          className="w-full rounded-lg border border-fr-border bg-fr-bg px-3 py-2.5"
        />
      </label>

      <label className="block space-y-2 text-sm">
        <span className="text-fr-muted">Descripción / consigna</span>
        <textarea
          name="description"
          required
          rows={5}
          defaultValue={v.description ?? ""}
          className="w-full rounded-lg border border-fr-border bg-fr-bg px-3 py-2.5"
        />
      </label>

      <div className="grid gap-4 md:grid-cols-2">
        <label className="block space-y-2 text-sm">
          <span className="text-fr-muted">Temática</span>
          <select
            name="themeId"
            required={themes.length > 0}
            defaultValue={v.themeId ?? ""}
            className="w-full rounded-lg border border-fr-border bg-fr-bg px-3 py-2.5"
          >
            <option value="">Seleccioná…</option>
            {themes.map((t) => (
              <option key={t.id} value={t.id}>
                {t.name}
              </option>
            ))}
          </select>
        </label>
        <label className="block space-y-2 text-sm">
          <span className="text-fr-muted">Nueva temática (si no está en la lista)</span>
          <input
            name="themeName"
            placeholder="Ej. Luz"
            className="w-full rounded-lg border border-fr-border bg-fr-bg px-3 py-2.5"
          />
        </label>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <label className="block space-y-2 text-sm">
          <span className="text-fr-muted">Subtemática</span>
          <select
            name="subthemeId"
            defaultValue={v.subthemeId ?? ""}
            className="w-full rounded-lg border border-fr-border bg-fr-bg px-3 py-2.5"
          >
            <option value="">Ninguna</option>
            {themes.flatMap((t) =>
              t.subthemes.map((s) => (
                <option key={s.id} value={s.id}>
                  {t.name} · {s.name}
                </option>
              )),
            )}
          </select>
        </label>
        <label className="block space-y-2 text-sm">
          <span className="text-fr-muted">Nueva subtemática</span>
          <input
            name="subthemeName"
            placeholder="Opcional"
            className="w-full rounded-lg border border-fr-border bg-fr-bg px-3 py-2.5"
          />
        </label>
      </div>

      <div className="fr-recuadro space-y-4 border border-fr-border bg-fr-bg-elevated">
        <p className="fr-eyebrow text-gold">Inspiración</p>
        <p className="text-sm leading-relaxed text-fr-muted">
          La inspiración es una referencia editorial. Pedí lenguaje visual (luz, color, ritmo,
          atmósfera); no copies escenas, fotogramas ni obras protegidas.
        </p>
        <div className="grid gap-4 md:grid-cols-2">
          <label className="block space-y-2 text-sm">
            <span className="text-fr-muted">Tipo</span>
            <select
              name="inspirationType"
              defaultValue={v.inspirationType ?? ""}
              className="w-full rounded-lg border border-fr-border bg-fr-bg px-3 py-2.5"
            >
              <option value="">Sin inspiración</option>
              {PHOTO_PROMPT_INSPIRATION_TYPES.map((t) => (
                <option key={t} value={t}>
                  {INSPIRATION_TYPE_LABELS[t]}
                </option>
              ))}
            </select>
          </label>
          <label className="block space-y-2 text-sm">
            <span className="text-fr-muted">Etiqueta</span>
            <input
              name="inspirationLabel"
              defaultValue={v.inspirationLabel ?? ""}
              placeholder="Ej. Wong Kar-wai"
              className="w-full rounded-lg border border-fr-border bg-fr-bg px-3 py-2.5"
            />
          </label>
        </div>
        <label className="block space-y-2 text-sm">
          <span className="text-fr-muted">Notas de inspiración</span>
          <textarea
            name="inspirationNotes"
            rows={3}
            defaultValue={v.inspirationNotes ?? ""}
            className="w-full rounded-lg border border-fr-border bg-fr-bg px-3 py-2.5"
          />
        </label>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <label className="block space-y-2 text-sm md:col-span-1">
          <span className="text-fr-muted">Dificultad</span>
          <select
            name="difficulty"
            defaultValue={v.difficulty ?? "MEDIUM"}
            className="w-full rounded-lg border border-fr-border bg-fr-bg px-3 py-2.5"
          >
            {PHOTO_PROMPT_DIFFICULTIES.map((d) => (
              <option key={d} value={d}>
                {DIFFICULTY_LABELS[d]}
              </option>
            ))}
          </select>
        </label>
        <label className="block space-y-2 text-sm">
          <span className="text-fr-muted">Idioma</span>
          <input
            name="language"
            defaultValue={v.language ?? "es"}
            className="w-full rounded-lg border border-fr-border bg-fr-bg px-3 py-2.5"
          />
        </label>
        <label className="flex items-end gap-3 pb-2 text-sm">
          <input
            type="checkbox"
            name="universal"
            value="1"
            defaultChecked={v.universal ?? true}
            className="size-4 rounded border-fr-border"
          />
          <span className="text-fr-muted">Universal (realizable en cualquier lugar)</span>
        </label>
      </div>

      <label className="block space-y-2 text-sm">
        <span className="text-fr-muted">Etiquetas (separadas por coma)</span>
        <input
          name="tags"
          defaultValue={(v.tags ?? []).join(", ")}
          className="w-full rounded-lg border border-fr-border bg-fr-bg px-3 py-2.5"
        />
      </label>

      {showChangeSummary ? (
        <label className="block space-y-2 text-sm">
          <span className="text-fr-muted">Resumen del cambio</span>
          <input
            name="changeSummary"
            placeholder="Opcional"
            className="w-full rounded-lg border border-fr-border bg-fr-bg px-3 py-2.5"
          />
        </label>
      ) : null}

      <button type="submit" className="fr-btn fr-btn-primary px-6 py-3 text-sm">
        {submitLabel}
      </button>
    </form>
  );
}
