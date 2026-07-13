"use client";

import { useEffect, useState } from "react";
import Card from "@/components/ui/Card";
import Button from "@/components/ui/Button";
import Input from "@/components/ui/Input";

type TutorialDraft = {
  youtubeUrl: string;
  title?: string;
  description?: string;
  thumbnailUrl?: string;
};

const EMPTY_TUTORIAL: TutorialDraft = {
  youtubeUrl: "",
  title: "",
  description: "",
  thumbnailUrl: "",
};

export default function AdminTutorialsPage() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [items, setItems] = useState<TutorialDraft[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  useEffect(() => {
    loadTutorials();
  }, []);

  async function loadTutorials() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/admin/tutorials", { credentials: "include" });
      if (!res.ok) throw new Error("Error cargando tutoriales");
      const data = await res.json();
      setItems(Array.isArray(data.items) ? data.items : []);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error cargando tutoriales");
    } finally {
      setLoading(false);
    }
  }

  async function handleSave() {
    setSaving(true);
    setError(null);
    setSuccess(null);
    try {
      const res = await fetch("/api/admin/tutorials", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ items: items.map((item) => ({ youtubeUrl: item.youtubeUrl })) }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || "Error guardando");
      }
      setSuccess("Tutoriales guardados correctamente.");
      await loadTutorials();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error guardando tutoriales");
    } finally {
      setSaving(false);
    }
  }

  function addTutorial() {
    setItems((prev) => [...prev, { ...EMPTY_TUTORIAL }]);
  }

  function removeTutorial(index: number) {
    setItems((prev) => prev.filter((_, i) => i !== index));
  }

  function moveUp(index: number) {
    if (index <= 0) return;
    setItems((prev) => {
      const next = [...prev];
      [next[index - 1], next[index]] = [next[index], next[index - 1]];
      return next;
    });
  }

  function moveDown(index: number) {
    if (index >= items.length - 1) return;
    setItems((prev) => {
      const next = [...prev];
      [next[index], next[index + 1]] = [next[index + 1], next[index]];
      return next;
    });
  }

  function updateTutorial(index: number, field: "youtubeUrl", value: string) {
    setItems((prev) => {
      const next = [...prev];
      next[index] = { ...next[index], [field]: value };
      return next;
    });
  }

  if (loading) {
    return (
      <div className="p-6">
        <p className="text-[#6b7280]">Cargando tutoriales...</p>
      </div>
    );
  }

  return (
    <div className="p-6 max-w-4xl">
      <h1 className="text-2xl font-semibold text-[#1a1a1a] mb-2">Tutoriales</h1>
      <p className="text-[#6b7280] mb-6">
        Agregá los links de YouTube y ordenalos como quieras. Se mostrarán en la página pública de tutoriales.
      </p>

      {error && (
        <div className="mb-4 p-3 rounded-lg bg-red-50 text-red-700 text-sm">
          {error}
        </div>
      )}
      {success && (
        <div className="mb-4 p-3 rounded-lg bg-green-50 text-green-700 text-sm">
          {success}
        </div>
      )}

      <Card className="p-6 mb-6">
        <div className="flex items-center justify-between mb-4">
          <span className="text-sm font-medium text-[#1a1a1a]">
            Tutoriales ({items.length})
          </span>
          <Button variant="primary" onClick={addTutorial} className="text-sm">
            Agregar tutorial
          </Button>
        </div>

        {items.length === 0 ? (
          <p className="text-sm text-[#6b7280]">Todavía no hay tutoriales cargados.</p>
        ) : (
          <div className="space-y-4">
            {items.map((item, index) => (
              <div
                key={`${item.youtubeUrl}-${index}`}
                className="flex flex-wrap items-start gap-4 p-4 rounded-lg border border-[#e5e7eb] bg-[#fafafa]"
              >
                <div className="flex flex-col gap-3 flex-1 min-w-0">
                  <div className="text-xs font-medium text-[#6b7280]">
                    Orden #{index + 1}
                  </div>
                  <div>
                    <label className="text-xs font-medium text-[#6b7280]">Link de YouTube</label>
                    <Input
                      value={item.youtubeUrl}
                      onChange={(e) => updateTutorial(index, "youtubeUrl", e.target.value)}
                      placeholder="https://www.youtube.com/watch?v=..."
                      className="text-sm"
                    />
                  </div>
                  {item.title && (
                    <div className="text-sm text-[#111827]">
                      <span className="text-xs font-medium text-[#6b7280] block">Título</span>
                      {item.title}
                    </div>
                  )}
                  {item.description && (
                    <div className="text-sm text-[#6b7280] whitespace-pre-line">
                      <span className="text-xs font-medium text-[#6b7280] block">Descripción</span>
                      {item.description}
                    </div>
                  )}
                  {item.thumbnailUrl && (
                    <img
                      src={item.thumbnailUrl}
                      alt={`Miniatura de ${item.title || "tutorial"}`}
                      className="w-full max-w-sm rounded-lg border border-[#e5e7eb]"
                      loading="lazy"
                    />
                  )}
                </div>
                <div className="flex items-center gap-1">
                  <button
                    type="button"
                    onClick={() => moveUp(index)}
                    disabled={index === 0}
                    className="p-2 rounded hover:bg-black/10 disabled:opacity-40"
                    title="Subir"
                  >
                    ↑
                  </button>
                  <button
                    type="button"
                    onClick={() => moveDown(index)}
                    disabled={index === items.length - 1}
                    className="p-2 rounded hover:bg-black/10 disabled:opacity-40"
                    title="Bajar"
                  >
                    ↓
                  </button>
                  <button
                    type="button"
                    onClick={() => removeTutorial(index)}
                    className="p-2 rounded hover:bg-red-100 text-red-600"
                    title="Eliminar"
                  >
                    ✕
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}

        <div className="mt-6 flex gap-3">
          <Button variant="primary" onClick={handleSave} disabled={saving}>
            {saving ? "Guardando…" : "Guardar tutoriales"}
          </Button>
          <a href="/tutoriales" target="_blank" rel="noopener noreferrer">
            <Button variant="secondary">Ver tutoriales</Button>
          </a>
        </div>
      </Card>
    </div>
  );
}
