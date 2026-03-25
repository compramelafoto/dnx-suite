"use client";

import { useMemo, useState } from "react";
import { Button, FormField, FormSection, IconButton, radius, spacing, useResolvedTheme } from "@repo/design-system";
import { updateContestCategoriesFromModal } from "../../../../../actions/contests";
import { normalizeSlug } from "../../../../../lib/fotorank/slug";

type Contest = NonNullable<
  Awaited<ReturnType<typeof import("../../../../../lib/fotorank/contests").getFotorankContestById>>
>;

type EditableCategory = {
  name: string;
  slug: string;
  description: string;
  maxFiles: number;
};

interface CategoriasModalContentProps {
  contest: Contest;
  onSuccess: () => void;
  onCancel: () => void;
  readOnly?: boolean;
  restrictionMessage?: string | null;
}

export function CategoriasModalContent({ contest, onSuccess, onCancel, readOnly, restrictionMessage }: CategoriasModalContentProps) {
  const theme = useResolvedTheme();
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [categories, setCategories] = useState<EditableCategory[]>(
    contest.categories.length > 0
      ? contest.categories.map((c) => ({
          name: c.name ?? "",
          slug: c.slug ?? "",
          description: c.description ?? "",
          maxFiles: Math.max(1, c.maxFiles ?? 1),
        }))
      : [{ name: "", slug: "", description: "", maxFiles: 1 }],
  );

  const canEdit = !readOnly;

  const controlStyle: React.CSSProperties = useMemo(
    () => ({
      width: "100%",
      boxSizing: "border-box",
      borderRadius: radius.button,
      border: `1px solid ${theme.border.subtle}`,
      background: theme.surface.base,
      color: theme.text.primary,
      padding: `${spacing[3]} ${spacing[4]}`,
      fontSize: "0.95rem",
      outline: "none",
    }),
    [theme, radius.button],
  );

  const updateCategory = (index: number, patch: Partial<EditableCategory>) => {
    setCategories((prev) => {
      const next = [...prev];
      const current = next[index];
      if (!current) return prev;
      next[index] = { ...current, ...patch };
      return next;
    });
  };

  const addCategory = () => {
    setCategories((prev) => [...prev, { name: "", slug: "", description: "", maxFiles: 1 }]);
  };

  const removeCategory = (index: number) => {
    setCategories((prev) => prev.filter((_, i) => i !== index));
  };

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!canEdit) return;

    const normalized = categories.map((c) => ({
      ...c,
      name: c.name.trim(),
      slug: normalizeSlug(c.slug || c.name),
      description: c.description.trim(),
      maxFiles: Math.max(1, Math.floor(c.maxFiles || 1)),
    }));

    const nonEmpty = normalized.filter((c) => c.name !== "");
    if (nonEmpty.length === 0) {
      setError("Agregá al menos una categoría con nombre.");
      return;
    }

    const slugSet = new Set<string>();
    for (const c of nonEmpty) {
      if (!c.slug) {
        setError("Todas las categorías deben tener slug válido.");
        return;
      }
      if (slugSet.has(c.slug)) {
        setError("No puede haber categorías con el mismo slug.");
        return;
      }
      slugSet.add(c.slug);
    }

    setError(null);
    setSaving(true);

    const formData = new FormData();
    formData.set("contestId", contest.id);
    formData.set("categories", JSON.stringify(nonEmpty));

    const result = await updateContestCategoriesFromModal(formData);
    setSaving(false);

    if (result.ok) onSuccess();
    else setError(result.error ?? "No se pudieron guardar las categorías.");
  };

  if (!canEdit) {
    return (
      <div style={{ display: "flex", flexDirection: "column", gap: spacing[6] }}>
        {restrictionMessage ? (
          <div
            style={{
              borderRadius: radius.button,
              border: `1px solid ${theme.border.default}`,
              background: theme.surface.elevated,
              color: theme.text.secondary,
              padding: spacing[4],
              fontSize: "0.875rem",
            }}
          >
            {restrictionMessage}
          </div>
        ) : null}

        {contest.categories.length === 0 ? (
          <p style={{ color: theme.text.secondary, fontSize: "0.9rem" }}>
            No hay categorías definidas.
          </p>
        ) : (
          <ul style={{ display: "grid", gap: spacing[3] }}>
            {contest.categories.map((cat) => (
              <li
                key={cat.id}
                style={{
                  border: `1px solid ${theme.border.subtle}`,
                  background: theme.surface.base,
                  borderRadius: radius.button,
                  padding: `${spacing[3]} ${spacing[4]}`,
                  color: theme.text.primary,
                  fontSize: "0.9rem",
                }}
              >
                {cat.name}
                {cat.maxFiles > 1 ? (
                  <span style={{ marginLeft: spacing[2], color: theme.text.secondary }}>
                    · máx. {cat.maxFiles} archivos
                  </span>
                ) : null}
              </li>
            ))}
          </ul>
        )}

        <div style={{ display: "flex", gap: spacing[3] }}>
          <Button type="button" variant="outline" onClick={onCancel}>
            Cerrar
          </Button>
        </div>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: spacing[6] }}>
      {restrictionMessage ? (
        <div
          style={{
            borderRadius: radius.button,
            border: `1px solid ${theme.border.default}`,
            background: theme.surface.elevated,
            color: theme.text.secondary,
            padding: spacing[4],
            fontSize: "0.875rem",
          }}
        >
          {restrictionMessage}
        </div>
      ) : null}

      {error ? (
        <div
          role="alert"
          style={{
            borderRadius: radius.button,
            border: "1px solid rgba(239, 68, 68, 0.35)",
            background: "rgba(239, 68, 68, 0.1)",
            color: "#fca5a5",
            padding: spacing[4],
            fontSize: "0.875rem",
          }}
        >
          {error}
        </div>
      ) : null}

      <FormSection title="Categorías" description="Agregá, editá o quitá categorías según el estado del concurso." style={{ marginBottom: 0 }}>
        <div style={{ display: "flex", flexDirection: "column", gap: spacing[6] }}>
          {categories.map((cat, index) => (
            <div
              key={index}
              style={{
                border: `1px solid ${theme.border.subtle}`,
                background: theme.surface.base,
                borderRadius: radius.button,
                padding: spacing[4],
              }}
            >
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: spacing[3] }}>
                <strong style={{ color: theme.text.primary, fontSize: "0.9rem" }}>Categoría {index + 1}</strong>
                <IconButton
                  type="button"
                  icon="delete"
                  variant="destructive"
                  size="sm"
                  aria-label={`Eliminar categoría ${index + 1}`}
                  onClick={() => removeCategory(index)}
                  disabled={categories.length <= 1}
                />
              </div>

              <div style={{ display: "grid", gap: spacing[4], gridTemplateColumns: "repeat(2, minmax(0, 1fr))" }}>
                <FormField label="Nombre" htmlFor={`cat-name-${index}`} required>
                  <input
                    id={`cat-name-${index}`}
                    type="text"
                    value={cat.name}
                    onChange={(e) => {
                      const name = e.target.value;
                      updateCategory(index, {
                        name,
                        slug: normalizeSlug(cat.slug || name),
                      });
                    }}
                    placeholder="Ej. Paisaje"
                    style={controlStyle}
                  />
                </FormField>

                <FormField label="Slug" htmlFor={`cat-slug-${index}`} required helperText="Se genera desde el nombre (editable).">
                  <input
                    id={`cat-slug-${index}`}
                    type="text"
                    value={cat.slug}
                    onChange={(e) => updateCategory(index, { slug: normalizeSlug(e.target.value) })}
                    placeholder="paisaje"
                    style={controlStyle}
                  />
                </FormField>

                <div style={{ gridColumn: "1 / -1" }}>
                  <FormField label="Descripción (opcional)" htmlFor={`cat-desc-${index}`}>
                    <textarea
                      id={`cat-desc-${index}`}
                      rows={3}
                      value={cat.description}
                      onChange={(e) => updateCategory(index, { description: e.target.value })}
                      placeholder="Descripción breve de esta categoría"
                      style={{ ...controlStyle, minHeight: "6.5rem", resize: "vertical" }}
                    />
                  </FormField>
                </div>

                <FormField label="Máximo de archivos" htmlFor={`cat-max-${index}`} helperText="Cantidad permitida por participante.">
                  <input
                    id={`cat-max-${index}`}
                    type="number"
                    min={1}
                    value={cat.maxFiles}
                    onChange={(e) => updateCategory(index, { maxFiles: Math.max(1, Number(e.target.value) || 1) })}
                    style={controlStyle}
                  />
                </FormField>
              </div>
            </div>
          ))}

          <Button type="button" variant="outline" onClick={addCategory}>
            Agregar categoría
          </Button>
        </div>
      </FormSection>

      <div style={{ display: "flex", gap: spacing[3] }}>
        <Button type="submit" disabled={saving}>
          {saving ? "Guardando..." : "Guardar"}
        </Button>
        <Button type="button" variant="outline" onClick={onCancel}>
          Cancelar
        </Button>
      </div>
    </form>
  );
}
