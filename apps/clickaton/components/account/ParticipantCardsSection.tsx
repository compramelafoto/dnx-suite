"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";

export type ParticipantCardUiState =
  | "available"
  | "missing_photo"
  | "missing_consent"
  | "not_confirmed"
  | "error";

type CardKind = "welcome" | "member";

type CardDef = {
  kind: CardKind;
  title: string;
  previewTestId: string;
};

const CARDS: CardDef[] = [
  {
    kind: "welcome",
    title: "¡Bienvenid@ a Clickatón!",
    previewTestId: "clickaton-card-welcome-preview",
  },
  {
    kind: "member",
    title: "Soy parte de Clickatón",
    previewTestId: "clickaton-card-member-preview",
  },
];

type Props = {
  registrationId: string;
  welcomeState: ParticipantCardUiState;
  memberState: ParticipantCardUiState;
};

function stateLabel(state: ParticipantCardUiState): string {
  switch (state) {
    case "available":
      return "Disponible";
    case "missing_photo":
      return "Falta fotografía";
    case "missing_consent":
      return "Falta consentimiento";
    case "not_confirmed":
      return "Inscripción no confirmada";
    case "error":
      return "Error de generación";
  }
}

function stateMessage(state: ParticipantCardUiState): string | null {
  switch (state) {
    case "missing_photo":
      return "Falta cargar una fotografía para descargar tu placa.";
    case "missing_consent":
      return "Falta el consentimiento necesario para generar tu placa.";
    case "not_confirmed":
      return "Tu inscripción debe estar confirmada para usar las placas.";
    case "error":
      return "No pudimos generar la placa. Probá de nuevo en unos minutos.";
    default:
      return null;
  }
}

