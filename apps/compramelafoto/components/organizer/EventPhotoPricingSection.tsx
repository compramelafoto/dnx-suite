"use client";

import Link from "next/link";
import { DsInfoPanel } from "@/components/ui/DsLayout";
import { EventPhotoPricingMode } from "@/lib/prisma";

export type EventPhotoPricingSectionProps = {
  mode: EventPhotoPricingMode;
  onModeChange: (mode: EventPhotoPricingMode) => void;
  disabled?: boolean;
  fieldIdPrefix?: string;
  /** Alta vs edición: textos del CTA al final del bloque modo oficial. */
  pricingFormPhase?: "create" | "edit";
  /** En edición, enlace interno opcional al panel actual (ej. mismo evento). */
  organizerEventHref?: string | null;
  /** Si el evento sigue en DB con ORGANIZER_MINIMUM (legacy), mostramos aviso y el monto guardado. */
  legacyMinimumPesos?: number | null;
};

function OptionCard({
  selected,
  onSelect,
  disabled: dis,
  recommended,
  title,
  description,
  accent,
}: {
  selected: boolean;
  onSelect: () => void;
  disabled?: boolean;
  recommended?: boolean;
  title: string;
  description: string;
  accent: "default" | "advanced";
}) {
  const border = selected
    ? accent === "advanced"
      ? "border-amber-400/90 ring-2 ring-amber-300/50"
      : "border-[#c27b3d]/80 ring-2 ring-[#c27b3d]/25"
    : "border-[#111827]/10 hover:border-[#111827]/20";

  return (
    <button
      type="button"
      role="radio"
      aria-checked={selected}
      disabled={dis}
      onClick={onSelect}
      className={`w-full min-w-0 text-left rounded-2xl border bg-white p-4 sm:p-5 transition shadow-sm focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 disabled:opacity-60 disabled:cursor-not-allowed ${
        accent === "advanced"
          ? "focus-visible:ring-amber-500"
          : "focus-visible:ring-[#c27b3d]"
      } ${border}`}
    >
      <div className="flex flex-wrap items-start justify-between gap-2 min-w-0">
        <span className="text-base font-semibold text-[#111827] leading-snug">{title}</span>
        {recommended ? (
          <span className="text-[10px] font-bold uppercase tracking-wide shrink-0 rounded-full bg-[#c27b3d]/12 text-[#9a5828] px-2 py-0.5">
            Recomendado
          </span>
        ) : (
          <span className="text-[10px] font-bold uppercase tracking-wide shrink-0 rounded-full bg-amber-100 text-amber-950 px-2 py-0.5">
            AVANZADO
          </span>
        )}
      </div>
      <p className="ds-readable-text ds-readable-text--fluid text-sm text-gray-600 mt-2 mb-0 max-w-prose">
        {description}
      </p>
    </button>
  );
}

