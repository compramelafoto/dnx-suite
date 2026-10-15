"use client";

import { useCallback, useEffect, useState, type FormEvent } from "react";
import { slugifyFromName } from "@repo/content";
import { BLOG_API_BASE, errorMessage } from "@/lib/blog/admin-client";

/**
 * Alta, edición y baja de categorías, tags y autores del blog. Una sola pantalla para los tres
 * porque se diferencian en dos o tres campos; el molde es el gestor del CMS de Clickatón.
 */
type TaxonomyKind = "categories" | "tags" | "authors";

type TaxonomyRow = {
  id: number;
  name: string;
  slug: string;
  description?: string | null;
  bio?: string | null;
  role?: string | null;
  sortOrder?: number;
  isFeatured?: boolean;
  isActive?: boolean;
  _count?: { posts: number };
};

type FormState = {
  name: string;
  slug: string;
  description: string;
  bio: string;
  role: string;
  sortOrder: string;
  isFeatured: boolean;
  isActive: boolean;
};

const EMPTY_FORM: FormState = {
  name: "",
  slug: "",
  description: "",
  bio: "",
  role: "",
  sortOrder: "0",
  isFeatured: false,
  isActive: true,
};

const COPY: Record<
  TaxonomyKind,
  { createTitle: string; editTitle: string; deleteConfirm: string; empty: string; namePlaceholder: string }
> = {
  categories: {
    createTitle: "Nueva categoría",
    editTitle: "Editar categoría",
    deleteConfirm: "¿Eliminar esta categoría? Sus artículos quedan sin categoría, no se borran.",
    empty: "Todavía no hay categorías. Sirven para ordenar el blog en secciones (Noticias, Salidas, Concursos…).",
    namePlaceholder: "Noticias",
  },
  tags: {
    createTitle: "Nuevo tag",
    editTitle: "Editar tag",
    deleteConfirm: "¿Eliminar este tag? Se quita de todos los artículos.",
    empty: "Todavía no hay tags. Son etiquetas libres que cruzan categorías (retrato, paisaje, analógico…).",
    namePlaceholder: "retrato",
  },
  authors: {
    createTitle: "Nuevo autor",
    editTitle: "Editar autor",
    deleteConfirm: "¿Eliminar este autor? Sus artículos quedan sin autor, no se borran.",
    empty: "Todavía no hay autores. No hacen falta para publicar: un artículo puede salir sin firma.",
    namePlaceholder: "Nombre y apellido",
  },
};

function buildPayload(kind: TaxonomyKind, form: FormState): Record<string, unknown> {
  const base = { name: form.name.trim(), slug: form.slug.trim() || undefined };
  if (kind === "tags") return base;
  if (kind === "categories") {
    return {
      ...base,
      description: form.description.trim() || null,
      sortOrder: Number(form.sortOrder) || 0,
      isFeatured: form.isFeatured,
    };
  }
  return { ...base, bio: form.bio.trim() || null, role: form.role.trim() || null, isActive: form.isActive };
}

