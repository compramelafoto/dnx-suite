"use client";

import { useState, useTransition } from "react";
import { FotofficeLogo } from "@/components/fotoffice-logo";
import {
  FOTOFFICE_ORGANIZATION_TYPES,
  FOTOFFICE_SPECIALTIES,
} from "@/lib/onboarding-constants";
import {
  saveOnboardingBusinessAction,
  saveOnboardingPersonalAction,
  saveOnboardingSpecialtiesAction,
  skipOnboardingAction,
} from "./actions";

type Initial = {
  firstName: string;
  lastName: string;
  displayName: string;
  phone: string;
  commercialName: string;
  activityType: string;
  city: string;
  province: string;
  country: string;
  website: string;
  instagram: string;
  specialties: string[];
};

export function OnboardingWizard({ initial }: { initial: Initial }) {
  const [step, setStep] = useState(1);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  return (
    <div className="min-h-screen bg-[var(--fo-bg)] px-4 py-12">
      <div className="mx-auto max-w-xl space-y-10">
        <div className="text-center space-y-4">
          <div className="inline-flex rounded-2xl bg-white px-5 py-3">
            <FotofficeLogo variant="compact" priority />
          </div>
          <h1 className="text-2xl font-semibold tracking-tight text-[var(--fo-text)]">
            Configurá tu espacio
          </h1>
          <p className="text-sm text-[var(--fo-muted)] leading-relaxed">
            Paso {step} de 3 · Podés completar después y seguir trabajando.
          </p>
          <div className="flex gap-2 justify-center" aria-hidden>
            {[1, 2, 3].map((n) => (
              <div
                key={n}
                className={`h-2 w-10 rounded-full ${n <= step ? "bg-[var(--fo-accent)]" : "bg-[var(--fo-border)]"}`}
              />
            ))}
          </div>
        </div>

        <div className="fo-card space-y-8">
          {step === 1 ? (
            <form
              className="space-y-6"
              onSubmit={(e) => {
                e.preventDefault();
                const fd = new FormData(e.currentTarget);
                setError(null);
                startTransition(async () => {
                  const res = await saveOnboardingPersonalAction(undefined, fd);
                  if (res.error) setError(res.error);
                  else setStep(2);
                });
              }}
            >
              <h2 className="text-lg font-semibold text-[var(--fo-text)]">Datos personales</h2>
              <Field label="Nombre" name="firstName" defaultValue={initial.firstName} />
              <Field label="Apellido" name="lastName" defaultValue={initial.lastName} />
              <Field
                label="Nombre visible"
                name="displayName"
                defaultValue={initial.displayName}
                required
              />
              <Field label="Teléfono (opcional)" name="phone" defaultValue={initial.phone} />
              {error ? <p className="text-sm text-red-600">{error}</p> : null}
              <div className="flex flex-wrap gap-3 pt-2">
                <button type="submit" className="fo-btn fo-btn-primary" disabled={pending}>
                  {pending ? "Guardando…" : "Continuar"}
                </button>
                <button
                  type="button"
                  className="fo-btn fo-btn-secondary"
                  disabled={pending}
                  onClick={() => startTransition(() => skipOnboardingAction())}
                >
                  Continuar más tarde
                </button>
              </div>
            </form>
          ) : null}

          {step === 2 ? (
            <form
              className="space-y-6"
              onSubmit={(e) => {
                e.preventDefault();
                const fd = new FormData(e.currentTarget);
                setError(null);
                startTransition(async () => {
                  const res = await saveOnboardingBusinessAction(undefined, fd);
                  if (res.error) setError(res.error);
                  else setStep(3);
                });
              }}
            >
              <h2 className="text-lg font-semibold text-[var(--fo-text)]">Tu organización</h2>
              <Field
                label="Nombre comercial"
                name="commercialName"
                defaultValue={initial.commercialName}
                required
              />
              <label className="block space-y-3">
                <span className="text-sm font-semibold text-[var(--fo-text)]">Tipo de organización</span>
                <p className="text-xs text-[var(--fo-muted)] leading-relaxed">
                  Esto nos ayuda a adaptar FotoOffice a tu actividad. Después vas a poder elegir
                  qué módulos querés utilizar.
                </p>
                <select
                  name="activityType"
                  defaultValue={initial.activityType || "FREELANCE_PHOTOGRAPHER"}
                  className="w-full rounded-xl border border-[var(--fo-border)] bg-[var(--fo-bg)] px-4 py-3 text-sm"
                  required
                >
                  {FOTOFFICE_ORGANIZATION_TYPES.map((o) => (
                    <option key={o.id} value={o.id}>
                      {o.label}
                    </option>
                  ))}
                </select>
              </label>
              <Field label="Ciudad" name="city" defaultValue={initial.city} />
              <Field label="Provincia" name="province" defaultValue={initial.province} />
              <Field label="País" name="country" defaultValue={initial.country} />
              <Field label="Sitio web (opcional)" name="website" defaultValue={initial.website} />
              <Field
                label="Instagram (opcional)"
                name="instagram"
                defaultValue={initial.instagram}
              />
              {error ? <p className="text-sm text-red-600">{error}</p> : null}
              <div className="flex flex-wrap gap-3 pt-2">
                <button type="button" className="fo-btn fo-btn-secondary" onClick={() => setStep(1)}>
                  Atrás
                </button>
                <button type="submit" className="fo-btn fo-btn-primary" disabled={pending}>
                  {pending ? "Guardando…" : "Continuar"}
                </button>
              </div>
            </form>
          ) : null}

          {step === 3 ? (
            <form
              className="space-y-6"
              onSubmit={(e) => {
                e.preventDefault();
                const fd = new FormData(e.currentTarget);
                setError(null);
                startTransition(async () => {
                  const res = await saveOnboardingSpecialtiesAction(undefined, fd);
                  if (res?.error) setError(res.error);
                });
              }}
            >
              <h2 className="text-lg font-semibold text-[var(--fo-text)]">Especialidades</h2>
              <p className="text-sm text-[var(--fo-muted)] leading-relaxed">
                Seleccioná una o más. No es obligatorio para entrar al workspace.
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {FOTOFFICE_SPECIALTIES.map((s) => (
                  <label
                    key={s.id}
                    className="flex items-center gap-3 rounded-xl border border-[var(--fo-border)] px-4 py-3 text-sm"
                  >
                    <input
                      type="checkbox"
                      name="specialties"
                      value={s.id}
                      defaultChecked={initial.specialties.includes(s.id)}
                      className="size-4 accent-[var(--fo-accent)]"
                    />
                    {s.label}
                  </label>
                ))}
              </div>
              {error ? <p className="text-sm text-red-600">{error}</p> : null}
              <div className="flex flex-wrap gap-3 pt-2">
                <button type="button" className="fo-btn fo-btn-secondary" onClick={() => setStep(2)}>
                  Atrás
                </button>
                <button type="submit" className="fo-btn fo-btn-primary" disabled={pending}>
                  {pending ? "Entrando…" : "Ir al workspace"}
                </button>
              </div>
            </form>
          ) : null}
        </div>
      </div>
    </div>
  );
}

function Field({
  label,
  name,
  defaultValue,
  required,
}: {
  label: string;
  name: string;
  defaultValue?: string;
  required?: boolean;
}) {
  return (
    <label className="block space-y-3">
      <span className="text-sm font-semibold text-[var(--fo-text)]">
        {label}
        {required ? <span className="text-[var(--fo-accent)]"> *</span> : null}
      </span>
      <input
        name={name}
        defaultValue={defaultValue}
        required={required}
        className="w-full rounded-xl border border-[var(--fo-border)] bg-[var(--fo-bg)] px-4 py-3 text-sm"
      />
    </label>
  );
}