function OfficialDigitalPanel({
  organizerEventHref,
  pricingFormPhase,
}: {
  organizerEventHref?: string | null;
  pricingFormPhase: "create" | "edit";
}) {
  const ctaSub =
    pricingFormPhase === "create"
      ? "Guardá el evento y después vas a cargar montos desde la pantalla especializada del evento."
      : "Seguí trabajando en este evento; la sección para precio individual, packs, promos y descuentos oficiales se sumará al panel cuando corresponda.";

  const roadmapLead =
    pricingFormPhase === "create"
      ? "Después de crear el evento vas a poder configurar:"
      : "En este evento vas a poder configurar (desde la sección dedicada cuando esté disponible):";

  const showHref =
    organizerEventHref && pricingFormPhase === "edit";

  const roadmapBullets = (
    <ul className="ds-readable-text ds-readable-text--fluid text-sm text-gray-700 pl-6 list-[square] space-y-1.5 max-w-none m-0 [&>li]:pl-1">
      <li>precio digital individual;</li>
      <li>packs digitales oficiales;</li>
      <li>promociones;</li>
      <li>descuentos;</li>
      <li>y otras reglas comerciales del evento.</li>
    </ul>
  );

  const warningBullets = (
    <ul className="ds-readable-text ds-readable-text--fluid text-sm text-amber-950/95 pl-6 list-[square] space-y-2 max-w-none m-0 [&>li]:pl-1">
      <li>Los fotógrafos seguirán pudiendo vender impresiones y productos físicos.</li>
      <li>Los precios digitales oficiales se configurarán más adelante.</li>
      <li>Los cambios futuros solo afectarán ventas nuevas.</li>
      <li>Las órdenes ya creadas nunca se modifican.</li>
    </ul>
  );

  const panelChrome =
    "w-full min-w-0 rounded-2xl border border-[#111827]/10 bg-white p-5 sm:p-6 shadow-sm space-y-5";

  return (
    <div className={`${panelChrome} flex flex-col gap-5`}>
      <p className="ds-readable-text ds-readable-text--fluid text-base text-[#111827] font-semibold leading-relaxed max-w-none m-0">
        Activás la venta digital oficial del evento. Los fotógrafos no podrán modificar precios digitales, packs ni
        promociones en sus álbumes de este evento.
      </p>

      <div
        className="rounded-2xl border border-amber-300/80 bg-gradient-to-b from-amber-50 via-amber-50/95 to-amber-50/80 p-4 sm:p-5 space-y-3 shadow-[inset_0_1px_0_rgb(254_243_199_/_0.6)]"
        role="alert"
      >
        <p className="text-base font-bold text-amber-950 tracking-tight m-0">Modo avanzado</p>
        <p className="ds-readable-text ds-readable-text--fluid text-sm text-amber-950/95 m-0 max-w-none">
          Centralizar la venta digital puede reducir la convocatoria o hacer que algunos fotógrafos prefieran no
          participar. Recomendamos este modo solo cuando necesitás una experiencia comercial unificada.
        </p>
        {warningBullets}
      </div>

      <DsInfoPanel title="Configuración posterior" className="bg-gray-50/95 border-[#111827]/8">
        <p className="ds-readable-text ds-readable-text--fluid text-sm text-gray-700 mb-3 max-w-none m-0">{roadmapLead}</p>
        {roadmapBullets}
      </DsInfoPanel>

      <div className="rounded-xl border border-dashed border-amber-300/90 bg-amber-50/60 px-4 py-3.5 sm:px-5 sm:py-4">
        <p className="ds-readable-text ds-readable-text--fluid text-sm font-bold text-amber-950 m-0 max-w-none">
          {pricingFormPhase === "create"
            ? "Configurar venta digital después de crear el evento."
            : "Configuración de venta digital en el panel del evento."}
        </p>
        <p className="ds-readable-text ds-readable-text--fluid text-sm text-amber-950/90 mt-2 mb-0 max-w-none">
          {ctaSub}
        </p>
        {showHref ? (
          <Link
            href={organizerEventHref}
            className="inline-flex mt-3 text-sm font-semibold text-[#9a5828] underline underline-offset-2 hover:text-[#7a4420]"
          >
            Ver panel del evento
          </Link>
        ) : null}
      </div>
    </div>
  );
}