export function BlogTaxonomyManager({ kind }: { kind: TaxonomyKind }) {
  const copy = COPY[kind];
  const [items, setItems] = useState<TaxonomyRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [slugManual, setSlugManual] = useState(false);
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`${BLOG_API_BASE}/${kind}`, { credentials: "include" });
      const data = (await res.json().catch(() => ({}))) as Record<string, unknown>;
      if (!res.ok) throw new Error(errorMessage(data, "No se pudo cargar la lista"));
      setItems((data[kind] as TaxonomyRow[]) || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo cargar la lista");
    } finally {
      setLoading(false);
    }
  }, [kind]);

  useEffect(() => {
    void load();
  }, [load]);

  function resetForm() {
    setForm(EMPTY_FORM);
    setSlugManual(false);
    setEditingId(null);
  }

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setSaving(true);
    setError(null);
    try {
      const res = await fetch(editingId ? `${BLOG_API_BASE}/${kind}/${editingId}` : `${BLOG_API_BASE}/${kind}`, {
        method: editingId ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(buildPayload(kind, form)),
      });
      const data = (await res.json().catch(() => ({}))) as Record<string, unknown>;
      if (!res.ok) throw new Error(errorMessage(data, "No se pudo guardar"));
      resetForm();
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo guardar");
    } finally {
      setSaving(false);
    }
  }

  async function remove(id: number) {
    if (!window.confirm(copy.deleteConfirm)) return;
    setError(null);
    const res = await fetch(`${BLOG_API_BASE}/${kind}/${id}`, { method: "DELETE", credentials: "include" });
    if (!res.ok) {
      setError(errorMessage((await res.json().catch(() => ({}))) as Record<string, unknown>, "No se pudo eliminar"));
      return;
    }
    if (editingId === id) resetForm();
    await load();
  }

  function startEdit(item: TaxonomyRow) {
    setEditingId(item.id);
    setSlugManual(true);
    setError(null);
    setForm({
      name: item.name,
      slug: item.slug,
      description: item.description || "",
      bio: item.bio || "",
      role: item.role || "",
      sortOrder: String(item.sortOrder ?? 0),
      isFeatured: Boolean(item.isFeatured),
      isActive: item.isActive !== false,
    });
  }

  return (
    <div className="space-y-6">
      <form onSubmit={handleSubmit} className="fo-card space-y-5">
        <h2 className="text-base font-semibold text-[var(--fo-text)]">{editingId ? copy.editTitle : copy.createTitle}</h2>

        <div className="grid gap-4 sm:grid-cols-2">
          <label className="block">
            <span className="fo-label">Nombre</span>
            <input
              className="fo-input"
              value={form.name}
              onChange={(e) => {
                const name = e.target.value;
                setForm((prev) => ({ ...prev, name, slug: slugManual ? prev.slug : slugifyFromName(name) }));
              }}
              placeholder={copy.namePlaceholder}
              required
            />
          </label>
          <label className="block">
            <span className="fo-label">Dirección (slug)</span>
            <input
              className="fo-input"
              value={form.slug}
              onChange={(e) => {
                setSlugManual(true);
                setForm((prev) => ({ ...prev, slug: e.target.value }));
              }}
              placeholder="se-completa-solo"
            />
            <span className="fo-helper">Es lo que va en la dirección de la página. Se arma solo a partir del nombre.</span>
          </label>
        </div>

        {kind === "categories" ? (
          <>
            <label className="block">
              <span className="fo-label">Descripción</span>
              <textarea
                className="fo-input"
                rows={3}
                value={form.description}
                onChange={(e) => setForm((prev) => ({ ...prev, description: e.target.value }))}
                placeholder="Aparece arriba de la lista de artículos de la categoría y en Google"
              />
            </label>
            <div className="flex flex-wrap items-end gap-6">
              <label className="block">
                <span className="fo-label">Orden</span>
                <input
                  type="number"
                  min={0}
                  className="fo-input w-28"
                  value={form.sortOrder}
                  onChange={(e) => setForm((prev) => ({ ...prev, sortOrder: e.target.value }))}
                />
              </label>
              <label className="flex min-h-11 items-center gap-2 text-sm text-[var(--fo-text-secondary)]">
                <input
                  type="checkbox"
                  checked={form.isFeatured}
                  onChange={(e) => setForm((prev) => ({ ...prev, isFeatured: e.target.checked }))}
                />
                Destacar en el blog
              </label>
            </div>
          </>
        ) : null}

        {kind === "authors" ? (
          <>
            <label className="block">
              <span className="fo-label">Rol</span>
              <input
                className="fo-input"
                value={form.role}
                onChange={(e) => setForm((prev) => ({ ...prev, role: e.target.value }))}
                placeholder="Comisión directiva, socio, fotógrafo invitado…"
              />
            </label>
            <label className="block">
              <span className="fo-label">Biografía</span>
              <textarea
                className="fo-input"
                rows={3}
                value={form.bio}
                onChange={(e) => setForm((prev) => ({ ...prev, bio: e.target.value }))}
              />
            </label>
            <label className="flex min-h-11 items-center gap-2 text-sm text-[var(--fo-text-secondary)]">
              <input
                type="checkbox"
                checked={form.isActive}
                onChange={(e) => setForm((prev) => ({ ...prev, isActive: e.target.checked }))}
              />
              Disponible para firmar artículos
            </label>
          </>
        ) : null}

        {error ? (
          <p className="fo-alert-error" role="alert">
            {error}
          </p>
        ) : null}

        <div className="flex flex-wrap gap-2 border-t border-[var(--fo-border)] pt-4">
          <button type="submit" className="fo-btn fo-btn-primary" disabled={saving}>
            {saving ? "Guardando…" : editingId ? "Guardar cambios" : "Crear"}
          </button>
          {editingId ? (
            <button type="button" className="fo-btn fo-btn-secondary" onClick={resetForm}>
              Cancelar
            </button>
          ) : null}
        </div>
      </form>

      {loading ? (
        <p className="text-sm text-[var(--fo-muted)]">Cargando…</p>
      ) : items.length === 0 ? (
        <div className="fo-card py-10 text-center">
          <p className="mx-auto max-w-md text-sm text-[var(--fo-muted)]">{copy.empty}</p>
        </div>
      ) : (
        <div className="overflow-x-auto rounded-[var(--fo-radius)] border border-[var(--fo-border)]">
          <table className="w-full text-left text-sm">
            <thead className="bg-[var(--fo-bg-elevated)] text-[var(--fo-muted)]">
              <tr>
                <th className="px-4 py-3 font-semibold">Nombre</th>
                <th className="hidden px-4 py-3 font-semibold sm:table-cell">Dirección</th>
                <th className="px-4 py-3 font-semibold w-24">Artículos</th>
                <th className="px-4 py-3 font-semibold w-40" />
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--fo-border)] bg-[var(--fo-surface)]">
              {items.map((item) => (
                <tr key={item.id}>
                  <td className="px-4 py-3 text-[var(--fo-text)]">
                    {item.name}
                    {kind === "authors" && item.isActive === false ? (
                      <span className="ml-2 text-xs text-[var(--fo-muted)]">(inactivo)</span>
                    ) : null}
                  </td>
                  <td className="hidden px-4 py-3 text-[var(--fo-muted)] sm:table-cell">{item.slug}</td>
                  <td className="px-4 py-3 text-[var(--fo-muted)]">{item._count?.posts ?? 0}</td>
                  <td className="px-4 py-3">
                    <div className="flex justify-end gap-1">
                      <button type="button" className="fo-btn fo-btn-ghost text-xs" onClick={() => startEdit(item)}>
                        Editar
                      </button>
                      <button
                        type="button"
                        className="fo-btn fo-btn-ghost text-xs text-[var(--fo-danger)]"
                        onClick={() => void remove(item.id)}
                      >
                        Eliminar
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
