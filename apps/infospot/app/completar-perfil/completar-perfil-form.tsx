"use client";

import { useActionState, useMemo, useState } from "react";
import Link from "next/link";
import {
  completePublicProfileOnboardingAction,
  type OnboardingActionState,
} from "@/app/actions/onboarding";

const initial: OnboardingActionState = { ok: false, message: "" };

type CategoryOption = { slug: string; name: string };

type Props = {
  categories: CategoryOption[];
  showInviteHint?: boolean;
  clfPhotographer?: boolean;
  clfOrganizer?: boolean;
};

export function CompletarPerfilForm({
  categories,
  showInviteHint,
  clfPhotographer,
  clfOrganizer,
}: Props) {
  const [state, action, pending] = useActionState(
    completePublicProfileOnboardingAction,
    initial,
  );
  const [selected, setSelected] = useState<Record<string, boolean>>({
    CUSTOMER: true,
    PHOTOGRAPHER: false,
    ORGANIZER: false,
  });

  const wantsCustomer = selected.CUSTOMER;
  const cards = useMemo(
    () => [
      {
        id: "CUSTOMER",
        title: "Quiero descubrir eventos",
        description:
          "Encontrá eventos cerca tuyo, guardá favoritos y recibí novedades.",
      },
      {
        id: "PHOTOGRAPHER",
        title: "Soy fotógrafo",
        description: clfPhotographer
          ? "Detectamos tu perfil de fotógrafo en ComprameLaFoto. Lo vamos a vincular."
          : "Encontrá convocatorias, inscribite y vinculá tus coberturas.",
      },
      {
        id: "ORGANIZER",
        title: "Organizo eventos",
        description: clfOrganizer
          ? "Detectamos tu perfil de organizador. Lo vamos a vincular sin duplicarlo."
          : "Publicá eventos, buscá fotógrafos y difundí tus actividades.",
      },
    ],
    [clfOrganizer, clfPhotographer],
  );

  function toggle(id: string) {
    setSelected((prev) => ({ ...prev, [id]: !prev[id] }));
  }

  return (
    <form action={action} className="mx-auto w-full max-w-2xl space-y-10">
      <div className="space-y-4">
        {cards.map((card) => {
          const checked = Boolean(selected[card.id]);
          return (
            <label
              key={card.id}
              className={`flex cursor-pointer gap-4 rounded-[var(--is-radius-md)] border px-5 py-5 transition ${
                checked
                  ? "border-[var(--is-accent)] bg-[var(--is-surface)]"
                  : "border-[var(--is-border)] bg-white hover:border-[var(--is-border-strong,var(--is-border))]"
              }`}
            >
              <input
                type="checkbox"
                name="profile"
                value={card.id}
                checked={checked}
                onChange={() => toggle(card.id)}
                className="mt-1 size-5 shrink-0"
              />
              <span className="min-w-0">
                <span className="block text-base font-semibold text-[var(--is-text)]">
                  {card.title}
                </span>
                <span className="mt-2 block text-sm leading-relaxed text-[var(--is-muted)]">
                  {card.description}
                </span>
              </span>
            </label>
          );
        })}
      </div>

      {wantsCustomer ? (
        <fieldset className="space-y-6 rounded-[var(--is-radius-md)] border border-[var(--is-border)] bg-[var(--is-surface)] p-6">
          <legend className="px-1 text-sm font-semibold text-[var(--is-text)]">
            Preferencias (opcional)
          </legend>
          <p className="text-sm leading-relaxed text-[var(--is-muted)]">
            Podés omitirlas y completarlas más adelante. No pedimos ubicación precisa.
          </p>
          <div className="grid gap-6 sm:grid-cols-2">
            <div className="space-y-2">
              <label htmlFor="city" className="block text-sm font-semibold">
                Ciudad
              </label>
              <input
                id="city"
                name="city"
                type="text"
                className="min-h-11 w-full rounded-[var(--is-radius-sm)] border border-[var(--is-border)] bg-white px-4 text-sm"
              />
            </div>
            <div className="space-y-2">
              <label htmlFor="province" className="block text-sm font-semibold">
                Provincia
              </label>
              <input
                id="province"
                name="province"
                type="text"
                className="min-h-11 w-full rounded-[var(--is-radius-sm)] border border-[var(--is-border)] bg-white px-4 text-sm"
              />
            </div>
          </div>
          <div className="space-y-2">
            <label htmlFor="radiusKm" className="block text-sm font-semibold">
              Radio aproximado (km)
            </label>
            <input
              id="radiusKm"
              name="radiusKm"
              type="number"
              min={5}
              max={200}
              placeholder="50"
              className="min-h-11 w-full max-w-xs rounded-[var(--is-radius-sm)] border border-[var(--is-border)] bg-white px-4 text-sm"
            />
          </div>
          {categories.length > 0 ? (
            <div className="space-y-3">
              <p className="text-sm font-semibold text-[var(--is-text)]">Intereses</p>
              <div className="flex flex-wrap gap-3">
                {categories.map((cat) => (
                  <label
                    key={cat.slug}
                    className="inline-flex min-h-11 items-center gap-2 rounded-full border border-[var(--is-border)] bg-white px-4 text-sm"
                  >
                    <input type="checkbox" name="interest" value={cat.slug} />
                    {cat.name}
                  </label>
                ))}
              </div>
            </div>
          ) : null}
          <div className="space-y-3">
            <p className="text-sm font-semibold text-[var(--is-text)]">Avisos (futuros)</p>
            <label className="flex items-center gap-3 text-sm">
              <input type="checkbox" name="notifyEventsNearby" className="size-4" />
              Eventos cerca
            </label>
            <label className="flex items-center gap-3 text-sm">
              <input type="checkbox" name="notifyCategories" className="size-4" />
              Por categorías de interés
            </label>
            <label className="flex items-center gap-3 text-sm">
              <input type="checkbox" name="notifyCalls" className="size-4" />
              Convocatorias
            </label>
          </div>
        </fieldset>
      ) : null}

      {showInviteHint ? (
        <p
          className="rounded-[var(--is-radius-sm)] border border-amber-300 bg-amber-50 px-4 py-3 text-sm leading-relaxed text-amber-950"
          role="status"
        >
          Tenés una invitación editorial pendiente. Podés aceptarla con el enlace que te
          enviaron, o desde el acceso a Redacción.
        </p>
      ) : null}

      <div className="space-y-4 border-t border-[var(--is-border)] pt-8">
        <button
          type="submit"
          disabled={pending}
          className="inline-flex min-h-11 w-full items-center justify-center rounded-[var(--is-radius-sm)] bg-[var(--is-accent)] px-5 text-sm font-semibold text-[var(--is-bg)] disabled:opacity-60 sm:w-auto"
        >
          {pending ? "Guardando…" : "Continuar"}
        </button>
        {state.message ? (
          <p className="text-sm text-red-700" role="alert">
            {state.message}
          </p>
        ) : null}
        <p className="text-sm leading-relaxed text-[var(--is-muted)]">
          ¿Fuiste invitado a trabajar en Info Spot?{" "}
          <Link
            href="/ingresar"
            className="font-medium text-[var(--is-accent)] underline-offset-2 hover:underline"
          >
            Ingresá con el enlace de invitación
          </Link>
          .
        </p>
      </div>
    </form>
  );
}
