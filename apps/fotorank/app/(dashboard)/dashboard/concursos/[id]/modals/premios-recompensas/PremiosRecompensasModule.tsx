"use client";

import { useMemo, useState } from "react";
import {
  Award,
  Banknote,
  Eye,
  Gift,
  LayoutTemplate,
  Link2,
  Package,
  Sparkles,
  TrendingUp,
  Trophy,
  Truck,
  Users,
} from "lucide-react";
import { inputBase, labelBase, selectBase } from "../../../../../../components/ui/form";
import {
  computeEconomySummary,
  getEconomyModuleStatus,
  getPrizesModuleStatus,
  type ContestPrizeItem,
  type ContestRewardItem,
  type PrizesRewardsConfig,
} from "../../../../../../lib/fotorank/prizesRewards";
import { DELIVERY_LABEL, RECIPIENT_LABEL, SCOPE_LABEL, prizeTypeLabel, rewardTypeLabel } from "./constants";
import { PrizeEditor, RewardEditor } from "./forms";
import { EmptyStateBlock, HelperLine, PrBadge, SectionIntro, StatMiniCard } from "./ui";

type Cat = { id: string; name: string };

export type PremiosRecompensasModuleProps = {
  /** Necesario para descargar la placa de agradecimiento del sponsor. */
  contestId?: string;
  contestTitle: string;
  categories: Cat[];
  cfg: PrizesRewardsConfig;
  setCfg: React.Dispatch<React.SetStateAction<PrizesRewardsConfig>>;
  readOnly?: boolean;
  pending?: boolean;
};

export type TabId = "premios" | "recompensas" | "sponsors" | "entrega" | "economia" | "vista";