export default function EventPhotoPricingSection({
  mode,
  onModeChange,
  disabled = false,
  fieldIdPrefix = "event-photo-pricing",
  pricingFormPhase = "create",
  organizerEventHref = null,
  legacyMinimumPesos,
}: EventPhotoPricingSectionProps) {
  const headingId = `${fieldIdPrefix}-heading`;
  const optDecides = `${fieldIdPrefix}-mode-decides`;
  const optFixed = `${fieldIdPrefix}-mode-fixed`;

  const legacyMinimum = mode === EventPhotoPricingMode.ORGANIZER_MINIMUM;
  const money = new Intl.NumberFormat("es-AR", {
    style: "currency",
    currency: "ARS",
    maximumFractionDigits: 0,
  });

  return (
    <section className="ds-organizer-panel ds-organizer-panel--stack w-full min-w-0" aria-labelledby={headingId}>
      <div className="min-w-0 w-full ds-content-container">
        <h3 id={headingId} className="text-lg font-semibold text-[#111827] m-0">
          Precio de las fotos
        </h3>
        <p className="ds-readable-text ds-readable-text--fluid text-sm text-gray-600 mt-2 mb-0 max-w-none">
          Definí cómo se comercializa la <strong className="font-semibold text-gray-800">venta digital</strong> en este
          evento. Los cambios valen para ventas futuras; no se recalculan pedidos ya cerrados.
        </p>
      </div>

      {legacyMinimum ? (
        <div role="alert" className="rounded-2xl border border-amber-300/90 bg-amber-50 px-4 py-3 text-sm text-amber-950 min-w-0 w-full">
          <p className="ds-readable-text ds-readable-text--fluid text-sm font-medium text-amber-950 m-0 mb-1">
            Seguís usando una regla anterior (precio mínimo por foto digital)
          </p>
          <p className="ds-readable-text ds-readable-text--fluid text-sm text-amber-950/95 m-0 max-w-none">
            Esa opción ya no se ofrece en eventos nuevos. Te recomendamos migrar a{" "}
            <strong className="font-semibold">cada fotógrafo define su venta digital</strong> o a{" "}
            <strong className="font-semibold">precios digitales oficiales del evento</strong>, según lo que negociaste con
            los colegas.
            {legacyMinimumPesos != null && Number.isFinite(legacyMinimumPesos) && legacyMinimumPesos > 0 ? (
              <>
                {" "}
                Hoy el mínimo guardado es{" "}
                <strong className="font-semibold">{money.format(legacyMinimumPesos)}</strong> por foto digital.
              </>
            ) : null}{" "}
            Elegí un modo abajo y guardá el evento cuando quieras actualizarlo; hasta entonces se mantiene lo que ya tenías
            en base de datos.
          </p>
        </div>
      ) : null}

      <DsInfoPanel title="Visible para fotógrafos">
        <p className="ds-readable-text ds-readable-text--fluid text-sm text-gray-700 m-0 mb-2 max-w-none">
          Esta información se muestra a los fotógrafos antes de sumarse al evento.
        </p>
        <p className="ds-readable-text ds-readable-text--fluid text-sm text-gray-600 m-0 max-w-none">
          Las impresiones y productos físicos siguen pudiendo comercializarse con la lista de precios de cada fotógrafo,
          salvo acuerdos particulares que queden fuera de la plataforma.
        </p>
      </DsInfoPanel>

      <fieldset disabled={disabled} className="w-full min-w-0 border-0 m-0 p-0 space-y-5">
        <legend className="sr-only">Regla de venta digital</legend>

        <div className="flex flex-col gap-4 w-full min-w-0">
          <div className="min-w-0 w-full">
            <input
              id={optDecides}
              type="radio"
              name={`${fieldIdPrefix}-mode`}
              className="sr-only"
              checked={mode === EventPhotoPricingMode.PHOTOGRAPHER_DECIDES}
              onChange={() => onModeChange(EventPhotoPricingMode.PHOTOGRAPHER_DECIDES)}
              tabIndex={-1}
            />
            <OptionCard
              accent="default"
              recommended
              selected={mode === EventPhotoPricingMode.PHOTOGRAPHER_DECIDES}
              onSelect={() => onModeChange(EventPhotoPricingMode.PHOTOGRAPHER_DECIDES)}
              disabled={disabled}
              title="Cada fotógrafo define su venta digital"
              description="El fotógrafo configura precio digital, packs digitales, promociones y descuentos. Es el modo que recomienda ComprameLaFoto para convocatorias abiertas."
            />
            <label htmlFor={optDecides} className="sr-only">
              Cada fotógrafo define su venta digital
            </label>
          </div>

          <div className="min-w-0 w-full space-y-4">
            <input
              id={optFixed}
              type="radio"
              name={`${fieldIdPrefix}-mode`}
              className="sr-only"
              checked={mode === EventPhotoPricingMode.ORGANIZER_FIXED}
              onChange={() => onModeChange(EventPhotoPricingMode.ORGANIZER_FIXED)}
              tabIndex={-1}
            />
            <OptionCard
              accent="advanced"
              selected={mode === EventPhotoPricingMode.ORGANIZER_FIXED}
              onSelect={() => onModeChange(EventPhotoPricingMode.ORGANIZER_FIXED)}
              disabled={disabled}
              title="Precios digitales oficiales del evento"
              description="Activás la venta digital oficial del organizador sin cargar montos acá. Los valores se configuran en una sección especializada después."
            />
            <label htmlFor={optFixed} className="sr-only">
              Precios digitales oficiales del evento
            </label>

            {mode === EventPhotoPricingMode.ORGANIZER_FIXED ? (
              <OfficialDigitalPanel organizerEventHref={organizerEventHref} pricingFormPhase={pricingFormPhase} />
            ) : null}
          </div>
        </div>
      </fieldset>
    </section>
  );
}
