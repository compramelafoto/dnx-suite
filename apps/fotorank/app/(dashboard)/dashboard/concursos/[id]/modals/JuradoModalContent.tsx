"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import {
  createJudgeAssignmentsBatch,
  listJudgeInvitationsForContest,
  listJudgeRosterForContest,
  sendJudgeInvitation,
  type ContestJudgeRosterRow,
  type JudgeMethodType,
} from "../../../../../actions/judges";
import { updateContestRules } from "../../../../../actions/contests";
import { inputBase } from "../../../../../components/ui/form";

type Contest = NonNullable<
  Awaited<ReturnType<typeof import("../../../../../lib/fotorank/contests").getFotorankContestById>>
>;

interface JuradoModalContentProps {
  contest: Contest;
  onSuccess: () => void;
  onCancel: () => void;
  readOnly?: boolean;
  restrictionMessage?: string | null;
}

type TabId = "integrantes" | "evaluacion" | "visibilidad" | "invitaciones" | "preview";
type JudgeFichaState = "NOT_STARTED" | "IN_PROGRESS" | "READY";

type JuradoRulesConfig = {
  jurado?: {
    showInLanding?: boolean;
    hideUntil?: string | null;
    visibilityByJudgeId?: Record<string, boolean>;
    methodType?: JudgeMethodType;
    methodConfig?: unknown;
    anonymousByDefault?: boolean;
    criteriaPreset?: Array<{ key: string; label: string; maxScore: number; weight: number }>;
  };
};

const TAB_LABELS: Record<TabId, string> = {
  integrantes: "Integrantes",
  evaluacion: "Evaluación",
  visibilidad: "Visibilidad pública",
  invitaciones: "Invitaciones y acceso",
  preview: "Vista previa",
};

const METHOD_OPTIONS: { id: JudgeMethodType; label: string }[] = [
  { id: "SCORE_1_10", label: "Puntaje numérico (1 a 10)" },
  { id: "SCORE_1_5", label: "Estrellas (1 a 5)" },
  { id: "SCORE_0_100", label: "Ranking / score (0 a 100)" },
  { id: "YES_NO", label: "Selección simple" },
  { id: "SELECTION_WITH_QUOTA", label: "Selección + cupo" },
  { id: "CRITERIA_BASED", label: "Selección + comentario (criterios)" },
];

const DEFAULT_CRITERIA = [
  { key: "tecnica", label: "Técnica", maxScore: 10, weight: 20 },
  { key: "composicion", label: "Composición", maxScore: 10, weight: 20 },
  { key: "creatividad", label: "Creatividad", maxScore: 10, weight: 20 },
  { key: "impacto", label: "Impacto visual", maxScore: 10, weight: 20 },
  { key: "adecuacion", label: "Adecuación al tema", maxScore: 10, weight: 20 },
];

function asJuradoConfig(rulesData: unknown): JuradoRulesConfig {
  if (!rulesData || typeof rulesData !== "object" || Array.isArray(rulesData)) return {};
  return rulesData as JuradoRulesConfig;
}

function safeDateInput(v: string | null | undefined): string {
  if (!v) return "";
  const d = new Date(v);
  if (Number.isNaN(d.getTime())) return "";
  return d.toISOString().slice(0, 10);
}

function statusBadgeCls(state: JudgeFichaState): string {
  if (state === "READY") return "border-emerald-500/40 bg-emerald-500/10 text-emerald-200";
  if (state === "IN_PROGRESS") return "border-amber-500/40 bg-amber-500/10 text-amber-200";
  return "border-fr-border bg-fr-bg-elevated text-fr-muted";
}

