"use client";

import { useMemo, useState, useTransition } from "react";
import { updateContestRules } from "../../../../../actions/contests";
import {
  parsePrizesRewardsConfig,
  toRulesDataWithPrizesRewards,
  type PrizesRewardsConfig,
} from "../../../../../lib/fotorank/prizesRewards";
import { PremiosRecompensasModule } from "./premios-recompensas/PremiosRecompensasModule";

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

export function PremiosRecompensasModalContent({ contest, onSuccess, onCancel, readOnly, restrictionMessage }: Props) {
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [okMsg, setOkMsg] = useState<string | null>(null);

  const initial = useMemo(() => parsePrizesRewardsConfig(contest.rulesData), [contest.rulesData]);
  const [cfg, setCfg] = useState<PrizesRewardsConfig>(initial);

  const categories = contest.categories.filter((c) => c.status === "ACTIVE");

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
      { label: "Premio o recompensa configurado (o sin premios explícito)", ok: hasAny },
      { label: "Premios monetarios con monto y moneda", ok: monetaryValid },
      { label: "Premios por categoría con categoría asignada", ok: categoryValid },
      { label: "Sponsors con URL si hay nombre", ok: sponsorsValid },
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
      setOkMsg("Cambios guardados correctamente.");
      onSuccess();
    });
  };

  return (
    <div className="space-y-10">
      {restrictionMessage ? (
        <div className="rounded-lg border border-gold/30 bg-gold/10 px-4 py-3 text-sm text-gold">{restrictionMessage}</div>
      ) : null}
      {error ? <div className="rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-200">{error}</div> : null}
      {okMsg ? <div className="rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-200">{okMsg}</div> : null}

      <section className="space-y-4">
        <h3 className="text-xs font-semibold uppercase tracking-wider text-fr-muted">Completitud</h3>
        <div className="grid gap-3 sm:grid-cols-2">
          {checklist.map((item) => (
            <div
              key={item.label}
              className={`rounded-xl border px-4 py-3 text-sm leading-relaxed transition-colors ${
                item.ok ? "border-emerald-500/25 bg-emerald-500/10 text-emerald-200" : "border-amber-500/30 bg-amber-500/10 text-amber-200"
              }`}
            >
              {item.ok ? "Listo" : "Pendiente"} · {item.label}
            </div>
          ))}
        </div>
      </section>

      <PremiosRecompensasModule
        contestId={contest.id}
        contestTitle={contest.title}
        categories={categories.map((c) => ({ id: c.id, name: c.name }))}
        cfg={cfg}
        setCfg={setCfg}
        readOnly={readOnly}
        pending={pending}
      />

      <div className="fr-form-actions flex flex-wrap gap-3 border-t border-fr-border pt-8">
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
