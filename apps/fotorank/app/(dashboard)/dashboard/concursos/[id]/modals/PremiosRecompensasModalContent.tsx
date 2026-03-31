"use client";

import { useMemo, useState, useTransition } from "react";
import { updateContestRules } from "../../../../../actions/contests";
import { inputBase, textareaWizard } from "../../../../../components/ui/form";
import {
  computeEconomySummary,
  parsePrizesRewardsConfig,
  toRulesDataWithPrizesRewards,
  type ContestPrizeItem,
  type ContestRewardItem,
  type PrizesRewardsConfig,
  type PrizeType,
  type RewardType,
} from "../../../../../lib/fotorank/prizesRewards";

type Contest = NonNullable<
  Awaited<ReturnType<typeof import("../../../../../lib/fotorank/contests").getFotorankContestById>>
>;

type Props = {
  contest: Contest;
  onSuccess: () => void;
  onCancel: () => void;
  readOnly?: boolean;
  restrictionMessage?: string | null;
};

const PRIZE_TYPES: Array<{ value: PrizeType; label: string }> = [
  { value: "CASH", label: "Efectivo" },
  { value: "TROPHY", label: "Trofeo" },
  { value: "DIPLOMA", label: "Diploma" },
  { value: "CERTIFICATE", label: "Certificado" },
  { value: "PHYSICAL_PRODUCT", label: "Producto físico" },
  { value: "DIGITAL_PRODUCT", label: "Producto digital" },
  { value: "SCHOLARSHIP", label: "Beca" },
  { value: "PROMOTION", label: "Difusión" },
  { value: "DISCOUNT", label: "Descuento" },
  { value: "SPONSOR_BENEFIT", label: "Sponsor benefit" },
  { value: "OTHER", label: "Otro" },
];

const REWARD_TYPES: Array<{ value: RewardType; label: string }> = [
  { value: "DISCOUNT", label: "Descuento" },
  { value: "COUPON", label: "Cupón" },
  { value: "COURSE_ACCESS", label: "Acceso a curso" },
  { value: "MEMBERSHIP", label: "Membresía" },
  { value: "GIFT_CARD", label: "Gift card" },
  { value: "FEATURED_PUBLICATION", label: "Publicación destacada" },
  { value: "SPONSOR_BENEFIT", label: "Beneficio sponsor" },
  { value: "OTHER", label: "Otro" },
];

function newPrize(): ContestPrizeItem {
  return {
    id: `pr-${Date.now()}-${Math.random().toString(16).slice(2, 8)}`,
    name: "",
    type: "OTHER",
    shortDescription: "",
    scope: "GENERAL",
    winnersCount: 1,
    visiblePublic: true,
    deliveryStatus: "PENDING",
    isMonetary: false,
    payoutMethod: "OFF_PLATFORM",
    payoutStatus: "PENDING",
  };
}

function newReward(): ContestRewardItem {
  return {
    id: `rw-${Date.now()}-${Math.random().toString(16).slice(2, 8)}`,
    name: "",
    type: "OTHER",
    description: "",
    recipients: "ALL",
    visiblePublic: true,
    deliveryStatus: "PENDING",
  };
}

