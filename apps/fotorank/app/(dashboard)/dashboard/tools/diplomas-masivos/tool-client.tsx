"use client";

import { useMemo, useState, useTransition } from "react";
import {
  downloadDiplomaExcelTemplateAction,
  generateDiplomasFromExcelDraftAction,
  getDiplomaPreviewSampleVariablesAction,
  listDiplomaExcelBatchesAction,
  parseDiplomaExcelDraftAction,
} from "../../../../actions/diplomas";
import { DiplomaLayoutPreview } from "../../../../components/diplomas/DiplomaLayoutPreview";
import { parseDiplomaLayoutJson } from "../../../../lib/fotorank/diplomas/layoutSchema";
import type { DiplomaMergeVariables } from "../../../../lib/fotorank/diplomas/mergeFields";

type ContestOption = {
  id: string;
  title: string;
  slug: string;
  templates: Array<{
    id: string;
    name: string;
    status: string;
    layoutJson: unknown;
    widthPt: number;
    heightPt: number;
    backgroundColor: string;
    backgroundImageUrl: string | null;
  }>;
};

export function DiplomaBatchToolClient({
  contestOptions,
  initialContestId,
}: {
  contestOptions: ContestOption[];
  initialContestId: string | null;
}) {
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [okMsg, setOkMsg] = useState<string | null>(null);

  const initialContest =
    (initialContestId ? contestOptions.find((c) => c.id === initialContestId) : null) ??
    contestOptions[0] ??
    null;
  const [contestId, setContestId] = useState(initialContest?.id ?? "");
  const contest = useMemo(() => contestOptions.find((c) => c.id === contestId) ?? null, [contestOptions, contestId]);

  const [templateId, setTemplateId] = useState(contest?.templates[0]?.id ?? "");
  const template = useMemo(
    () => contest?.templates.find((t) => t.id === templateId) ?? contest?.templates[0] ?? null,
    [contest, templateId]
  );

  const [excelDraftId, setExcelDraftId] = useState<string | null>(null);
  const [excelRows, setExcelRows] = useState<Array<Record<string, unknown>>>([]);
  const [excelSummary, setExcelSummary] = useState<{ total: number; valid: number; invalid: number } | null>(null);
  const [excelUnknownColumns, setExcelUnknownColumns] = useState<string[]>([]);
  const [excelOutput, setExcelOutput] = useState<"pdf" | "png" | "both">("both");
  const [excelWithQr, setExcelWithQr] = useState(true);
  const [excelWithVerification, setExcelWithVerification] = useState(true);
  const [excelRequireAllValid, setExcelRequireAllValid] = useState(false);
  const [excelBatchHistory, setExcelBatchHistory] = useState<Array<Record<string, unknown>>>([]);

  const [previewVars, setPreviewVars] = useState<DiplomaMergeVariables | null>(null);

  const refreshHistory = () => {
    if (!contestId) return;
    start(async () => {
      const r = await listDiplomaExcelBatchesAction(contestId);
      if (r.ok) setExcelBatchHistory((r.items as Array<Record<string, unknown>>) ?? []);
    });
  };

  const loadPreview = () => {
    if (!contestId) return;
    start(async () => {
      const r = await getDiplomaPreviewSampleVariablesAction(contestId);
      if (!r.ok) return;
      const firstValid = excelRows.find((x) => Array.isArray((x as { errors?: unknown }).errors) && ((x as { errors: unknown[] }).errors.length === 0));
      const fv = firstValid as
        | {
            nombre_completo?: string;
            categoria?: string;
            premio?: string;
            puesto?: string;
            titulo_obra?: string;
            fecha_emision?: string;
            texto_adicional?: string;
          }
        | undefined;
      setPreviewVars({
        ...r.variables,
        recipientName: fv?.nombre_completo || r.variables.recipientName,
        categoryName: fv?.categoria || r.variables.categoryName,
        prizeLabel: [fv?.premio, fv?.puesto ? `Puesto ${fv.puesto}` : "", fv?.texto_adicional].filter(Boolean).join(" · ") || r.variables.prizeLabel,
        entryTitle: fv?.titulo_obra || r.variables.entryTitle,
        issuedDate: fv?.fecha_emision || r.variables.issuedDate,
      });
    });
  };

  return (
    <div className="space-y-8">
      {error ? <div className="rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-200">{error}</div> : null}
      {okMsg ? <div className="rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-200">{okMsg}</div> : null}

      <section className="fr-recuadro rounded-xl border border-fr-border bg-fr-card">
        <div className="grid gap-6 lg:grid-cols-[1fr_320px]">
          <div className="space-y-5">
            <label className="space-y-2 block">
              <span className="text-sm font-semibold text-fr-primary">Concurso</span>
              <select
                className="w-full rounded-lg border border-fr-border bg-fr-bg px-4 py-3 text-sm text-fr-primary"
                value={contestId}
                onChange={(e) => {
                  const nextId = e.target.value;
                  setContestId(nextId);
                  const nextContest = contestOptions.find((c) => c.id === nextId);
                  setTemplateId(nextContest?.templates[0]?.id ?? "");
                  setExcelDraftId(null);
                  setExcelRows([]);
                  setExcelSummary(null);
                  setExcelUnknownColumns([]);
                  setPreviewVars(null);
                  setError(null);
                  setOkMsg(null);
                }}
              >
                {contestOptions.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.title}
                  </option>
                ))}
              </select>
            </label>

            <div className="flex flex-wrap gap-3">
              <button
                type="button"
                className="fr-btn fr-btn-secondary"
                onClick={() =>
                  start(async () => {
                    const r = await downloadDiplomaExcelTemplateAction();
                    if (!r.ok) {
                      setError(r.error);
                      return;
                    }
                    const a = document.createElement("a");
                    a.href = `data:application/vnd.openxmlformats-officedocument.spreadsheetml.sheet;base64,${r.base64}`;
                    a.download = r.filename;
                    a.click();
                  })
                }
              >
                Descargar plantilla Excel
              </button>
              <label className="fr-btn fr-btn-secondary cursor-pointer">
                Importar archivo
                <input
                  type="file"
                  accept=".xlsx,.csv"
                  className="hidden"
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    if (!f || !contestId) return;
                    const fd = new FormData();
                    fd.set("contestId", contestId);
                    fd.set("file", f);
                    start(async () => {
                      const r = await parseDiplomaExcelDraftAction(fd);
                      if (!r.ok) {
                        setError(r.error);
                        return;
                      }
                      setExcelDraftId(r.draftId);
                      setExcelRows((r.rows as Array<Record<string, unknown>>) ?? []);
                      setExcelSummary({ total: r.totalRows, valid: r.validRows, invalid: r.invalidRows });
                      setExcelUnknownColumns(r.unknownColumns);
                      setOkMsg("Archivo importado y validado.");
                    });
                  }}
                />
              </label>
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <label className="space-y-2 block">
                <span className="text-sm font-semibold text-fr-primary">Plantilla de diploma</span>
                <select
                  className="w-full rounded-lg border border-fr-border bg-fr-bg px-4 py-3 text-sm text-fr-primary"
                  value={templateId}
                  onChange={(e) => setTemplateId(e.target.value)}
                >
                  {(contest?.templates ?? []).map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.name} ({t.status})
                    </option>
                  ))}
                </select>
              </label>
              <label className="space-y-2 block">
                <span className="text-sm font-semibold text-fr-primary">Formato de salida</span>
                <select
                  className="w-full rounded-lg border border-fr-border bg-fr-bg px-4 py-3 text-sm text-fr-primary"
                  value={excelOutput}
                  onChange={(e) => setExcelOutput(e.target.value as "pdf" | "png" | "both")}
                >
                  <option value="pdf">Solo PDF</option>
                  <option value="png">Solo PNG</option>
                  <option value="both">PDF + PNG</option>
                </select>
              </label>
            </div>

            <div className="flex flex-wrap gap-4">
              <label className="inline-flex items-center gap-2 text-sm text-fr-muted">
                <input type="checkbox" checked={excelWithQr} onChange={(e) => setExcelWithQr(e.target.checked)} />
                Incluir QR
              </label>
              <label className="inline-flex items-center gap-2 text-sm text-fr-muted">
                <input type="checkbox" checked={excelWithVerification} onChange={(e) => setExcelWithVerification(e.target.checked)} />
                Verificación pública
              </label>
              <label className="inline-flex items-center gap-2 text-sm text-fr-muted">
                <input type="checkbox" checked={excelRequireAllValid} onChange={(e) => setExcelRequireAllValid(e.target.checked)} />
                Exigir filas 100% válidas
              </label>
            </div>

            {excelSummary ? (
              <div className="rounded-lg border border-fr-border bg-fr-bg p-4 text-sm text-fr-primary">
                Registros: <strong>{excelSummary.total}</strong> · válidos: <strong>{excelSummary.valid}</strong> · con error:{" "}
                <strong>{excelSummary.invalid}</strong>
                {excelUnknownColumns.length > 0 ? (
                  <p className="mt-2 text-xs text-amber-300">Columnas desconocidas: {excelUnknownColumns.join(", ")}</p>
                ) : null}
              </div>
            ) : null}

            <div className="fr-content-to-actions flex flex-wrap gap-3 border-t border-fr-border pt-6">
              <button type="button" className="fr-btn fr-btn-secondary" onClick={loadPreview} disabled={!template || !excelRows.length}>
                Vista previa
              </button>
              <button
                type="button"
                className="fr-btn fr-btn-primary"
                disabled={!contestId || !templateId || !excelDraftId || pending}
                onClick={() =>
                  start(async () => {
                    const r = await generateDiplomasFromExcelDraftAction({
                      contestId,
                      draftId: excelDraftId!,
                      templateId,
                      output: excelOutput,
                      withQr: excelWithQr,
                      withPublicVerification: excelWithVerification,
                      requireAllValid: excelRequireAllValid,
                    });
                    if (!r.ok) {
                      setError(r.error);
                      return;
                    }
                    setOkMsg(`Lote generado: ${r.batch.successCount} exitosos · ${r.batch.failedCount} con error.`);
                    refreshHistory();
                  })
                }
              >
                Generar diplomas en lote
              </button>
            </div>
          </div>

          <aside className="space-y-3">
            <h3 className="text-base font-semibold text-fr-primary">Historial de lotes</h3>
            <button type="button" className="fr-btn fr-btn-secondary text-xs" onClick={refreshHistory}>
              Actualizar
            </button>
            <div className="space-y-2">
              {excelBatchHistory.length === 0 ? (
                <p className="text-xs text-fr-muted">Sin lotes registrados.</p>
              ) : (
                excelBatchHistory.slice(0, 8).map((b) => {
                  const batch = b as {
                    batchId: string;
                    createdAt: string;
                    successCount: number;
                    failedCount: number;
                    zipUrl: string | null;
                    reportUrl: string | null;
                  };
                  return (
                    <div key={batch.batchId} className="rounded-lg border border-fr-border bg-fr-bg p-2.5">
                      <p className="text-[11px] text-fr-muted">{new Date(batch.createdAt).toLocaleString("es-AR")}</p>
                      <p className="mt-1 text-xs text-fr-primary">OK {batch.successCount} · Error {batch.failedCount}</p>
                      <div className="mt-2 flex gap-2">
                        {batch.zipUrl ? (
                          <a className="fr-btn fr-btn-secondary px-2 py-1 text-[11px]" href={batch.zipUrl}>
                            ZIP
                          </a>
                        ) : null}
                        {batch.reportUrl ? (
                          <a className="fr-btn fr-btn-secondary px-2 py-1 text-[11px]" href={batch.reportUrl}>
                            Errores
                          </a>
                        ) : null}
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </aside>
        </div>
      </section>

      {excelRows.length > 0 ? (
        <section className="fr-recuadro rounded-xl border border-fr-border bg-fr-card">
          <h3 className="text-base font-semibold text-fr-primary">Validación previa</h3>
          <div className="mt-4 overflow-x-auto rounded-lg border border-fr-border">
            <table className="w-full min-w-[760px] text-left text-xs">
              <thead className="border-b border-fr-border bg-fr-bg-elevated text-fr-muted">
                <tr>
                  <th className="px-3 py-2">Fila</th>
                  <th className="px-3 py-2">Nombre</th>
                  <th className="px-3 py-2">Categoría</th>
                  <th className="px-3 py-2">Premio</th>
                  <th className="px-3 py-2">Estado</th>
                  <th className="px-3 py-2">Errores</th>
                </tr>
              </thead>
              <tbody>
                {excelRows.slice(0, 120).map((r, idx) => {
                  const row = r as { rowNumber: number; nombre_completo: string; categoria: string; premio: string; errors: string[] };
                  return (
                    <tr key={idx} className="border-b border-fr-border/70">
                      <td className="px-3 py-2">{row.rowNumber}</td>
                      <td className="px-3 py-2 text-fr-primary">{row.nombre_completo}</td>
                      <td className="px-3 py-2">{row.categoria}</td>
                      <td className="px-3 py-2">{row.premio || "—"}</td>
                      <td className={`px-3 py-2 ${row.errors.length ? "text-red-300" : "text-emerald-300"}`}>
                        {row.errors.length ? "Con error" : "Válida"}
                      </td>
                      <td className="px-3 py-2 text-red-300">{row.errors.join(" · ")}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </section>
      ) : null}

      {template && previewVars ? (
        <section className="fr-recuadro rounded-xl border border-fr-border bg-fr-card">
          <h3 className="text-base font-semibold text-fr-primary">Vista previa del diploma (primera fila válida)</h3>
          <div className="mt-4 max-w-[720px]">
            <DiplomaLayoutPreview
              layout={parseDiplomaLayoutJson(template.layoutJson)}
              variables={previewVars}
              widthPt={template.widthPt}
              heightPt={template.heightPt}
              backgroundColor={template.backgroundColor}
              backgroundImageUrl={template.backgroundImageUrl ?? undefined}
            />
          </div>
        </section>
      ) : null}
    </div>
  );
}
