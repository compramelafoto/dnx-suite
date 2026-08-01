"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/ui/Button";
import { CAMERA_CLOCK_WARNING_ES } from "@/config/editions/argentina-2026";
import { publicUploadError } from "@/lib/public-ux/public-errors";
import { presentPhotoSubmissionStatus } from "@/lib/public-ux/status-presentation";

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
      const err = publicUploadError(json.message ?? json.error);
      setMessage(`${err.title}. ${err.description}`);
      return;
    }
    setStatus(json.status ?? null);
    setChecklist(json.checklist ?? null);
    setMessage("Archivo recibido. Revisá el resumen y confirmá el envío.");
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
      const err = publicUploadError(json.message ?? json.error);
      setMessage(`${err.title}. ${err.description}`);
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
          Estado del envío: {presentPhotoSubmissionStatus(status)}
          {validationResult && !/^[A-Z][A-Z0-9_]{2,}$/.test(validationResult)
            ? ` · ${validationResult}`
            : ""}
        </p>
      </div>

      {canUpload ? (
        <div className="space-y-3">
          <p
            className="rounded-lg border border-ck-yellow/40 bg-ck-yellow/10 px-4 py-3 text-sm leading-relaxed text-ck-text"
            role="note"
          >
            {CAMERA_CLOCK_WARNING_ES}
          </p>
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
        </div>
      ) : (
        <p className="text-sm text-ck-text-muted">Carga no disponible en este momento.</p>
      )}

      {checklist ? (
        <dl className="grid gap-1 text-xs text-ck-text-secondary sm:grid-cols-2">
          <div>Dimensiones: {String(checklist.width)}×{String(checklist.height)}</div>
          <div>Fecha de captura: {String(checklist.captureDate ?? "no detectada")}</div>
          <div>Cámara: {String(checklist.camera ?? "—")}</div>
          <div>Ubicación: {String(checklist.gps ?? "—")}</div>
        </dl>
      ) : null}

      {status === "PENDING_CONFIRMATION" ? (
        <div className="space-y-2">
          <p className="text-xs text-ck-text-secondary">
            Declaro que la fotografía cumple el reglamento de la edición.
          </p>
          <Button
            type="button"
            variant="primary"
            className="min-h-11 w-full sm:w-auto"
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
