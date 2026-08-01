"use client";

import {
  presentShirtBenefitMessage,
  type ShirtBenefitUiStatus,
} from "@/lib/catalog/domain/first-n-benefit";
import type { ParticipantPersona } from "./participant-persona";
import { RegistrationCtaHint } from "./RegistrationCtaHint";
import { RegistrationPromoPrice } from "./RegistrationPromoPrice";
import { RegistrationTrustStrip } from "./RegistrationTrustStrip";

export type ExperienceTicketOption = {
  id: string;
  name: string;
  isPack: boolean;
  isOpen: boolean;
  priceMinor: number | null;
  compareAtMinor?: number | null;
  savingsMinor?: number | null;
  phaseLabel?: string | null;
};

type Props = {
  tickets: ExperienceTicketOption[];
  selectedTicketId: string;
  usePassCredit: boolean;
  canUsePassCredit: boolean;
  remainingCredits?: number | null;
  persona: ParticipantPersona;
  advancing?: boolean;
  /** Estado real del beneficio remera (first-N + deadline). */
  shirtBenefitStatus?: ShirtBenefitUiStatus;
  onSelectTicket: (ticketId: string) => void;
  onSelectPassCredit: () => void;
  onConfirmTicket: (ticketId: string) => void;
  onConfirmPassCredit: () => void;
};

const ENTRY_BENEFITS = [
  "Tu lugar en la Clickatón",
  "Tu número de participante",
  "Acceso completo al evento",
  "Certificado digital",
] as const;

const PACK_BENEFITS = [
  "Esta Clickatón incluida",
  "3 Clickatones más",
  "Válido por 2 años",
  "Mejor precio por edición",
] as const;

const PACK_IDEAL = [
  "Pensás participar más de una vez.",
  "Querés ahorrar dinero.",
  "Querés asegurarte lugar durante todo el año.",
] as const;

function cardShell(opts: {
  active: boolean;
  featured?: boolean;
  recommended?: boolean;
}) {
  return [
    "group relative flex h-full w-full flex-col rounded-[var(--ck-radius-card)] border p-6 text-left transition duration-200 ease-out md:p-8",
    "hover:-translate-y-0.5 hover:shadow-[0_12px_40px_rgb(0_0_0_/_0.35)]",
    opts.active
      ? "border-ck-yellow bg-ck-yellow/10 shadow-[0_0_0_1px_rgb(250_204_21_/_0.4),0_16px_40px_rgb(250_204_21_/_0.12)] scale-[1.01]"
      : "border-ck-border bg-ck-surface/40 hover:border-ck-yellow/40 hover:bg-ck-surface/70",
    opts.recommended
      ? "md:scale-[1.03] md:shadow-[0_20px_50px_rgb(0_0_0_/_0.45)] ring-1 ring-ck-yellow/30"
      : opts.featured
        ? "md:scale-[1.01]"
        : "",
  ].join(" ");
}

