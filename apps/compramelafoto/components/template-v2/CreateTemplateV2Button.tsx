"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Button from "@/components/ui/Button";

type CreateResponse = {
  ok: boolean;
  templateId?: string;
  versionId?: string;
  error?: string;
};

export function CreateTemplateV2Button() {
  const router = useRouter();
  const [isCreating, setIsCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onCreate() {
    if (isCreating) return;
    setIsCreating(true);
    setError(null);
    try {
      const res = await fetch("/api/template-v2/templates/create", {
        method: "POST",
        credentials: "include",
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
    <div className="flex flex-col items-end gap-2">
      <Button
        type="button"
        variant="primary"
        className="px-6 py-2.5 text-sm font-semibold"
        onClick={onCreate}
        disabled={isCreating}
      >
        {isCreating ? "Creando..." : "Nueva plantilla"}
      </Button>
      {error ? <p className="max-w-md text-right text-xs text-red-600">{error}</p> : null}
    </div>
  );
}
