"use client";

import { inputBase, labelBase, selectBase, textareaWizard } from "../../../../../../components/ui/form";
import type { ContestPrizeItem, ContestRewardItem, PrizeType, RewardType } from "../../../../../../lib/fotorank/prizesRewards";
import { FieldGroup, HelperLine } from "./ui";
import { PRIZE_TYPES, RECIPIENT_LABEL, REWARD_TYPES, SCOPE_LABEL } from "./constants";

type Cat = { id: string; name: string };

export function PrizeEditor({
  p,
  categories,
  onChange,
  readOnly,
  pending,
}: {
  p: ContestPrizeItem;
  categories: Cat[];
  onChange: (next: ContestPrizeItem) => void;
  readOnly?: boolean;
  pending?: boolean;
}) {
  const patch = (partial: Partial<ContestPrizeItem>) => onChange({ ...p, ...partial });

  return (
    <div className="space-y-8 border-t border-fr-border pt-8">
      <FieldGroup
        title="Identidad del premio"
        hint="Lo que verá el participante si el premio es público en la landing."
      >
        <div className="grid grid-cols-1 gap-8 lg:grid-cols-2">
          <div className="fr-field-stack min-w-0">
            <span className={labelBase}>Nombre del premio</span>
            <input
              className={inputBase}
              placeholder="Ej. Gran premio del jurado"
              value={p.name}
              onChange={(e) => patch({ name: e.target.value })}
              disabled={readOnly || pending}
            />
          </div>
          <div className="fr-field-stack min-w-0">
            <span className={labelBase}>Tipo</span>
            <select
              className={selectBase}
              value={p.type}
              onChange={(e) => patch({ type: e.target.value as PrizeType })}
              disabled={readOnly || pending}
            >
              {PRIZE_TYPES.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
          </div>
        </div>
        <div className="fr-field-stack">
          <span className={labelBase}>Descripción breve</span>
          <textarea
            className={textareaWizard}
            rows={3}
            placeholder="Qué incluye, en qué consiste el reconocimiento."
            value={p.shortDescription}
            onChange={(e) => patch({ shortDescription: e.target.value })}
            disabled={readOnly || pending}
          />
        </div>
      </FieldGroup>

      <FieldGroup
        title="Alcance, visibilidad y sponsor"
        hint="Definí si el premio es general, por categoría o mención. Lo público impacta la sección Premios de la landing."
      >
        <div className="grid grid-cols-1 gap-8 lg:grid-cols-3">
          <div className="fr-field-stack min-w-0">
            <span className={labelBase}>Alcance</span>
            <select
              className={selectBase}
              value={p.scope}
              onChange={(e) => patch({ scope: e.target.value as ContestPrizeItem["scope"] })}
              disabled={readOnly || pending}
            >
              {Object.entries(SCOPE_LABEL).map(([k, lab]) => (
                <option key={k} value={k}>
                  {lab}
                </option>
              ))}
            </select>
          </div>
          <div className="fr-field-stack min-w-0">
            <span className={labelBase}>Categoría</span>
            <select
              className={selectBase}
              value={p.categoryId ?? ""}
              onChange={(e) => patch({ categoryId: e.target.value || undefined })}
              disabled={readOnly || pending}
            >
              <option value="">Sin categoría</option>
              {categories.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
            {p.scope === "CATEGORY" ? <HelperLine>Elegí la categoría a la que aplica este premio.</HelperLine> : null}
          </div>
          <div className="fr-field-stack min-w-0">
            <span className={labelBase}>Sponsor (opcional)</span>
            <input
              className={inputBase}
              placeholder="Nombre visible"
              value={p.sponsorName ?? ""}
              onChange={(e) => patch({ sponsorName: e.target.value })}
              disabled={readOnly || pending}
            />
          </div>
        </div>
        <div className="grid grid-cols-1 gap-8 lg:grid-cols-2">
          <div className="fr-field-stack min-w-0">
            <span className={labelBase}>URL del sponsor</span>
            <input
              className={inputBase}
              placeholder="https://…"
              value={p.sponsorUrl ?? ""}
              onChange={(e) => patch({ sponsorUrl: e.target.value })}
              disabled={readOnly || pending}
            />
            <HelperLine>Si cargás nombre de sponsor, la URL ayuda a validar el vínculo.</HelperLine>
          </div>
          <div className="fr-field-stack min-w-0">
            <span className={labelBase}>Aporte del sponsor (opcional)</span>
            <input
              className={inputBase}
              placeholder="Ej. Kit de productos valorado en…"
              value={p.sponsorContribution ?? ""}
              onChange={(e) => patch({ sponsorContribution: e.target.value })}
              disabled={readOnly || pending}
            />
          </div>
        </div>
        <div className="flex flex-col gap-6 sm:flex-row sm:flex-wrap">
          <label className="flex cursor-pointer items-start gap-3 text-sm leading-relaxed text-fr-muted">
            <input
              type="checkbox"
              className="mt-1 size-4 shrink-0 rounded border-fr-border bg-fr-bg text-gold focus:ring-gold/30"
              checked={Boolean(p.visiblePublic)}
              onChange={(e) => patch({ visiblePublic: e.target.checked })}
              disabled={readOnly || pending}
            />
            <span>
              <span className="font-medium text-fr-primary">Visible en landing pública</span>
              <span className="mt-1 block text-xs text-fr-muted">Si está desactivado, el premio queda solo para gestión interna.</span>
            </span>
          </label>
          <label className="flex cursor-pointer items-start gap-3 text-sm leading-relaxed text-fr-muted">
            <input
              type="checkbox"
              className="mt-1 size-4 shrink-0 rounded border-fr-border bg-fr-bg text-gold focus:ring-gold/30"
              checked={Boolean(p.isPrimary)}
              onChange={(e) => patch({ isPrimary: e.target.checked })}
              disabled={readOnly || pending}
            />
            <span>
              <span className="font-medium text-fr-primary">Destacar como premio principal</span>
              <span className="mt-1 block text-xs text-fr-muted">Se muestra arriba en la vista previa y en la landing.</span>
            </span>
          </label>
          <label className="flex cursor-pointer items-start gap-3 text-sm leading-relaxed text-fr-muted">
            <input
              type="checkbox"
              className="mt-1 size-4 shrink-0 rounded border-fr-border bg-fr-bg text-gold focus:ring-gold/30"
              checked={Boolean(p.isMonetary)}
              onChange={(e) => patch({ isMonetary: e.target.checked })}
              disabled={readOnly || pending}
            />
            <span>
              <span className="font-medium text-fr-primary">Premio en dinero</span>
              <span className="mt-1 block text-xs text-fr-muted">Es el premio del concurso, no un cargo de Fotorank.</span>
            </span>
          </label>
        </div>
      </FieldGroup>

      {p.isMonetary ? (
        <FieldGroup
          title="Detalle del premio monetario"
          hint="La entrega por fuera de la plataforma no genera comisión por el monto del premio."
        >
          <div className="grid grid-cols-1 gap-8 lg:grid-cols-3">
            <div className="fr-field-stack min-w-0 lg:col-span-1">
              <span className={labelBase}>Monto</span>
              <div className="rounded-xl border border-gold/25 bg-gradient-to-br from-gold/10 to-transparent p-4">
                <input
                  className={`${inputBase} border-fr-border/80 bg-fr-bg text-2xl font-semibold tabular-nums text-fr-primary`}
                  type="number"
                  min={0}
                  step="0.01"
                  placeholder="0"
                  value={p.amount ?? ""}
                  onChange={(e) => patch({ amount: Number(e.target.value || 0) })}
                  disabled={readOnly || pending}
                />
              </div>
            </div>
            <div className="fr-field-stack min-w-0">
              <span className={labelBase}>Moneda</span>
              <input
                className={inputBase}
                placeholder="USD, ARS…"
                value={p.currency ?? ""}
                onChange={(e) => patch({ currency: e.target.value })}
                disabled={readOnly || pending}
              />
            </div>
            <div className="fr-field-stack min-w-0">
              <span className={labelBase}>Forma de entrega</span>
              <select
                className={selectBase}
                value={p.payoutMethod ?? "OFF_PLATFORM"}
                onChange={(e) => patch({ payoutMethod: e.target.value as ContestPrizeItem["payoutMethod"] })}
                disabled={readOnly || pending}
              >
                <option value="OFF_PLATFORM">Fuera de Fotorank (organizador / sponsor)</option>
                <option value="PLATFORM_FUTURE">Futura gestión por plataforma</option>
              </select>
            </div>
          </div>
        </FieldGroup>
      ) : null}

      <FieldGroup title="Seguimiento de entrega (interno)" hint="Estados orientativos para tu equipo; no se muestran en la landing.">
        <div className="grid grid-cols-1 gap-8 md:grid-cols-2">
          <div className="fr-field-stack min-w-0">
            <span className={labelBase}>Estado de entrega</span>
            <select
              className={selectBase}
              value={p.deliveryStatus ?? "PENDING"}
              onChange={(e) => patch({ deliveryStatus: e.target.value as ContestPrizeItem["deliveryStatus"] })}
              disabled={readOnly || pending}
            >
              <option value="PENDING">Pendiente</option>
              <option value="ANNOUNCED">Anunciado</option>
              <option value="ASSIGNED">Asignado</option>
              <option value="DELIVERED">Entregado</option>
              <option value="CANCELLED">Cancelado</option>
            </select>
          </div>
          <div className="fr-field-stack min-w-0">
            <span className={labelBase}>Notas internas</span>
            <input
              className={inputBase}
              placeholder="Contacto ganador, logística…"
              value={p.internalNotes ?? ""}
              onChange={(e) => patch({ internalNotes: e.target.value })}
              disabled={readOnly || pending}
            />
          </div>
        </div>
      </FieldGroup>
    </div>
  );
}

export function RewardEditor({
  r,
  categories,
  onChange,
  readOnly,
  pending,
}: {
  r: ContestRewardItem;
  categories: Cat[];
  onChange: (next: ContestRewardItem) => void;
  readOnly?: boolean;
  pending?: boolean;
}) {
  const patch = (partial: Partial<ContestRewardItem>) => onChange({ ...r, ...partial });

  return (
    <div className="space-y-8 border-t border-fr-border pt-8">
      <FieldGroup title="Beneficio" hint="Complementa los premios: cupones, difusión, accesos. Suele ser más flexible que un premio por puesto.">
        <div className="grid grid-cols-1 gap-8 lg:grid-cols-2">
          <div className="fr-field-stack min-w-0">
            <span className={labelBase}>Nombre</span>
            <input
              className={inputBase}
              placeholder="Ej. Descuento en laboratorio"
              value={r.name}
              onChange={(e) => patch({ name: e.target.value })}
              disabled={readOnly || pending}
            />
          </div>
          <div className="fr-field-stack min-w-0">
            <span className={labelBase}>Tipo</span>
            <select
              className={selectBase}
              value={r.type}
              onChange={(e) => patch({ type: e.target.value as RewardType })}
              disabled={readOnly || pending}
            >
              {REWARD_TYPES.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
          </div>
        </div>
        <div className="fr-field-stack">
          <span className={labelBase}>Descripción</span>
          <textarea
            className={textareaWizard}
            rows={3}
            placeholder="Cómo se obtiene el beneficio y condiciones."
            value={r.description}
            onChange={(e) => patch({ description: e.target.value })}
            disabled={readOnly || pending}
          />
        </div>
      </FieldGroup>

      <FieldGroup title="Audiencia y sponsor">
        <div className="grid grid-cols-1 gap-8 lg:grid-cols-3">
          <div className="fr-field-stack min-w-0">
            <span className={labelBase}>Destinatarios</span>
            <select
              className={selectBase}
              value={r.recipients}
              onChange={(e) => patch({ recipients: e.target.value as ContestRewardItem["recipients"] })}
              disabled={readOnly || pending}
            >
              {Object.entries(RECIPIENT_LABEL).map(([k, lab]) => (
                <option key={k} value={k}>
                  {lab}
                </option>
              ))}
            </select>
          </div>
          {r.recipients === "CATEGORY" ? (
            <div className="fr-field-stack min-w-0">
              <span className={labelBase}>Categoría</span>
              <select
                className={selectBase}
                value={r.categoryId ?? ""}
                onChange={(e) => patch({ categoryId: e.target.value || undefined })}
                disabled={readOnly || pending}
              >
                <option value="">Elegir…</option>
                {categories.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </div>
          ) : null}
          <div className="fr-field-stack min-w-0">
            <span className={labelBase}>Sponsor (opcional)</span>
            <input
              className={inputBase}
              value={r.sponsorName ?? ""}
              onChange={(e) => patch({ sponsorName: e.target.value })}
              disabled={readOnly || pending}
            />
          </div>
        </div>
        <div className="grid grid-cols-1 gap-8 md:grid-cols-2">
          <div className="fr-field-stack min-w-0">
            <span className={labelBase}>URL sponsor</span>
            <input className={inputBase} placeholder="https://…" value={r.sponsorUrl ?? ""} onChange={(e) => patch({ sponsorUrl: e.target.value })} disabled={readOnly || pending} />
          </div>
          <div className="fr-field-stack min-w-0">
            <span className={labelBase}>Cupón / código</span>
            <input className={inputBase} placeholder="Opcional" value={r.couponCode ?? ""} onChange={(e) => patch({ couponCode: e.target.value })} disabled={readOnly || pending} />
          </div>
        </div>
        <label className="flex cursor-pointer items-start gap-3 text-sm leading-relaxed text-fr-muted">
          <input
            type="checkbox"
            className="mt-1 size-4 shrink-0 rounded border-fr-border bg-fr-bg text-gold focus:ring-gold/30"
            checked={Boolean(r.visiblePublic)}
            onChange={(e) => patch({ visiblePublic: e.target.checked })}
            disabled={readOnly || pending}
          />
          <span>
            <span className="font-medium text-fr-primary">Visible en landing</span>
            <span className="mt-1 block text-xs text-fr-muted">Los beneficios públicos suman valor percibido del concurso.</span>
          </span>
        </label>
        <div className="fr-field-stack">
          <span className={labelBase}>Notas internas (entrega)</span>
          <input
            className={inputBase}
            placeholder="Seguimiento operativo"
            value={r.internalNotes ?? ""}
            onChange={(e) => patch({ internalNotes: e.target.value })}
            disabled={readOnly || pending}
          />
        </div>
      </FieldGroup>
    </div>
  );
}
