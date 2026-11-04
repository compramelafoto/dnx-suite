"use client";

import { useEffect, useState } from "react";
import Card from "@/components/ui/Card";
import Button from "@/components/ui/Button";
import Input from "@/components/ui/Input";
import { ESCOLAR_COURSE_BLOCKS, ESCOLAR_COURSE_PATH } from "@/lib/tutorials/escolar-course";

export default function AdminEscolarCourseCard() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [videos, setVideos] = useState<Record<number, string>>({});
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  useEffect(() => {
    loadVideos();
  }, []);

  async function loadVideos() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/admin/tutorials/escolar", { credentials: "include" });
      if (!res.ok) throw new Error("Error cargando el curso");
      const data = await res.json();
      setVideos(data.videos && typeof data.videos === "object" ? data.videos : {});
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error cargando el curso");
    } finally {
      setLoading(false);
    }
  }

  async function handleSave() {
    setSaving(true);
    setError(null);
    setSuccess(null);
    try {
      const res = await fetch("/api/admin/tutorials/escolar", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ videos }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || "Error guardando");
      const notPlayable: number[] = Array.isArray(data.notPlayable) ? data.notPlayable : [];
      setSuccess(
        notPlayable.length > 0
          ? `Guardado. Ojo: ${notPlayable.length === 1 ? "la clase" : "las clases"} ${notPlayable.join(", ")} todavía no se ${notPlayable.length === 1 ? "puede" : "pueden"} ver: en YouTube ${notPlayable.length === 1 ? "tiene" : "tienen"} que estar públicas o no listadas.`
          : "Curso guardado correctamente."
      );
      await loadVideos();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error guardando el curso");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Card className="p-6 mb-6">
      <h2 className="text-lg font-semibold text-[#1a1a1a] mb-1">Curso de fotografía escolar</h2>
      <p className="text-sm text-[#6b7280] mb-4">
        Pegá el link de YouTube de cada clase. Las clases sin link se muestran como «Próximamente». El video tiene
        que estar público o no listado para que se pueda ver.
      </p>

      {error && <div className="mb-4 p-3 rounded-lg bg-red-50 text-red-700 text-sm">{error}</div>}
      {success && <div className="mb-4 p-3 rounded-lg bg-green-50 text-green-700 text-sm">{success}</div>}

      {loading ? (
        <p className="text-sm text-[#6b7280]">Cargando curso...</p>
      ) : (
        <div className="space-y-6">
          {ESCOLAR_COURSE_BLOCKS.map((block) => (
            <div key={block.title} className="space-y-3">
              <div className="text-sm font-medium text-[#1a1a1a]">{block.title}</div>
              {block.lessons.map((lesson) => (
                <div key={lesson.number}>
                  <label className="text-xs font-medium text-[#6b7280]">
                    Clase {lesson.number} · {lesson.title}
                  </label>
                  <Input
                    value={videos[lesson.number] ?? ""}
                    onChange={(e) =>
                      setVideos((prev) => ({ ...prev, [lesson.number]: e.target.value }))
                    }
                    placeholder="https://www.youtube.com/watch?v=..."
                    className="text-sm"
                  />
                </div>
              ))}
            </div>
          ))}
        </div>
      )}

      <div className="mt-6 flex gap-3">
        <Button variant="primary" onClick={handleSave} disabled={saving || loading}>
          {saving ? "Guardando…" : "Guardar curso"}
        </Button>
        <a href={ESCOLAR_COURSE_PATH} target="_blank" rel="noopener noreferrer">
          <Button variant="secondary">Ver curso</Button>
        </a>
      </div>
    </Card>
  );
}
