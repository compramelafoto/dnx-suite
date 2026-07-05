"use client";

import { useEffect, useState } from "react";
import Button from "@/components/ui/Button";
import Input from "@/components/ui/Input";
import Textarea from "@/components/ui/Textarea";
import { slugifyBlogFromName } from "@/lib/blog/slugify-blog";

type Category = {
  id: number;
  name: string;
  slug: string;
  description: string | null;
  sortOrder: number;
  isFeatured: boolean;
  _count?: { posts: number };
};

export default function BlogCategoryManager() {
  const [items, setItems] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState({ name: "", slug: "", description: "", sortOrder: "0", isFeatured: false });
  const [slugManual, setSlugManual] = useState(false);
  const [saving, setSaving] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function load() {
    setLoading(true);
    try {
      const res = await fetch("/api/admin/blog/categories", { credentials: "include" });
      const data = await res.json().catch(() => ({}));
      setItems(data.categories || []);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
  }, []);

  function resetForm() {
    setForm({ name: "", slug: "", description: "", sortOrder: "0", isFeatured: false });
    setSlugManual(false);
    setEditingId(null);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    const payload = {
      name: form.name.trim(),
      slug: form.slug.trim() || undefined,
      description: form.description.trim() || null,
      sortOrder: Number(form.sortOrder) || 0,
      isFeatured: form.isFeatured,
    };
    try {
      const res = await fetch(
        editingId ? `/api/admin/blog/categories/${editingId}` : "/api/admin/blog/categories",
        {
          method: editingId ? "PATCH" : "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify(payload),
        }
      );
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.details || data.error || "Error guardando");
      resetForm();
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error guardando");
    } finally {
      setSaving(false);
    }
  }

  async function remove(id: number) {
    if (!window.confirm("¿Eliminar esta categoría? Los artículos quedarán sin categoría.")) return;
    const res = await fetch(`/api/admin/blog/categories/${id}`, { method: "DELETE", credentials: "include" });
    if (res.ok) await load();
  }

  return (
    <div className="space-y-6">
      <form onSubmit={handleSubmit} className="rounded-xl border border-gray-200 bg-white p-4 space-y-3">
        <h2 className="font-semibold text-gray-900">{editingId ? "Editar categoría" : "Nueva categoría"}</h2>
        <div className="grid gap-3 sm:grid-cols-2">
          <Input
            value={form.name}
            onChange={(e) => {
              const name = e.target.value;
              setForm((f) => ({
                ...f,
                name,
                slug: slugManual ? f.slug : slugifyBlogFromName(name),
              }));
            }}
            placeholder="Nombre"
            required
          />
          <Input
            value={form.slug}
            onChange={(e) => {
              setSlugManual(true);
              setForm((f) => ({ ...f, slug: e.target.value }));
            }}
            placeholder="slug-url"
            required
          />
        </div>
        <Textarea
          value={form.description}
          onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
          placeholder="Descripción"
          rows={2}
        />
        <div className="flex flex-wrap gap-4 items-center">
          <Input
            type="number"
            value={form.sortOrder}
            onChange={(e) => setForm((f) => ({ ...f, sortOrder: e.target.value }))}
            placeholder="Orden"
            className="w-24"
          />
          <label className="flex items-center gap-2 text-sm text-gray-700">
            <input
              type="checkbox"
              checked={form.isFeatured}
              onChange={(e) => setForm((f) => ({ ...f, isFeatured: e.target.checked }))}
            />
            Destacada en home del blog
          </label>
        </div>
        {error ? <p className="text-sm text-red-600">{error}</p> : null}
        <div className="flex gap-2">
          <Button type="submit" disabled={saving}>
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
        <p className="text-gray-500">Cargando...</p>
      ) : (
        <div className="rounded-xl border border-gray-200 overflow-hidden">
          <table className="min-w-full text-sm divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-2 text-left">Nombre</th>
                <th className="px-4 py-2 text-left">Slug</th>
                <th className="px-4 py-2 text-left">Artículos</th>
                <th className="px-4 py-2 text-right">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200 bg-white">
              {items.map((item) => (
                <tr key={item.id}>
                  <td className="px-4 py-3">{item.name}</td>
                  <td className="px-4 py-3 text-gray-600">{item.slug}</td>
                  <td className="px-4 py-3">{item._count?.posts ?? 0}</td>
                  <td className="px-4 py-3 text-right space-x-2">
                    <button
                      type="button"
                      className="text-[#c27b3d] hover:underline"
                      onClick={() => {
                        setEditingId(item.id);
                        setSlugManual(true);
                        setForm({
                          name: item.name,
                          slug: item.slug,
                          description: item.description || "",
                          sortOrder: String(item.sortOrder),
                          isFeatured: item.isFeatured,
                        });
                      }}
                    >
                      Editar
                    </button>
                    <button type="button" className="text-red-600 hover:underline" onClick={() => void remove(item.id)}>
                      Eliminar
                    </button>
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
