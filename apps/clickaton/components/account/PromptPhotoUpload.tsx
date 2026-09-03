"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/ui/Button";
import { CAMERA_CLOCK_WARNING_ES } from "@/config/editions/argentina-2026";
import { publicUploadError } from "@/lib/public-ux/public-errors";
import { resolverEstadoConsigna } from "@/lib/participant-notes/prompt-state";

/**
 * Entrega de la foto de una consigna, en dos pasos: subir y confirmar.
 *
 * El paso del medio es el que deja gente afuera: una foto subida y no
 * confirmada NO compite. Por eso ese estado se señala en ámbar, dice
 * explícitamente que falta, y muestra los datos que el sistema leyó del archivo
 * para que la persona detecte sola el problema más común — la cámara con la
 * hora mal puesta — y cambie la foto antes de confirmar.
 */

export type DatosTecnicos = {
  dimensiones: string | null;
  captura: string | null;
  camara: string | null;
};

type Props = {
  registrationId: string;
  promptId: string;
  sequence: number;
  title: string;
  canUpload: boolean;
  /** Por qué no se puede subir, cuando no se puede. */
  blockedReason?: string | null;
  submissionStatus?: string | null;
  validationResult?: string | null;
  tecnica?: DatosTecnicos | null;
  showClockWarning?: boolean;
};

export function PromptPhotoUpload({
  registrationId,
  promptId,
  sequence,
  title,
  canUpload,
  blockedReason,
  submissionStatus,
  validationResult,
  tecnica,
  showClockWarning = true,
}: Props) {
  const [pending, startTransition] = useTransition();
  const [message, setMessage] = useState<string | null>(null);
  const [status, setStatus] = useState(submissionStatus ?? null);
  const [datos, setDatos] = useState<DatosTecnicos | null>(tecnica ?? null);
  const [declaracion, setDeclaracion] = useState(false);

  const estado = resolverEstadoConsigna({ submissionStatus: status });

  async function onUpload(file: File, replace = false) {
    setMessage("Subiendo la foto…");
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
      checklist?: {
        width?: number;
        height?: number;
        captureDate?: string | null;
        camera?: string | null;
      };
    };
    if (!res.ok) {
      const err = publicUploadError(json.message ?? json.error);
      setMessage(`${err.title}. ${err.description}`);
      return;
    }
    setStatus(json.status ?? "PENDING_CONFIRMATION");
    setDeclaracion(false);
    if (json.checklist) {
      setDatos({
        dimensiones:
          json.checklist.width && json.checklist.height
            ? `${json.checklist.width} × ${json.checklist.height}`
            : null,
        captura: json.checklist.captureDate ?? null,
        camara: json.checklist.camera ?? null,
      });
    }
    setMessage("Foto recibida. Revisá los datos y confirmá el envío.");
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
    setMessage("Envío confirmado. Esta foto ya compite.");
  }

  const selector = (etiqueta: string, variante: "primary" | "secondary") => (
    <label
      className={`ck-btn ck-btn-${variante} min-h-12 w-full cursor-pointer justify-center${
        pending ? " pointer-events-none opacity-60" : ""
      }`}
    >
      {etiqueta}
      <input
        type="file"
        accept="image/jpeg,image/png,image/webp,image/*"
        capture="environment"
        disabled={pending}
        className="sr-only"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (!file) return;
          startTransition(() => {
            void onUpload(file, estado === "ENVIADA" || estado === "SIN_CONFIRMAR");
          });
        }}
      />
    </label>
  );

  return (
    <div className="space-y-3 border-t border-ck-border pt-4">
      <p className="sr-only">
        Consigna {sequence}: {title}
      </p>

      {showClockWarning && canUpload ? (
        <p
          className="rounded-lg border border-ck-yellow/40 bg-ck-yellow/10 px-4 py-3 text-sm leading-relaxed text-ck-text"
          role="note"
        >
          {CAMERA_CLOCK_WARNING_ES}
        </p>
      ) : null}

      {estado === "ENVIADA" ? (
        <div className="space-y-3">
          <p className="text-sm font-semibold text-[var(--ck-success)]">
            Foto enviada · compite en el concurso
          </p>
          {canUpload ? selector("Cambiar la foto", "secondary") : null}
        </div>
      ) : estado === "SIN_CONFIRMAR" ? (
        <div
          className={`space-y-4 rounded-[var(--ck-radius-card)] border p-4 ${
            canUpload
              ? "border-[var(--ck-warning)]/55"
              : "border-[var(--ck-danger)]/55"
          }`}
        >
          <p
            className="text-sm font-semibold"
            style={{ color: canUpload ? "var(--ck-warning)" : "var(--ck-danger)" }}
          >
            {canUpload ? "Subida · falta confirmar" : "Sin confirmar · no compite"}
          </p>

          {datos ? (
            <dl className="grid gap-1 text-xs text-ck-text-muted sm:grid-cols-2">
              {datos.dimensiones ? (
                <div>
                  <dt className="inline">Dimensiones: </dt>
                  <dd className="inline">{datos.dimensiones}</dd>
                </div>
              ) : null}
              <div>
                <dt className="inline">Fecha de captura: </dt>
                <dd className="inline">
                  {datos.captura
                    ? new Date(datos.captura).toLocaleString("es-AR", {
                        day: "2-digit",
                        month: "2-digit",
                        hour: "2-digit",
                        minute: "2-digit",
                        hour12: false,
                      })
                    : "no detectada"}
                </dd>
              </div>
              {datos.camara ? (
                <div>
                  <dt className="inline">Cámara: </dt>
                  <dd className="inline">{datos.camara}</dd>
                </div>
              ) : null}
            </dl>
          ) : null}

          {canUpload ? (
            <>
              <label className="flex cursor-pointer items-start gap-3 text-sm text-ck-text">
                <input
                  type="checkbox"
                  checked={declaracion}
                  onChange={(e) => setDeclaracion(e.target.checked)}
                  className="mt-0.5 size-5 shrink-0 accent-[var(--ck-brand-primary)]"
                />
                <span>Declaro que la fotografía cumple el reglamento de la edición.</span>
              </label>

              <Button
                type="button"
                variant="primary"
                className="min-h-12 w-full"
                disabled={pending || !declaracion}
                onClick={() => startTransition(() => void onConfirm())}
              >
                Confirmar envío
              </Button>
              {!declaracion ? (
                <p className="text-center text-xs text-ck-text-muted">
                  Tildá la declaración para confirmar.
                </p>
              ) : null}
              {selector("Elegir otra foto", "secondary")}
            </>
          ) : null}
        </div>
      ) : estado === "RECHAZADA" ? (
        <div className="space-y-3">
          <p className="text-sm font-semibold text-[var(--ck-danger)]">
            Entrega no admitida
            {validationResult && !/^[A-Z][A-Z0-9_]{2,}$/.test(validationResult)
              ? ` · ${validationResult}`
              : ""}
          </p>
          {canUpload ? selector("Subir otra foto", "primary") : null}
        </div>
      ) : canUpload ? (
        <div className="space-y-2">
          {selector("Subir la foto", "primary")}
          <p className="text-center text-xs text-ck-text-muted">
            Después de subirla vas a tener que confirmar el envío.
          </p>
        </div>
      ) : (
        <p className="text-center text-xs text-ck-text-muted">
          {blockedReason ?? "Carga no disponible en este momento."}
        </p>
      )}

      {message ? (
        <p className="text-sm text-ck-text-secondary" role="status">
          {message}
        </p>
      ) : null}
    </div>
  );
}