export function ParticipantCardsSection({
  registrationId,
  welcomeState,
  memberState,
}: Props) {
  const [busyKind, setBusyKind] = useState<CardKind | null>(null);
  const [previewKind, setPreviewKind] = useState<CardKind | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [previewError, setPreviewError] = useState<string | null>(null);
  const [actionMessage, setActionMessage] = useState<string | null>(null);
  const objectUrlRef = useRef<string | null>(null);

  const stateFor = (kind: CardKind) =>
    kind === "welcome" ? welcomeState : memberState;

  const revokePreview = useCallback(() => {
    if (objectUrlRef.current) {
      URL.revokeObjectURL(objectUrlRef.current);
      objectUrlRef.current = null;
    }
    setPreviewUrl(null);
    setPreviewKind(null);
    setPreviewError(null);
  }, []);

  useEffect(() => () => revokePreview(), [revokePreview]);

  async function fetchPng(
    kind: CardKind,
    disposition: "inline" | "attachment"
  ): Promise<{ blob: Blob; filename: string }> {
    const url = `/api/account/registrations/${registrationId}/cards/${kind}?disposition=${disposition}`;
    const res = await fetch(url, { credentials: "same-origin" });
    if (res.status === 202) {
      throw new Error("generating");
    }
    if (!res.ok) {
      let code = "";
      try {
        const body = (await res.json()) as { code?: string };
        code = body.code ?? "";
      } catch {
        /* ignore */
      }
      if (code === "CLICKATON_CARD_PHOTO_REQUIRED") {
        throw new Error("missing_photo");
      }
      if (code === "CLICKATON_CARD_CONSENT_REQUIRED") {
        throw new Error("missing_consent");
      }
      if (code === "CLICKATON_CARD_NOT_ELIGIBLE") {
        throw new Error("not_confirmed");
      }
      throw new Error("generate_failed");
    }
    const blob = await res.blob();
    const cd = res.headers.get("content-disposition") ?? "";
    const match = /filename="([^"]+)"/.exec(cd);
    const filename = match?.[1] ?? `clickaton-${kind}.png`;
    return { blob, filename };
  }

  async function openPreview(kind: CardKind) {
    if (stateFor(kind) !== "available") return;
    setBusyKind(kind);
    setActionMessage(null);
    setPreviewError(null);
    try {
      const { blob } = await fetchPng(kind, "inline");
      if (objectUrlRef.current) URL.revokeObjectURL(objectUrlRef.current);
      const url = URL.createObjectURL(blob);
      objectUrlRef.current = url;
      setPreviewUrl(url);
      setPreviewKind(kind);
    } catch (e) {
      setPreviewError(
        e instanceof Error && e.message === "generating"
          ? "Generando placa… Probá de nuevo en unos segundos."
          : "No se pudo generar la vista previa."
      );
      setPreviewKind(kind);
    } finally {
      setBusyKind(null);
    }
  }

  async function download(kind: CardKind) {
    if (stateFor(kind) !== "available" || busyKind) return;
    setBusyKind(kind);
    setActionMessage(null);
    try {
      const { blob, filename } = await fetchPng(kind, "attachment");
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = filename;
      a.rel = "noopener";
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
      setActionMessage("Descarga iniciada.");
    } catch (e) {
      setActionMessage(
        e instanceof Error && e.message === "generating"
          ? "Generando placa… Probá de nuevo en unos segundos."
          : "No se pudo descargar la placa. Probá de nuevo."
      );
    } finally {
      setBusyKind(null);
    }
  }

  async function share(kind: CardKind) {
    if (stateFor(kind) !== "available" || busyKind) return;
    setBusyKind(kind);
    setActionMessage(null);
    try {
      const { blob, filename } = await fetchPng(kind, "inline");
      const file = new File([blob], filename, { type: "image/png" });
      const nav = navigator as Navigator & {
        share?: (data: ShareData) => Promise<void>;
        canShare?: (data: ShareData) => boolean;
      };
      if (typeof nav.share === "function") {
        const data: ShareData = {
          title: "Mi placa Clickatón",
          text: "Descargá la placa y compartila en tu historia de Instagram, WhatsApp o la aplicación que prefieras.",
          files: [file],
        };
        if (!nav.canShare || nav.canShare(data)) {
          await nav.share(data);
          setActionMessage("Listo — compartiste tu placa.");
          return;
        }
      }
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
      setActionMessage(
        "Tu navegador no soporta compartir archivos. Descargamos la placa para que la subas vos."
      );
    } catch (e) {
      setActionMessage(
        e instanceof Error && e.message === "generating"
          ? "Generando placa… Probá de nuevo en unos segundos."
          : "No se pudo compartir. Probá Descargar PNG."
      );
    } finally {
      setBusyKind(null);
    }
  }

  return (
    <Card variant="outlined" className="space-y-6 border-ck-yellow/40 p-6">
      <header className="space-y-2">
        <p className="ck-label text-ck-yellow">Mis placas</p>
        <h2 className="font-semibold text-ck-text">Placas oficiales Clickatón</h2>
        <p className="text-sm leading-relaxed text-ck-text-secondary">
          Generá tu placa bajo demanda, descargala y compartila. No hay publicación
          automática desde Clickatón.
        </p>
      </header>

      <div className="grid gap-6 md:grid-cols-2">
        {CARDS.map((card) => {
          const state = stateFor(card.kind);
          const enabled = state === "available";
          const busy = busyKind === card.kind;
          return (
            <div
              key={card.kind}
              className="space-y-4 rounded-xl border border-ck-border bg-ck-bg-elevated p-5"
            >
              <div className="flex flex-wrap items-center gap-3">
                <h3 className="font-semibold text-ck-text">{card.title}</h3>
                <Badge variant={enabled ? "success" : "warning"}>
                  {stateLabel(state)}
                </Badge>
              </div>
              {stateMessage(state) ? (
                <p className="text-sm text-ck-text-secondary">{stateMessage(state)}</p>
              ) : (
                <p className="text-sm text-ck-text-secondary">
                  Descargá la placa y compartila en tu historia de Instagram, WhatsApp o
                  la aplicación que prefieras.
                </p>
              )}
              <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap">
                <Button
                  type="button"
                  variant="secondary"
                  className="min-h-11"
                  data-testid={card.previewTestId}
                  disabled={!enabled || busy}
                  onClick={() => void openPreview(card.kind)}
                >
                  {busy ? "Generando placa…" : "Vista previa"}
                </Button>
                <Button
                  type="button"
                  variant="primary"
                  className="min-h-11"
                  disabled={!enabled || busy}
                  onClick={() => void download(card.kind)}
                >
                  Descargar PNG
                </Button>
                <Button
                  type="button"
                  variant="secondary"
                  className="min-h-11"
                  disabled={!enabled || busy}
                  onClick={() => void share(card.kind)}
                >
                  Compartir
                </Button>
              </div>
            </div>
          );
        })}
      </div>

      {actionMessage ? (
        <p className="text-xs text-ck-text-secondary" role="status">
          {actionMessage}
        </p>
      ) : null}

      {previewKind ? (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4"
          data-testid="clickaton-card-preview-dialog"
          role="dialog"
          aria-modal="true"
          aria-label="Vista previa de placa"
          onClick={revokePreview}
          onKeyDown={(e) => {
            if (e.key === "Escape") revokePreview();
          }}
        >
          <div
            className="max-h-[90dvh] w-full max-w-md space-y-4 rounded-2xl border border-ck-border bg-ck-bg p-6"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between gap-4">
              <h3 className="font-semibold">
                {previewKind === "welcome"
                  ? "¡Bienvenid@ a Clickatón!"
                  : "Soy parte de Clickatón"}
              </h3>
              <Button type="button" variant="secondary" onClick={revokePreview}>
                Cerrar
              </Button>
            </div>
            {previewError ? (
              <p
                className="text-sm text-ck-text-secondary"
                data-testid="clickaton-card-preview-error"
              >
                {previewError}
              </p>
            ) : previewUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={previewUrl}
                alt="Vista previa de la placa"
                className="mx-auto max-h-[70dvh] w-auto rounded-lg border border-ck-border"
                data-testid="clickaton-card-preview-image"
              />
            ) : null}
          </div>
        </div>
      ) : null}
    </Card>
  );
}
