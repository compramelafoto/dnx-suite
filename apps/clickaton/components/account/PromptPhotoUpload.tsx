"use client";

import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { CAMERA_CLOCK_WARNING_ES } from "@/config/editions/argentina-2026";
import { publicUploadError } from "@/lib/public-ux/public-errors";
import { resolverEstadoConsigna } from "@/lib/participant-notes/prompt-state";
import { subirConProgreso } from "@/lib/participant-notes/upload-progress";

/**
 * Entrega de la foto de una consigna, en un solo paso.
 *
 * Se elige el archivo desde el administrador de archivos —del celular o de la
 * computadora, porque la foto buena se editó antes— y queda entregada: la
 * subida confirma sola, sin un segundo botón.
 *
 * La declaración del reglamento se acepta al subir y queda registrada con fecha
 * y versión en la entrega, igual que antes. El aviso está junto al botón.
 *
 * Si la confirmación automática falla (se cortó la señal justo ahí), la foto
 * queda subida pero sin competir. Ese estado se señala en ámbar con un botón
 * para reintentar: es preferible mostrarlo que dejarlo pasar en silencio.
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
  const [message, setMessage] = useState<string | null>(null);
  const [status, setStatus] = useState(submissionStatus ?? null);
  const [datos, setDatos] = useState<DatosTecnicos | null>(tecnica ?? null);
  const [progreso, setProgreso] = useState<number | null>(null);
  const [trabajando, setTrabajando] = useState(false);

  const estado = resolverEstadoConsigna({ submissionStatus: status });

  async function confirmar(): Promise<boolean> {
    setMessage("Guardando la entrega…");
    try {
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
        return false;
      }
      setStatus(json.status ?? "CONFIRMED");
      setMessage("Foto entregada. Ya compite.");
      return true;
    } catch {
      setMessage("Se cortó la conexión antes de guardar la entrega. Probá de nuevo.");
      return false;
    }
  }

  async function subir(file: File, replace: boolean) {
    setTrabajando(true);
    setProgreso(0);
    setMessage(null);

    const res = await subirConProgreso({
      url: `/api/public/registrations/${registrationId}/prompts/${promptId}/upload`,
      file,
      replace,
      onProgress: setProgreso,
    });

    if (!res.ok) {
      setProgreso(null);
      setTrabajando(false);
      const err = publicUploadError(
        (res.json.message as string) ?? (res.json.error as string) ?? undefined,
      );
      setMessage(`${err.title}. ${err.description}`);
      return;
    }

    setProgreso(100);
    setStatus((res.json.status as string) ?? "PENDING_CONFIRMATION");

    const checklist = res.json.checklist as
      | { width?: number; height?: number; captureDate?: string | null; camera?: string | null }
      | undefined;
    if (checklist) {
      setDatos({
        dimensiones:
          checklist.width && checklist.height
            ? `${checklist.width} × ${checklist.height}`
            : null,
        captura: checklist.captureDate ?? null,
        camara: checklist.camera ?? null,
      });
    }

    // Un solo paso: la entrega se guarda sola.
    await confirmar();
    setProgreso(null);
    setTrabajando(false);
  }

  const selector = (etiqueta: string, variante: "primary" | "secondary") => (
    <label
      className={`ck-btn ck-btn-${variante} min-h-12 w-full cursor-pointer justify-center${
        trabajando ? " pointer-events-none opacity-60" : ""
      }`}
    >
      {etiqueta}
      <input
        type="file"
        accept="image/jpeg,image/png,image/webp"
        disabled={trabajando}
        className="sr-only"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (!file) return;
          void subir(file, estado === "ENVIADA" || estado === "SIN_CONFIRMAR");
          e.target.value = "";
        }}
      />
    </label>
  );

  const fichaTecnica = datos ? (
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
  ) : null;

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

      {progreso !== null ? (
        <div className="space-y-1">
          <div
            className="h-2 w-full overflow-hidden rounded-full bg-ck-surface-strong"
            role="progressbar"
            aria-valuenow={progreso}
            aria-valuemin={0}
            aria-valuemax={100}
            aria-label="Progreso de la subida"
          >
            <div
              className="h-full rounded-full bg-ck-yellow transition-[width] duration-200"
              style={{ width: `${progreso}%` }}
            />
          </div>
          <p className="text-right text-xs tabular-nums text-ck-text-muted">
            {progreso < 100 ? `Subiendo… ${progreso}%` : "Guardando la entrega…"}
          </p>
        </div>
      ) : null}

      {estado === "ENVIADA" ? (
        <div className="space-y-3">
          <p className="text-sm font-semibold text-[var(--ck-success)]">
            Foto entregada · compite en el concurso
          </p>
          {fichaTecnica}
          {canUpload ? selector("Cambiar la foto", "secondary") : null}
        </div>
      ) : estado === "SIN_CONFIRMAR" ? (
        <div
          className={`space-y-3 rounded-[var(--ck-radius-card)] border p-4 ${
            canUpload ? "border-[var(--ck-warning)]/55" : "border-[var(--ck-danger)]/55"
          }`}
        >
          <p
            className="text-sm font-semibold"
            style={{ color: canUpload ? "var(--ck-warning)" : "var(--ck-danger)" }}
          >
            {canUpload
              ? "La foto se subió pero no llegó a guardarse la entrega"
              : "Sin guardar · no compite"}
          </p>
          {fichaTecnica}
          {canUpload ? (
            <>
              <Button
                type="button"
                variant="primary"
                className="min-h-12 w-full"
                disabled={trabajando}
                onClick={() => void confirmar()}
              >
                Guardar la entrega
              </Button>
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
          {selector("Elegir la foto y entregar", "primary")}
          <p className="text-center text-xs leading-relaxed text-ck-text-muted">
            Se entrega apenas termina de subir. Al subirla declarás que la fotografía cumple el
            reglamento de la edición.
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
