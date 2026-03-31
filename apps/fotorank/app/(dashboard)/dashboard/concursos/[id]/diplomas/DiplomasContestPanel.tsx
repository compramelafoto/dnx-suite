"use client";

import { useCallback, useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Modal } from "../../../../../components/ui/Modal";
import { DiplomaLayoutPreview } from "../../../../../components/diplomas/DiplomaLayoutPreview";
import {
  planDiplomaIssuanceAction,
  executeDiplomaIssuanceAction,
  listIssuedDiplomasAction,
  revokeDiplomaAction,
  reissueDiplomaAction,
  getDiplomaPreviewSampleVariablesAction,
  downloadDiplomaExcelTemplateAction,
  parseDiplomaExcelDraftAction,
  generateDiplomasFromExcelDraftAction,
  listDiplomaExcelBatchesAction,
} from "../../../../../actions/diplomas";
import type { DiplomaIssuanceMode, PlanRow } from "../../../../../lib/fotorank/diplomas/issuanceTypes";
import { parseDiplomaLayoutJson } from "../../../../../lib/fotorank/diplomas/layoutSchema";
import type { DiplomaMergeVariables } from "../../../../../lib/fotorank/diplomas/mergeFields";
import { DiplomaTemplatesTab } from "./DiplomaTemplatesTab";

type TemplateRow = {
  id: string;
  name: string;
  status: string;
  layoutJson: unknown;
  widthPt: number;
  heightPt: number;
  backgroundColor: string;
  backgroundImageUrl: string | null;
};

type IssuedRow = {
  id: string;
  recipientType: string;
  recipientName: string;
  status: string;
  diplomaCode: string;
  verificationUrl: string;
  pdfUrl: string | null;
  pngUrl: string | null;
  renderedAt: string | Date | null;
  createdAt: string | Date;
  prizeLabel: string | null;
  failureReason: string | null;
  supersededById: string | null;
};

type Props = {
  contestId: string;
  contestTitle: string;
  categories: { id: string; name: string }[];
  templates: TemplateRow[];
  entries: { id: string; title: string | null; categoryName: string }[];
  judges: { id: string; label: string }[];
  participants: { userId: number; label: string }[];
  initialIssued: IssuedRow[];
};

const MODE_OPTIONS: { value: DiplomaIssuanceMode; label: string; group: string }[] = [
  { value: "SINGLE_ENTRY", label: "Una obra", group: "Individual" },
  { value: "SINGLE_PARTICIPANT", label: "Un participante (usuario)", group: "Individual" },
  { value: "SINGLE_JUDGE", label: "Un jurado", group: "Individual" },
  { value: "SINGLE_COLLABORATOR", label: "Un colaborador", group: "Individual" },
  { value: "ALL_PARTICIPANTS", label: "Todos los participantes (autores)", group: "Lote" },
  { value: "ALL_ENTRIES", label: "Todas las obras", group: "Lote" },
  { value: "FINALISTS", label: "Finalistas (top N por categoría)", group: "Lote" },
  { value: "WINNERS", label: "Ganadores (1.º por categoría)", group: "Lote" },
  { value: "BY_CATEGORY_ENTRIES", label: "Obras de una categoría", group: "Lote" },
  { value: "BY_CATEGORY_PARTICIPANTS", label: "Participantes de una categoría", group: "Lote" },
  { value: "MANUAL_ENTRY_IDS", label: "Selección manual de obras", group: "Lote" },
  { value: "ALL_JUDGES", label: "Todo el jurado asignado", group: "Lote" },
  { value: "COLLABORATOR_NAMES", label: "Colaboradores (lista de nombres)", group: "Lote" },
];

