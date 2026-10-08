"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

const MAX_NAME_LENGTH = 240;

function friendlyError(code: string | undefined, fallback: string): string {
  if (code === "TEMPLATE_PUBLISHED_LOCKED") {
    return "Esta plantilla está publicada en el catálogo y no se puede renombrar.";
  }
  if (code === "TEMPLATE_FORBIDDEN" || code === "TEMPLATE_NOT_FOUND") {
    return "No tenés permiso para renombrar esta plantilla.";
  }
  return fallback;
}

/**
 * Nombre de una plantilla V2 con edición en el lugar. Usa el PATCH del editor, que ya valida que
 * quien renombra sea el dueño o un admin.
 */
export default function TemplateV2NameEditor({
  templateId,
  initialName,
  subtitle,
}: {
  templateId: string;
  initialName: string;
  subtitle?: string;
}) {
  const router = useRouter();
  const [name, setName] = useState(initialName);
  const [draft, setDraft] = useState(initialName);
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function startEditing() {
    setDraft(name);
    setError(null);
    setEditing(true);
  }

  function cancel() {
    setDraft(name);
    setError(null);
    setEditing(false);
  }

  async function save() {
    const next = draft.trim();
    if (!next) {
      setError("El nombre no puede quedar vacío.");
      return;
    }
    if (next === name) {
      setEditing(false);
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const res = await fetch(`/api/template-v2/templates/${encodeURIComponent(templateId)}`, {
        method: "PATCH",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: next }),
      });
      const data = (await res.json().catch(() => ({}))) as { ok?: boolean; error?: string; code?: string };
      if (!res.ok || !data.ok) {
        setError(friendlyError(data.code, "No se pudo guardar el nombre. Probá de nuevo."));
        return;
      }
      setName(next);
      setEditing(false);
      router.refresh();
    } catch {
      setError("No se pudo guardar el nombre. Revisá tu conexión.");
    } finally {
      setSaving(false);
    }
  }

  if (!editing) {
    return (
      <div>
        <div className="flex items-start gap-2">
          <p className="text-sm font-semibold text-[#111827]">{name || "Sin nombre"}</p>
          <button
            type="button"
            onClick={startEditing}
            className="shrink-0 rounded-md px-1.5 py-0.5 text-xs font-medium text-[#c27b3d] hover:bg-[#c27b3d]/10"
            aria-label={`Cambiar el nombre de ${name || "la plantilla"}`}
          >
            Renombrar
          </button>
        </div>
        {subtitle ? <p className="mt-1 text-xs text-[#6b7280]">{subtitle}</p> : null}
      </div>
    );
  }

  return (
    <form
      className="max-w-sm"
      onSubmit={(e) => {
        e.preventDefault();
        void save();
      }}
    >
      <input
        type="text"
        value={draft}
        maxLength={MAX_NAME_LENGTH}
        autoFocus
        onFocus={(e) => e.currentTarget.select()}
        disabled={saving}
        onChange={(e) => setDraft(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Escape") cancel();
        }}
        className="w-full rounded-lg border border-[#d1d5db] px-3 py-1.5 text-sm text-[#111827] focus:border-[#c27b3d] focus:outline-none focus:ring-2 focus:ring-[#c27b3d]/20"
        aria-label="Nombre de la plantilla"
      />
      <div className="mt-2 flex items-center gap-2">
        <button
          type="submit"
          disabled={saving}
          className="rounded-full bg-[#c27b3d] px-3 py-1 text-xs font-semibold text-white disabled:opacity-50"
        >
          {saving ? "Guardando…" : "Guardar"}
        </button>
        <button
          type="button"
          onClick={cancel}
          disabled={saving}
          className="rounded-full px-3 py-1 text-xs font-medium text-[#6b7280] hover:bg-[#f3f4f6]"
        >
          Cancelar
        </button>
      </div>
      {error ? <p className="mt-1.5 text-xs text-red-600">{error}</p> : null}
    </form>
  );
}
