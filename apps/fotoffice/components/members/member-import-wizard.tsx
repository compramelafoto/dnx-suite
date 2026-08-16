"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  confirmMemberImportAction,
  validateMemberImportAction,
  type MemberImportValidationState,
} from "@/app/actions/members-import";

type Step = 1 | 2 | 3;

const STEP_LABELS: Record<Step, string> = {
  1: "Preparar",
  2: "Pegar CSV",
  3: "Revisar e importar",
};

export function MemberImportWizard({
  prompt,
  csvHeaderExample,
  hasCategories,
  workspaceName,
}: {
  prompt: string;
  csvHeaderExample: string;
  hasCategories: boolean;
  workspaceName: string;
}) {
  const router = useRouter();
  const [step, setStep] = useState<Step>(1);
  const [copiedPrompt, setCopiedPrompt] = useState(false);
  const [copiedHeaders, setCopiedHeaders] = useState(false);
  const [csvText, setCsvText] = useState("");
  const [validation, setValidation] = useState<MemberImportValidationState | null>(null);
  const [confirmError, setConfirmError] = useState<string | null>(null);
  const [importedCount, setImportedCount] = useState<number | null>(null);
  const [isPending, startTransition] = useTransition();

  const canConfirm = validation?.ok && validation.errorCount === 0 && validation.validCount > 0;

  async function copy(text: string, setCopied: (v: boolean) => void) {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      setCopied(false);
    }
  }

  function handleValidate() {
    setConfirmError(null);
    startTransition(async () => {
      const result = await validateMemberImportAction(csvText);
      setValidation(result);
      if (result.ok) setStep(3);
    });
  }

  function handleConfirmImport() {
    setConfirmError(null);
    startTransition(async () => {
      const result = await confirmMemberImportAction(csvText);
      if (!result.ok) {
        setConfirmError(result.error);
        return;
      }
      setImportedCount(result.createdCount);
    });
  }

  function handleClear() {
    setCsvText("");
    setValidation(null);
    setConfirmError(null);
  }

  const summary = useMemo(() => {
    if (!validation?.ok) return null;
    return validation;
  }, [validation]);

  if (importedCount !== null) {
    return (
      <div className="fo-card space-y-4 text-center py-12">
        <p className="text-lg font-semibold text-[var(--fo-text)]">
          {importedCount} {importedCount === 1 ? "socio importado" : "socios importados"} correctamente.
        </p>
        <button className="fo-btn fo-btn-primary" onClick={() => router.push("/members")}>
          Ver padrón
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
        <div className="fo-card space-y-5 max-w-3xl">
          <div className="space-y-2">
            <h2 className="text-lg font-semibold text-[var(--fo-text)]">Preparar la información</h2>
            <p className="text-sm text-[var(--fo-muted)] leading-relaxed">
              Si ya tenés un padrón en Excel, Word, una lista, mensajes o cualquier otro formato,
              podés usar ChatGPT (u otra IA) para ordenarlo antes de importarlo. Es una ayuda, no
              un requisito: si tus datos ya están ordenados, podés armar el CSV vos mismo y pasar
              directo al paso siguiente.
            </p>
          </div>

          {!hasCategories ? (
            <p className="rounded-lg border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-950">
              Todavía no creaste ninguna categoría de socios. Creá al menos una antes de importar —
              cada fila del CSV necesita una categoría existente.
            </p>
          ) : null}

          <p className="rounded-lg border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-950">
            Revisá qué información compartís con herramientas externas antes de pegar datos
            personales de tus socios.
          </p>

          <div className="space-y-2">
            <p className="text-sm font-semibold text-[var(--fo-text)]">Prompt para pegar en ChatGPT</p>
            <pre className="max-h-72 overflow-auto whitespace-pre-wrap rounded-lg border border-[var(--fo-border)] bg-[var(--fo-bg)] p-4 text-xs leading-relaxed text-[var(--fo-text)]">
              {prompt}
            </pre>
            <div className="flex flex-wrap gap-3">
              <button
                type="button"
                className="fo-btn fo-btn-primary text-sm"
                onClick={() => void copy(prompt, setCopiedPrompt)}
              >
                {copiedPrompt ? "Copiado ✓" : "Copiar prompt para ChatGPT"}
              </button>
              <button
                type="button"
                className="fo-btn fo-btn-secondary text-sm"
                onClick={() => void copy(csvHeaderExample, setCopiedHeaders)}
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
        <div className="fo-card space-y-4 max-w-3xl">
          <h2 className="text-lg font-semibold text-[var(--fo-text)]">Pegá acá el resultado de ChatGPT</h2>
          <p className="text-sm text-[var(--fo-muted)] leading-relaxed">
            También podés pegar un CSV armado a mano o exportado desde Excel, Numbers o Google
            Sheets, siempre que respete el mismo formato de columnas.
          </p>
          <textarea
            value={csvText}
            onChange={(e) => setCsvText(e.target.value)}
            rows={16}
            placeholder={csvHeaderExample}
            className="w-full rounded-xl border border-[var(--fo-border)] bg-[var(--fo-bg)] px-4 py-3 font-mono text-xs"
          />
          {!validation?.ok && validation?.error ? (
            <p className="text-sm text-[var(--fo-danger)]">{validation.error}</p>
          ) : null}
          <div className="flex flex-wrap gap-3">
            <button type="button" className="fo-btn fo-btn-secondary" onClick={() => setStep(1)}>
              Atrás
            </button>
            <button type="button" className="fo-btn fo-btn-secondary" onClick={handleClear}>
              Limpiar
            </button>
            <button
              type="button"
              className="fo-btn fo-btn-primary"
              disabled={!csvText.trim() || isPending}
              onClick={handleValidate}
            >
              {isPending ? "Validando…" : "Validar datos"}
            </button>
          </div>
        </div>
      ) : null}

      {step === 3 && summary ? (
        <div className="space-y-4">
          <div className="fo-card space-y-2">
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-center">
              <div>
                <p className="text-2xl font-semibold text-[var(--fo-text)]">{summary.totalRows}</p>
                <p className="text-xs text-[var(--fo-muted)]">filas encontradas</p>
              </div>
              <div>
                <p className="text-2xl font-semibold text-[var(--fo-success)]">{summary.validCount}</p>
                <p className="text-xs text-[var(--fo-muted)]">listas para importar</p>
              </div>
              <div>
                <p className="text-2xl font-semibold text-[var(--fo-danger)]">{summary.errorCount}</p>
                <p className="text-xs text-[var(--fo-muted)]">con errores</p>
              </div>
              <div>
                <p className="text-2xl font-semibold text-[var(--fo-warning,#a16207)]">{summary.warningCount}</p>
                <p className="text-xs text-[var(--fo-muted)]">con advertencias</p>
              </div>
            </div>
            {summary.errorCount > 0 ? (
              <p className="text-sm text-[var(--fo-danger)] pt-2">
                Encontramos {summary.errorCount} {summary.errorCount === 1 ? "problema" : "problemas"} que
                tenés que corregir antes de importar. No se va a crear ningún socio hasta que el
                archivo esté sin errores.
              </p>
            ) : (
              <p className="text-sm text-[var(--fo-success)] pt-2">
                Sin errores. Se van a crear {summary.validCount} socios en {workspaceName}.
              </p>
            )}
          </div>

          <div className="overflow-x-auto rounded-[var(--fo-radius)] border border-[var(--fo-border)]">
            <table className="w-full text-sm text-left min-w-[720px]">
              <thead className="bg-[var(--fo-bg-elevated)] text-[var(--fo-muted)]">
                <tr>
                  <th className="px-4 py-3 font-semibold">Fila</th>
                  <th className="px-4 py-3 font-semibold">N° socio</th>
                  <th className="px-4 py-3 font-semibold">Nombre</th>
                  <th className="px-4 py-3 font-semibold">Categoría</th>
                  <th className="px-4 py-3 font-semibold">Estado</th>
                  <th className="px-4 py-3 font-semibold">Resultado</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--fo-border)] bg-[var(--fo-surface)]">
                {summary.rows.map((row) => (
                  <tr key={row.rowNumber}>
                    <td className="px-4 py-3 text-[var(--fo-muted)]">{row.rowNumber}</td>
                    <td className="px-4 py-3">{row.memberNumber || "—"}</td>
                    <td className="px-4 py-3">
                      {row.firstName} {row.lastName}
                    </td>
                    <td className="px-4 py-3 text-[var(--fo-muted)]">{row.categoryName || "—"}</td>
                    <td className="px-4 py-3 text-[var(--fo-muted)]">{row.statusLabel}</td>
                    <td className="px-4 py-3">
                      {row.status === "VALID" ? (
                        <span className="text-[var(--fo-success)]">✓</span>
                      ) : row.status === "WARNING" ? (
                        <span className="text-[var(--fo-warning,#a16207)]">
                          ⚠ {row.warnings.join(" · ")}
                        </span>
                      ) : (
                        <span className="text-[var(--fo-danger)]">✕ {row.errors.join(" · ")}</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {confirmError ? <p className="text-sm text-[var(--fo-danger)]">{confirmError}</p> : null}

          <div className="flex flex-wrap gap-3">
            <button type="button" className="fo-btn fo-btn-secondary" onClick={() => setStep(2)}>
              Atrás
            </button>
            <button
              type="button"
              className="fo-btn fo-btn-primary"
              disabled={!canConfirm || isPending}
              onClick={handleConfirmImport}
            >
              {isPending ? "Importando…" : `Importar ${summary.validCount} socios`}
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
