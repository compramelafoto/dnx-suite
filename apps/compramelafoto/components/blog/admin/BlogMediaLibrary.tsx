"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Image from "next/image";
import Button from "@/components/ui/Button";
import Input from "@/components/ui/Input";
import Textarea from "@/components/ui/Textarea";

export type BlogMediaItem = {
  id: number;
  createdAt: string;
  title: string | null;
  altText: string | null;
  caption: string | null;
  filename: string;
  url: string;
  mimeType: string;
  sizeBytes: number;
};

type BlogMediaLibraryProps = {
  mode?: "page" | "picker";
  onSelect?: (item: BlogMediaItem) => void;
};

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export default function BlogMediaLibrary({ mode = "page", onSelect }: BlogMediaLibraryProps) {
  const [items, setItems] = useState<BlogMediaItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState("");
  const [uploading, setUploading] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editForm, setEditForm] = useState({ title: "", altText: "", caption: "" });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      if (query.trim()) params.set("q", query.trim());
      params.set("limit", "100");
      const res = await fetch(`/api/admin/blog/media?${params.toString()}`, { credentials: "include" });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || "Error cargando multimedia");
      setItems(data.media || []);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error cargando multimedia");
    } finally {
      setLoading(false);
    }
  }, [query]);

  useEffect(() => {
    void load();
  }, [load]);

  async function handleUpload(file: File) {
    setUploading(true);
    setError(null);
    setSuccess(null);
    try {
      const form = new FormData();
      form.append("file", file);
      const res = await fetch("/api/admin/blog/media", {
        method: "POST",
        credentials: "include",
        body: form,
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || "Error subiendo imagen");
      setSuccess("Imagen subida correctamente.");
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error subiendo imagen");
    } finally {
      setUploading(false);
    }
  }

  function startEdit(item: BlogMediaItem) {
    setEditingId(item.id);
    setEditForm({
      title: item.title || "",
      altText: item.altText || "",
      caption: item.caption || "",
    });
  }

  async function saveEdit() {
    if (!editingId) return;
    setSaving(true);
    setError(null);
    try {
      const res = await fetch(`/api/admin/blog/media/${editingId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(editForm),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || data.details || "Error guardando");
      setEditingId(null);
      setSuccess("Metadata actualizada.");
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error guardando");
    } finally {
      setSaving(false);
    }
  }

  async function copyUrl(url: string) {
    try {
      await navigator.clipboard.writeText(url);
      setSuccess("URL copiada al portapapeles.");
    } catch {
      setError("No se pudo copiar la URL.");
    }
  }

  async function removeItem(id: number) {
    if (!window.confirm("¿Eliminar esta imagen de la biblioteca?")) return;
    setError(null);
    try {
      const res = await fetch(`/api/admin/blog/media/${id}`, {
        method: "DELETE",
        credentials: "include",
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || "Error eliminando");
      }
      setSuccess("Imagen eliminada.");
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error eliminando");
    }
  }

  return (
    <div className="space-y-4">
      {mode === "page" ? (
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex flex-wrap gap-2">
            <input
              ref={fileRef}
              type="file"
              accept="image/jpeg,image/png,image/webp"
              className="hidden"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) void handleUpload(file);
                e.target.value = "";
              }}
            />
            <Button type="button" disabled={uploading} onClick={() => fileRef.current?.click()}>
              {uploading ? "Subiendo..." : "Subir imagen"}
            </Button>
          </div>
          <div className="flex gap-2">
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Buscar..."
              className="rounded-lg border border-gray-300 px-3 py-2 text-sm w-full sm:w-56"
            />
            <Button type="button" variant="secondary" size="sm" onClick={() => void load()}>
              Buscar
            </Button>
          </div>
        </div>
      ) : null}

      {error ? <div className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div> : null}
      {success ? <div className="rounded-lg bg-green-50 px-3 py-2 text-sm text-green-700">{success}</div> : null}

      {loading ? (
        <p className="text-sm text-gray-500">Cargando biblioteca...</p>
      ) : items.length === 0 ? (
        <p className="text-sm text-gray-500">No hay imágenes en la biblioteca.</p>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {items.map((item) => (
            <div key={item.id} className="rounded-xl border border-gray-200 bg-white overflow-hidden">
              <div className="relative aspect-video bg-gray-100">
                <Image src={item.url} alt={item.altText || item.filename} fill className="object-cover" unoptimized />
              </div>
              <div className="space-y-2 p-3">
                <p className="text-sm font-medium text-gray-900 truncate">{item.title || item.filename}</p>
                <p className="text-xs text-gray-500">{formatBytes(item.sizeBytes)}</p>
                {editingId === item.id ? (
                  <div className="space-y-2">
                    <Input
                      value={editForm.title}
                      onChange={(e) => setEditForm((f) => ({ ...f, title: e.target.value }))}
                      placeholder="Título"
                    />
                    <Input
                      value={editForm.altText}
                      onChange={(e) => setEditForm((f) => ({ ...f, altText: e.target.value }))}
                      placeholder="Alt text"
                    />
                    <Textarea
                      value={editForm.caption}
                      onChange={(e) => setEditForm((f) => ({ ...f, caption: e.target.value }))}
                      placeholder="Caption"
                      rows={2}
                    />
                    <div className="flex gap-2">
                      <Button type="button" size="sm" disabled={saving} onClick={() => void saveEdit()}>
                        {saving ? "Guardando..." : "Guardar"}
                      </Button>
                      <Button type="button" size="sm" variant="secondary" onClick={() => setEditingId(null)}>
                        Cancelar
                      </Button>
                    </div>
                  </div>
                ) : (
                  <div className="flex flex-wrap gap-2">
                    {mode === "picker" && onSelect ? (
                      <Button type="button" size="sm" onClick={() => onSelect(item)}>
                        Insertar
                      </Button>
                    ) : null}
                    <Button type="button" size="sm" variant="secondary" onClick={() => void copyUrl(item.url)}>
                      Copiar URL
                    </Button>
                    {mode === "page" ? (
                      <>
                        <Button type="button" size="sm" variant="secondary" onClick={() => startEdit(item)}>
                          Editar
                        </Button>
                        <Button type="button" size="sm" variant="secondary" onClick={() => void removeItem(item.id)}>
                          Eliminar
                        </Button>
                      </>
                    ) : null}
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
