"use client";

import { useEffect, useState, useTransition } from "react";

type Props = {
  contestId: string;
  contestSlug: string;
};

type EntryView = {
  id: string;
  status: string;
  entryNumber: string | null;
  technicalSummaryStatus: string;
  manualReviewStatus?: string | null;
  admissionStatus?: string | null;
  admissionPublic?: {
    logicalState: string;
    publicLabel: string;
    publicMessage: string;
    replacementAllowed: boolean;
    evidenceRequested: boolean;
    evidenceDeadlineAt: string | null;
    evidencePublicMessage: string | null;
    admitted: boolean;
    rejected: boolean;
    frozen: boolean;
  };
  publicRejectionReason?: string | null;
  previewUrl: string | null;
  checks: Array<{ checkCode: string; status: string; title: string; message: string }>;
};

export function EntryUploadPanel({ contestId, contestSlug }: Props) {
  const requiresSantaFeEligibility =
    contestSlug === "santa-fe-en-foco" || contestSlug.includes("santa-fe");
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [entry, setEntry] = useState<EntryView | null>(null);
  const [phase, setPhase] = useState<"idle" | "uploading" | "processing" | "done">("idle");
  const [captureLocality, setCaptureLocality] = useState("");
  const [captureDepartment, setCaptureDepartment] = useState("");
  const [territoryConfirmed, setTerritoryConfirmed] = useState(false);
  const [declaredDeviceKind, setDeclaredDeviceKind] = useState("UNKNOWN");
  const [declaredDeviceMake, setDeclaredDeviceMake] = useState("");
  const [declaredDeviceModel, setDeclaredDeviceModel] = useState("");
  const [captureWithinPeriod, setCaptureWithinPeriod] = useState(false);
  const [droneAck, setDroneAck] = useState(false);

  async function refresh() {
    const res = await fetch(`/api/fotorank/contests/${contestId}/entries/me`);
    if (!res.ok) return;
    const data = (await res.json()) as { entry: EntryView };
    setEntry(data.entry);
  }

  useEffect(() => {
    void refresh();
    // Cargar estado de obra / admisión pública al montar (reemplazo, evidencia, etc.).
    // eslint-disable-next-line react-hooks/exhaustive-deps -- solo al montar / cambio de concurso
  }, [contestId]);

  async function onFile(file: File, replace = false) {
    setError(null);
    setInfo(null);
    if (requiresSantaFeEligibility) {
      if (!territoryConfirmed || !captureLocality.trim()) {
        setError("Confirmá territorio y localidad de captura en Santa Fe antes de subir.");
        return;
      }
      if (!captureWithinPeriod) {
        setError("Confirmá que la fotografía fue tomada en el período oficial.");
        return;
      }
      if (declaredDeviceKind === "UNKNOWN") {
        setError("Indicá el tipo de dispositivo utilizado.");
        return;
      }
    }
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
        if (requiresSantaFeEligibility) {
          fd.set("captureLocality", captureLocality.trim());
          if (captureDepartment.trim()) fd.set("captureDepartment", captureDepartment.trim());
          fd.set("territoryConfirmedSantaFe", territoryConfirmed ? "1" : "0");
          fd.set("declaredDeviceKind", declaredDeviceKind);
          if (declaredDeviceMake.trim()) fd.set("declaredDeviceMake", declaredDeviceMake.trim());
          if (declaredDeviceModel.trim()) fd.set("declaredDeviceModel", declaredDeviceModel.trim());
          fd.set("captureWithinPeriodDeclared", captureWithinPeriod ? "1" : "0");
          if (droneAck) fd.set("droneRegulationAcknowledged", "1");
        }
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
      const data = (await res.json()) as {
        ok?: boolean;
        entryNumber?: string;
        error?: { message?: string };
        message?: string;
      };
      if (!res.ok || !data.ok) {
        setError(data.error?.message ?? "No se pudo confirmar.");
        return;
      }
      setInfo(data.message ?? "Tu obra quedó confirmada.");
      await refresh();
    });
  }

  return (
    <section className="fr-public-card mt-10 space-y-6" data-testid="entry-upload-panel">
      <h2 className="text-xl font-semibold tracking-tight">Fotografía</h2>
      <p className="text-sm text-[var(--foreground-muted)]">
        JPG/JPEG. Una fotografía por participante. El GPS no es obligatorio y nunca se publica. El original se
        guarda de forma privada.
      </p>

      {requiresSantaFeEligibility ? (
        <>
          <label className="block">
            <span className="text-sm font-semibold text-[var(--foreground)]">Localidad o paraje de captura</span>
            <input
              className="mt-4 w-full rounded-xl border border-[var(--border)] bg-[var(--background)] px-5 py-4"
              value={captureLocality}
              onChange={(e) => setCaptureLocality(e.target.value)}
              data-testid="entry-capture-locality"
            />
          </label>
          <label className="block">
            <span className="text-sm font-semibold text-[var(--foreground)]">Departamento (opcional)</span>
            <input
              className="mt-4 w-full rounded-xl border border-[var(--border)] bg-[var(--background)] px-5 py-4"
              value={captureDepartment}
              onChange={(e) => setCaptureDepartment(e.target.value)}
              data-testid="entry-capture-department"
            />
          </label>
          <label className="flex items-start gap-4 text-sm text-[var(--foreground)]">
            <input
              type="checkbox"
              className="mt-1 size-5 accent-[var(--primary)]"
              checked={territoryConfirmed}
              onChange={(e) => setTerritoryConfirmed(e.target.checked)}
              data-testid="entry-territory-confirm"
            />
            <span>La fotografía fue tomada dentro de la Provincia de Santa Fe.</span>
          </label>
          <label className="flex items-start gap-4 text-sm text-[var(--foreground)]">
            <input
              type="checkbox"
              className="mt-1 size-5 accent-[var(--primary)]"
              checked={captureWithinPeriod}
              onChange={(e) => setCaptureWithinPeriod(e.target.checked)}
              data-testid="entry-period-confirm"
            />
            <span>Declaro que la fotografía fue tomada durante el período oficial del concurso.</span>
          </label>
          <label className="block">
            <span className="text-sm font-semibold text-[var(--foreground)]">Dispositivo utilizado</span>
            <select
              className="mt-4 w-full rounded-xl border border-[var(--border)] bg-[var(--background)] px-5 py-4"
              value={declaredDeviceKind}
              onChange={(e) => setDeclaredDeviceKind(e.target.value)}
              data-testid="entry-device-kind"
            >
              <option value="UNKNOWN">Seleccioná…</option>
              <option value="SMARTPHONE">Teléfono celular</option>
              <option value="DSLR">Cámara DSLR</option>
              <option value="MIRRORLESS">Cámara mirrorless</option>
              <option value="COMPACT_CAMERA">Cámara compacta</option>
              <option value="BRIDGE_CAMERA">Cámara bridge</option>
              <option value="OTHER_CAMERA">Otra cámara</option>
              <option value="DRONE">Dron</option>
            </select>
          </label>
          <div className="grid gap-6 md:grid-cols-2">
            <label className="block">
              <span className="text-sm font-semibold text-[var(--foreground)]">Marca (si falta en EXIF)</span>
              <input
                className="mt-4 w-full rounded-xl border border-[var(--border)] bg-[var(--background)] px-5 py-4"
                value={declaredDeviceMake}
                onChange={(e) => setDeclaredDeviceMake(e.target.value)}
                data-testid="entry-device-make"
              />
            </label>
            <label className="block">
              <span className="text-sm font-semibold text-[var(--foreground)]">Modelo (si falta en EXIF)</span>
              <input
                className="mt-4 w-full rounded-xl border border-[var(--border)] bg-[var(--background)] px-5 py-4"
                value={declaredDeviceModel}
                onChange={(e) => setDeclaredDeviceModel(e.target.value)}
                data-testid="entry-device-model"
              />
            </label>
          </div>
          {declaredDeviceKind === "DRONE" ? (
            <label className="flex items-start gap-4 text-sm text-[var(--foreground-muted)]">
              <input
                type="checkbox"
                className="mt-1 size-5 accent-[var(--primary)]"
                checked={droneAck}
                onChange={(e) => setDroneAck(e.target.checked)}
                data-testid="entry-drone-ack"
              />
              <span>
                Declaro haber cumplido la normativa aplicable a la operación del dron. LEGAL REVIEW REQUIRED —
                no implica verificación automática.
              </span>
            </label>
          ) : null}
        </>
      ) : null}

      <label className="block">
        <span className="text-sm font-semibold text-[var(--foreground)]">Seleccionar archivo</span>
        <input
          type="file"
          accept="image/jpeg,.jpg,.jpeg"
          className="mt-4 block w-full text-sm text-[var(--foreground-muted)]"
          data-testid="entry-file-input"
          disabled={pending}
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) void onFile(f, Boolean(entry && entry.status !== "DRAFT"));
          }}
        />
      </label>

      {phase === "uploading" || phase === "processing" ? (
        <p className="text-[var(--primary)]" data-testid="entry-processing">
          {phase === "uploading" ? "Subiendo…" : "Estamos verificando el archivo…"}
        </p>
      ) : null}

      {info ? (
        <p className="text-sm text-[var(--foreground)]" data-testid="entry-info">
          {info}
        </p>
      ) : null}
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
          className="max-h-80 rounded-xl border border-[var(--border)] object-contain"
          data-testid="entry-preview"
        />
      ) : null}

      {entry ? (
        <div className="space-y-4" data-testid="entry-status-block">
          <p className="text-sm text-[var(--foreground-muted)]">
            Estado de la obra:{" "}
            <span className="text-[var(--foreground)]">
              {entry.status === "CONFIRMED"
                ? "Presentada"
                : entry.status === "READY_TO_CONFIRM"
                  ? "Lista para confirmar"
                  : entry.status === "REQUIRES_REVIEW"
                    ? "Requiere revisión"
                    : entry.status === "DRAFT"
                      ? "Borrador"
                      : "En proceso"}
            </span>
          </p>
          {entry.admissionPublic ? (
            <div
              className="rounded-xl border border-[var(--border)] bg-[var(--background)]/40 px-4 py-4 space-y-2"
              data-testid="admission-public-status"
            >
              <p className="text-base font-semibold text-[var(--foreground)]">{entry.admissionPublic.publicLabel}</p>
              <p className="text-sm text-[var(--foreground-muted)]">{entry.admissionPublic.publicMessage}</p>
              {entry.admissionPublic.evidenceRequested ? (
                <p className="text-sm text-amber-300">
                  {entry.admissionPublic.evidencePublicMessage}
                  {entry.admissionPublic.evidenceDeadlineAt
                    ? ` · Plazo: ${entry.admissionPublic.evidenceDeadlineAt.slice(0, 10)}`
                    : ""}
                </p>
              ) : null}
              {entry.admissionPublic.replacementAllowed ? (
                <p className="text-sm text-[var(--primary)]">Reemplazo habilitado: podés subir un nuevo archivo.</p>
              ) : null}
              {entry.publicRejectionReason ? (
                <p className="text-sm text-red-300">{entry.publicRejectionReason}</p>
              ) : null}
            </div>
          ) : null}
          {entry.entryNumber ? (
            <p className="text-lg font-semibold text-[var(--primary)]" data-testid="entry-number">
              Obra {entry.entryNumber}
            </p>
          ) : null}
          <ul className="space-y-2 text-sm">
            {entry.checks.slice(0, 12).map((c) => (
              <li key={c.checkCode} className="flex gap-3">
                <span className="w-28 shrink-0 font-medium text-[var(--foreground-muted)]">{c.status}</span>
                <span className="text-[var(--foreground)]">
                  {c.title}: {c.message}
                </span>
              </li>
            ))}
          </ul>
          {entry.status !== "CONFIRMED" &&
          (entry.status === "READY_TO_CONFIRM" || entry.status === "REQUIRES_REVIEW") ? (
            <div className="flex flex-wrap gap-3">
              <button
                type="button"
                className="fr-public-btn fr-public-btn--primary px-6 py-3"
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