export function JuradoModalContent({ contest, onSuccess, onCancel, readOnly, restrictionMessage }: JuradoModalContentProps) {
  const [tab, setTab] = useState<TabId>("integrantes");
  const [error, setError] = useState<string | null>(null);
  const [okMsg, setOkMsg] = useState<string | null>(null);
  const [pending, start] = useTransition();

  const [roster, setRoster] = useState<ContestJudgeRosterRow[]>([]);
  const [invites, setInvites] = useState<
    Array<{
      id: string;
      email: string;
      invitationStatus: string;
      expiresAt: string;
      acceptedAt: string | null;
      createdAt: string;
      judgeLabel: string | null;
    }>
  >([]);

  const rulesCfg = useMemo(() => asJuradoConfig(contest.rulesData), [contest.rulesData]);
  const [showInLanding, setShowInLanding] = useState<boolean>(rulesCfg.jurado?.showInLanding ?? false);
  const [hideUntil, setHideUntil] = useState<string>(safeDateInput(rulesCfg.jurado?.hideUntil));
  const [anonymousByDefault, setAnonymousByDefault] = useState<boolean>(rulesCfg.jurado?.anonymousByDefault ?? true);
  const [methodType, setMethodType] = useState<JudgeMethodType>(rulesCfg.jurado?.methodType ?? "CRITERIA_BASED");
  const [criteria, setCriteria] = useState(rulesCfg.jurado?.criteriaPreset ?? DEFAULT_CRITERIA);
  const [visibilityByJudgeId, setVisibilityByJudgeId] = useState<Record<string, boolean>>(
    rulesCfg.jurado?.visibilityByJudgeId ?? {}
  );

  const [assignJudgeId, setAssignJudgeId] = useState("");
  const [assignType, setAssignType] = useState<"PRIMARY" | "BACKUP">("PRIMARY");
  const [allCategories, setAllCategories] = useState(true);
  const [assignCategoryIds, setAssignCategoryIds] = useState<string[]>([]);

  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteJudgeId, setInviteJudgeId] = useState("");

  const refreshData = () => {
    start(async () => {
      const [rRes, iRes] = await Promise.all([
        listJudgeRosterForContest(contest.id),
        listJudgeInvitationsForContest(contest.id),
      ]);
      if (rRes.ok) setRoster(rRes.data ?? []);
      if (iRes.ok) setInvites(iRes.data ?? []);
    });
  };

  useEffect(() => {
    refreshData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [contest.id]);

  const assignedRows = useMemo(
    () => roster.filter((r) => r.assignedCategoryIds.length > 0),
    [roster]
  );
  const visibleCount = useMemo(
    () => assignedRows.filter((r) => (visibilityByJudgeId[r.judgeId] ?? r.isPublicProfile) && Boolean(r.avatarUrl)).length,
    [assignedRows, visibilityByJudgeId]
  );

  const criteriaWeightsSum = useMemo(
    () => criteria.reduce((s, c) => s + Number(c.weight || 0), 0),
    [criteria]
  );

  const checklist = useMemo(() => {
    const methodOk = Boolean(methodType);
    const criteriaOk = criteria.length > 0 && criteriaWeightsSum === 100;
    const visibilityOk = typeof showInLanding === "boolean";
    const perJudgeScopeOk = assignedRows.every((j) => j.assignedCategoryIds.length > 0);
    return [
      { label: "Al menos 1 jurado asignado", ok: assignedRows.length > 0 },
      { label: "Método de evaluación definido", ok: methodOk },
      { label: "Criterios de evaluación completos (100%)", ok: criteriaOk },
      { label: "Visibilidad pública del bloque resuelta", ok: visibilityOk },
      { label: "Cada jurado con alcance/categoría", ok: perJudgeScopeOk },
    ];
  }, [assignedRows, methodType, criteria, criteriaWeightsSum, showInLanding]);

  const fichaState: JudgeFichaState = useMemo(() => {
    const done = checklist.filter((c) => c.ok).length;
    if (done === 0) return "NOT_STARTED";
    if (done === checklist.length) return "READY";
    return "IN_PROGRESS";
  }, [checklist]);

  const fichaStatusLabel = fichaState === "READY" ? "Listo" : fichaState === "IN_PROGRESS" ? "En configuración" : "No iniciado";

  const saveRulesConfig = () => {
    if (readOnly) return;
    setError(null);
    setOkMsg(null);
    const rulesData: JuradoRulesConfig = {
      ...rulesCfg,
      jurado: {
        ...(rulesCfg.jurado ?? {}),
        showInLanding,
        hideUntil: hideUntil || null,
        visibilityByJudgeId,
        methodType,
        methodConfig: { type: methodType },
        anonymousByDefault,
        criteriaPreset: criteria,
      },
    };
    start(async () => {
      const res = await updateContestRules(contest.id, contest.rulesText ?? "", rulesData as Record<string, unknown>);
      if (!res.ok) {
        setError(res.error);
        return;
      }
      setOkMsg("Configuración de jurado guardada.");
      onSuccess();
    });
  };

  const assignJudge = () => {
    if (readOnly) return;
    setError(null);
    setOkMsg(null);
    start(async () => {
      const res = await createJudgeAssignmentsBatch({
        judgeAccountId: assignJudgeId,
        contestId: contest.id,
        allCategories,
        categoryIds: allCategories ? [] : assignCategoryIds,
        assignmentType: assignType,
        methodType,
        methodConfigJson: methodType === "CRITERIA_BASED" ? { criteria } : {},
        allowVoteEdit: false,
        commentsVisibleToParticipants: false,
        sendInvitationNow: false,
      });
      if (!res.ok) {
        setError(res.error);
        return;
      }
      setOkMsg(`Asignaciones creadas: ${res.data?.created ?? 0}.`);
      refreshData();
    });
  };

  const sendInvite = () => {
    if (readOnly) return;
    const email = inviteEmail.trim() || roster.find((r) => r.judgeId === inviteJudgeId)?.email || "";
    if (!email) {
      setError("Ingresá email o seleccioná un jurado.");
      return;
    }
    setError(null);
    setOkMsg(null);
    start(async () => {
      const res = await sendJudgeInvitation({
        email,
        contestId: contest.id,
        judgeAccountId: inviteJudgeId || undefined,
      });
      if (!res.ok) {
        setError(res.error);
        return;
      }
      setOkMsg("Invitación enviada.");
      setInviteEmail("");
      refreshData();
    });
  };

  const runReminderSweep = () => {
    const pendingInv = invites.filter((i) => ["DRAFT", "SENT", "OPENED"].includes(i.invitationStatus)).length;
    const acceptedNoProgress = assignedRows.filter((r) => r.assignmentStatuses.includes("ACCEPTED")).length;
    const inProgress = assignedRows.filter((r) => r.assignmentStatuses.includes("IN_PROGRESS")).length;
    setOkMsg(
      `Recordatorios preparados (simulado): ${pendingInv} sin aceptar, ${acceptedNoProgress} aceptados sin iniciar, ${inProgress} en progreso.`
    );
  };

  return (
    <div className="space-y-6">
      {restrictionMessage ? (
        <div className="rounded-lg border border-gold/30 bg-gold/5 px-4 py-3 text-sm text-gold">{restrictionMessage}</div>
      ) : null}
      {error ? <div className="rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-200">{error}</div> : null}
      {okMsg ? <div className="rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-200">{okMsg}</div> : null}

      <div className="rounded-xl border border-fr-border bg-fr-bg-elevated/60 p-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h3 className="text-lg font-semibold text-fr-primary">Jurado</h3>
          <span className={`rounded-full border px-3 py-1 text-xs font-semibold ${statusBadgeCls(fichaState)}`}>{fichaStatusLabel}</span>
        </div>
        <div className="mt-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
          <SummaryChip label="Jurados asignados" value={String(assignedRows.length)} />
          <SummaryChip label="Visibles en landing" value={String(visibleCount)} />
          <SummaryChip label="Método de evaluación" value={METHOD_OPTIONS.find((m) => m.id === methodType)?.label ?? methodType} />
        </div>
        <div className="mt-4 grid gap-2">
          {checklist.map((item) => (
            <div
              key={item.label}
              className={`rounded-lg border px-3 py-2 text-xs ${
                item.ok ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-200" : "border-amber-500/30 bg-amber-500/10 text-amber-200"
              }`}
            >
              {item.ok ? "Completo" : "Pendiente"} · {item.label}
            </div>
          ))}
        </div>
      </div>

      <div className="flex flex-wrap gap-2 border-b border-fr-border pb-2">
        {(Object.keys(TAB_LABELS) as TabId[]).map((t) => (
          <button
            key={t}
            type="button"
            onClick={() => setTab(t)}
            className={`rounded-full px-3 py-1.5 text-xs font-medium ${
              tab === t ? "bg-gold/15 text-gold ring-1 ring-gold/30" : "text-fr-muted hover:text-fr-primary"
            }`}
          >
            {TAB_LABELS[t]}
          </button>
        ))}
      </div>

      {tab === "integrantes" ? (
        <div className="space-y-4">
          <div className="rounded-xl border border-fr-border p-4">
            <h4 className="text-sm font-semibold text-fr-primary">Asignar jurado al concurso</h4>
            <div className="mt-3 grid gap-3 md:grid-cols-2">
              <label className="space-y-1.5">
                <span className="text-xs text-fr-muted">Jurado reutilizable</span>
                <select className={inputBase} value={assignJudgeId} onChange={(e) => setAssignJudgeId(e.target.value)} disabled={readOnly || pending}>
                  <option value="">Seleccionar jurado</option>
                  {roster.map((r) => (
                    <option key={r.judgeId} value={r.judgeId}>
                      {r.firstName} {r.lastName} · {r.email}
                    </option>
                  ))}
                </select>
              </label>
              <label className="space-y-1.5">
                <span className="text-xs text-fr-muted">Rol</span>
                <select className={inputBase} value={assignType} onChange={(e) => setAssignType(e.target.value as "PRIMARY" | "BACKUP")} disabled={readOnly || pending}>
                  <option value="PRIMARY">Titular</option>
                  <option value="BACKUP">Suplente</option>
                </select>
              </label>
            </div>
            <div className="mt-3 space-y-2">
              <label className="inline-flex items-center gap-2 text-sm text-fr-muted">
                <input type="checkbox" checked={allCategories} onChange={(e) => setAllCategories(e.target.checked)} disabled={readOnly || pending} />
                Asignar a todas las categorías
              </label>
              {!allCategories ? (
                <div className="grid gap-2 sm:grid-cols-2">
                  {contest.categories.filter((c) => c.status === "ACTIVE").map((c) => (
                    <label key={c.id} className="inline-flex items-center gap-2 rounded-lg border border-fr-border px-3 py-2 text-xs text-fr-muted">
                      <input
                        type="checkbox"
                        checked={assignCategoryIds.includes(c.id)}
                        onChange={(e) =>
                          setAssignCategoryIds((prev) =>
                            e.target.checked ? [...prev, c.id] : prev.filter((x) => x !== c.id)
                          )
                        }
                        disabled={readOnly || pending}
                      />
                      {c.name}
                    </label>
                  ))}
                </div>
              ) : null}
            </div>
            <div className="mt-4">
              <button type="button" className="fr-btn fr-btn-primary" disabled={readOnly || pending || !assignJudgeId} onClick={assignJudge}>
                Guardar asignación
              </button>
            </div>
          </div>

          <div className="space-y-2">
            {assignedRows.length === 0 ? (
              <p className="text-sm text-fr-muted">No hay jurados asignados para este concurso.</p>
            ) : (
              assignedRows.map((r) => (
                <div key={r.judgeId} className="rounded-xl border border-fr-border p-3">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <p className="font-medium text-fr-primary">{r.firstName} {r.lastName}</p>
                      <p className="text-xs text-fr-muted">{r.email}</p>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="rounded-full border border-fr-border px-2 py-0.5 text-[10px] text-fr-muted">{r.assignmentType === "BACKUP" ? "Suplente" : "Titular"}</span>
                      <span className="rounded-full border border-fr-border px-2 py-0.5 text-[10px] text-fr-muted">{r.assignedCategoryIds.length} categoría(s)</span>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      ) : null}

      {tab === "evaluacion" ? (
        <div className="space-y-4">
          <label className="space-y-1.5">
            <span className="text-xs text-fr-muted">Método de evaluación del concurso</span>
            <select className={inputBase} value={methodType} onChange={(e) => setMethodType(e.target.value as JudgeMethodType)} disabled={readOnly || pending}>
              {METHOD_OPTIONS.map((m) => (
                <option key={m.id} value={m.id}>{m.label}</option>
              ))}
            </select>
          </label>
          <label className="inline-flex items-center gap-2 text-sm text-fr-muted">
            <input type="checkbox" checked={anonymousByDefault} onChange={(e) => setAnonymousByDefault(e.target.checked)} disabled={readOnly || pending} />
            Jura anónima por defecto
          </label>
          <div className="rounded-xl border border-fr-border p-4">
            <h4 className="text-sm font-semibold text-fr-primary">Criterios fijos (privados)</h4>
            <p className="mt-1 text-xs text-fr-muted">Técnica, Composición, Creatividad, Impacto visual, Adecuación al tema.</p>
            <div className="mt-3 space-y-2">
              {criteria.map((c, idx) => (
                <div key={c.key} className="grid grid-cols-[1fr_120px_120px] gap-2">
                  <input className={inputBase} value={c.label} readOnly />
                  <input
                    type="number"
                    min={1}
                    max={100}
                    className={inputBase}
                    value={c.maxScore}
                    onChange={(e) =>
                      setCriteria((prev) => prev.map((x, i) => (i === idx ? { ...x, maxScore: Number(e.target.value) } : x)))
                    }
                    disabled={readOnly || pending}
                  />
                  <input
                    type="number"
                    min={0}
                    max={100}
                    className={inputBase}
                    value={c.weight}
                    onChange={(e) =>
                      setCriteria((prev) => prev.map((x, i) => (i === idx ? { ...x, weight: Number(e.target.value) } : x)))
                    }
                    disabled={readOnly || pending}
                  />
                </div>
              ))}
            </div>
            <p className={`mt-3 text-xs ${criteriaWeightsSum === 100 ? "text-emerald-300" : "text-amber-300"}`}>
              Suma de ponderaciones: {criteriaWeightsSum}% (debe dar 100%).
            </p>
          </div>
        </div>
      ) : null}

      {tab === "visibilidad" ? (
        <div className="space-y-4">
          <label className="inline-flex items-center gap-2 text-sm text-fr-primary">
            <input type="checkbox" checked={showInLanding} onChange={(e) => setShowInLanding(e.target.checked)} disabled={readOnly || pending} />
            Mostrar jurado en landing
          </label>
          <label className="space-y-1.5 block">
            <span className="text-xs text-fr-muted">Ocultar bloque hasta fecha (opcional)</span>
            <input type="date" className={inputBase} value={hideUntil} onChange={(e) => setHideUntil(e.target.value)} disabled={readOnly || pending} />
          </label>
          <div className="space-y-2">
            {assignedRows.map((r) => {
              const visible = visibilityByJudgeId[r.judgeId] ?? r.isPublicProfile;
              return (
                <label key={r.judgeId} className="flex items-center justify-between rounded-lg border border-fr-border px-3 py-2 text-sm">
                  <span className="text-fr-primary">{r.firstName} {r.lastName}</span>
                  <span className="inline-flex items-center gap-2 text-fr-muted">
                    <input
                      type="checkbox"
                      checked={visible}
                      onChange={(e) => setVisibilityByJudgeId((prev) => ({ ...prev, [r.judgeId]: e.target.checked }))}
                      disabled={readOnly || pending}
                    />
                    visible
                  </span>
                </label>
              );
            })}
          </div>
          {assignedRows.length > 0 && !showInLanding ? (
            <p className="rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-xs text-amber-200">
              Hay jurados asignados, pero la sección está oculta en landing.
            </p>
          ) : null}
        </div>
      ) : null}

      {tab === "invitaciones" ? (
        <div className="space-y-4">
          <div className="grid gap-3 md:grid-cols-2">
            <label className="space-y-1.5">
              <span className="text-xs text-fr-muted">Seleccionar jurado (opcional)</span>
              <select className={inputBase} value={inviteJudgeId} onChange={(e) => setInviteJudgeId(e.target.value)} disabled={readOnly || pending}>
                <option value="">Sin jurado vinculado</option>
                {roster.map((r) => (
                  <option key={r.judgeId} value={r.judgeId}>{r.firstName} {r.lastName}</option>
                ))}
              </select>
            </label>
            <label className="space-y-1.5">
              <span className="text-xs text-fr-muted">Email invitación</span>
              <input className={inputBase} value={inviteEmail} onChange={(e) => setInviteEmail(e.target.value)} disabled={readOnly || pending} placeholder="jurado@email.com" />
            </label>
          </div>
          <div className="flex flex-wrap gap-2">
            <button type="button" className="fr-btn fr-btn-primary" disabled={readOnly || pending} onClick={sendInvite}>
              Invitar / reenviar
            </button>
            <button type="button" className="fr-btn fr-btn-secondary" disabled={pending} onClick={runReminderSweep}>
              Probar recordatorios automáticos
            </button>
          </div>
          <div className="space-y-2">
            {invites.length === 0 ? (
              <p className="text-sm text-fr-muted">No hay invitaciones para este concurso.</p>
            ) : (
              invites.map((i) => (
                <div key={i.id} className="rounded-lg border border-fr-border px-3 py-2 text-xs text-fr-muted">
                  <span className="font-medium text-fr-primary">{i.judgeLabel ?? i.email}</span> · {i.invitationStatus} · vence{" "}
                  {new Date(i.expiresAt).toLocaleDateString("es-AR")}
                </div>
              ))
            )}
          </div>
        </div>
      ) : null}

      {tab === "preview" ? (
        <div className="space-y-4">
          <p className="text-sm text-fr-muted">
            Vista previa del bloque jurado para landing (cards). Se muestran solo jurados visibles con foto.
          </p>
          <div className="grid gap-3 sm:grid-cols-2">
            {assignedRows
              .filter((r) => (visibilityByJudgeId[r.judgeId] ?? r.isPublicProfile) && Boolean(r.avatarUrl))
              .map((r) => (
                <div key={r.judgeId} className="rounded-xl border border-fr-border bg-fr-bg-elevated p-3">
                  <p className="font-medium text-fr-primary">{r.firstName} {r.lastName}</p>
                  <p className="mt-1 text-xs text-fr-muted">
                    {r.specialities[0] ?? "Jurado"} · {[r.city, r.country].filter(Boolean).join(", ") || "Sin ubicación"}
                  </p>
                </div>
              ))}
          </div>
        </div>
      ) : null}

      <div className="fr-form-actions flex flex-wrap gap-2">
        <button type="button" className="fr-btn fr-btn-primary" disabled={readOnly || pending} onClick={saveRulesConfig}>
          Guardar ficha jurado
        </button>
        <button type="button" className="fr-btn fr-btn-secondary" onClick={onCancel}>
          Cerrar
        </button>
      </div>
    </div>
  );
}

function SummaryChip({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-fr-border bg-fr-bg px-3 py-2">
      <p className="text-[10px] uppercase tracking-wide text-fr-muted">{label}</p>
      <p className="mt-1 text-sm font-semibold text-fr-primary">{value}</p>
    </div>
  );
}
