"use client";

import { useState, useTransition } from "react";

type Props = {
  contestId: string;
  contestSlug: string;
};

type EntryView = {
  id: string;
  status: string;
  entryNumber: string | null;
  technicalSummaryStatus: string;
  previewUrl: string | null;
  checks: Array<{ checkCode: string; status: string; title: string; message: string }>;
};

export function EntryUploadPanel({ contestId }: Props) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [entry, setEntry] = useState<EntryView | null>(null);
  const [phase, setPhase] = useState<"idle" | "uploading" | "processing" | "done">("idle");

  async function refresh() {
    const res = await fetch(`/api/fotorank/contests/${contestId}/entries/me`);
    if (!res.ok) return;
    const data = (await res.json()) as { entry: EntryView };
    setEntry(data.entry);
  }

  async function onFile(file: File, replace = false) {
    setError(null);
    setInfo(null);
    setPhase("uploading");
    startTransition(async () => {
      try {
        const intentRes = await fetch(`/api/fotorank/contests/${contestId}/entries/upload-intent`, {
          method: "POST",
        });
        const intent = (await intentRes.json()) as {
          ok?: boolean;
          entryId?: string;
          uploadUrl?: string;
          error?: { message?: string };
        };
        if (!intentRes.ok || !intent.entryId || !intent.uploadUrl) {
          setError(intent.error?.message ?? "No se pudo iniciar la carga.");
          setPhase("idle");
          return;
        }

        setPhase("processing");
        setInfo("Estamos verificando el archivo.");
        const fd = new FormData();
        fd.set("file", file);
        if (replace) fd.set("replace", "1");
        const upRes = await fetch(
          replace
            ? `/api/fotorank/contests/${contestId}/entries/${intent.entryId}/replace`
            : intent.uploadUrl,
          { method: "POST", body: fd },
        );
        const up = (await upRes.json()) as {
          ok?: boolean;
          error?: { message?: string };
          technicalSummaryStatus?: string;
          warnings?: string[];
        };
        if (!upRes.ok || !up.ok) {
          setError(up.error?.message ?? "No se pudo subir la fotografía.");
          setPhase("idle");
          return;
        }

        await refresh();
        setPhase("done");
        if (up.technicalSummaryStatus === "APPROVED") {
          setInfo("La fotografía cumple los requisitos.");
        } else if (up.technicalSummaryStatus === "APPROVED_WITH_WARNINGS") {
          setInfo("La fotografía fue aceptada con advertencias. Falta información en metadatos no implica rechazo.");
        } else if (up.technicalSummaryStatus === "REQUIRES_REVIEW") {
          setInfo("La fotografía necesita revisión.");
        } else if (up.technicalSummaryStatus === "TECHNICALLY_REJECTED") {
          setInfo("Hay requisitos técnicos que no se cumplen. Podés reemplazarla.");
        } else {
          setInfo("Tu fotografía fue recibida.");
        }
      } catch {
        setError("Error de red al subir.");
        setPhase("idle");
      }
    });
  }

  async function confirm(acknowledgeWarnings = false) {
    if (!entry) return;
    setError(null);
    startTransition(async () => {
      const res = await fetch(`/api/fotorank/contests/${contestId}/entries/${entry.id}/confirm`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ acknowledgeWarnings }),
      });
      const data = (await res.json()) as { ok?: boolean; entryNumber?: string; error?: { message?: string }; message?: string };
      if (!res.ok || !data.ok) {
        setError(data.error?.message ?? "No se pudo confirmar.");
        return;
      }
      setInfo(data.message ?? "Tu obra quedó confirmada.");
      await refresh();
    });
  }

  return (
    <section className="fr-recuadro mt-10 space-y-6 border border-fr-border bg-fr-card" data-testid="entry-upload-panel">
      <h2 className="text-xl font-semibold tracking-tight">Fotografía</h2>
      <p className="text-sm text-fr-muted">
        JPG/JPEG. La ausencia de EXIF no implica rechazo automático. El original se guarda de forma privada.
      </p>

      <label className="block">
        <span className="text-sm font-semibold text-fr-primary">Seleccionar archivo</span>
        <input
          type="file"
          accept="image/jpeg,.jpg,.jpeg"
          className="mt-4 block w-full text-sm text-fr-muted"
          data-testid="entry-file-input"
          disabled={pending}
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) void onFile(f, Boolean(entry && entry.status !== "DRAFT"));
          }}
        />
      </label>

      {phase === "uploading" || phase === "processing" ? (
        <p className="text-gold" data-testid="entry-processing">
          {phase === "uploading" ? "Subiendo…" : "Estamos verificando el archivo…"}
        </p>
      ) : null}

      {info ? <p className="text-sm text-fr-primary" data-testid="entry-info">{info}</p> : null}
      {error ? (
        <p className="rounded-xl border border-red-500/35 bg-red-500/10 px-4 py-3 text-sm text-red-200" role="alert">
          {error}
        </p>
      ) : null}

      {entry?.previewUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={entry.previewUrl}
          alt="Vista previa"
          className="max-h-80 rounded-xl border border-fr-border object-contain"
          data-testid="entry-preview"
        />
      ) : null}

      {entry ? (
        <div className="space-y-4" data-testid="entry-status-block">
          <p className="text-sm text-fr-muted">
            Estado: <span className="text-fr-primary">{entry.status}</span> · Técnico:{" "}
            <span className="text-fr-primary">{entry.technicalSummaryStatus}</span>
          </p>
          {entry.entryNumber ? (
            <p className="text-lg font-semibold text-gold" data-testid="entry-number">
              Obra {entry.entryNumber}
            </p>
          ) : null}
          <ul className="space-y-2 text-sm">
            {entry.checks.slice(0, 12).map((c) => (
              <li key={c.checkCode} className="flex gap-3">
                <span className="w-28 shrink-0 font-medium text-fr-muted">{c.status}</span>
                <span className="text-fr-primary">{c.title}: {c.message}</span>
              </li>
            ))}
          </ul>
          {entry.status !== "CONFIRMED" &&
          (entry.status === "READY_TO_CONFIRM" || entry.status === "REQUIRES_REVIEW") ? (
            <div className="flex flex-wrap gap-3">
              <button
                type="button"
                className="fr-btn fr-btn-primary px-6 py-3"
                disabled={pending}
                data-testid="entry-confirm"
                onClick={() => void confirm(entry.status === "REQUIRES_REVIEW")}
              >
                Confirmar obra
              </button>
            </div>
          ) : null}
        </div>
      ) : null}
    </section>
  );
}