export function RegistrationOptionCards({
  tickets,
  selectedTicketId,
  usePassCredit,
  canUsePassCredit,
  remainingCredits,
  persona,
  advancing,
  shirtBenefitStatus = "not_applicable",
  onSelectTicket,
  onSelectPassCredit,
  onConfirmTicket,
  onConfirmPassCredit,
}: Props) {
  const entry = tickets.find((t) => !t.isPack && t.isOpen) ?? tickets.find((t) => !t.isPack);
  const pack = tickets.find((t) => t.isPack && t.isOpen) ?? tickets.find((t) => t.isPack);
  const entrySelected = Boolean(entry && selectedTicketId === entry.id && !usePassCredit);
  const packSelected = Boolean(pack && selectedTicketId === pack.id && !usePassCredit);
  const creditFeatured = persona === "pack_holder";
  const entryRecommended = persona !== "pack_holder";
  const shirtMessage = presentShirtBenefitMessage(shirtBenefitStatus);

  const creditCard = canUsePassCredit ? (
    <article
      className={`${cardShell({
        active: usePassCredit,
        recommended: creditFeatured,
      })} cursor-pointer animate-[ck-fade-up_0.35s_ease-out]`}
      aria-current={usePassCredit ? "true" : undefined}
      onClick={onSelectPassCredit}
    >
      <div className="flex flex-wrap items-center gap-2">
        {creditFeatured ? (
          <span className="inline-flex items-center rounded-full bg-ck-yellow px-3 py-1 text-xs font-semibold uppercase tracking-wide text-black">
            ⭐ Usá tu Pack
          </span>
        ) : (
          <span className="ck-label text-ck-yellow">Ya tenés un Pack</span>
        )}
      </div>
      <h3 className="mt-4 text-xl font-semibold tracking-tight md:text-2xl">
        {creditFeatured ? "Participá con tu Pack" : "Usar mi Pack"}
      </h3>
      <p className="mt-2 text-sm text-ck-text-secondary">
        Usá uno de tus usos del Pack y participá sin volver a pagar.
      </p>
      {remainingCredits != null ? (
        <p className="mt-4 text-sm font-medium text-ck-text">
          Te quedan {remainingCredits} uso{remainingCredits === 1 ? "" : "s"}
        </p>
      ) : null}
      <button
        type="button"
        className="mt-8 inline-flex min-h-12 w-full items-center justify-center rounded-[var(--ck-radius-button)] bg-ck-yellow px-4 py-3 text-sm font-semibold text-black transition duration-200 hover:brightness-105 disabled:opacity-70"
        disabled={advancing}
        onClick={(e) => {
          e.stopPropagation();
          onConfirmPassCredit();
        }}
      >
        {advancing && usePassCredit ? "Continuando…" : "Usar mi Pack"}
      </button>
      <RegistrationCtaHint />
    </article>
  ) : null;

  const entryCard = entry ? (
    <article
      className={`${cardShell({
        active: entrySelected,
        featured: entryRecommended,
        recommended: entryRecommended,
      })} cursor-pointer`}
      aria-current={entrySelected ? "true" : undefined}
      onClick={() => entry.isOpen && onSelectTicket(entry.id)}
    >
      <div className="flex flex-wrap items-center gap-2">
        {entryRecommended ? (
          <span className="inline-flex animate-[ck-soft-pulse_2.4s_ease-in-out_infinite] items-center rounded-full bg-ck-yellow px-3 py-1 text-xs font-semibold uppercase tracking-wide text-black">
            ⭐ Más elegida
          </span>
        ) : null}
        {entry.phaseLabel ? (
          <span className="text-xs font-medium uppercase tracking-wide text-ck-text-muted">
            {entry.phaseLabel}
          </span>
        ) : null}
      </div>
      <h3 className="mt-5 text-xl font-semibold tracking-tight md:text-2xl">
        Inscripción a esta Clickatón
      </h3>
      {entry.priceMinor != null ? (
        <RegistrationPromoPrice
          nowMinor={entry.priceMinor}
          beforeMinor={entry.compareAtMinor}
          savingsMinor={entry.savingsMinor}
        />
      ) : (
        <p className="mt-4 text-sm text-ck-text-muted">Precio a confirmar</p>
      )}
      <ul className="mt-6 space-y-2 text-sm text-ck-text">
        {ENTRY_BENEFITS.map((b) => (
          <li key={b}>✔ {b}</li>
        ))}
      </ul>
      {shirtMessage ? (
        <p
          className={
            shirtBenefitStatus === "available"
              ? "mt-4 text-sm leading-relaxed text-emerald-300/90"
              : "mt-4 text-sm leading-relaxed text-ck-text-muted"
          }
          role="status"
        >
          {shirtMessage}
        </p>
      ) : null}
      <button
        type="button"
        className="mt-6 inline-flex min-h-12 w-full items-center justify-center rounded-[var(--ck-radius-button)] bg-ck-yellow px-4 py-3 text-sm font-semibold text-black transition duration-200 hover:brightness-105 disabled:opacity-70"
        disabled={!entry.isOpen || advancing}
        onClick={(e) => {
          e.stopPropagation();
          onConfirmTicket(entry.id);
        }}
      >
        {advancing && entrySelected ? "Continuando…" : "Reservar mi lugar"}
      </button>
      <RegistrationTrustStrip className="mt-4" />
      <RegistrationCtaHint />
    </article>
  ) : null;

  const packCard = pack ? (
    <article
      className={`${cardShell({ active: packSelected })} cursor-pointer`}
      aria-current={packSelected ? "true" : undefined}
      onClick={() => pack.isOpen && onSelectTicket(pack.id)}
    >
      <div className="flex flex-wrap items-center gap-2">
        <span className="inline-flex items-center rounded-full border border-ck-yellow/60 bg-ck-yellow/15 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-ck-yellow">
          Mejor valor
        </span>
      </div>
      <h3 className="mt-4 text-xl font-semibold tracking-tight md:text-2xl">Pack de 4 Clickatones</h3>
      {pack.priceMinor != null ? (
        <RegistrationPromoPrice nowMinor={pack.priceMinor} />
      ) : null}
      <div className="mt-5 rounded-lg border border-ck-border/80 bg-ck-bg/40 p-4">
        <p className="text-xs font-semibold uppercase tracking-wide text-ck-text-muted">
          Ideal para vos si…
        </p>
        <ul className="mt-3 space-y-2 text-sm text-ck-text">
          {PACK_IDEAL.map((b) => (
            <li key={b}>✔ {b}</li>
          ))}
        </ul>
      </div>
      <ul className="mt-5 space-y-2 text-sm text-ck-text-secondary">
        {PACK_BENEFITS.map((b) => (
          <li key={b}>✔ {b}</li>
        ))}
      </ul>
      <button
        type="button"
        className="mt-8 inline-flex min-h-12 w-full items-center justify-center rounded-[var(--ck-radius-button)] border border-ck-yellow bg-transparent px-4 py-3 text-sm font-semibold text-ck-yellow transition duration-200 hover:bg-ck-yellow/10 disabled:opacity-70"
        disabled={!pack.isOpen || advancing}
        onClick={(e) => {
          e.stopPropagation();
          onConfirmTicket(pack.id);
        }}
      >
        {advancing && packSelected ? "Continuando…" : "Quiero el Pack"}
      </button>
      <RegistrationCtaHint />
    </article>
  ) : null;

  return (
    <section className="space-y-8" aria-labelledby="registration-options-title">
      <div className="space-y-3">
        <h2 id="registration-options-title" className="text-2xl font-semibold tracking-tight md:text-3xl">
          {persona === "pack_holder" ? "Tu Pack te está esperando" : "¿Cómo querés participar?"}
        </h2>
        <p className="max-w-2xl text-sm leading-relaxed text-ck-text-secondary md:text-base">
          {persona === "pack_holder"
            ? "Elegí usar tu Pack y seguí con tus datos. También podés elegir otra opción."
            : "Elegí una opción. En el siguiente paso completás tus datos."}
        </p>
      </div>

      {creditFeatured && creditCard ? (
        <div className="mx-auto max-w-xl">{creditCard}</div>
      ) : null}

      <div
        className={[
          creditFeatured
            ? "grid gap-6 lg:grid-cols-2"
            : canUsePassCredit
              ? "grid gap-6 lg:grid-cols-2 xl:grid-cols-3"
              : "grid gap-6 lg:grid-cols-2",
          advancing ? "pointer-events-none opacity-90 transition-opacity duration-300" : "transition-opacity duration-300",
        ].join(" ")}
        aria-busy={advancing || undefined}
      >
        {creditFeatured ? (
          <>
            {entryCard}
            {packCard}
          </>
        ) : (
          <>
            {entryCard}
            {packCard}
            {creditCard}
          </>
        )}
      </div>
    </section>
  );
}
