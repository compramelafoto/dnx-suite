"use client";

import { useMemo, useState, useTransition } from "react";
import {
  PHOTO_PROMPT_DIFFICULTIES,
  PHOTO_PROMPT_INSPIRATION_TYPES,
  MAX_PROMPTS_PER_EDITION,
} from "@repo/photo-prompt-library";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { assignLibraryItemsAction } from "@/lib/prompt-library/admin-actions";

export type LibraryPickerItem = {
  id: string;
  title: string;
  description: string;
  themeId: string;
  themeName: string;
  subthemeName: string | null;
  difficulty: string;
  inspirationType: string | null;
  inspirationLabel: string | null;
  inspirationNotes: string | null;
  usageCount: number;
  lastUsedAt: Date | string | null;
  version: number;
};

export type LibraryPickerTheme = {
  id: string;
  name: string;
  slug: string;
};

const DIFFICULTY_LABELS: Record<string, string> = {
  EASY: "Fácil",
  MEDIUM: "Media",
  HARD: "Difícil",
};

const INSPIRATION_LABELS: Record<string, string> = {
  DIRECTOR: "Director/a",
  MOVIE: "Película",
  GENRE: "Género",
  ART_MOVEMENT: "Movimiento artístico",
  PHOTOGRAPHER: "Fotógrafo/a",
  VISUAL_STYLE: "Estilo visual",
  OTHER: "Otra",
};

type Props = {
  editionId: string;
  initialItems: LibraryPickerItem[];
  themes: LibraryPickerTheme[];
  alreadyAssignedCount: number;
  alreadyAssignedLibraryIds: string[];
};