const TABS: Array<{ id: TabId; label: string; icon: typeof Trophy }> = [
  { id: "premios", label: "Premios", icon: Trophy },
  { id: "recompensas", label: "Recompensas", icon: Gift },
  { id: "sponsors", label: "Sponsors", icon: Users },
  { id: "entrega", label: "Entrega", icon: Truck },
  { id: "economia", label: "Economía", icon: TrendingUp },
  { id: "vista", label: "Vista pública", icon: LayoutTemplate },
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
    isPrimary: false,
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

function aggregateSponsors(cfg: PrizesRewardsConfig) {
  const map = new Map<string, { name: string; url?: string; prizes: string[]; rewards: string[] }>();
  for (const p of cfg.prizes) {
    const n = p.sponsorName?.trim();
    if (!n) continue;
    const key = n.toLowerCase();
    const prev = map.get(key) ?? { name: n, url: p.sponsorUrl, prizes: [], rewards: [] as string[] };
    prev.prizes.push(p.name || "Premio sin nombre");
    if (p.sponsorUrl?.trim()) prev.url = p.sponsorUrl;
    map.set(key, prev);
  }
  for (const r of cfg.rewards) {
    const n = r.sponsorName?.trim();
    if (!n) continue;
    const key = n.toLowerCase();
    const prev = map.get(key) ?? { name: n, url: r.sponsorUrl, prizes: [], rewards: [] };
    prev.rewards.push(r.name || "Recompensa sin nombre");
    if (r.sponsorUrl?.trim()) prev.url = r.sponsorUrl;
    map.set(key, prev);
  }
  return [...map.values()];
}

function moduleStatusLabel(cfg: PrizesRewardsConfig): { label: string; tone: "gold" | "warning" | "success" | "muted" } {
  const p = getPrizesModuleStatus(cfg);
  const e = getEconomyModuleStatus(cfg);
  if (p === "COMPLETE" && e === "COMPLETE") return { label: "Módulo listo", tone: "success" };
  if (p === "NOT_STARTED" && e === "NOT_STARTED") return { label: "Sin configurar", tone: "muted" };
  return { label: "En configuración", tone: "warning" };
}

export function PremiosRecompensasModule({
  contestId,
  contestTitle,
  categories,
  cfg,
  setCfg,
  readOnly,
  pending,
}: PremiosRecompensasModuleProps) {
  const [tab, setTab] = useState<TabId>("premios");
  const [openPrizeId, setOpenPrizeId] = useState<string | null>(null);
  const [openRewardId, setOpenRewardId] = useState<string | null>(null);

  const economy = useMemo(() => computeEconomySummary(cfg), [cfg]);
  const sponsors = useMemo(() => aggregateSponsors(cfg), [cfg]);
  const monetaryCount = cfg.prizes.filter((p) => p.isMonetary).length;
  const servicesActive = (cfg.economy.diplomasEnabled ? 1 : 0) + (cfg.economy.diplomaEmailsEnabled ? 1 : 0);
  const status = moduleStatusLabel(cfg);

  const catName = (id?: string) => categories.find((c) => c.id === id)?.name ?? "—";

  const addPrize = () => {
    const p = newPrize();
    setCfg((s) => ({ ...s, prizes: [...s.prizes, p] }));
    setOpenPrizeId(p.id);
    setTab("premios");
  };

  const addReward = () => {
    const r = newReward();
    setCfg((s) => ({ ...s, rewards: [...s.rewards, r] }));
    setOpenRewardId(r.id);
    setTab("recompensas");
  };

  return (
    <div className="space-y-10 pb-2">
      {/* Encabezado editorial */}
      <header className="relative overflow-hidden rounded-2xl border border-fr-border bg-gradient-to-br from-fr-card via-fr-bg-elevated to-fr-bg p-6 md:p-8">
        <div className="pointer-events-none absolute -right-16 -top-16 size-48 rounded-full bg-gold/5 blur-3xl" aria-hidden />
        <div className="relative space-y-6">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
            <div className="min-w-0 space-y-3">
              <p className="fr-eyebrow text-gold">Concurso</p>
              <h2 className="font-sans text-2xl font-semibold tracking-tight text-fr-primary md:text-3xl">Premios y recompensas</h2>
              <p className="max-w-2xl text-sm leading-relaxed text-fr-muted md:text-base">
                Configurá reconocimientos y beneficios para la landing, y revisá la economía del torneo: ingresos por inscripción, comisión Fotorank y servicios activados — todo con criterio claro y separado del premio al participante.
              </p>
            </div>
            <div className="flex shrink-0 flex-wrap items-center gap-2">
              <PrBadge tone={status.tone === "success" ? "success" : status.tone === "warning" ? "warning" : status.tone === "gold" ? "gold" : "muted"}>
                {status.label}
              </PrBadge>
              {cfg.noPrizesExplicit ? (
                <PrBadge tone="muted">Sin premios declarados</PrBadge>
              ) : null}
            </div>
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <StatMiniCard icon={Trophy} label="Premios" value={cfg.prizes.length} hint="Reconocimientos por resultado" />
            <StatMiniCard icon={Sparkles} label="Recompensas" value={cfg.rewards.length} hint="Beneficios extra" />
            <StatMiniCard icon={Banknote} label="Premios monetarios" value={monetaryCount} hint="Montos declarados" />
            <StatMiniCard
              icon={Package}
              label="Servicios pagos"
              value={servicesActive}
              hint={cfg.economy.diplomasEnabled || cfg.economy.diplomaEmailsEnabled ? "Diplomas / email activos" : "Ninguno activo"}
            />
          </div>

          <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap">
            <button type="button" className="fr-btn fr-btn-primary inline-flex items-center justify-center gap-2" onClick={addPrize} disabled={readOnly || pending || cfg.noPrizesExplicit}>
              <Trophy className="size-4" aria-hidden />
              Agregar premio
            </button>
            <button type="button" className="fr-btn fr-btn-secondary inline-flex items-center justify-center gap-2" onClick={addReward} disabled={readOnly || pending || cfg.noPrizesExplicit}>
              <Gift className="size-4" aria-hidden />
              Agregar recompensa
            </button>
            <button type="button" className="fr-btn fr-btn-secondary inline-flex items-center justify-center gap-2" onClick={() => setTab("vista")}>
              <Eye className="size-4" aria-hidden />
              Vista previa pública
            </button>
          </div>

          <label className="flex cursor-pointer items-start gap-3 rounded-xl border border-fr-border/80 bg-fr-bg/40 px-4 py-3 text-sm text-fr-muted">
            <input
              type="checkbox"
              className="mt-0.5 size-4 shrink-0 rounded border-fr-border bg-fr-bg text-gold focus:ring-gold/30"
              checked={Boolean(cfg.noPrizesExplicit)}
              onChange={(e) => setCfg((s) => ({ ...s, noPrizesExplicit: e.target.checked }))}
              disabled={readOnly || pending}
            />
            <span>
              <span className="font-medium text-fr-primary">Este concurso no ofrece premios ni recompensas</span>
              <span className="mt-1 block text-xs leading-relaxed">Marcá esto si el torneo es solo reconocimiento simbólico o sin entregas.</span>
            </span>
          </label>
        </div>
      </header>

      {/* Tabs */}
      <div className="sticky top-0 z-10 -mx-1 border-b border-fr-border bg-[#0a0a0a]/95 px-1 py-2 backdrop-blur-md">
        <nav className="flex flex-wrap gap-2" aria-label="Secciones premios">
          {TABS.map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              type="button"
              onClick={() => setTab(id)}
              className={`inline-flex items-center gap-2 rounded-full px-4 py-2 text-sm font-medium transition-colors ${
                tab === id ? "bg-gold/15 text-gold ring-1 ring-gold/40" : "text-fr-muted hover:bg-fr-card hover:text-fr-primary"
              }`}
            >
              <Icon className="size-4 shrink-0 opacity-90" aria-hidden />
              {label}
            </button>
          ))}
        </nav>
      </div>

      {/* Contenido por tab */}
      <div className="min-h-[12rem]">
        {tab === "premios" ? (
          <div className="space-y-8">
            <SectionIntro
              title="Premios del concurso"
              description="Son reconocimientos ligados al resultado: podés marcar uno como principal, definir alcance por categoría y separar lo público de lo interno."
            />
            {cfg.noPrizesExplicit ? (
              <EmptyStateBlock
                icon={Trophy}
                title="Sin premios por decisión del organizador"
                description="Desmarcá la opción superior si querés volver a cargar premios y recompensas."
              />
            ) : cfg.prizes.length === 0 ? (
              <EmptyStateBlock
                icon={Award}
                title="Todavía no cargaste premios"
                description="Un buen premio principal y premios por categoría aumentan la conversión en la landing pública."
                action={
                  <button type="button" className="fr-btn fr-btn-primary inline-flex items-center gap-2" onClick={addPrize} disabled={readOnly || pending}>
                    <Trophy className="size-4" aria-hidden />
                    Agregar primer premio
                  </button>
                }
              />
            ) : (
              <ul className="space-y-6">
                {cfg.prizes.map((p) => (
                  <li
                    key={p.id}
                    className={`fr-recuadro rounded-2xl border bg-fr-card/90 transition-shadow ${
                      p.isPrimary ? "border-gold/40 shadow-[0_0_0_1px_rgba(212,175,55,0.12)]" : "border-fr-border"
                    }`}
                  >
                    <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
                      <div className="min-w-0 flex-1 space-y-3">
                        <div className="flex flex-wrap gap-2">
                          {p.isPrimary ? <PrBadge tone="gold">Principal</PrBadge> : null}
                          {p.isMonetary ? <PrBadge tone="gold">Monetario</PrBadge> : null}
                          <PrBadge tone="muted">{SCOPE_LABEL[p.scope]}</PrBadge>
                          <PrBadge tone={p.visiblePublic ? "success" : "warning"}>{p.visiblePublic ? "Visible landing" : "Solo interno"}</PrBadge>
                          <PrBadge tone="muted">{prizeTypeLabel(p.type)}</PrBadge>
                        </div>
                        <h4 className="font-sans text-lg font-semibold text-fr-primary">{p.name || "Premio sin nombre"}</h4>
                        {p.shortDescription ? <p className="text-sm leading-relaxed text-fr-muted line-clamp-3">{p.shortDescription}</p> : null}
                        <p className="text-xs text-fr-muted">
                          {p.scope === "CATEGORY" ? <>Categoría: {catName(p.categoryId)} · </> : null}
                          {p.sponsorName ? <>Sponsor: {p.sponsorName}</> : <span>Sin sponsor</span>}
                        </p>
                        {p.isMonetary && p.amount ? (
                          <p className="text-lg font-semibold tabular-nums text-gold">
                            {p.amount} {p.currency || "USD"}{" "}
                            <span className="text-xs font-normal text-fr-muted">(premio del concurso, no cargo Fotorank)</span>
                          </p>
                        ) : null}
                      </div>
                      <div className="flex shrink-0 flex-wrap gap-2 md:flex-col">
                        <button
                          type="button"
                          className="fr-btn fr-btn-secondary text-sm"
                          onClick={() => setOpenPrizeId((x) => (x === p.id ? null : p.id))}
                          disabled={readOnly || pending}
                        >
                          {openPrizeId === p.id ? "Cerrar edición" : "Editar"}
                        </button>
                        <button
                          type="button"
                          className="fr-btn fr-btn-secondary text-sm"
                          onClick={() =>
                            setCfg((s) => ({
                              ...s,
                              prizes: s.prizes.map((x) => (x.id === p.id ? { ...x, isPrimary: !x.isPrimary } : { ...x, isPrimary: false })),
                            }))
                          }
                          disabled={readOnly || pending}
                        >
                          {p.isPrimary ? "Quitar destacado" : "Destacar principal"}
                        </button>
                        <button
                          type="button"
                          className="fr-btn fr-btn-secondary border-red-500/30 text-red-300 hover:border-red-400/50 hover:text-red-200"
                          onClick={() => {
                            setCfg((s) => ({ ...s, prizes: s.prizes.filter((x) => x.id !== p.id) }));
                            setOpenPrizeId(null);
                          }}
                          disabled={readOnly || pending}
                        >
                          Eliminar
                        </button>
                      </div>
                    </div>
                    {openPrizeId === p.id ? (
                      <PrizeEditor
                        p={p}
                        categories={categories}
                        onChange={(next) => setCfg((s) => ({ ...s, prizes: s.prizes.map((x) => (x.id === p.id ? next : x)) }))}
                        readOnly={readOnly}
                        pending={pending}
                      />
                    ) : null}
                  </li>
                ))}
              </ul>
            )}
          </div>
        ) : null}

        {tab === "recompensas" ? (
          <div className="space-y-8">
            <SectionIntro
              title="Recompensas y beneficios"
              description="Beneficios flexibles: cupones, difusión o accesos. Visualmente más livianos que los premios, pero suman valor percibido."
            />
            {cfg.noPrizesExplicit ? (
              <EmptyStateBlock icon={Gift} title="Sin recompensas" description="Activá premios desde la opción superior o desmarcá «sin premios»." />
            ) : cfg.rewards.length === 0 ? (
              <EmptyStateBlock
                icon={Gift}
                title="Sin recompensas aún"
                description="Podés ofrecer descuentos de aliados, publicación destacada o cupones para todos los participantes."
                action={
                  <button type="button" className="fr-btn fr-btn-primary inline-flex items-center gap-2" onClick={addReward} disabled={readOnly || pending}>
                    <Gift className="size-4" aria-hidden />
                    Agregar primera recompensa
                  </button>
                }
              />
            ) : (
              <ul className="space-y-6">
                {cfg.rewards.map((r) => (
                  <li key={r.id} className="fr-recuadro rounded-2xl border border-fr-border/90 bg-fr-bg-elevated/80">
                    <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
                      <div className="min-w-0 space-y-3">
                        <div className="flex flex-wrap gap-2">
                          <PrBadge tone="muted">{rewardTypeLabel(r.type)}</PrBadge>
                          <PrBadge tone="muted">{RECIPIENT_LABEL[r.recipients]}</PrBadge>
                          <PrBadge tone={r.visiblePublic ? "success" : "warning"}>{r.visiblePublic ? "Pública" : "Interna"}</PrBadge>
                          {r.couponCode ? <PrBadge tone="gold">Cupón</PrBadge> : null}
                        </div>
                        <h4 className="font-sans text-lg font-semibold text-fr-primary">{r.name || "Recompensa sin nombre"}</h4>
                        {r.description ? <p className="text-sm leading-relaxed text-fr-muted line-clamp-3">{r.description}</p> : null}
                        {r.sponsorName ? (
                          <p className="text-xs text-fr-muted">
                            Sponsor: {r.sponsorName}
                            {r.sponsorUrl ? (
                              <>
                                {" "}
                                <a href={r.sponsorUrl} className="text-gold hover:text-gold-hover" target="_blank" rel="noreferrer">
                                  <Link2 className="inline size-3" aria-hidden /> enlace
                                </a>
                              </>
                            ) : null}
                          </p>
                        ) : null}
                      </div>
                      <div className="flex shrink-0 flex-wrap gap-2 md:flex-col">
                        <button type="button" className="fr-btn fr-btn-secondary text-sm" onClick={() => setOpenRewardId((x) => (x === r.id ? null : r.id))} disabled={readOnly || pending}>
                          {openRewardId === r.id ? "Cerrar" : "Editar"}
                        </button>
                        <button
                          type="button"
                          className="fr-btn fr-btn-secondary border-red-500/30 text-red-300"
                          onClick={() => {
                            setCfg((s) => ({ ...s, rewards: s.rewards.filter((x) => x.id !== r.id) }));
                            setOpenRewardId(null);
                          }}
                          disabled={readOnly || pending}
                        >
                          Eliminar
                        </button>
                      </div>
                    </div>
                    {openRewardId === r.id ? (
                      <RewardEditor
                        r={r}
                        categories={categories}
                        onChange={(next) => setCfg((s) => ({ ...s, rewards: s.rewards.map((x) => (x.id === r.id ? next : x)) }))}
                        readOnly={readOnly}
                        pending={pending}
                      />
                    ) : null}
                  </li>
                ))}
              </ul>
            )}
          </div>
        ) : null}

        {tab === "sponsors" ? (
          <div className="space-y-8">
            <SectionIntro
              title="Sponsors vinculados"
              description="Resumen automático a partir de premios y recompensas con sponsor cargado. Así ves quién aporta qué sin duplicar datos. La placa de agradecimiento se genera con los datos ya guardados."
            />
            {sponsors.length === 0 ? (
              <EmptyStateBlock
                icon={Users}
                title="Ningún sponsor asociado"
                description="Agregá nombre (y URL) en premios o recompensas para listarlos aquí con contexto."
              />
            ) : (
              <ul className="grid grid-cols-1 gap-6 md:grid-cols-2">
                {sponsors.map((s) => (
                  <li key={s.name} className="fr-recuadro rounded-2xl border border-fr-border bg-fr-card">
                    <div className="flex items-start gap-4">
                      <span className="flex size-12 shrink-0 items-center justify-center rounded-xl border border-fr-border bg-fr-bg text-gold">
                        <Users className="size-6" aria-hidden />
                      </span>
                      <div className="min-w-0 flex-1 space-y-2">
                        <h4 className="font-semibold text-fr-primary">{s.name}</h4>
                        {s.url ? (
                          <a href={s.url} className="inline-flex items-center gap-1 text-sm text-gold hover:text-gold-hover" target="_blank" rel="noreferrer">
                            Sitio web <Link2 className="size-3.5" />
                          </a>
                        ) : null}
                        {s.prizes.length > 0 ? (
                          <p className="text-xs leading-relaxed text-fr-muted">
                            <span className="font-medium text-fr-primary">Premios:</span> {s.prizes.join(" · ")}
                          </p>
                        ) : null}
                        {s.rewards.length > 0 ? (
                          <p className="text-xs leading-relaxed text-fr-muted">
                            <span className="font-medium text-fr-primary">Recompensas:</span> {s.rewards.join(" · ")}
                          </p>
                        ) : null}
                        {contestId ? (
                          <a
                            href={`/api/fotorank/contests/${contestId}/sponsors/thankyou-card?sponsor=${encodeURIComponent(s.name)}&disposition=attachment`}
                            className="inline-flex items-center gap-1 text-sm text-gold hover:text-gold-hover"
                            target="_blank"
                            rel="noreferrer"
                          >
                            Placa de agradecimiento <Sparkles className="size-3.5" />
                          </a>
                        ) : null}
                      </div>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>
        ) : null}

        {tab === "entrega" ? (
          <div className="space-y-8">
            <SectionIntro
              title="Entrega y seguimiento"
              description="Vista operativa de estados de entrega. En el futuro podés vincular ganador y evidencias; por ahora sirve como checklist interno."
            />
            {cfg.prizes.length === 0 && cfg.rewards.length === 0 ? (
              <EmptyStateBlock icon={Truck} title="Nada para entregar aún" description="Cargá premios o recompensas para gestionar entregas." />
            ) : (
              <div className="overflow-x-auto rounded-xl border border-fr-border">
                <table className="w-full min-w-[640px] border-collapse text-left text-sm">
                  <thead>
                    <tr className="border-b border-fr-border bg-fr-bg-elevated text-fr-muted">
                      <th className="fr-recuadro py-4 font-semibold">Ítem</th>
                      <th className="fr-recuadro py-4 font-semibold">Tipo</th>
                      <th className="fr-recuadro py-4 font-semibold">Estado</th>
                      <th className="fr-recuadro py-4 font-semibold">Notas</th>
                    </tr>
                  </thead>
                  <tbody>
                    {cfg.prizes.map((p) => (
                      <tr key={p.id} className="border-b border-fr-border/80 hover:bg-fr-card/40">
                        <td className="fr-recuadro py-4 text-fr-primary">{p.name || "—"}</td>
                        <td className="fr-recuadro py-4 text-fr-muted">Premio · {prizeTypeLabel(p.type)}</td>
                        <td className="fr-recuadro py-4">
                          <PrBadge tone="muted">{DELIVERY_LABEL[p.deliveryStatus ?? "PENDING"]}</PrBadge>
                        </td>
                        <td className="fr-recuadro py-4 text-fr-muted">{p.internalNotes || "—"}</td>
                      </tr>
                    ))}
                    {cfg.rewards.map((r) => (
                      <tr key={r.id} className="border-b border-fr-border/80 hover:bg-fr-card/40">
                        <td className="fr-recuadro py-4 text-fr-primary">{r.name || "—"}</td>
                        <td className="fr-recuadro py-4 text-fr-muted">Recompensa · {rewardTypeLabel(r.type)}</td>
                        <td className="fr-recuadro py-4">
                          <PrBadge tone="muted">{DELIVERY_LABEL[r.deliveryStatus ?? "PENDING"]}</PrBadge>
                        </td>
                        <td className="fr-recuadro py-4 text-fr-muted">{r.internalNotes || "—"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
            <HelperLine>Para editar estado y notas de un premio, abrí la pestaña Premios y desplegá la edición del ítem.</HelperLine>
          </div>
        ) : null}

        {tab === "economia" ? (
          <div className="space-y-10">
            <SectionIntro
              title="Economía del concurso"
              description="Separación explícita: lo que recauda el concurso, lo que retiene Fotorank (15% sobre inscripciones pagas), costos fijos de servicios y el neto estimado para el organizador. No confundir con premios en dinero al ganador."
            />

            <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
              <div className="fr-recuadro rounded-2xl border border-fr-border bg-fr-bg-elevated lg:col-span-2">
                <p className="text-xs font-semibold uppercase tracking-wider text-fr-muted">Participantes · inscripciones</p>
                <div className="mt-6 grid grid-cols-1 gap-8 sm:grid-cols-2">
                  <div className="fr-field-stack min-w-0">
                    <span className={labelBase}>Modalidad</span>
                    <select
                      className={selectBase}
                      value={cfg.economy.entryMode}
                      onChange={(e) => setCfg((s) => ({ ...s, economy: { ...s.economy, entryMode: e.target.value as "FREE" | "PAID" } }))}
                      disabled={readOnly || pending}
                    >
                      <option value="FREE">Concurso gratuito</option>
                      <option value="PAID">Inscripción paga</option>
                    </select>
                  </div>
                  <div className="fr-field-stack min-w-0">
                    <span className={labelBase}>Inscripciones pagas (estimado)</span>
                    <input
                      className={inputBase}
                      type="number"
                      min={0}
                      value={cfg.economy.paidRegistrationsCount ?? 0}
                      onChange={(e) => setCfg((s) => ({ ...s, economy: { ...s.economy, paidRegistrationsCount: Number(e.target.value || 0) } }))}
                      disabled={readOnly || pending}
                    />
                  </div>
                  <div className="fr-field-stack min-w-0">
                    <span className={labelBase}>Valor por inscripción</span>
                    <input
                      className={inputBase}
                      type="number"
                      min={0}
                      step="0.01"
                      value={cfg.economy.entryFeeAmount ?? ""}
                      onChange={(e) => setCfg((s) => ({ ...s, economy: { ...s.economy, entryFeeAmount: Number(e.target.value || 0) } }))}
                      disabled={readOnly || pending || cfg.economy.entryMode !== "PAID"}
                    />
                  </div>
                  <div className="fr-field-stack min-w-0">
                    <span className={labelBase}>Moneda</span>
                    <input
                      className={inputBase}
                      value={cfg.economy.entryFeeCurrency ?? "USD"}
                      onChange={(e) => setCfg((s) => ({ ...s, economy: { ...s.economy, entryFeeCurrency: e.target.value } }))}
                      disabled={readOnly || pending || cfg.economy.entryMode !== "PAID"}
                    />
                  </div>
                </div>
                <div className="fr-field-stack mt-8 max-w-md">
                  <span className={labelBase}>Comisión pasarela estimada (%)</span>
                  <input
                    className={inputBase}
                    type="number"
                    min={0}
                    step="0.01"
                    value={cfg.economy.gatewayFeePercent ?? 0}
                    onChange={(e) => setCfg((s) => ({ ...s, economy: { ...s.economy, gatewayFeePercent: Number(e.target.value || 0) } }))}
                    disabled={readOnly || pending}
                  />
                </div>
              </div>

              <div className="fr-recuadro flex flex-col justify-between rounded-2xl border border-gold/25 bg-gradient-to-b from-gold/10 to-transparent">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wider text-gold">Servicios Fotorank</p>
                  <p className="mt-2 text-sm leading-relaxed text-fr-muted">Activá solo lo que vas a usar; cada uno suma al resumen.</p>
                </div>
                <div className="mt-6 space-y-4">
                  <label className="flex cursor-pointer items-start gap-3 text-sm text-fr-muted">
                    <input
                      type="checkbox"
                      className="mt-1 size-4 shrink-0 rounded border-fr-border bg-fr-bg text-gold"
                      checked={Boolean(cfg.economy.diplomasEnabled)}
                      onChange={(e) => setCfg((s) => ({ ...s, economy: { ...s.economy, diplomasEnabled: e.target.checked } }))}
                      disabled={readOnly || pending}
                    />
                    <span>Módulo diplomas (20 USD)</span>
                  </label>
                  <label className="flex cursor-pointer items-start gap-3 text-sm text-fr-muted">
                    <input
                      type="checkbox"
                      className="mt-1 size-4 shrink-0 rounded border-fr-border bg-fr-bg text-gold"
                      checked={Boolean(cfg.economy.diplomaEmailsEnabled)}
                      onChange={(e) => setCfg((s) => ({ ...s, economy: { ...s.economy, diplomaEmailsEnabled: e.target.checked } }))}
                      disabled={readOnly || pending}
                    />
                    <span>Envío masivo por email (20 USD)</span>
                  </label>
                  <label className="flex cursor-pointer items-start gap-3 text-sm text-fr-muted">
                    <input
                      type="checkbox"
                      className="mt-1 size-4 shrink-0 rounded border-fr-border bg-fr-bg text-gold"
                      checked={Boolean(cfg.economy.reviewedByOrganizer)}
                      onChange={(e) => setCfg((s) => ({ ...s, economy: { ...s.economy, reviewedByOrganizer: e.target.checked } }))}
                      disabled={readOnly || pending}
                    />
                    <span>Revisé la economía del concurso</span>
                  </label>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
              <div className="fr-recuadro rounded-2xl border border-fr-border bg-fr-card">
                <p className="text-xs font-semibold uppercase tracking-wider text-fr-muted">Bruto inscripciones</p>
                <p className="mt-3 text-3xl font-semibold tabular-nums tracking-tight text-fr-primary">
                  {economy.gross.toFixed(2)} <span className="text-lg font-normal text-fr-muted">{cfg.economy.entryFeeCurrency ?? "USD"}</span>
                </p>
              </div>
              <div className="fr-recuadro rounded-2xl border border-fr-border bg-fr-card">
                <p className="text-xs font-semibold uppercase tracking-wider text-fr-muted">Comisión Fotorank (15%)</p>
                <p className="mt-3 text-3xl font-semibold tabular-nums tracking-tight text-gold">
                  {economy.platformCommission.toFixed(2)} <span className="text-lg font-normal text-fr-muted">{cfg.economy.entryFeeCurrency ?? "USD"}</span>
                </p>
                <p className="mt-2 text-xs text-fr-muted">Sobre recaudación por inscripciones pagas.</p>
              </div>
              <div className="fr-recuadro rounded-2xl border border-fr-border bg-fr-card">
                <p className="text-xs font-semibold uppercase tracking-wider text-fr-muted">Pasarela (estimado)</p>
                <p className="mt-3 text-3xl font-semibold tabular-nums tracking-tight text-fr-primary">
                  {economy.gatewayFee.toFixed(2)} <span className="text-lg font-normal text-fr-muted">{cfg.economy.entryFeeCurrency ?? "USD"}</span>
                </p>
              </div>
              <div className="fr-recuadro rounded-2xl border border-emerald-500/20 bg-emerald-500/5">
                <p className="text-xs font-semibold uppercase tracking-wider text-emerald-200/90">Neto organizador (estimado)</p>
                <p className="mt-3 text-3xl font-semibold tabular-nums tracking-tight text-emerald-200">
                  {economy.netForOrganizer.toFixed(2)} <span className="text-lg font-normal text-fr-muted">{cfg.economy.entryFeeCurrency ?? "USD"}</span>
                </p>
                <p className="mt-2 text-xs text-fr-muted">Tras comisión, pasarela y servicios ({economy.servicesTotal.toFixed(2)} USD).</p>
              </div>
            </div>
          </div>
        ) : null}

        {tab === "vista" ? (
          <div className="space-y-8">
            <SectionIntro title="Vista previa pública" description="Aproximación de cómo se verá la sección de premios en la landing. Los textos reales dependen de lo marcado como visible." />
            <div className="overflow-hidden rounded-2xl border border-fr-border bg-fr-bg shadow-[0_24px_80px_-24px_rgba(0,0,0,0.6)]">
              <div className="border-b border-fr-border bg-gradient-to-r from-fr-card to-fr-bg px-6 py-5 md:px-10">
                <p className="fr-eyebrow text-gold">Vista previa</p>
                <h3 className="mt-2 font-sans text-xl font-semibold tracking-tight text-fr-primary md:text-2xl">{contestTitle}</h3>
                <p className="mt-3 max-w-2xl text-sm leading-relaxed text-fr-muted">Sección «Premios y beneficios» — orden aproximado en la página pública.</p>
              </div>
              <div className="space-y-10 px-6 py-10 md:px-10">
                {(cfg.prizes.some((p) => p.isPrimary && p.visiblePublic) || cfg.prizes.filter((p) => p.visiblePublic).length > 0) && (
                  <div className="rounded-2xl border border-gold/30 bg-gradient-to-br from-gold/10 via-fr-card to-fr-bg p-6 md:p-8">
                    <p className="text-xs font-semibold uppercase tracking-wider text-gold">Premio principal</p>
                    <h4 className="mt-3 font-sans text-2xl font-semibold text-fr-primary">
                      {cfg.prizes.find((p) => p.isPrimary && p.visiblePublic)?.name ||
                        cfg.prizes.filter((p) => p.visiblePublic)[0]?.name ||
                        "Definí un premio destacado"}
                    </h4>
                    <p className="mt-4 max-w-2xl text-sm leading-relaxed text-fr-muted">
                      {cfg.prizes.find((p) => p.isPrimary && p.visiblePublic)?.shortDescription ||
                        cfg.prizes.filter((p) => p.visiblePublic)[0]?.shortDescription ||
                        "La descripción aparecerá aquí para generar deseo de participar."}
                    </p>
                  </div>
                )}
                <div>
                  <h5 className="text-sm font-semibold uppercase tracking-wider text-fr-muted">Premios y menciones</h5>
                  <ul className="mt-6 grid grid-cols-1 gap-6 md:grid-cols-2">
                    {cfg.prizes
                      .filter((p) => p.visiblePublic)
                      .map((p) => (
                        <li key={p.id} className="fr-recuadro rounded-xl border border-fr-border bg-fr-card/80">
                          <div className="flex flex-wrap gap-2">
                            <PrBadge tone="muted">{SCOPE_LABEL[p.scope]}</PrBadge>
                            {p.isMonetary ? <PrBadge tone="gold">Monetario</PrBadge> : null}
                          </div>
                          <p className="mt-3 font-semibold text-fr-primary">{p.name || "Premio"}</p>
                          <p className="mt-2 text-sm text-fr-muted">{p.shortDescription || "Descripción breve del premio."}</p>
                          {p.isMonetary && p.amount ? (
                            <p className="mt-3 text-gold">
                              {p.amount} {p.currency || "USD"}
                            </p>
                          ) : null}
                        </li>
                      ))}
                  </ul>
                </div>
                {cfg.rewards.filter((r) => r.visiblePublic).length > 0 ? (
                  <div>
                    <h5 className="text-sm font-semibold uppercase tracking-wider text-fr-muted">Beneficios adicionales</h5>
                    <ul className="mt-6 grid grid-cols-1 gap-4 md:grid-cols-2">
                      {cfg.rewards
                        .filter((r) => r.visiblePublic)
                        .map((r) => (
                          <li key={r.id} className="rounded-xl border border-dashed border-fr-border-muted bg-fr-bg/60 px-4 py-4">
                            <p className="font-medium text-fr-primary">{r.name}</p>
                            <p className="mt-1 text-sm text-fr-muted">{r.description || "Beneficio para participantes."}</p>
                            <p className="mt-2 text-xs text-fr-muted-soft">{RECIPIENT_LABEL[r.recipients]}</p>
                          </li>
                        ))}
                    </ul>
                  </div>
                ) : null}
              </div>
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
}
