"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/ui/Button";

type Props = {
  registrationId: string;
  promptId: string;
  sequence: number;
  title: string;
  canUpload: boolean;
  submissionStatus?: string | null;
  validationResult?: string | null;
};

export function PromptPhotoUpload({
  registrationId,
  promptId,
  sequence,
  title,
  canUpload,
  submissionStatus,
  validationResult,
}: Props) {
  const [pending, startTransition] = useTransition();
  const [message, setMessage] = useState<string | null>(null);
  const [checklist, setChecklist] = useState<Record<string, unknown> | null>(null);
  const [status, setStatus] = useState(submissionStatus ?? null);

  async function onUpload(file: File, replace = false) {
    setMessage("Subiendo archivo…");
    const body = new FormData();
    body.set("file", file);
    if (replace) body.set("replace", "1");
    const res = await fetch(
      `/api/public/registrations/${registrationId}/prompts/${promptId}/upload`,
      { method: "POST", body },
    );
    const json = (await res.json()) as {
      error?: string;
      message?: string;
      status?: string;
      validationResult?: string;
      checklist?: Record<string, unknown>;
    };
    if (!res.ok) {
      setMessage(json.message ?? json.error ?? "Error al subir");
      return;
    }
    setStatus(json.status ?? null);
    setChecklist(json.checklist ?? null);
    setMessage("Archivo recibido. Revisá el checklist y confirmá.");
  }

  async function onConfirm() {
    setMessage("Confirmando…");
    const res = await fetch(
      `/api/public/registrations/${registrationId}/prompts/${promptId}/confirm`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ acceptDeclaration: true }),
      },
    );
    const json = (await res.json()) as { error?: string; message?: string; status?: string };
    if (!res.ok) {
      setMessage(json.message ?? json.error ?? "No se pudo confirmar");
      return;
    }
    setStatus(json.status ?? "CONFIRMED");
    setMessage("Envío confirmado.");
  }

  return (
    <div className="space-y-3 rounded border border-ck-border p-4">
      <div>
        <p className="font-semibold">
          Consigna {sequence}: {title}
        </p>
        <p className="text-xs text-ck-text-muted">
          Estado envío: {status ?? "sin envío"}
          {validationResult ? ` · ${validationResult}` : ""}
        </p>
      </div>

      {canUpload ? (
        <label className="block text-sm">
          <span className="sr-only">Seleccionar fotografía</span>
          <input
            type="file"
            accept="image/jpeg,image/png,image/webp,image/*"
            capture="environment"
            disabled={pending}
            className="block w-full text-sm"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (!file) return;
              startTransition(() => {
                void onUpload(file, status === "CONFIRMED");
              });
            }}
          />
        </label>
      ) : (
        <p className="text-sm text-ck-text-muted">Carga no disponible en este momento.</p>
      )}

      {checklist ? (
        <dl className="grid gap-1 text-xs text-ck-text-secondary sm:grid-cols-2">
          <div>Dimensiones: {String(checklist.width)}×{String(checklist.height)}</div>
          <div>Captura: {String(checklist.captureDate ?? "sin EXIF")}</div>
          <div>Cámara: {String(checklist.camera ?? "—")}</div>
          <div>GPS: {String(checklist.gps ?? "—")}</div>
        </dl>
      ) : null}

      {status === "PENDING_CONFIRMATION" ? (
        <div className="space-y-2">
          <p className="text-xs text-ck-text-secondary">
            Declaro que la fotografía cumple el reglamento de la edición.
          </p>
          <Button
            type="button"
            size="sm"
            variant="primary"
            disabled={pending}
            onClick={() => startTransition(() => void onConfirm())}
          >
            Confirmar envío
          </Button>
        </div>
      ) : null}

      {message ? (
        <p className="text-sm text-ck-text-secondary" role="status">
          {message}
        </p>
      ) : null}
    </div>
  );
}