export function DiplomasContestPanel({
  contestId,
  contestTitle,
  categories,
  templates,
  entries,
  judges,
  participants,
  initialIssued,
}: Props) {
  const router = useRouter();
  const [tab, setTab] = useState<"templates" | "emit" | "excel" | "issued">("templates");
  const [templateId, setTemplateId] = useState(templates[0]?.id ?? "");
  const [mode, setMode] = useState<DiplomaIssuanceMode>("ALL_ENTRIES");
  const [categoryId, setCategoryId] = useState(categories[0]?.id ?? "");
  const [topN, setTopN] = useState(3);
  const [stampPrize, setStampPrize] = useState("");
  const [singleEntryId, setSingleEntryId] = useState(entries[0]?.id ?? "");
  const [singleJudgeId, setSingleJudgeId] = useState(judges[0]?.id ?? "");
  const [singleUserId, setSingleUserId] = useState(participants[0]?.userId ?? 0);
  const [singleCollabName, setSingleCollabName] = useState("");
  const [manualIdsText, setManualIdsText] = useState("");
  const [collabNamesText, setCollabNamesText] = useState("");
  const [planOpen, setPlanOpen] = useState(false);
  const [planError, setPlanError] = useState<string | null>(null);
  const [planPayload, setPlanPayload] = useState<Awaited<ReturnType<typeof planDiplomaIssuanceAction>> | null>(null);
  const [confirmIssueOpen, setConfirmIssueOpen] = useState(false);
  const [previewVars, setPreviewVars] = useState<DiplomaMergeVariables | null>(null);
  const [issued, setIssued] = useState(initialIssued);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [revokeTarget, setRevokeTarget] = useState<IssuedRow | null>(null);
  const [reissueTarget, setReissueTarget] = useState<IssuedRow | null>(null);
  const [excelDraftId, setExcelDraftId] = useState<string | null>(null);
  const [excelRows, setExcelRows] = useState<Array<Record<string, unknown>>>([]);
  const [excelSummary, setExcelSummary] = useState<{ total: number; valid: number; invalid: number } | null>(null);
  const [excelUnknownColumns, setExcelUnknownColumns] = useState<string[]>([]);
  const [excelOutput, setExcelOutput] = useState<"pdf" | "png" | "both">("both");
  const [excelWithQr, setExcelWithQr] = useState(true);
  const [excelWithVerification, setExcelWithVerification] = useState(true);
  const [excelRequireAllValid, setExcelRequireAllValid] = useState(false);
  const [excelBatchHistory, setExcelBatchHistory] = useState<Array<Record<string, unknown>>>([]);
  const [pending, startTransition] = useTransition();

  const selectedTemplate = useMemo(
    () => templates.find((t) => t.id === templateId) ?? templates[0],
    [templates, templateId]
  );

  const layout = useMemo(
    () => parseDiplomaLayoutJson(selectedTemplate?.layoutJson),
    [selectedTemplate?.layoutJson]
  );

  const loadPreviewVars = useCallback(() => {
    startTransition(async () => {
      const r = await getDiplomaPreviewSampleVariablesAction(contestId);
      if (r.ok) setPreviewVars(r.variables);
    });
  }, [contestId]);

  const refreshIssued = useCallback(() => {
    startTransition(async () => {
      const r = await listIssuedDiplomasAction(contestId, { search, status: statusFilter });
      if (r.ok) setIssued(r.rows as IssuedRow[]);
    });
  }, [contestId, search, statusFilter]);

  const refreshExcelHistory = useCallback(() => {
    startTransition(async () => {
      const r = await listDiplomaExcelBatchesAction(contestId);
      if (r.ok) setExcelBatchHistory((r.items as Array<Record<string, unknown>>) ?? []);
    });
  }, [contestId]);

  const buildPlanInput = (): Parameters<typeof planDiplomaIssuanceAction>[0] => {
    const manualEntryIds = manualIdsText
      .split(/[\s,;]+/)
      .map((s) => s.trim())
      .filter(Boolean);
    const collaboratorNames = collabNamesText
      .split("\n")
      .map((s) => s.trim())
      .filter(Boolean);
    return {
      contestId,
      templateId,
      mode,
      categoryId: categoryId || null,
      topN,
      manualEntryIds: mode === "MANUAL_ENTRY_IDS" ? manualEntryIds : undefined,
      collaboratorNames: mode === "COLLABORATOR_NAMES" ? collaboratorNames : undefined,
      singleEntryId: mode === "SINGLE_ENTRY" ? singleEntryId : null,
      singleJudgeAccountId: mode === "SINGLE_JUDGE" ? singleJudgeId : null,
      singleParticipantUserId: mode === "SINGLE_PARTICIPANT" ? singleUserId : null,
      singleCollaboratorName: mode === "SINGLE_COLLABORATOR" ? singleCollabName : null,
      stampPrizeLabel: stampPrize.trim() || null,
    };
  };

  const runPlan = () => {
    setPlanError(null);
    startTransition(async () => {
      const r = await planDiplomaIssuanceAction(buildPlanInput());
      if (!r.ok) {
        setPlanError(r.error);
        setPlanPayload(null);
        return;
      }
      setPlanPayload(r);
      setPlanOpen(true);
    });
  };

  const runExecute = () => {
    setPlanError(null);
    startTransition(async () => {
      const r = await executeDiplomaIssuanceAction(buildPlanInput());
      setConfirmIssueOpen(false);
      setPlanOpen(false);
      if (!r.ok) {
        setPlanError(r.error);
        return;
      }
      if (r.failed.length > 0) {
        setPlanError(
          `Emitidos: ${r.createdCount}. Fallos: ${r.failed.map((f) => `${f.key}: ${f.error}`).join(" · ")}`
        );
      } else {
        setPlanError(null);
      }
      router.refresh();
      refreshIssued();
      setTab("issued");
    });
  };

  const onRevoke = () => {
    if (!revokeTarget) return;
    startTransition(async () => {
      await revokeDiplomaAction(contestId, revokeTarget.id);
      setRevokeTarget(null);
      router.refresh();
      refreshIssued();
    });
  };

  const onReissue = () => {
    if (!reissueTarget) return;
    startTransition(async () => {
      await reissueDiplomaAction(contestId, reissueTarget.id);
      setReissueTarget(null);
      router.refresh();
      refreshIssued();
    });
  };

  const needsCategory =
    mode === "BY_CATEGORY_ENTRIES" || mode === "BY_CATEGORY_PARTICIPANTS";
  const needsTopN = mode === "FINALISTS";
  const needsManualEntries = mode === "MANUAL_ENTRY_IDS";
  const needsCollabList = mode === "COLLABORATOR_NAMES";

  return (
    <div className="space-y-12">
      {planError ? (
        <div className="rounded-lg border border-amber-500/40 bg-amber-500/10 px-4 py-3 text-sm text-amber-100">
          {planError}
        </div>
      ) : null}

      <div className="flex flex-wrap gap-3 border-b border-fr-border pb-6">
        <button
          type="button"
          className={`rounded-full px-5 py-2 text-sm font-medium transition-colors ${
            tab === "templates" ? "bg-gold/15 text-gold ring-1 ring-gold/40" : "text-fr-muted hover:text-fr-primary"
          }`}
          onClick={() => setTab("templates")}
        >
          Plantillas
        </button>
        <button
          type="button"
          className={`rounded-full px-5 py-2 text-sm font-medium transition-colors ${
            tab === "emit" ? "bg-gold/15 text-gold ring-1 ring-gold/40" : "text-fr-muted hover:text-fr-primary"
          }`}
          onClick={() => setTab("emit")}
        >
          Emitir
        </button>
        <button
          type="button"
          className={`rounded-full px-5 py-2 text-sm font-medium transition-colors ${
            tab === "issued" ? "bg-gold/15 text-gold ring-1 ring-gold/40" : "text-fr-muted hover:text-fr-primary"
          }`}
          onClick={() => {
            setTab("issued");
            refreshIssued();
          }}
        >
          Emitidos
        </button>
      </div>

      {tab === "templates" ? <DiplomaTemplatesTab contestId={contestId} templates={templates} /> : null}

      {tab === "emit" ? (
        <div className="grid gap-12 lg:grid-cols-[1fr_380px]">
          <div className="min-w-0 space-y-10">
            <section className="fr-recuadro rounded-xl border border-fr-border bg-fr-card">
              <h2 className="font-sans text-lg font-semibold text-fr-primary">Emisión</h2>
              <p className="mt-3 text-sm leading-relaxed text-fr-muted">
                Concurso: <span className="text-fr-primary">{contestTitle}</span>. Generá un plan antes de confirmar un
                lote.
              </p>

              <div className="mt-10 space-y-8">
                <div className="space-y-3">
                  <label className="text-sm font-semibold text-fr-primary">Plantilla</label>
                  <select
                    className="w-full rounded-lg border border-fr-border bg-fr-bg px-4 py-3 text-sm text-fr-primary"
                    value={templateId}
                    onChange={(e) => setTemplateId(e.target.value)}
                  >
                    {templates.map((t) => (
                      <option key={t.id} value={t.id}>
                        {t.name} ({t.status})
                      </option>
                    ))}
                  </select>
                </div>

                <div className="space-y-3">
                  <label className="text-sm font-semibold text-fr-primary">Modo</label>
                  <select
                    className="w-full rounded-lg border border-fr-border bg-fr-bg px-4 py-3 text-sm text-fr-primary"
                    value={mode}
                    onChange={(e) => setMode(e.target.value as DiplomaIssuanceMode)}
                  >
                    {MODE_OPTIONS.map((o) => (
                      <option key={o.value} value={o.value}>
                        {o.group}: {o.label}
                      </option>
                    ))}
                  </select>
                </div>

                {needsCategory ? (
                  <div className="space-y-3">
                    <label className="text-sm font-semibold text-fr-primary">Categoría</label>
                    <select
                      className="w-full rounded-lg border border-fr-border bg-fr-bg px-4 py-3 text-sm text-fr-primary"
                      value={categoryId}
                      onChange={(e) => setCategoryId(e.target.value)}
                    >
                      {categories.map((c) => (
                        <option key={c.id} value={c.id}>
                          {c.name}
                        </option>
                      ))}
                    </select>
                  </div>
                ) : null}

                {needsTopN ? (
                  <div className="space-y-3">
                    <label className="text-sm font-semibold text-fr-primary">Top N por categoría</label>
                    <input
                      type="number"
                      min={1}
                      max={50}
                      className="w-full rounded-lg border border-fr-border bg-fr-bg px-4 py-3 text-sm text-fr-primary"
                      value={topN}
                      onChange={(e) => setTopN(Number(e.target.value) || 3)}
                    />
                  </div>
                ) : null}

                {mode === "SINGLE_ENTRY" ? (
                  <div className="space-y-3">
                    <label className="text-sm font-semibold text-fr-primary">Obra</label>
                    <select
                      className="w-full rounded-lg border border-fr-border bg-fr-bg px-4 py-3 text-sm text-fr-primary"
                      value={singleEntryId}
                      onChange={(e) => setSingleEntryId(e.target.value)}
                    >
                      {entries.map((e) => (
                        <option key={e.id} value={e.id}>
                          {e.title ?? "Sin título"} — {e.categoryName}
                        </option>
                      ))}
                    </select>
                  </div>
                ) : null}

                {mode === "SINGLE_JUDGE" ? (
                  <div className="space-y-3">
                    <label className="text-sm font-semibold text-fr-primary">Jurado</label>
                    {judges.length === 0 ? (
                      <p className="text-sm text-fr-muted">No hay jurados asignados a este concurso.</p>
                    ) : (
                      <select
                        className="w-full rounded-lg border border-fr-border bg-fr-bg px-4 py-3 text-sm text-fr-primary"
                        value={singleJudgeId}
                        onChange={(e) => setSingleJudgeId(e.target.value)}
                      >
                        {judges.map((j) => (
                          <option key={j.id} value={j.id}>
                            {j.label}
                          </option>
                        ))}
                      </select>
                    )}
                  </div>
                ) : null}

                {mode === "SINGLE_PARTICIPANT" ? (
                  <div className="space-y-3">
                    <label className="text-sm font-semibold text-fr-primary">Participante</label>
                    {participants.length === 0 ? (
                      <p className="text-sm text-fr-muted">No hay autores con usuario vinculado a obras.</p>
                    ) : (
                      <select
                        className="w-full rounded-lg border border-fr-border bg-fr-bg px-4 py-3 text-sm text-fr-primary"
                        value={singleUserId}
                        onChange={(e) => setSingleUserId(Number(e.target.value))}
                      >
                        {participants.map((p) => (
                          <option key={p.userId} value={p.userId}>
                            {p.label}
                          </option>
                        ))}
                      </select>
                    )}
                  </div>
                ) : null}

                {mode === "SINGLE_COLLABORATOR" ? (
                  <div className="space-y-3">
                    <label className="text-sm font-semibold text-fr-primary">Nombre del colaborador</label>
                    <input
                      className="w-full rounded-lg border border-fr-border bg-fr-bg px-4 py-3 text-sm text-fr-primary"
                      value={singleCollabName}
                      onChange={(e) => setSingleCollabName(e.target.value)}
                      placeholder="Nombre completo"
                    />
                  </div>
                ) : null}

                {needsManualEntries ? (
                  <div className="space-y-3">
                    <label className="text-sm font-semibold text-fr-primary">IDs de obras (separados por coma o salto)</label>
                    <textarea
                      className="min-h-[100px] w-full rounded-lg border border-fr-border bg-fr-bg px-4 py-3 text-sm text-fr-primary"
                      value={manualIdsText}
                      onChange={(e) => setManualIdsText(e.target.value)}
                      placeholder="cuid1, cuid2..."
                    />
                  </div>
                ) : null}

                {needsCollabList ? (
                  <div className="space-y-3">
                    <label className="text-sm font-semibold text-fr-primary">Nombres (uno por línea)</label>
                    <textarea
                      className="min-h-[100px] w-full rounded-lg border border-fr-border bg-fr-bg px-4 py-3 text-sm text-fr-primary"
                      value={collabNamesText}
                      onChange={(e) => setCollabNamesText(e.target.value)}
                    />
                  </div>
                ) : null}

                <div className="space-y-3">
                  <label className="text-sm font-semibold text-fr-primary">Texto de premio (opcional, todos del lote)</label>
                  <input
                    className="w-full rounded-lg border border-fr-border bg-fr-bg px-4 py-3 text-sm text-fr-primary"
                    value={stampPrize}
                    onChange={(e) => setStampPrize(e.target.value)}
                    placeholder="Ej. Mención especial"
                  />
                </div>
              </div>

              <div className="fr-content-to-actions mt-16 flex flex-wrap gap-3 border-t border-fr-border pt-8">
                <button
                  type="button"
                  disabled={pending || !templateId}
                  onClick={runPlan}
                  className="fr-btn fr-btn-primary"
                >
                  Previsualizar plan
                </button>
              </div>
            </section>
          </div>

          <aside className="min-w-0 space-y-6">
            <div className="fr-recuadro rounded-xl border border-fr-border bg-fr-card">
              <h3 className="font-sans text-base font-semibold text-fr-primary">Vista previa (layout)</h3>
              <p className="mt-3 text-xs leading-relaxed text-fr-muted">
                Misma geometría que el PDF; tipografías pueden diferir levemente del motor PDF.
              </p>
              <button type="button" className="fr-btn fr-btn-secondary mt-6 text-sm" onClick={loadPreviewVars} disabled={pending}>
                Cargar datos de ejemplo
              </button>
              {previewVars && selectedTemplate ? (
                <div className="mt-8">
                  <DiplomaLayoutPreview
                    layout={layout}
                    variables={previewVars}
                    widthPt={selectedTemplate.widthPt}
                    heightPt={selectedTemplate.heightPt}
                    backgroundColor={selectedTemplate.backgroundColor}
                    backgroundImageUrl={selectedTemplate.backgroundImageUrl}
                  />
                </div>
              ) : null}
            </div>
          </aside>
        </div>
      ) : tab === "excel" ? (
        <section className="space-y-8">
          <div className="grid gap-8 lg:grid-cols-3">
            <div className="fr-recuadro rounded-xl border border-fr-border bg-fr-card lg:col-span-2">
              <h2 className="text-lg font-semibold text-fr-primary">Generar diplomas desde Excel</h2>
              <p className="mt-2 text-sm text-fr-muted">
                Descargá la plantilla, subí el archivo completo, validá filas y emití en lote PDF/PNG con o sin verificación pública.
              </p>
              <div className="mt-6 flex flex-wrap gap-3">
                <button
                  type="button"
                  className="fr-btn fr-btn-secondary"
                  onClick={() =>
                    startTransition(async () => {
                      const r = await downloadDiplomaExcelTemplateAction();
                      if (!r.ok) {
                        setPlanError(r.error);
                        return;
                      }
                      const a = document.createElement("a");
                      a.href = `data:application/vnd.openxmlformats-officedocument.spreadsheetml.sheet;base64,${r.base64}`;
                      a.download = r.filename;
                      a.click();
                    })
                  }
                >
                  Descargar plantilla
                </button>
                <label className="fr-btn fr-btn-secondary cursor-pointer">
                  Subir Excel
                  <input
                    type="file"
                    accept=".xlsx,.csv"
                    className="hidden"
                    onChange={(e) => {
                      const f = e.target.files?.[0];
                      if (!f) return;
                      const fd = new FormData();
                      fd.set("contestId", contestId);
                      fd.set("file", f);
                      startTransition(async () => {
                        const r = await parseDiplomaExcelDraftAction(fd);
                        if (!r.ok) {
                          setPlanError(r.error);
                          return;
                        }
                        setExcelDraftId(r.draftId);
                        setExcelRows((r.rows as Array<Record<string, unknown>>) ?? []);
                        setExcelSummary({ total: r.totalRows, valid: r.validRows, invalid: r.invalidRows });
                        setExcelUnknownColumns(r.unknownColumns);
                      });
                    }}
                  />
                </label>
              </div>

              <div className="mt-6 grid gap-4 md:grid-cols-2">
                <label className="space-y-2">
                  <span className="text-sm font-semibold text-fr-primary">Plantilla de diploma</span>
                  <select
                    className="w-full rounded-lg border border-fr-border bg-fr-bg px-4 py-3 text-sm text-fr-primary"
                    value={templateId}
                    onChange={(e) => setTemplateId(e.target.value)}
                  >
                    {templates.map((t) => (
                      <option key={t.id} value={t.id}>
                        {t.name}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="space-y-2">
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

              <div className="mt-4 flex flex-wrap gap-4">
                <label className="inline-flex items-center gap-2 text-sm text-fr-muted">
                  <input type="checkbox" checked={excelWithQr} onChange={(e) => setExcelWithQr(e.target.checked)} />
                  Incluir QR
                </label>
                <label className="inline-flex items-center gap-2 text-sm text-fr-muted">
                  <input
                    type="checkbox"
                    checked={excelWithVerification}
                    onChange={(e) => setExcelWithVerification(e.target.checked)}
                  />
                  Incluir verificación pública
                </label>
                <label className="inline-flex items-center gap-2 text-sm text-fr-muted">
                  <input
                    type="checkbox"
                    checked={excelRequireAllValid}
                    onChange={(e) => setExcelRequireAllValid(e.target.checked)}
                  />
                  Exigir corrección total
                </label>
              </div>

              {excelSummary ? (
                <div className="mt-6 rounded-lg border border-fr-border bg-fr-bg p-4">
                  <p className="text-sm text-fr-primary">
                    Filas detectadas: <strong>{excelSummary.total}</strong> · válidas: <strong>{excelSummary.valid}</strong> · con error:{" "}
                    <strong>{excelSummary.invalid}</strong>
                  </p>
                  {excelUnknownColumns.length > 0 ? (
                    <p className="mt-2 text-xs text-amber-300">
                      Columnas desconocidas: {excelUnknownColumns.join(", ")}
                    </p>
                  ) : null}
                </div>
              ) : null}

              <div className="fr-content-to-actions mt-8 flex justify-end border-t border-fr-border pt-6">
                <button
                  type="button"
                  className="fr-btn fr-btn-primary"
                  disabled={!excelDraftId || pending}
                  onClick={() =>
                    startTransition(async () => {
                      if (!excelDraftId) return;
                      const r = await generateDiplomasFromExcelDraftAction({
                        contestId,
                        draftId: excelDraftId,
                        templateId,
                        output: excelOutput,
                        withQr: excelWithQr,
                        withPublicVerification: excelWithVerification,
                        requireAllValid: excelRequireAllValid,
                      });
                      if (!r.ok) {
                        setPlanError(r.error);
                        return;
                      }
                      setPlanError(
                        `Lote generado. Exitosos: ${r.batch.successCount} · fallidos: ${r.batch.failedCount}.`
                      );
                      refreshIssued();
                      refreshExcelHistory();
                      setTab("issued");
                    })
                  }
                >
                  Generar diplomas
                </button>
              </div>
            </div>

            <div className="fr-recuadro rounded-xl border border-fr-border bg-fr-card">
              <h3 className="text-base font-semibold text-fr-primary">Historial de lotes</h3>
              <p className="mt-2 text-xs text-fr-muted">Últimas importaciones y descargas.</p>
              <div className="mt-4 space-y-3">
                {excelBatchHistory.length === 0 ? (
                  <p className="text-sm text-fr-muted">Sin lotes todavía.</p>
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
                      <div key={batch.batchId} className="rounded-lg border border-fr-border bg-fr-bg p-3">
                        <p className="text-xs text-fr-muted">{new Date(batch.createdAt).toLocaleString("es-AR")}</p>
                        <p className="mt-1 text-sm text-fr-primary">
                          OK {batch.successCount} · Error {batch.failedCount}
                        </p>
                        <div className="mt-2 flex flex-wrap gap-2">
                          {batch.zipUrl ? (
                            <a className="fr-btn fr-btn-secondary px-3 py-1.5 text-xs" href={batch.zipUrl}>
                              ZIP
                            </a>
                          ) : null}
                          {batch.reportUrl ? (
                            <a className="fr-btn fr-btn-secondary px-3 py-1.5 text-xs" href={batch.reportUrl}>
                              Errores
                            </a>
                          ) : null}
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          </div>

          {excelRows.length > 0 ? (
            <div className="fr-recuadro rounded-xl border border-fr-border bg-fr-card">
              <h3 className="text-base font-semibold text-fr-primary">Vista previa de registros</h3>
              <div className="mt-4 overflow-x-auto rounded-lg border border-fr-border">
                <table className="w-full min-w-[720px] text-left text-xs">
                  <thead className="border-b border-fr-border bg-fr-bg-elevated text-fr-muted">
                    <tr>
                      <th className="px-3 py-2">Fila</th>
                      <th className="px-3 py-2">Nombre</th>
                      <th className="px-3 py-2">Categoría</th>
                      <th className="px-3 py-2">Premio</th>
                      <th className="px-3 py-2">Estado</th>
                      <th className="px-3 py-2">Error</th>
                    </tr>
                  </thead>
                  <tbody>
                    {excelRows.slice(0, 120).map((r, idx) => {
                      const row = r as {
                        rowNumber: number;
                        nombre_completo: string;
                        categoria: string;
                        premio: string;
                        errors: string[];
                      };
                      const hasErr = row.errors.length > 0;
                      return (
                        <tr key={idx} className="border-b border-fr-border/70">
                          <td className="px-3 py-2">{row.rowNumber}</td>
                          <td className="px-3 py-2 text-fr-primary">{row.nombre_completo}</td>
                          <td className="px-3 py-2">{row.categoria}</td>
                          <td className="px-3 py-2">{row.premio || "—"}</td>
                          <td className={`px-3 py-2 ${hasErr ? "text-red-300" : "text-emerald-300"}`}>
                            {hasErr ? "Con error" : "Válida"}
                          </td>
                          <td className="px-3 py-2 text-red-300">{hasErr ? row.errors.join(" · ") : ""}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          ) : null}
        </section>
      ) : (
        <section className="fr-recuadro rounded-xl border border-fr-border bg-fr-card">
          <div className="flex flex-col gap-6 md:flex-row md:items-end md:justify-between">
            <div className="flex min-w-0 flex-1 flex-col gap-4 sm:flex-row">
              <input
                className="w-full rounded-lg border border-fr-border bg-fr-bg px-4 py-3 text-sm text-fr-primary sm:max-w-xs"
                placeholder="Buscar por nombre o código..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
              <select
                className="w-full rounded-lg border border-fr-border bg-fr-bg px-4 py-3 text-sm text-fr-primary sm:max-w-[200px]"
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
              >
                <option value="all">Todos los estados</option>
                <option value="ISSUED">Emitido</option>
                <option value="FAILED">Fallido</option>
                <option value="REVOKED">Revocado</option>
                <option value="REPLACED">Reemplazado</option>
              </select>
            </div>
            <button type="button" className="fr-btn fr-btn-secondary text-sm" onClick={refreshIssued} disabled={pending}>
              Actualizar
            </button>
          </div>

          <div className="mt-10 overflow-x-auto rounded-lg border border-fr-border">
            <table className="w-full min-w-[720px] border-collapse text-left text-sm">
              <thead>
                <tr className="border-b border-fr-border bg-[#0a0a0a] text-fr-muted">
                  <th className="fr-recuadro py-3 font-semibold">Destinatario</th>
                  <th className="fr-recuadro py-3 font-semibold">Código</th>
                  <th className="fr-recuadro py-3 font-semibold">Estado</th>
                  <th className="fr-recuadro py-3 font-semibold">Acciones</th>
                </tr>
              </thead>
              <tbody>
                {issued.map((row) => (
                  <tr key={row.id} className="border-b border-fr-border/80">
                    <td className="fr-recuadro py-3 align-top">
                      <div className="font-medium text-fr-primary">{row.recipientName}</div>
                      <div className="fr-caption text-fr-muted">{row.recipientType}</div>
                    </td>
                    <td className="fr-recuadro py-3 align-top font-mono text-xs text-gold">{row.diplomaCode}</td>
                    <td className="fr-recuadro py-3 align-top text-fr-muted">{row.status}</td>
                    <td className="fr-recuadro py-3 align-top">
                      <div className="flex flex-wrap gap-2">
                        {row.status === "ISSUED" && row.pdfUrl ? (
                          <a
                            className="fr-btn fr-btn-secondary px-3 py-1.5 text-xs"
                            href={`/api/diplomas/${row.id}/file?format=pdf`}
                          >
                            PDF
                          </a>
                        ) : null}
                        {row.status === "ISSUED" && row.pngUrl ? (
                          <a
                            className="fr-btn fr-btn-secondary px-3 py-1.5 text-xs"
                            href={`/api/diplomas/${row.id}/file?format=png`}
                          >
                            PNG
                          </a>
                        ) : null}
                        <button
                          type="button"
                          className="fr-btn fr-btn-secondary px-3 py-1.5 text-xs"
                          onClick={() => navigator.clipboard.writeText(row.verificationUrl)}
                        >
                          Copiar enlace
                        </button>
                        {row.status === "ISSUED" ? (
                          <>
                            <button
                              type="button"
                              className="fr-btn fr-btn-secondary px-3 py-1.5 text-xs text-amber-200"
                              onClick={() => setReissueTarget(row)}
                            >
                              Reemitir
                            </button>
                            <button
                              type="button"
                              className="fr-btn fr-btn-secondary px-3 py-1.5 text-xs text-red-200"
                              onClick={() => setRevokeTarget(row)}
                            >
                              Revocar
                            </button>
                          </>
                        ) : null}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}

      <Modal
        isOpen={planOpen && !!planPayload && planPayload.ok}
        onClose={() => setPlanOpen(false)}
        title="Plan de emisión"
        header="full"
        maxWidth="2xl"
        showTopLogo={false}
      >
        <div className="space-y-8 pt-6">
          {planPayload && planPayload.ok ? (
            <>
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="rounded-lg border border-fr-border bg-fr-bg px-4 py-3">
                  <p className="text-xs font-semibold uppercase text-fr-muted">Plantilla</p>
                  <p className="mt-1 text-sm text-fr-primary">{planPayload.template.name}</p>
                  <p className="fr-caption text-fr-muted">Estado: {planPayload.template.status}</p>
                </div>
                <div className="rounded-lg border border-fr-border bg-fr-bg px-4 py-3">
                  <p className="text-xs font-semibold uppercase text-fr-muted">Cantidad</p>
                  <p className="mt-1 text-2xl font-semibold text-gold">{planPayload.plan.rows.length}</p>
                  <p className="fr-caption text-fr-muted">
                    Válidas para emitir: {planPayload.plan.okRowCount} · Con error: {planPayload.plan.errorRowCount} ·
                    Solo advertencias: {planPayload.plan.warningRowCount}
                  </p>
                </div>
              </div>

              {planPayload.plan.globalWarnings.length > 0 ? (
                <div className="rounded-lg border border-amber-500/40 bg-amber-500/10 px-4 py-3">
                  <p className="text-sm font-semibold text-amber-100">Advertencias globales</p>
                  <ul className="mt-2 list-inside list-disc text-sm text-fr-muted">
                    {planPayload.plan.globalWarnings.map((w: string, i: number) => (
                      <li key={i}>{w}</li>
                    ))}
                  </ul>
                </div>
              ) : null}

              {planPayload.plan.rows.some((r: PlanRow) => r.errors.length > 0) ? (
                <div className="rounded-lg border border-red-500/40 bg-red-500/10 px-4 py-3">
                  <p className="text-sm font-semibold text-red-100">Errores por fila</p>
                  <ul className="mt-2 max-h-40 overflow-y-auto text-sm text-fr-muted">
                    {planPayload.plan.rows
                      .filter((r: PlanRow) => r.errors.length > 0)
                      .map((r: PlanRow) => (
                        <li key={r.key}>
                          <span className="font-mono text-fr-primary">{r.key}</span>: {r.errors.join(" ")}
                        </li>
                      ))}
                  </ul>
                </div>
              ) : null}

              {planPayload.plan.rows.some((r: PlanRow) => r.warnings.length > 0 && r.errors.length === 0) ? (
                <div className="rounded-lg border border-fr-border bg-fr-bg-elevated px-4 py-3">
                  <p className="text-sm font-semibold text-fr-primary">Posibles faltantes / avisos</p>
                  <ul className="mt-2 max-h-32 overflow-y-auto text-sm text-fr-muted">
                    {planPayload.plan.rows
                      .filter((r: PlanRow) => r.warnings.length > 0 && r.errors.length === 0)
                      .slice(0, 12)
                      .map((r: PlanRow) => (
                        <li key={r.key}>
                          {r.recipientName}: {r.warnings.join(" · ")}
                        </li>
                      ))}
                  </ul>
                </div>
              ) : null}

              <div className="fr-content-to-actions flex flex-wrap justify-end gap-3 border-t border-fr-border pt-8">
                <button type="button" className="fr-btn fr-btn-secondary" onClick={() => setPlanOpen(false)}>
                  Volver
                </button>
                <button
                  type="button"
                  className="fr-btn fr-btn-primary"
                  disabled={pending || planPayload.plan.okRowCount === 0}
                  onClick={() => {
                    setPlanOpen(false);
                    setConfirmIssueOpen(true);
                  }}
                >
                  Continuar a confirmar
                </button>
              </div>
            </>
          ) : null}
        </div>
      </Modal>

      <Modal
        isOpen={confirmIssueOpen}
        onClose={() => setConfirmIssueOpen(false)}
        title="Confirmar emisión"
        header="full"
        maxWidth="md"
        showTopLogo={false}
      >
        <div className="space-y-6 pt-6">
          <p className="text-sm leading-relaxed text-fr-muted">
            Vas a generar <strong className="text-fr-primary">{planPayload?.ok ? planPayload.plan.okRowCount : 0}</strong>{" "}
            diplomas, archivos PDF/PNG y códigos de verificación públicos. Esta acción puede tardar varios segundos.
          </p>
          <div className="flex flex-wrap justify-end gap-3">
            <button type="button" className="fr-btn fr-btn-secondary" onClick={() => setConfirmIssueOpen(false)}>
              Cancelar
            </button>
            <button type="button" className="fr-btn fr-btn-primary" disabled={pending} onClick={runExecute}>
              Emitir ahora
            </button>
          </div>
        </div>
      </Modal>

      <Modal
        isOpen={!!revokeTarget}
        onClose={() => setRevokeTarget(null)}
        title="Revocar diploma"
        header="full"
        maxWidth="md"
        showTopLogo={false}
      >
        <div className="space-y-6 pt-6">
          <p className="text-sm text-fr-muted">
            El diploma <span className="font-mono text-gold">{revokeTarget?.diplomaCode}</span> pasará a estado revocado
            y la verificación pública lo mostrará como tal.
          </p>
          <div className="flex flex-wrap justify-end gap-3">
            <button type="button" className="fr-btn fr-btn-secondary" onClick={() => setRevokeTarget(null)}>
              Cancelar
            </button>
            <button type="button" className="fr-btn fr-btn-primary text-red-100" disabled={pending} onClick={onRevoke}>
              Revocar
            </button>
          </div>
        </div>
      </Modal>

      <Modal
        isOpen={!!reissueTarget}
        onClose={() => setReissueTarget(null)}
        title="Reemitir diploma"
        header="full"
        maxWidth="md"
        showTopLogo={false}
      >
        <div className="space-y-6 pt-6">
          <p className="text-sm text-fr-muted">
            Se emitirá un diploma nuevo con el mismo destinatario. El actual quedará como reemplazado y enlazado al nuevo
            para trazabilidad.
          </p>
          <div className="flex flex-wrap justify-end gap-3">
            <button type="button" className="fr-btn fr-btn-secondary" onClick={() => setReissueTarget(null)}>
              Cancelar
            </button>
            <button type="button" className="fr-btn fr-btn-primary" disabled={pending} onClick={onReissue}>
              Reemitir
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
