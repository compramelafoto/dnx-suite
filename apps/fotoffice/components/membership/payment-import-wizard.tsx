"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  confirmPaymentImportAction,
  validatePaymentImportAction,
  type PaymentImportValidationState,
} from "@/app/actions/payments-import";

type Step = 1 | 2 | 3;

const STEP_LABELS: Record<Step, string> = {
  1: "Preparar",
  2: "Pegar CSV",
  3: "Revisar e importar",
};

/**
 * Importación del registro de pagos anterior a FotoOffice.
 *
 * Mismos tres pasos que la importación de socios, a propósito: quien ya importó el padrón
 * no tiene que aprender otra pantalla. La diferencia está en lo que se le promete —acá no
 * se da de alta a nadie ni se modifica ninguna deuda— y eso se dice en cada paso, no una
 * sola vez al principio.
 */
export function PaymentImportWizard({
  prompt,
  csvHeaderExample,
}: {
  prompt: string;
  csvHeaderExample: string;
}) {
  const router = useRouter();
  const [step, setStep] = useState<Step>(1);
  const [copiedPrompt, setCopiedPrompt] = useState(false);
  const [copiedHeaders, setCopiedHeaders] = useState(false);
  const [csvText, setCsvText] = useState("");
  const [validation, setValidation] = useState<PaymentImportValidationState | null>(null);
  const [confirmError, setConfirmError] = useState<string | null>(null);
  const [done, setDone] = useState<{ imported: number; skipped: number } | null>(null);
  const [isPending, startTransition] = useTransition();

  const puedeImportar = validation?.ok && validation.errorCount === 0 && validation.willImport > 0;

  async function copiar(texto: string, marcar: (v: boolean) => void) {
    try {
      await navigator.clipboard.writeText(texto);
      marcar(true);
      setTimeout(() => marcar(false), 2000);
    } catch {
      marcar(false);
    }
  }

  function revisar() {
    setConfirmError(null);
    startTransition(async () => {
      const r = await validatePaymentImportAction(csvText);
      setValidation(r);
      if (r.ok) setStep(3);
    });
  }

  function importar() {
    setConfirmError(null);
    startTransition(async () => {
      const r = await confirmPaymentImportAction(csvText);
      if (!r.ok) {
        setConfirmError(r.error);
        return;
      }
      setDone({ imported: r.imported, skipped: r.skipped });
    });
  }

  if (done) {
    return (
      <div className="fo-card space-y-4 py-12 text-center">
        <p className="text-lg font-semibold text-[var(--fo-text)]">
          {done.imported} {done.imported === 1 ? "pago importado" : "pagos importados"}.
        </p>
        {done.skipped > 0 ? (
          <p className="text-sm text-[var(--fo-muted)]">
            Se omitieron {done.skipped} que ya estaban registrados.
          </p>
        ) : null}
        <p className="text-sm text-[var(--fo-muted)] leading-relaxed">
          Ya se ven en la ficha de cada socio y en su portal. Ninguna deuda cambió.
        </p>
        <button className="fo-btn fo-btn-primary" onClick={() => router.push("/members/cuotas")}>
          Volver a Cuotas
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <ol className="flex flex-wrap gap-2">
        {([1, 2, 3] as Step[]).map((s) => (
          <li
            key={s}
            className={`inline-flex min-h-9 items-center rounded-full px-3 text-xs font-semibold ${
              step === s
                ? "bg-[var(--fo-accent)] text-white"
                : step > s
                  ? "bg-[var(--fo-accent-muted)] text-[var(--fo-accent)]"
                  : "bg-[var(--fo-bg-elevated)] text-[var(--fo-muted)]"
            }`}
          >
            {s}. {STEP_LABELS[s]}
          </li>
        ))}
      </ol>

      {step === 1 ? (
        <div className="fo-card max-w-3xl space-y-5">
          <div className="space-y-2">
            <h2 className="text-lg font-semibold text-[var(--fo-text)]">Preparar la planilla</h2>
            <p className="text-sm leading-relaxed text-[var(--fo-muted)]">
              Si tenés el registro de pagos en Excel, en un cuaderno tipeado o en cualquier otro
              formato, podés usar ChatGPT para ordenarlo antes de importarlo. Es una ayuda, no un
              requisito: si ya está ordenado, armá el CSV vos y pasá al paso siguiente.
            </p>
          </div>

          <div className="space-y-2 rounded-lg border border-[var(--fo-border)] bg-[var(--fo-bg)] px-4 py-3 text-sm leading-relaxed text-[var(--fo-text)]">
            <p className="font-semibold">Qué hace y qué no hace esta importación</p>
            <ul className="list-disc space-y-1 pl-5 text-[var(--fo-muted)]">
              <li>Deja registrados los pagos para que el socio los vea en su portal.</li>
              <li>
                <strong>No da de alta socios.</strong> Si una fila trae un número que no está en
                el padrón, esa fila se rechaza.
              </li>
              <li>
                <strong>No modifica ninguna deuda.</strong> Los saldos y la deuda anterior al
                sistema quedan exactamente como están.
              </li>
            </ul>
          </div>

          <p className="rounded-lg border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-950">
            Revisá qué información compartís con herramientas externas antes de pegar datos de
            tus socios.
          </p>

          <div className="space-y-2">
            <p className="text-sm font-semibold text-[var(--fo-text)]">
              Prompt para pegar en ChatGPT
            </p>
            <pre className="max-h-72 overflow-auto whitespace-pre-wrap rounded-lg border border-[var(--fo-border)] bg-[var(--fo-bg)] p-4 text-xs leading-relaxed text-[var(--fo-text)]">
              {prompt}
            </pre>
            <div className="flex flex-wrap gap-3">
              <button
                type="button"
                className="fo-btn fo-btn-primary text-sm"
                onClick={() => void copiar(prompt, setCopiedPrompt)}
              >
                {copiedPrompt ? "Copiado ✓" : "Copiar prompt para ChatGPT"}
              </button>
              <button
                type="button"
                className="fo-btn fo-btn-secondary text-sm"
                onClick={() => void copiar(csvHeaderExample, setCopiedHeaders)}
              >
                {copiedHeaders ? "Copiado ✓" : "Copiar encabezados CSV"}
              </button>
            </div>
          </div>

          <div className="pt-2">
            <button type="button" className="fo-btn fo-btn-primary" onClick={() => setStep(2)}>
              Siguiente
            </button>
          </div>
        </div>
      ) : null}

      {step === 2 ? (
        <div className="fo-card max-w-3xl space-y-4">
          <h2 className="text-lg font-semibold text-[var(--fo-text)]">Pegá acá el CSV</h2>
          <p className="text-sm leading-relaxed text-[var(--fo-muted)]">
            Una fila por pago, no por socio. Si un socio pagó doce veces, son doce filas.
          </p>
          <textarea
            value={csvText}
            onChange={(e) => setCsvText(e.target.value)}
            rows={12}
            spellCheck={false}
            placeholder={csvHeaderExample}
            className="w-full rounded-lg border border-[var(--fo-border)] bg-[var(--fo-surface)] p-3 font-mono text-xs text-[var(--fo-text)]"
          />
          {validation && !validation.ok ? (
            <p className="text-sm text-[var(--fo-danger)]" role="alert">
              {validation.error}
            </p>
          ) : null}
          <div className="flex flex-wrap gap-3">
            <button type="button" className="fo-btn fo-btn-secondary" onClick={() => setStep(1)}>
              Volver
            </button>
            <button
              type="button"
              className="fo-btn fo-btn-primary disabled:opacity-60"
              disabled={isPending || csvText.trim() === ""}
              onClick={revisar}
            >
              {isPending ? "Revisando…" : "Revisar"}
            </button>
          </div>
        </div>
      ) : null}

      {step === 3 && validation?.ok ? (
        <div className="fo-card space-y-4">
          <div className="flex flex-wrap gap-x-6 gap-y-1 text-sm">
            <span>
              <strong className="tabular-nums">{validation.totalRows}</strong> filas leídas
            </span>
            <span className="text-[var(--fo-success)]">
              <strong className="tabular-nums">{validation.validCount}</strong> sin observaciones
            </span>
            <span className="text-[var(--fo-warning)]">
              <strong className="tabular-nums">{validation.warningCount}</strong> con aviso
            </span>
            <span className="text-[var(--fo-danger)]">
              <strong className="tabular-nums">{validation.errorCount}</strong> con error
            </span>
          </div>

          {validation.errorCount > 0 ? (
            <p className="rounded-lg border border-[var(--fo-danger-border)] bg-[var(--fo-danger-soft)] px-4 py-3 text-sm text-[var(--fo-danger)]">
              No se importa nada mientras haya filas con error. Corregí la planilla y volvé a
              revisar: importar sólo una parte deja un historial incompleto que después nadie
              audita.
            </p>
          ) : null}

          <div className="max-h-[28rem] overflow-auto">
            <table className="w-full min-w-[46rem] text-left text-xs">
              <thead className="sticky top-0 bg-[var(--fo-bg)] text-[var(--fo-muted-soft)]">
                <tr>
                  <th className="px-2 py-2 font-medium">Fila</th>
                  <th className="px-2 py-2 font-medium">Socio</th>
                  <th className="px-2 py-2 font-medium">Fecha</th>
                  <th className="px-2 py-2 font-medium">Importe</th>
                  <th className="px-2 py-2 font-medium">Observaciones</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--fo-border)]">
                {validation.rows.map((r) => (
                  <tr key={r.rowNumber} className={r.status === "ERROR" ? "bg-[var(--fo-danger-soft)]" : ""}>
                    <td className="px-2 py-2 tabular-nums">{r.rowNumber}</td>
                    <td className="px-2 py-2">
                      <span className="tabular-nums">{r.memberNumber}</span>
                      {r.memberName ? (
                        <span className="text-[var(--fo-muted)]"> · {r.memberName}</span>
                      ) : null}
                    </td>
                    <td className="px-2 py-2 tabular-nums">{r.paidAtLabel}</td>
                    <td className="px-2 py-2 tabular-nums">{r.amountLabel}</td>
                    <td className="px-2 py-2">
                      {r.errors.map((e, i) => (
                        <p key={`e${i}`} className="text-[var(--fo-danger)]">
                          {e}
                        </p>
                      ))}
                      {r.warnings.map((w, i) => (
                        <p key={`w${i}`} className="text-[var(--fo-warning)]">
                          {w}
                        </p>
                      ))}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {confirmError ? (
            <p className="text-sm text-[var(--fo-danger)]" role="alert">
              {confirmError}
            </p>
          ) : null}

          <div className="flex flex-wrap gap-3">
            <button type="button" className="fo-btn fo-btn-secondary" onClick={() => setStep(2)}>
              Corregir el CSV
            </button>
            <button
              type="button"
              className="fo-btn fo-btn-primary disabled:opacity-60"
              disabled={isPending || !puedeImportar}
              onClick={importar}
            >
              {isPending ? "Importando…" : `Importar ${validation.willImport} pagos`}
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
