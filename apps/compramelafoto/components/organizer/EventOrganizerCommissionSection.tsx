"use client";

import Input from "@/components/ui/Input";
import { DsInfoPanel } from "@/components/ui/DsLayout";
import { MAX_EVENT_ORGANIZER_COMMISSION_PERCENT } from "@/lib/event-organizer-commission";

type Props = {
  enabled: boolean;
  onEnabledChange: (value: boolean) => void;
  percentageInput: string;
  onPercentageInputChange: (value: string) => void;
  disabled?: boolean;
  /** Id estable para checkbox (create vs edit pueden usar distinto). */
  fieldIdPrefix?: string;
};

const EXAMPLE_BASE_ARS = 3000;

export default function EventOrganizerCommissionSection({
  enabled,
  onEnabledChange,
  percentageInput,
  onPercentageInputChange,
  disabled = false,
  fieldIdPrefix = "event-org-commission",
}: Props) {
  const pct = parseFloat(percentageInput.replace(",", "."));
  const pctValid =
    enabled &&
    Number.isFinite(pct) &&
    pct > 0 &&
    pct <= MAX_EVENT_ORGANIZER_COMMISSION_PERCENT;

  const money = new Intl.NumberFormat("es-AR", {
    style: "currency",
    currency: "ARS",
    maximumFractionDigits: 0,
  });

  let exampleParagraph: string | null = null;
  if (pctValid) {
    const organizerPart = Math.round(EXAMPLE_BASE_ARS * (pct / 100));
    const photographerPart = EXAMPLE_BASE_ARS - organizerPart;
    const feeExample = Math.round(EXAMPLE_BASE_ARS * 0.15);
    const clientPays = EXAMPLE_BASE_ARS + feeExample;
    exampleParagraph = `Ejemplo con precio base ${money.format(EXAMPLE_BASE_ARS)} y fee de plataforma 15%: el cliente paga ${money.format(clientPays)}; tu comisión (${pct}%) es ${money.format(organizerPart)}; el fotógrafo recibe ${money.format(photographerPart)} en su Mercado Pago (más el fee, la plataforma lo retiene por separado).`;
  }

  const toggleId = `${fieldIdPrefix}-enabled`;
  const pctId = `${fieldIdPrefix}-pct`;

  return (
    <section
      className="ds-organizer-panel ds-organizer-panel--stack"
      aria-labelledby={`${fieldIdPrefix}-heading`}
    >
      <div className="min-w-0">
        <h3 id={`${fieldIdPrefix}-heading`} className="text-lg font-semibold text-[#111827] m-0">
          Comisión para el organizador
        </h3>
      </div>

      <DsInfoPanel title="Cómo funciona">
        <ul className="ds-readable-text ds-readable-text--fluid text-gray-700 m-0 pl-5 space-y-2 text-sm list-disc">
          <li>
            Es opcional: si la activás, el porcentaje se calcula sobre el <strong>precio base</strong> que cada fotógrafo
            define por foto, no sobre promos ni el total que paga el cliente.
          </li>
          <li>
            Cuando el pago de una venta queda aprobado, la comisión aparece como pendiente y se habilita para retiro{" "}
            <strong>15 días después</strong> de esa aprobación.
          </li>
          <li>
            El dinero no se transfiere solo: desde <strong>Comisiones</strong> podés solicitar el retiro manual cuando
            haya saldo disponible; el equipo de ComprameLaFoto procesa el pago.
          </li>
        </ul>
      </DsInfoPanel>

      <div className="flex items-start gap-3">
        <input
          id={toggleId}
          type="checkbox"
          className="mt-1 rounded border-[#111827]/20 text-[#c27b3d] focus:ring-[#c27b3d] shrink-0"
          checked={enabled}
          disabled={disabled}
          onChange={(e) => onEnabledChange(e.target.checked)}
        />
        <label htmlFor={toggleId} className="text-sm text-[#111827] leading-snug cursor-pointer ds-readable-text ds-readable-text--fluid">
          Quiero recibir una comisión por cada venta de fotos de este evento
        </label>
      </div>

      <div
        className={`clf-form-control-numeric w-full box-border ${enabled ? "" : "opacity-60"}`}
      >
        <label htmlFor={pctId} className="block text-sm font-medium text-gray-700 mb-1">
          Porcentaje sobre el precio base del fotógrafo (máx. {MAX_EVENT_ORGANIZER_COMMISSION_PERCENT}%)
        </label>
        <Input
          id={pctId}
          type="number"
          min={0}
          max={MAX_EVENT_ORGANIZER_COMMISSION_PERCENT}
          step={0.01}
          value={percentageInput}
          onChange={(e) => onPercentageInputChange(e.target.value)}
          disabled={disabled || !enabled}
          placeholder="Ej: 10 o 50"
          className="w-full max-w-full min-w-[10rem] box-border"
          aria-describedby={`${fieldIdPrefix}-pct-hint`}
        />
        <p id={`${fieldIdPrefix}-pct-hint`} className="text-xs text-gray-500 mt-1 m-0">
          Podés usar decimales (por ejemplo 12,5).
        </p>
      </div>

      {exampleParagraph ? (
        <p className="ds-readable-text ds-readable-text--fluid text-sm text-gray-700 m-0 rounded-xl border border-[#111827]/08 bg-[#f8fafc] p-3">
          {exampleParagraph}
        </p>
      ) : null}
    </section>
  );
}
