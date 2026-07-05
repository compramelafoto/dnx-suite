"use client";

import { useEffect, useState } from "react";
import Button from "@/components/ui/Button";
import Input from "@/components/ui/Input";
import Textarea from "@/components/ui/Textarea";
import { slugifyBlogFromName } from "@/lib/blog/slugify-blog";

type Author = {
  id: number;
  name: string;
  slug: string;
  bio: string | null;
  avatarUrl: string | null;
  role: string | null;
  isActive: boolean;
  _count?: { posts: number };
};

export default function BlogAuthorManager() {
  const [items, setItems] = useState<Author[]>([]);
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState({
    name: "",
    slug: "",
    bio: "",
    avatarUrl: "",
    role: "",
    isActive: true,
  });
  const [slugManual, setSlugManual] = useState(false);
  const [saving, setSaving] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function load() {
    setLoading(true);
    try {
      const res = await fetch("/api/admin/blog/authors", { credentials: "include" });
      const data = await res.json().catch(() => ({}));
      setItems(data.authors || []);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
  }, []);

  function resetForm() {
    setForm({ name: "", slug: "", bio: "", avatarUrl: "", role: "", isActive: true });
    setSlugManual(false);
    setEditingId(null);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    try {
      const res = await fetch(editingId ? `/api/admin/blog/authors/${editingId}` : "/api/admin/blog/authors", {
        method: editingId ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          name: form.name.trim(),
          slug: form.slug.trim() || undefined,
          bio: form.bio.trim() || null,
          avatarUrl: form.avatarUrl.trim() || null,
          role: form.role.trim() || null,
          isActive: form.isActive,
        }),
      });
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
    if (!window.confirm("¿Eliminar este autor?")) return;
    const res = await fetch(`/api/admin/blog/authors/${id}`, { method: "DELETE", credentials: "include" });
    if (res.ok) await load();
  }

  return (
    <div className="space-y-6">
      <form onSubmit={handleSubmit} className="rounded-xl border border-gray-200 bg-white p-4 space-y-3">
        <h2 className="font-semibold text-gray-900">{editingId ? "Editar autor" : "Nuevo autor"}</h2>
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
            placeholder="slug"
            required
          />
          <Input
            value={form.role}
            onChange={(e) => setForm((f) => ({ ...f, role: e.target.value }))}
            placeholder="Rol (ej. Fundador)"
          />
          <Input
            value={form.avatarUrl}
            onChange={(e) => setForm((f) => ({ ...f, avatarUrl: e.target.value }))}
            placeholder="URL avatar"
          />
        </div>
        <Textarea
          value={form.bio}
          onChange={(e) => setForm((f) => ({ ...f, bio: e.target.value }))}
          placeholder="Bio"
          rows={3}
        />
        <label className="flex items-center gap-2 text-sm text-gray-700">
          <input
            type="checkbox"
            checked={form.isActive}
            onChange={(e) => setForm((f) => ({ ...f, isActive: e.target.checked }))}
          />
          Autor activo
        </label>
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
                <th className="px-4 py-2 text-left">Rol</th>
                <th className="px-4 py-2 text-left">Artículos</th>
                <th className="px-4 py-2 text-left">Estado</th>
                <th className="px-4 py-2 text-right">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200 bg-white">
              {items.map((item) => (
                <tr key={item.id}>
                  <td className="px-4 py-3">{item.name}</td>
                  <td className="px-4 py-3 text-gray-600">{item.role || "—"}</td>
                  <td className="px-4 py-3">{item._count?.posts ?? 0}</td>
                  <td className="px-4 py-3">{item.isActive ? "Activo" : "Inactivo"}</td>
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
                          bio: item.bio || "",
                          avatarUrl: item.avatarUrl || "",
                          role: item.role || "",
                          isActive: item.isActive,
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