export function PremiosRecompensasModalContent({
  contest,
  onSuccess,
  onCancel,
  readOnly,
  restrictionMessage,
}: Props) {
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [okMsg, setOkMsg] = useState<string | null>(null);

  const initial = useMemo(() => parsePrizesRewardsConfig(contest.rulesData), [contest.rulesData]);
  const [cfg, setCfg] = useState<PrizesRewardsConfig>(initial);

  const economy = useMemo(() => computeEconomySummary(cfg), [cfg]);
  const categories = contest.categories.filter((c) => c.status === "ACTIVE");
  const visiblePrizes = cfg.prizes.filter((p) => p.visiblePublic);
  const visibleRewards = cfg.rewards.filter((r) => r.visiblePublic);
  const hasAny = cfg.noPrizesExplicit || cfg.prizes.length > 0 || cfg.rewards.length > 0;

  const checklist = useMemo(() => {
    const monetaryValid = cfg.prizes
      .filter((p) => p.isMonetary)
      .every((p) => Number(p.amount ?? 0) > 0 && Boolean(p.currency?.trim()));
    const categoryValid = cfg.prizes
      .filter((p) => p.scope === "CATEGORY")
      .every((p) => Boolean(p.categoryId));
    const sponsorsValid = [...cfg.prizes, ...cfg.rewards]
      .filter((x) => Boolean(x.sponsorName?.trim()))
      .every((x) => Boolean(x.sponsorUrl?.trim()));
    return [
      { label: "Premio o recompensa configurado (o marcado como sin premios)", ok: hasAny },
      { label: "Premios monetarios completos (monto + moneda)", ok: monetaryValid },
      { label: "Premios por categoría con categoría asignada", ok: categoryValid },
      { label: "Sponsors vinculados con datos válidos", ok: sponsorsValid },
      { label: "Economía revisada por organizador", ok: Boolean(cfg.economy.reviewedByOrganizer) },
    ];
  }, [cfg, hasAny]);

  const save = () => {
    if (readOnly) return;
    setError(null);
    setOkMsg(null);
    const invalidMonetary = cfg.prizes.find((p) => p.isMonetary && (!p.amount || !p.currency));
    if (invalidMonetary) {
      setError(`El premio monetario "${invalidMonetary.name || "(sin nombre)"}" requiere monto y moneda.`);
      return;
    }
    const invalidCategory = cfg.prizes.find((p) => p.scope === "CATEGORY" && !p.categoryId);
    if (invalidCategory) {
      setError(`El premio "${invalidCategory.name || "(sin nombre)"}" requiere categoría asociada.`);
      return;
    }
    start(async () => {
      const rulesData = toRulesDataWithPrizesRewards(contest.rulesData, cfg);
      const res = await updateContestRules(contest.id, contest.rulesText ?? "", rulesData);
      if (!res.ok) {
        setError(res.error);
        return;
      }
      setOkMsg("Premios, recompensas y economía guardados.");
      onSuccess();
    });
  };

  return (
    <div className="space-y-8">
      {restrictionMessage ? (
        <div className="rounded-lg border border-gold/30 bg-gold/10 px-4 py-3 text-sm text-gold">{restrictionMessage}</div>
      ) : null}
      {error ? <div className="rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-200">{error}</div> : null}
      {okMsg ? <div className="rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-200">{okMsg}</div> : null}

      <section className="space-y-3">
        <h3 className="text-sm font-semibold uppercase tracking-wide text-fr-muted">Estado del módulo</h3>
        <div className="grid gap-2">
          {checklist.map((item) => (
            <div
              key={item.label}
              className={`rounded-lg border px-3 py-2 text-xs ${
                item.ok ? "border-emerald-500/25 bg-emerald-500/10 text-emerald-200" : "border-amber-500/30 bg-amber-500/10 text-amber-200"
              }`}
            >
              {item.ok ? "Completo" : "Pendiente"} · {item.label}
            </div>
          ))}
        </div>
      </section>

      <section className="space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold uppercase tracking-wide text-fr-muted">Premios</h3>
          <button type="button" className="fr-btn fr-btn-secondary" onClick={() => setCfg((s) => ({ ...s, prizes: [...s.prizes, newPrize()] }))} disabled={readOnly || pending}>
            Agregar premio
          </button>
        </div>
        <label className="inline-flex items-center gap-2 text-sm text-fr-muted">
          <input
            type="checkbox"
            checked={Boolean(cfg.noPrizesExplicit)}
            onChange={(e) => setCfg((s) => ({ ...s, noPrizesExplicit: e.target.checked }))}
            disabled={readOnly || pending}
          />
          Este concurso no ofrece premios ni recompensas
        </label>

        <div className="space-y-4">
          {cfg.prizes.map((p) => (
            <div key={p.id} className="fr-recuadro rounded-xl border border-fr-border bg-fr-card">
              <div className="grid gap-4 md:grid-cols-2">
                <input
                  className={inputBase}
                  placeholder="Nombre del premio"
                  value={p.name}
                  onChange={(e) => setCfg((s) => ({ ...s, prizes: s.prizes.map((x) => (x.id === p.id ? { ...x, name: e.target.value } : x)) }))}
                  disabled={readOnly || pending}
                />
                <select
                  className={inputBase}
                  value={p.type}
                  onChange={(e) => setCfg((s) => ({ ...s, prizes: s.prizes.map((x) => (x.id === p.id ? { ...x, type: e.target.value as PrizeType } : x)) }))}
                  disabled={readOnly || pending}
                >
                  {PRIZE_TYPES.map((o) => (
                    <option key={o.value} value={o.value}>
                      {o.label}
                    </option>
                  ))}
                </select>
              </div>
              <textarea
                className={`${textareaWizard} mt-4`}
                rows={2}
                placeholder="Descripción breve"
                value={p.shortDescription}
                onChange={(e) => setCfg((s) => ({ ...s, prizes: s.prizes.map((x) => (x.id === p.id ? { ...x, shortDescription: e.target.value } : x)) }))}
                disabled={readOnly || pending}
              />
              <div className="mt-4 grid gap-4 md:grid-cols-3">
                <select
                  className={inputBase}
                  value={p.scope}
                  onChange={(e) => setCfg((s) => ({ ...s, prizes: s.prizes.map((x) => (x.id === p.id ? { ...x, scope: e.target.value as ContestPrizeItem["scope"] } : x)) }))}
                  disabled={readOnly || pending}
                >
                  <option value="GENERAL">General</option>
                  <option value="CATEGORY">Por categoría</option>
                  <option value="POSITION">Por puesto</option>
                  <option value="MENTION">Mención</option>
                </select>
                <select
                  className={inputBase}
                  value={p.categoryId ?? ""}
                  onChange={(e) => setCfg((s) => ({ ...s, prizes: s.prizes.map((x) => (x.id === p.id ? { ...x, categoryId: e.target.value || undefined } : x)) }))}
                  disabled={readOnly || pending}
                >
                  <option value="">Sin categoría</option>
                  {categories.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </select>
                <input
                  className={inputBase}
                  placeholder="Sponsor (opcional)"
                  value={p.sponsorName ?? ""}
                  onChange={(e) => setCfg((s) => ({ ...s, prizes: s.prizes.map((x) => (x.id === p.id ? { ...x, sponsorName: e.target.value } : x)) }))}
                  disabled={readOnly || pending}
                />
              </div>
              <div className="mt-4 flex flex-wrap gap-4 text-sm">
                <label className="inline-flex items-center gap-2 text-fr-muted">
                  <input
                    type="checkbox"
                    checked={Boolean(p.visiblePublic)}
                    onChange={(e) => setCfg((s) => ({ ...s, prizes: s.prizes.map((x) => (x.id === p.id ? { ...x, visiblePublic: e.target.checked } : x)) }))}
                    disabled={readOnly || pending}
                  />
                  Visible en landing
                </label>
                <label className="inline-flex items-center gap-2 text-fr-muted">
                  <input
                    type="checkbox"
                    checked={Boolean(p.isMonetary)}
                    onChange={(e) => setCfg((s) => ({ ...s, prizes: s.prizes.map((x) => (x.id === p.id ? { ...x, isMonetary: e.target.checked } : x)) }))}
                    disabled={readOnly || pending}
                  />
                  Premio monetario
                </label>
              </div>
              {p.isMonetary ? (
                <div className="mt-4 grid gap-4 md:grid-cols-3">
                  <input
                    className={inputBase}
                    type="number"
                    min={0}
                    step="0.01"
                    placeholder="Monto"
                    value={p.amount ?? ""}
                    onChange={(e) => setCfg((s) => ({ ...s, prizes: s.prizes.map((x) => (x.id === p.id ? { ...x, amount: Number(e.target.value || 0) } : x)) }))}
                    disabled={readOnly || pending}
                  />
                  <input
                    className={inputBase}
                    placeholder="Moneda (USD, ARS...)"
                    value={p.currency ?? ""}
                    onChange={(e) => setCfg((s) => ({ ...s, prizes: s.prizes.map((x) => (x.id === p.id ? { ...x, currency: e.target.value } : x)) }))}
                    disabled={readOnly || pending}
                  />
                  <select
                    className={inputBase}
                    value={p.payoutMethod ?? "OFF_PLATFORM"}
                    onChange={(e) => setCfg((s) => ({ ...s, prizes: s.prizes.map((x) => (x.id === p.id ? { ...x, payoutMethod: e.target.value as ContestPrizeItem["payoutMethod"] } : x)) }))}
                    disabled={readOnly || pending}
                  >
                    <option value="OFF_PLATFORM">Entrega por fuera de Fotorank</option>
                    <option value="PLATFORM_FUTURE">Futura gestión por plataforma</option>
                  </select>
                </div>
              ) : null}
              <div className="mt-4">
                <button
                  type="button"
                  className="fr-btn fr-btn-secondary"
                  onClick={() => setCfg((s) => ({ ...s, prizes: s.prizes.filter((x) => x.id !== p.id) }))}
                  disabled={readOnly || pending}
                >
                  Eliminar premio
                </button>
              </div>
            </div>
          ))}
          {cfg.prizes.length === 0 ? <p className="text-sm text-fr-muted">No hay premios cargados.</p> : null}
        </div>
      </section>

      <section className="space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold uppercase tracking-wide text-fr-muted">Recompensas</h3>
          <button type="button" className="fr-btn fr-btn-secondary" onClick={() => setCfg((s) => ({ ...s, rewards: [...s.rewards, newReward()] }))} disabled={readOnly || pending}>
            Agregar recompensa
          </button>
        </div>
        <div className="space-y-4">
          {cfg.rewards.map((r) => (
            <div key={r.id} className="fr-recuadro rounded-xl border border-fr-border bg-fr-card">
              <div className="grid gap-4 md:grid-cols-2">
                <input
                  className={inputBase}
                  placeholder="Nombre de recompensa"
                  value={r.name}
                  onChange={(e) => setCfg((s) => ({ ...s, rewards: s.rewards.map((x) => (x.id === r.id ? { ...x, name: e.target.value } : x)) }))}
                  disabled={readOnly || pending}
                />
                <select
                  className={inputBase}
                  value={r.type}
                  onChange={(e) => setCfg((s) => ({ ...s, rewards: s.rewards.map((x) => (x.id === r.id ? { ...x, type: e.target.value as RewardType } : x)) }))}
                  disabled={readOnly || pending}
                >
                  {REWARD_TYPES.map((o) => (
                    <option key={o.value} value={o.value}>
                      {o.label}
                    </option>
                  ))}
                </select>
              </div>
              <textarea
                className={`${textareaWizard} mt-4`}
                rows={2}
                placeholder="Descripción"
                value={r.description}
                onChange={(e) => setCfg((s) => ({ ...s, rewards: s.rewards.map((x) => (x.id === r.id ? { ...x, description: e.target.value } : x)) }))}
                disabled={readOnly || pending}
              />
              <div className="mt-4 grid gap-4 md:grid-cols-3">
                <select
                  className={inputBase}
                  value={r.recipients}
                  onChange={(e) => setCfg((s) => ({ ...s, rewards: s.rewards.map((x) => (x.id === r.id ? { ...x, recipients: e.target.value as ContestRewardItem["recipients"] } : x)) }))}
                  disabled={readOnly || pending}
                >
                  <option value="ALL">Todos los participantes</option>
                  <option value="FINALISTS">Finalistas</option>
                  <option value="WINNERS">Ganadores</option>
                  <option value="CATEGORY">Categoría específica</option>
                </select>
                <input
                  className={inputBase}
                  placeholder="Sponsor (opcional)"
                  value={r.sponsorName ?? ""}
                  onChange={(e) => setCfg((s) => ({ ...s, rewards: s.rewards.map((x) => (x.id === r.id ? { ...x, sponsorName: e.target.value } : x)) }))}
                  disabled={readOnly || pending}
                />
                <input
                  className={inputBase}
                  placeholder="Cupón (opcional)"
                  value={r.couponCode ?? ""}
                  onChange={(e) => setCfg((s) => ({ ...s, rewards: s.rewards.map((x) => (x.id === r.id ? { ...x, couponCode: e.target.value } : x)) }))}
                  disabled={readOnly || pending}
                />
              </div>
              <div className="mt-4 flex flex-wrap gap-4 text-sm">
                <label className="inline-flex items-center gap-2 text-fr-muted">
                  <input
                    type="checkbox"
                    checked={Boolean(r.visiblePublic)}
                    onChange={(e) => setCfg((s) => ({ ...s, rewards: s.rewards.map((x) => (x.id === r.id ? { ...x, visiblePublic: e.target.checked } : x)) }))}
                    disabled={readOnly || pending}
                  />
                  Visible en landing
                </label>
              </div>
              <div className="mt-4">
                <button
                  type="button"
                  className="fr-btn fr-btn-secondary"
                  onClick={() => setCfg((s) => ({ ...s, rewards: s.rewards.filter((x) => x.id !== r.id) }))}
                  disabled={readOnly || pending}
                >
                  Eliminar recompensa
                </button>
              </div>
            </div>
          ))}
          {cfg.rewards.length === 0 ? <p className="text-sm text-fr-muted">No hay recompensas cargadas.</p> : null}
        </div>
      </section>

      <section className="space-y-4">
        <h3 className="text-sm font-semibold uppercase tracking-wide text-fr-muted">Economía del concurso (privada)</h3>
        <p className="text-sm text-fr-muted">
          Fotorank no cobra por uso general. Solo aplica cargos por inscripciones pagas (15%) y módulos activados (diplomas y envío masivo).
        </p>
        <div className="grid gap-4 md:grid-cols-3">
          <select
            className={inputBase}
            value={cfg.economy.entryMode}
            onChange={(e) => setCfg((s) => ({ ...s, economy: { ...s.economy, entryMode: e.target.value as "FREE" | "PAID" } }))}
            disabled={readOnly || pending}
          >
            <option value="FREE">Concurso gratuito</option>
            <option value="PAID">Con inscripción paga</option>
          </select>
          <input
            className={inputBase}
            type="number"
            min={0}
            step="0.01"
            placeholder="Valor inscripción"
            value={cfg.economy.entryFeeAmount ?? ""}
            onChange={(e) => setCfg((s) => ({ ...s, economy: { ...s.economy, entryFeeAmount: Number(e.target.value || 0) } }))}
            disabled={readOnly || pending || cfg.economy.entryMode !== "PAID"}
          />
          <input
            className={inputBase}
            placeholder="Moneda"
            value={cfg.economy.entryFeeCurrency ?? "USD"}
            onChange={(e) => setCfg((s) => ({ ...s, economy: { ...s.economy, entryFeeCurrency: e.target.value } }))}
            disabled={readOnly || pending || cfg.economy.entryMode !== "PAID"}
          />
        </div>
        <div className="grid gap-4 md:grid-cols-3">
          <input
            className={inputBase}
            type="number"
            min={0}
            placeholder="Inscripciones pagas"
            value={cfg.economy.paidRegistrationsCount ?? 0}
            onChange={(e) => setCfg((s) => ({ ...s, economy: { ...s.economy, paidRegistrationsCount: Number(e.target.value || 0) } }))}
            disabled={readOnly || pending}
          />
          <input
            className={inputBase}
            type="number"
            min={0}
            step="0.01"
            placeholder="% pasarela"
            value={cfg.economy.gatewayFeePercent ?? 0}
            onChange={(e) => setCfg((s) => ({ ...s, economy: { ...s.economy, gatewayFeePercent: Number(e.target.value || 0) } }))}
            disabled={readOnly || pending}
          />
        </div>
        <div className="flex flex-wrap gap-5 text-sm">
          <label className="inline-flex items-center gap-2 text-fr-muted">
            <input
              type="checkbox"
              checked={Boolean(cfg.economy.diplomasEnabled)}
              onChange={(e) => setCfg((s) => ({ ...s, economy: { ...s.economy, diplomasEnabled: e.target.checked } }))}
              disabled={readOnly || pending}
            />
            Módulo diplomas activado (20 USD)
          </label>
          <label className="inline-flex items-center gap-2 text-fr-muted">
            <input
              type="checkbox"
              checked={Boolean(cfg.economy.diplomaEmailsEnabled)}
              onChange={(e) => setCfg((s) => ({ ...s, economy: { ...s.economy, diplomaEmailsEnabled: e.target.checked } }))}
              disabled={readOnly || pending}
            />
            Envío masivo por email activado (20 USD)
          </label>
          <label className="inline-flex items-center gap-2 text-fr-muted">
            <input
              type="checkbox"
              checked={Boolean(cfg.economy.reviewedByOrganizer)}
              onChange={(e) => setCfg((s) => ({ ...s, economy: { ...s.economy, reviewedByOrganizer: e.target.checked } }))}
              disabled={readOnly || pending}
            />
            Economía revisada por organizador
          </label>
        </div>
        <div className="rounded-xl border border-fr-border bg-fr-bg-elevated p-4 text-sm">
          <p>Bruto por inscripciones: <strong>{economy.gross.toFixed(2)} {cfg.economy.entryFeeCurrency ?? "USD"}</strong></p>
          <p>Comisión Fotorank (15%): <strong>{economy.platformCommission.toFixed(2)} {cfg.economy.entryFeeCurrency ?? "USD"}</strong></p>
          <p>Pasarela estimada: <strong>{economy.gatewayFee.toFixed(2)} {cfg.economy.entryFeeCurrency ?? "USD"}</strong></p>
          <p>Servicios contratados: <strong>{economy.servicesTotal.toFixed(2)} USD</strong></p>
          <p className="mt-2">Neto estimado organizador: <strong>{economy.netForOrganizer.toFixed(2)} {cfg.economy.entryFeeCurrency ?? "USD"}</strong></p>
        </div>
      </section>

      <section className="space-y-3">
        <h3 className="text-sm font-semibold uppercase tracking-wide text-fr-muted">Vista pública previa</h3>
        <div className="rounded-xl border border-fr-border bg-fr-card p-4">
          <p className="text-sm text-fr-muted">Premio principal</p>
          <p className="mt-1 text-base font-semibold text-fr-primary">
            {visiblePrizes.find((p) => p.isPrimary)?.name ?? visiblePrizes[0]?.name ?? "Sin premio destacado"}
          </p>
          <div className="mt-4 grid gap-3 md:grid-cols-2">
            {visiblePrizes.slice(0, 6).map((p) => (
              <div key={p.id} className="rounded-lg border border-fr-border bg-fr-bg px-3 py-2 text-xs">
                <p className="font-semibold text-fr-primary">{p.name || "Premio sin nombre"}</p>
                <p className="mt-1 text-fr-muted">{p.shortDescription || "Sin descripción"}</p>
              </div>
            ))}
            {visibleRewards.slice(0, 6).map((r) => (
              <div key={r.id} className="rounded-lg border border-fr-border bg-fr-bg px-3 py-2 text-xs">
                <p className="font-semibold text-fr-primary">{r.name || "Recompensa sin nombre"}</p>
                <p className="mt-1 text-fr-muted">{r.description || "Sin descripción"}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <div className="fr-form-actions flex flex-wrap gap-2">
        <button type="button" className="fr-btn fr-btn-primary" onClick={save} disabled={readOnly || pending}>
          Guardar módulo
        </button>
        <button type="button" className="fr-btn fr-btn-secondary" onClick={onCancel}>
          Cerrar
        </button>
      </div>
    </div>
  );
}
