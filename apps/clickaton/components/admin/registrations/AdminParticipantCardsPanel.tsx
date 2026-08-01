"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/Button";

type Props = {
  registrationId: string;
  participantName: string;
  instagramNormalized: string | null;
  hasPhoto: boolean;
  numberLabel: string;
  categoryLabel: string;
  statusLabel: string;
  paymentLabel: string;
  hasConsent: boolean;
  welcomeEligible: boolean;
  memberEligible: boolean;
};

type CardKind = "welcome" | "member";

export function AdminParticipantCardsPanel({
  registrationId,
  participantName,
  instagramNormalized,
  hasPhoto,
  numberLabel,
  categoryLabel,
  statusLabel,
  paymentLabel,
  hasConsent,
  welcomeEligible,
  memberEligible,
}: Props) {
  const [busy, setBusy] = useState<string | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [previewTitle, setPreviewTitle] = useState("");
  const [diag, setDiag] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const objectUrlRef = useRef<string | null>(null);

  const revoke = useCallback(() => {
    if (objectUrlRef.current) {
      URL.revokeObjectURL(objectUrlRef.current);
      objectUrlRef.current = null;
    }
    setPreviewUrl(null);
  }, []);

  useEffect(() => () => revoke(), [revoke]);

  function formatDiagnostic(body: Record<string, unknown>) {
    const sourceSummary = body.sourceSummary as
      | { templateVersion?: number }
      | undefined;
    return JSON.stringify(
      {
        eligibility: body.eligibility,
        warnings: body.warnings,
        sourceSummary: body.sourceSummary,
        cacheStatus: body.cacheStatus,
        generatedAt: body.generatedAt,
        templateVersion: sourceSummary?.templateVersion,
        renderHashPrefix: body.renderHashPrefix,
        recordStatus: body.recordStatus,
        width: body.width,
        height: body.height,
        durationMs: body.durationMs,
      },
      null,
      2
    );
  }

  async function run(
    kind: CardKind,
    action: "preview" | "download" | "diagnose"
  ) {
    const key = `${kind}:${action}`;
    setBusy(key);
    setError(null);
    setDiag(null);
    try {
      const base = `/api/admin/registrations/${registrationId}/cards/${kind}`;
      if (action === "diagnose") {
        const res = await fetch(`${base}?mode=preview`, {
          credentials: "same-origin",
          headers: { Accept: "application/json" },
        });
        const body = (await res.json()) as Record<string, unknown>;
        if (!res.ok) {
          throw new Error(String(body.error ?? "diagnóstico fallido"));
        }
        setDiag(formatDiagnostic(body));
        return;
      }

      const disposition = action === "download" ? "attachment" : "inline";
      const res = await fetch(`${base}?mode=preview&disposition=${disposition}`, {
        credentials: "same-origin",
      });
      if (!res.ok) {
        let msg = "No se pudo generar la placa";
        try {
          const body = (await res.json()) as { error?: string };
          if (body.error) msg = body.error;
        } catch {
          /* ignore */
        }
        throw new Error(msg);
      }
      const blob = await res.blob();
      const cd = res.headers.get("content-disposition") ?? "";
      const match = /filename="([^"]+)"/.exec(cd);
      const filename = match?.[1] ?? `clickaton-${kind}.png`;

      if (action === "download") {
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        a.remove();
        URL.revokeObjectURL(url);
        return;
      }

      if (objectUrlRef.current) URL.revokeObjectURL(objectUrlRef.current);
      const url = URL.createObjectURL(blob);
      objectUrlRef.current = url;
      setPreviewUrl(url);
      setPreviewTitle(
        kind === "welcome" ? "Bienvenida" : "Soy parte de Clickatón"
      );
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error de generación");
    } finally {
      setBusy(null);
    }
  }

  async function regenerate(kind: CardKind | "both") {
    if (
      !window.confirm(
        "Se generará nuevamente la placa usando los datos actuales."
      )
    ) {
      return;
    }

    const key = `regenerate:${kind}`;
    setBusy(key);
    setError(null);
    setDiag(null);
    try {
      const kinds: CardKind[] =
        kind === "both" ? ["welcome", "member"] : [kind];
      const results: Record<string, unknown>[] = [];

      for (const cardKind of kinds) {
        const base = `/api/admin/registrations/${registrationId}/cards/${cardKind}`;
        const res = await fetch(`${base}?force=1&mode=preview`, {
          credentials: "same-origin",
          headers: { Accept: "application/json" },
        });
        const body = (await res.json()) as Record<string, unknown>;
        if (!res.ok) {
          throw new Error(String(body.error ?? `Regeneración fallida (${cardKind})`));
        }
        results.push({
          cardType: cardKind,
          cacheStatus: body.cacheStatus,
          generatedAt: body.generatedAt,
          templateVersion: (body.sourceSummary as { templateVersion?: number })
            ?.templateVersion,
          renderHashPrefix: body.renderHashPrefix,
          recordStatus: body.recordStatus,
          durationMs: body.durationMs,
        });
      }

      setDiag(JSON.stringify(results, null, 2));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error de regeneración");
    } finally {
      setBusy(null);
    }
  }

  return (
    <section
      className="space-y-6 rounded-xl border border-ck-border bg-ck-bg-elevated p-6"
      data-testid="admin-participant-cards"
    >
      <header className="space-y-2">
        <p className="text-xs font-semibold uppercase tracking-wide text-ck-yellow">
          Placas del participante
        </p>
        <h2 className="text-lg font-semibold">Template V2 (persistido)</h2>
        <p className="text-sm text-ck-text-secondary">
          Get-or-generate con caché R2/DB. No edita plantillas ni publica en redes.
        </p>
      </header>

      <dl className="grid gap-4 text-sm sm:grid-cols-2 lg:grid-cols-3">
        <div>
          <dt className="text-ck-text-muted">Nombre</dt>
          <dd className="font-medium">{participantName}</dd>
        </div>
        <div>
          <dt className="text-ck-text-muted">Instagram</dt>
          <dd>{instagramNormalized ? `@${instagramNormalized}` : "—"}</dd>
        </div>
        <div>
          <dt className="text-ck-text-muted">Fotografía</dt>
          <dd>{hasPhoto ? "Disponible" : "Ausente"}</dd>
        </div>
        <div>
          <dt className="text-ck-text-muted">Número</dt>
          <dd>{numberLabel}</dd>
        </div>
        <div>
          <dt className="text-ck-text-muted">Categoría</dt>
          <dd>{categoryLabel}</dd>
        </div>
        <div>
          <dt className="text-ck-text-muted">Estado</dt>
          <dd>
            {statusLabel} · {paymentLabel}
          </dd>
        </div>
        <div>
          <dt className="text-ck-text-muted">Consentimiento</dt>
          <dd>{hasConsent ? "Presente (proxy imagen/términos)" : "Ausente"}</dd>
        </div>
        <div>
          <dt className="text-ck-text-muted">Elegibilidad Welcome</dt>
          <dd>{welcomeEligible ? "Sí" : "No"}</dd>
        </div>
        <div>
          <dt className="text-ck-text-muted">Elegibilidad Member</dt>
          <dd>{memberEligible ? "Sí" : "No"}</dd>
        </div>
      </dl>

      <div className="flex flex-wrap gap-3">
        <Button
          type="button"
          variant="secondary"
          disabled={busy !== null}
          onClick={() => void run("welcome", "preview")}
        >
          Vista previa Bienvenida
        </Button>
        <Button
          type="button"
          variant="secondary"
          disabled={busy !== null}
          onClick={() => void run("welcome", "download")}
        >
          Descargar Bienvenida
        </Button>
        <Button
          type="button"
          variant="secondary"
          disabled={busy !== null}
          onClick={() => void run("member", "preview")}
        >
          Vista previa Soy parte
        </Button>
        <Button
          type="button"
          variant="secondary"
          disabled={busy !== null}
          onClick={() => void run("member", "download")}
        >
          Descargar Soy parte
        </Button>
        <Button
          type="button"
          variant="primary"
          disabled={busy !== null}
          onClick={() => void run("welcome", "diagnose")}
        >
          Ver diagnóstico
        </Button>
        <Button
          type="button"
          variant="secondary"
          disabled={busy !== null}
          onClick={() => void regenerate("welcome")}
        >
          Regenerar Bienvenida
        </Button>
        <Button
          type="button"
          variant="secondary"
          disabled={busy !== null}
          onClick={() => void regenerate("member")}
        >
          Regenerar Soy parte
        </Button>
        <Button
          type="button"
          variant="secondary"
          disabled={busy !== null}
          onClick={() => void regenerate("both")}
        >
          Regenerar ambas
        </Button>
      </div>

      {busy ? (
        <p className="text-xs text-ck-text-muted" role="status">
          Generando… ({busy})
        </p>
      ) : null}
      {error ? (
        <p className="text-sm text-red-400" role="alert">
          {error}
        </p>
      ) : null}
      {diag ? (
        <pre className="max-h-64 overflow-auto rounded-lg border border-ck-border bg-ck-bg p-4 text-xs">
          {diag}
        </pre>
      ) : null}
      {previewUrl ? (
        <div className="space-y-3">
          <div className="flex items-center justify-between gap-3">
            <p className="font-medium">Preview: {previewTitle}</p>
            <Button type="button" variant="secondary" onClick={revoke}>
              Cerrar preview
            </Button>
          </div>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={previewUrl}
            alt={`Preview ${previewTitle}`}
            className="mx-auto max-h-[480px] w-auto rounded-lg border border-ck-border"
          />
        </div>
      ) : null}
    </section>
  );
}
