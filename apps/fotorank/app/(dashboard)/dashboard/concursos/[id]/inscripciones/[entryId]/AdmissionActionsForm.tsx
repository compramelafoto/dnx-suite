"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";

type Props = { contestId: string; entryId: string; categorySlug: string };

export function AdmissionActionsForm({ contestId, entryId, categorySlug }: Props) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [reasonCode, setReasonCode] = useState("ADMISSION_APPROVED");
  const [notes, setNotes] = useState("");
  const [publicMessage, setPublicMessage] = useState("");
  const [argraStatus, setArgraStatus] = useState("VERIFIED");
  const [revealArgra, setRevealArgra] = useState<string | null>(null);

  async function call(path: string, body: Record<string, unknown>) {
    setError(null);
    setInfo(null);
    const res = await fetch(`/api/fotorank/contests/${contestId}/admission/entries/${entryId}${path}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const data = (await res.json()) as { ok?: boolean; error?: { message?: string }; [k: string]: unknown };
    if (!res.ok || !data.ok) {
      setError(data.error?.message ?? "Acción fallida.");
      return false;
    }
    setInfo("Acción registrada.");
    router.refresh();
    return true;
  }

  return (
    <div className="space-y-8" data-testid="admission-actions">
      <div className="space-y-4">
        <label className="block space-y-3">
          <span className="text-sm font-semibold">Reason code</span>
          <select
            className="fr-filter-select w-full"
            value={reasonCode}
            onChange={(e) => setReasonCode(e.target.value)}
            data-testid="admission-reason-code"
          >
            {[
              "ADMISSION_APPROVED",
              "ADMISSION_REJECTED",
              "MANUAL_REVIEW_REQUIRED",
              "EVIDENCE_REQUESTED",
              "REPLACEMENT_ALLOWED",
              "ORIGINAL_REQUIRED",
              "CAPTURE_DATE_MISSING",
              "CAPTURE_DATE_BEFORE_WINDOW",
              "GPS_OUTSIDE_SANTA_FE",
              "PROFESSIONAL_PHONE_NOT_ALLOWED",
              "AERIAL_DEVICE_NOT_IDENTIFIED",
              "ARGRA_VERIFICATION_PENDING",
              "ARGRA_VERIFICATION_REJECTED",
            ].map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
        </label>
        <label className="block space-y-3">
          <span className="text-sm font-semibold">Nota interna (no visible al participante)</span>
          <textarea
            className="fr-filter-input min-h-20 w-full"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
          />
        </label>
        <label className="block space-y-3">
          <span className="text-sm font-semibold">Mensaje público (rechazo / evidencia)</span>
          <textarea
            className="fr-filter-input min-h-20 w-full"
            value={publicMessage}
            onChange={(e) => setPublicMessage(e.target.value)}
          />
        </label>
      </div>

      <div className="flex flex-wrap gap-3">
        <button
          type="button"
          className="fr-btn fr-btn-primary px-4 py-3"
          disabled={pending}
          onClick={() =>
            startTransition(() => {
              void call("/admit", { reasonCode, notes });
            })
          }
        >
          Admitir
        </button>
        <button
          type="button"
          className="fr-btn fr-btn-secondary px-4 py-3"
          disabled={pending}
          onClick={() =>
            startTransition(() => {
              void call("/reject", {
                reasonCode: reasonCode === "ADMISSION_APPROVED" ? "ADMISSION_REJECTED" : reasonCode,
                publicMessage: publicMessage || undefined,
                internalNote: notes || undefined,
              });
            })
          }
        >
          Rechazar
        </button>
        <button
          type="button"
          className="fr-btn fr-btn-secondary px-4 py-3"
          disabled={pending}
          onClick={() =>
            startTransition(() => {
              void call("/evidence", {
                reasonCode: reasonCode === "ADMISSION_APPROVED" ? "ORIGINAL_REQUIRED" : reasonCode,
                types: ["ORIGINAL"],
                publicMessage: publicMessage || undefined,
                internalNote: notes || undefined,
              });
            })
          }
        >
          Solicitar evidencia
        </button>
        <button
          type="button"
          className="fr-btn fr-btn-secondary px-4 py-3"
          disabled={pending}
          onClick={() =>
            startTransition(() => {
              void call("/allow-replacement", {
                reasonCode: "REPLACEMENT_ALLOWED",
                publicMessage: publicMessage || undefined,
                internalNote: notes || undefined,
              });
            })
          }
        >
          Permitir reemplazo
        </button>
      </div>

      {categorySlug === "reportero-grafico" ? (
        <div className="space-y-4 border-t border-fr-border pt-8">
          <h3 className="font-semibold">Verificación ARGRA</h3>
          <p className="text-xs text-fr-muted">
            PENDING_INSTITUTIONAL_APPROVAL · LEGAL REVIEW REQUIRED · Sin integración externa.
          </p>
          <select
            className="fr-filter-select w-full"
            value={argraStatus}
            onChange={(e) => setArgraStatus(e.target.value)}
          >
            <option value="VERIFIED">VERIFIED</option>
            <option value="REJECTED">REJECTED</option>
            <option value="PENDING_VERIFICATION">PENDING_VERIFICATION</option>
            <option value="EVIDENCE_REQUESTED">EVIDENCE_REQUESTED</option>
          </select>
          <div className="flex flex-wrap gap-3">
            <button
              type="button"
              className="fr-btn fr-btn-primary px-4 py-3"
              disabled={pending}
              onClick={() =>
                startTransition(() => {
                  void call("/argra", { status: argraStatus, internalNote: notes || undefined });
                })
              }
            >
              Guardar ARGRA
            </button>
            <button
              type="button"
              className="fr-btn fr-btn-secondary px-4 py-3"
              disabled={pending}
              onClick={() =>
                startTransition(async () => {
                  const res = await fetch(
                    `/api/fotorank/contests/${contestId}/admission/entries/${entryId}?revealArgra=1`,
                  );
                  const data = (await res.json()) as {
                    ok?: boolean;
                    detail?: { argra?: { full?: string | null; redacted?: string } };
                  };
                  if (data.ok) {
                    setRevealArgra(data.detail?.argra?.full ?? data.detail?.argra?.redacted ?? "—");
                  }
                })
              }
            >
              Ver número (acción explícita)
            </button>
          </div>
          {revealArgra ? (
            <p className="text-sm text-amber-300">
              Valor protegido: {revealArgra} — no copiar a logs ni analytics.
            </p>
          ) : null}
        </div>
      ) : null}

      {error ? <p className="text-sm text-red-300">{error}</p> : null}
      {info ? <p className="text-sm text-emerald-300">{info}</p> : null}
    </div>
  );
}
