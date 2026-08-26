"use client";

import { useCallback, useEffect, useState } from "react";
import { slugifyFromName } from "@repo/content";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Textarea } from "@/components/ui/Textarea";
import { CONTENT_ADMIN_API_BASE } from "@/lib/content/clickaton-content-admin-adapter";

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
  {
    collectionKey: string;
    singular: string;
    createTitle: string;
    editTitle: string;
    deleteConfirm: string;
    empty: string;
  }
> = {
  categories: {
    collectionKey: "categories",
    singular: "categoría",
    createTitle: "Nueva categoría",
    editTitle: "Editar categoría",
    deleteConfirm: "¿Eliminar esta categoría? Las notas quedarán sin categoría.",
    empty: "Todavía no hay categorías.",
  },
  tags: {
    collectionKey: "tags",
    singular: "tag",
    createTitle: "Nuevo tag",
    editTitle: "Editar tag",
    deleteConfirm: "¿Eliminar este tag? Se quitará de todas las notas.",
    empty: "Todavía no hay tags.",
  },
  authors: {
    collectionKey: "authors",
    singular: "autor",
    createTitle: "Nuevo autor",
    editTitle: "Editar autor",
    deleteConfirm: "¿Eliminar este autor? Las notas quedarán sin autor.",
    empty: "Todavía no hay autores.",
  },
};

function buildPayload(kind: TaxonomyKind, form: FormState): Record<string, unknown> {
  const base = {
    name: form.name.trim(),
    slug: form.slug.trim() || undefined,
  };
  if (kind === "tags") return base;
  if (kind === "categories") {
    return {
      ...base,
      description: form.description.trim() || null,
      sortOrder: Number(form.sortOrder) || 0,
      isFeatured: form.isFeatured,
    };
  }
  return {
    ...base,
    bio: form.bio.trim() || null,
    role: form.role.trim() || null,
    isActive: form.isActive,
  };
}