export function LibraryPicker({
  editionId,
  initialItems,
  themes,
  alreadyAssignedCount,
  alreadyAssignedLibraryIds,
}: Props) {
  const [open, setOpen] = useState(false);
  const [text, setText] = useState("");
  const [themeId, setThemeId] = useState("");
  const [difficulty, setDifficulty] = useState("");
  const [inspirationType, setInspirationType] = useState("");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [previewId, setPreviewId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const assignedSet = useMemo(
    () => new Set(alreadyAssignedLibraryIds),
    [alreadyAssignedLibraryIds],
  );

  const filtered = useMemo(() => {
    const q = text.trim().toLowerCase();
    return initialItems.filter((item) => {
      if (themeId && item.themeId !== themeId) return false;
      if (difficulty && item.difficulty !== difficulty) return false;
      if (inspirationType && item.inspirationType !== inspirationType) return false;
      if (!q) return true;
      return (
        item.title.toLowerCase().includes(q) ||
        item.description.toLowerCase().includes(q) ||
        item.themeName.toLowerCase().includes(q) ||
        (item.inspirationLabel?.toLowerCase().includes(q) ?? false)
      );
    });
  }, [initialItems, text, themeId, difficulty, inspirationType]);

  const slotsLeft = Math.max(0, MAX_PROMPTS_PER_EDITION - alreadyAssignedCount);
  const selectedCount = selected.size;
  const totalAfter = alreadyAssignedCount + selectedCount;
  const preview = previewId
    ? initialItems.find((i) => i.id === previewId) ?? null
    : null;

  function toggle(id: string) {
    if (assignedSet.has(id)) return;
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
        return next;
      }
      if (alreadyAssignedCount + next.size >= MAX_PROMPTS_PER_EDITION) {
        setError(`Máximo ${MAX_PROMPTS_PER_EDITION} consignas por edición.`);
        return prev;
      }
      setError(null);
      next.add(id);
      return next;
    });
  }

  function confirm() {
    if (selected.size === 0) {
      setError("Seleccioná al menos una consigna.");
      return;
    }
    startTransition(async () => {
      try {
        setError(null);
        await assignLibraryItemsAction(editionId, [...selected]);
        setSelected(new Set());
        setOpen(false);
      } catch (e) {
        setError(e instanceof Error ? e.message : "No se pudo asignar");
      }
    });
  }

  return (
    <div>
      <Button
        type="button"
        variant="primary"
        className="min-h-11 w-full sm:w-auto"
        onClick={() => setOpen(true)}
      >
        + Elegir de Biblioteca
      </Button>

      {open ? (
        <div
          className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 p-0 sm:items-center sm:p-6"
          role="dialog"
          aria-modal="true"
          aria-labelledby="library-picker-title"
        >
          <div className="flex max-h-[92vh] w-full max-w-4xl flex-col overflow-hidden rounded-t-xl border border-ck-border bg-ck-surface sm:rounded-xl">
            <div className="flex flex-wrap items-start justify-between gap-3 border-b border-ck-border p-4 md:p-5">
              <div>
                <h2 id="library-picker-title" className="text-lg font-semibold">
                  Elegir de Biblioteca
                </h2>
                <p className="mt-1 text-sm text-ck-text-secondary">
                  Solo consignas aprobadas.{" "}
                  <span className="font-medium text-ck-text">
                    {totalAfter} / {MAX_PROMPTS_PER_EDITION} seleccionadas
                  </span>
                  {slotsLeft === 0 ? " · Cupo completo" : ` · ${slotsLeft} disponibles`}
                </p>
              </div>
              <Button
                type="button"
                variant="ghost"
                className="min-h-11"
                onClick={() => setOpen(false)}
              >
                Cerrar
              </Button>
            </div>

            <div className="grid gap-3 border-b border-ck-border p-4 md:grid-cols-4 md:p-5">
              <label className="text-sm md:col-span-2">
                Buscar
                <input
                  value={text}
                  onChange={(e) => setText(e.target.value)}
                  className="mt-2 min-h-11 w-full rounded border border-ck-border bg-transparent px-3 py-2"
                  placeholder="Título, temática, inspiración…"
                />
              </label>
              <label className="text-sm">
                Temática
                <select
                  value={themeId}
                  onChange={(e) => setThemeId(e.target.value)}
                  className="mt-2 min-h-11 w-full rounded border border-ck-border bg-transparent px-3 py-2"
                >
                  <option value="">Todas</option>
                  {themes.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.name}
                    </option>
                  ))}
                </select>
              </label>
              <label className="text-sm">
                Dificultad
                <select
                  value={difficulty}
                  onChange={(e) => setDifficulty(e.target.value)}
                  className="mt-2 min-h-11 w-full rounded border border-ck-border bg-transparent px-3 py-2"
                >
                  <option value="">Todas</option>
                  {PHOTO_PROMPT_DIFFICULTIES.map((d) => (
                    <option key={d} value={d}>
                      {DIFFICULTY_LABELS[d] ?? d}
                    </option>
                  ))}
                </select>
              </label>
              <label className="text-sm md:col-span-2">
                Inspiración
                <select
                  value={inspirationType}
                  onChange={(e) => setInspirationType(e.target.value)}
                  className="mt-2 min-h-11 w-full rounded border border-ck-border bg-transparent px-3 py-2"
                >
                  <option value="">Todas</option>
                  {PHOTO_PROMPT_INSPIRATION_TYPES.map((t) => (
                    <option key={t} value={t}>
                      {INSPIRATION_LABELS[t] ?? t}
                    </option>
                  ))}
                </select>
              </label>
            </div>

            <div className="grid min-h-0 flex-1 gap-4 overflow-hidden md:grid-cols-[1.2fr_0.8fr]">
              <ul className="space-y-2 overflow-y-auto p-4 md:p-5">
                {filtered.length === 0 ? (
                  <li className="text-sm text-ck-text-secondary">
                    No hay consignas aprobadas con esos filtros.
                  </li>
                ) : (
                  filtered.map((item) => {
                    const isAssigned = assignedSet.has(item.id);
                    const isSelected = selected.has(item.id);
                    const reused = item.usageCount > 0;
                    return (
                      <li key={item.id}>
                        <div
                          className={`rounded border px-3 py-3 ${
                            isSelected
                              ? "border-ck-yellow bg-ck-yellow/5"
                              : "border-ck-border"
                          }`}
                        >
                          <div className="flex flex-wrap items-start justify-between gap-2">
                            <label className="flex min-w-0 flex-1 cursor-pointer gap-3">
                              <input
                                type="checkbox"
                                className="mt-1"
                                checked={isSelected || isAssigned}
                                disabled={isAssigned || pending}
                                onChange={() => toggle(item.id)}
                              />
                              <span className="min-w-0 space-y-1">
                                <span className="block font-medium">{item.title}</span>
                                <span className="block text-xs text-ck-text-muted">
                                  {item.themeName}
                                  {item.subthemeName ? ` · ${item.subthemeName}` : ""}
                                  {" · "}
                                  {DIFFICULTY_LABELS[item.difficulty] ?? item.difficulty}
                                  {" · v"}
                                  {item.version}
                                </span>
                                {reused ? (
                                  <span
                                    className="mt-1 block text-xs text-ck-yellow"
                                    role="status"
                                  >
                                    Ya usada {item.usageCount}{" "}
                                    {item.usageCount === 1 ? "vez" : "veces"}
                                    {item.lastUsedAt
                                      ? ` · último uso ${new Date(item.lastUsedAt).toLocaleDateString("es-AR")}`
                                      : ""}
                                    . Revisá si querés reutilizarla.
                                  </span>
                                ) : null}
                                {isAssigned ? (
                                  <Badge variant="neutral" className="mt-1">
                                    Ya asignada
                                  </Badge>
                                ) : null}
                              </span>
                            </label>
                            <Button
                              type="button"
                              variant="ghost"
                              size="sm"
                              onClick={() => setPreviewId(item.id)}
                            >
                              Vista previa
                            </Button>
                          </div>
                        </div>
                      </li>
                    );
                  })
                )}
              </ul>

              <aside className="overflow-y-auto border-t border-ck-border p-4 md:border-l md:border-t-0 md:p-5">
                <h3 className="text-sm font-semibold">Vista previa</h3>
                {preview ? (
                  <article className="mt-3 space-y-3 rounded border border-ck-border p-4">
                    <p className="text-xs uppercase tracking-wide text-ck-text-muted">
                      Vista participante
                    </p>
                    <h4 className="text-lg font-semibold">{preview.title}</h4>
                    <p className="whitespace-pre-wrap text-sm text-ck-text-secondary">
                      {preview.description}
                    </p>
                    {preview.inspirationLabel ? (
                      <div className="border-t border-ck-border pt-3">
                        <p className="text-xs uppercase tracking-wide text-ck-text-muted">
                          Inspiración
                        </p>
                        <p className="mt-1 text-sm font-medium">
                          {preview.inspirationLabel}
                        </p>
                        {preview.inspirationNotes ? (
                          <p className="mt-1 text-sm text-ck-text-secondary">
                            {preview.inspirationNotes}
                          </p>
                        ) : null}
                      </div>
                    ) : null}
                  </article>
                ) : (
                  <p className="mt-3 text-sm text-ck-text-secondary">
                    Seleccioná “Vista previa” en una consigna.
                  </p>
                )}
              </aside>
            </div>

            <div className="flex flex-col gap-3 border-t border-ck-border p-4 sm:flex-row sm:items-center sm:justify-between md:p-5">
              <p className="text-sm text-ck-text-secondary">
                {selectedCount} nuevas · {alreadyAssignedCount} ya en la edición ·{" "}
                {totalAfter}/{MAX_PROMPTS_PER_EDITION}
              </p>
              <div className="flex flex-col gap-2 sm:flex-row">
                {error ? (
                  <p className="text-sm text-red-400" role="alert">
                    {error}
                  </p>
                ) : null}
                <Button
                  type="button"
                  variant="secondary"
                  className="min-h-11"
                  onClick={() => setOpen(false)}
                  disabled={pending}
                >
                  Cancelar
                </Button>
                <Button
                  type="button"
                  variant="primary"
                  className="min-h-11"
                  onClick={confirm}
                  disabled={pending || selectedCount === 0}
                >
                  {pending ? "Asignando…" : "Confirmar selección"}
                </Button>
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
