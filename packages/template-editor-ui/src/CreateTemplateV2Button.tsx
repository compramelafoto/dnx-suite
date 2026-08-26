"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Button from "@/components/ui/Button";

type CreateResponse = {
  ok: boolean;
  templateId?: string;
  versionId?: string;
  error?: string;
};

type PresetOption = {
  presetId: string;
  name: string;
  testId: string;
};

const CLICKATON_PRESETS: PresetOption[] = [
  {
    presetId: "clickaton-welcome-story-v1",
    name: "Bienvenid@ a Clickatón",
    testId: "template-v2-preset-clickaton-welcome",
  },
  {
    presetId: "clickaton-member-story-v1",
    name: "Soy parte de Clickatón",
    testId: "template-v2-preset-clickaton-member",
  },
];

export function CreateTemplateV2Button() {
  const router = useRouter();
  const [isCreating, setIsCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const [officialOpen, setOfficialOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!menuOpen) return;
    function onDoc(e: MouseEvent) {
      if (!rootRef.current?.contains(e.target as Node)) {
        setMenuOpen(false);
        setOfficialOpen(false);
      }
    }
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, [menuOpen]);

  async function createFromBody(body: Record<string, unknown>) {
    if (isCreating) return;
    setIsCreating(true);
    setError(null);
    setMenuOpen(false);
    setOfficialOpen(false);
    try {
      const res = await fetch("/api/template-v2/templates/create", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = (await res.json().catch(() => ({}))) as CreateResponse;
      if (!res.ok || !data.ok || !data.templateId || !data.versionId) {
        throw new Error(data.error || "No se pudo crear la plantilla.");
      }
      router.push(`/fotografo/diseno/plantillas/v2/${data.templateId}/${data.versionId}`);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error creando plantilla.");
      setIsCreating(false);
    }
  }

  return (
    <div className="relative flex flex-col items-end gap-2" ref={rootRef}>
      <div className="flex items-stretch gap-1">
        <Button
          type="button"
          variant="primary"
          className="rounded-r-none px-6 py-2.5 text-sm font-semibold"
          onClick={() => void createFromBody({})}
          disabled={isCreating}
          data-testid="template-v2-create-button"
        >
          {isCreating ? "Creando..." : "Nueva plantilla"}
        </Button>
        <Button
          type="button"
          variant="primary"
          className="rounded-l-none border-l border-white/30 px-3 py-2.5 text-sm"
          onClick={() => setMenuOpen((v) => !v)}
          disabled={isCreating}
          aria-expanded={menuOpen}
          aria-haspopup="menu"
          data-testid="template-v2-create-menu-button"
          title="Plantillas oficiales"
        >
          ▾
        </Button>
      </div>

      {menuOpen ? (
        <div
          className="absolute right-0 top-full z-40 mt-2 min-w-[260px] rounded-xl border border-[#e5e7eb] bg-white p-2 shadow-xl"
          role="menu"
          data-testid="template-v2-create-menu"
        >
          <button
            type="button"
            role="menuitem"
            className="flex w-full rounded-lg px-3 py-2.5 text-left text-sm font-medium text-[#111827] hover:bg-[#f3f4f6]"
            data-testid="template-v2-create-blank"
            onClick={() => void createFromBody({})}
          >
            Desde cero
          </button>
          <button
            type="button"
            role="menuitem"
            className="flex w-full items-center justify-between rounded-lg px-3 py-2.5 text-left text-sm font-medium text-[#111827] hover:bg-[#f3f4f6]"
            data-testid="template-v2-create-official"
            onClick={() => setOfficialOpen((v) => !v)}
          >
            Plantillas oficiales
            <span className="text-[#9ca3af]">{officialOpen ? "▴" : "▾"}</span>
          </button>
          {officialOpen ? (
            <div className="mt-1 border-t border-[#f3f4f6] pt-1 pl-2">
              <p className="px-3 py-1 text-[10px] font-semibold uppercase tracking-wide text-[#6b7280]">
                Clickatón
              </p>
              {CLICKATON_PRESETS.map((p) => (
                <button
                  key={p.presetId}
                  type="button"
                  role="menuitem"
                  className="flex w-full rounded-lg px-3 py-2 text-left text-sm text-[#111827] hover:bg-[#fdf8f4]"
                  data-testid={p.testId}
                  onClick={() => void createFromBody({ presetId: p.presetId })}
                >
                  {p.name}
                </button>
              ))}
            </div>
          ) : null}
        </div>
      ) : null}

      {error ? (
        <p
          className="max-w-md text-right text-xs text-red-600"
          data-testid="template-v2-error-banner"
          role="alert"
        >
          {error}
        </p>
      ) : null}
    </div>
  );
}