export default function ContentTaxonomyManager({ kind }: { kind: TaxonomyKind }) {
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
      const res = await fetch(`${CONTENT_ADMIN_API_BASE}/${kind}`, {
        credentials: "include",
      });
      const data = (await res.json().catch(() => ({}))) as Record<string, unknown>;
      if (!res.ok) throw new Error(String(data.error || "Error cargando"));
      setItems((data[copy.collectionKey] as TaxonomyRow[]) || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error cargando");
    } finally {
      setLoading(false);
    }
  }, [kind, copy.collectionKey]);

  useEffect(() => {
    void load();
  }, [load]);

  function resetForm() {
    setForm(EMPTY_FORM);
    setSlugManual(false);
    setEditingId(null);
  }

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setSaving(true);
    setError(null);
    try {
      const res = await fetch(
        editingId
          ? `${CONTENT_ADMIN_API_BASE}/${kind}/${editingId}`
          : `${CONTENT_ADMIN_API_BASE}/${kind}`,
        {
          method: editingId ? "PATCH" : "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify(buildPayload(kind, form)),
        },
      );
      const data = (await res.json().catch(() => ({}))) as Record<string, unknown>;
      if (!res.ok) throw new Error(String(data.details || data.error || "Error guardando"));
      resetForm();
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error guardando");
    } finally {
      setSaving(false);
    }
  }

  async function remove(id: number) {
    if (!window.confirm(copy.deleteConfirm)) return;
    setError(null);
    const res = await fetch(`${CONTENT_ADMIN_API_BASE}/${kind}/${id}`, {
      method: "DELETE",
      credentials: "include",
    });
    if (!res.ok) {
      const data = (await res.json().catch(() => ({}))) as Record<string, unknown>;
      setError(String(data.error || "Error eliminando"));
      return;
    }
    await load();
  }

  function startEdit(item: TaxonomyRow) {
    setEditingId(item.id);
    setSlugManual(true);
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
    <div className="space-y-8">
      <form
        onSubmit={handleSubmit}
        className="space-y-6 rounded-[var(--ck-radius-card)] border border-ck-border bg-ck-surface p-6 sm:p-8"
      >
        <h2 className="text-lg font-semibold text-ck-text">
          {editingId ? copy.editTitle : copy.createTitle}
        </h2>

        <div className="grid gap-6 sm:grid-cols-2">
          <label className="block space-y-3 text-sm">
            <span className="font-semibold text-ck-text">Nombre</span>
            <Input
              value={form.name}
              onChange={(event) => {
                const name = event.target.value;
                setForm((prev) => ({
                  ...prev,
                  name,
                  slug: slugManual ? prev.slug : slugifyFromName(name),
                }));
              }}
              placeholder="Nombre visible"
              required
            />
          </label>
          <label className="block space-y-3 text-sm">
            <span className="font-semibold text-ck-text">Slug (URL)</span>
            <Input
              value={form.slug}
              onChange={(event) => {
                setSlugManual(true);
                setForm((prev) => ({ ...prev, slug: event.target.value }));
              }}
              placeholder="slug-url"
              required
            />
          </label>
        </div>

        {kind === "categories" ? (
          <>
            <label className="block space-y-3 text-sm">
              <span className="font-semibold text-ck-text">Descripción</span>
              <Textarea
                value={form.description}
                onChange={(event) =>
                  setForm((prev) => ({ ...prev, description: event.target.value }))
                }
                placeholder="Se usa en la portada de la categoría y en buscadores"
                rows={3}
              />
            </label>
            <div className="flex flex-wrap items-end gap-6">
              <label className="space-y-3 text-sm">
                <span className="block font-semibold text-ck-text">Orden</span>
                <Input
                  type="number"
                  className="w-28"
                  value={form.sortOrder}
                  onChange={(event) =>
                    setForm((prev) => ({ ...prev, sortOrder: event.target.value }))
                  }
                />
              </label>
              <label className="flex min-h-11 items-center gap-3 text-sm text-ck-text-secondary">
                <input
                  type="checkbox"
                  checked={form.isFeatured}
                  onChange={(event) =>
                    setForm((prev) => ({ ...prev, isFeatured: event.target.checked }))
                  }
                />
                Destacar en el blog
              </label>
            </div>
          </>
        ) : null}

        {kind === "authors" ? (
          <>
            <label className="block space-y-3 text-sm">
              <span className="font-semibold text-ck-text">Rol</span>
              <Input
                value={form.role}
                onChange={(event) => setForm((prev) => ({ ...prev, role: event.target.value }))}
                placeholder="Equipo Clickatón, fotógrafo invitado…"
              />
            </label>
            <label className="block space-y-3 text-sm">
              <span className="font-semibold text-ck-text">Bio</span>
              <Textarea
                value={form.bio}
                onChange={(event) => setForm((prev) => ({ ...prev, bio: event.target.value }))}
                rows={3}
              />
            </label>
            <label className="flex min-h-11 items-center gap-3 text-sm text-ck-text-secondary">
              <input
                type="checkbox"
                checked={form.isActive}
                onChange={(event) =>
                  setForm((prev) => ({ ...prev, isActive: event.target.checked }))
                }
              />
              Disponible para asignar en notas
            </label>
          </>
        ) : null}

        {error ? (
          <p className="text-sm text-[var(--ck-danger)]" role="alert">
            {error}
          </p>
        ) : null}

        <div className="flex flex-wrap gap-3 border-t border-ck-border pt-6">
          <Button type="submit" variant="primary" disabled={saving}>
            {saving ? "Guardando..." : editingId ? "Actualizar" : "Crear"}
          </Button>
          {editingId ? (
            <Button type="button" variant="secondary" onClick={resetForm}>
              Cancelar
            </Button>
          ) : null}
        </div>
      </form>

      {loading ? (
        <p className="text-sm text-ck-text-muted">Cargando...</p>
      ) : items.length === 0 ? (
        <p className="rounded-[var(--ck-radius-card)] border border-dashed border-ck-border px-6 py-10 text-center text-sm text-ck-text-muted">
          {copy.empty}
        </p>
      ) : (
        <div className="overflow-x-auto rounded-[var(--ck-radius-card)] border border-ck-border">
          <table className="min-w-full divide-y divide-ck-border text-sm">
            <thead className="bg-ck-surface-muted/60">
              <tr>
                <th className="px-4 py-3 text-left font-semibold uppercase tracking-[0.08em] text-ck-text-muted">
                  Nombre
                </th>
                <th className="px-4 py-3 text-left font-semibold uppercase tracking-[0.08em] text-ck-text-muted">
                  Slug
                </th>
                <th className="px-4 py-3 text-left font-semibold uppercase tracking-[0.08em] text-ck-text-muted">
                  Notas
                </th>
                <th className="px-4 py-3 text-right font-semibold uppercase tracking-[0.08em] text-ck-text-muted">
                  Acciones
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-ck-border bg-ck-surface">
              {items.map((item) => (
                <tr key={item.id}>
                  <td className="px-4 py-3 text-ck-text">
                    {item.name}
                    {kind === "authors" && item.isActive === false ? (
                      <span className="ml-2 text-xs text-ck-text-muted">(inactivo)</span>
                    ) : null}
                  </td>
                  <td className="px-4 py-3 text-ck-text-secondary">{item.slug}</td>
                  <td className="px-4 py-3 text-ck-text-secondary">
                    {item._count?.posts ?? 0}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <div className="flex justify-end gap-4">
                      <button
                        type="button"
                        className="font-medium text-ck-yellow hover:underline"
                        onClick={() => startEdit(item)}
                      >
                        Editar
                      </button>
                      <button
                        type="button"
                        className="font-medium text-[var(--ck-danger)] hover:underline"
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
