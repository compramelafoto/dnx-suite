"use client";

import { useActionState, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Field } from "@/components/ui/Field";
import { Input } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";
import {
  carouselConfigToFormInput,
  type HomeBannerCarouselConfig,
  type HomeBannerCarouselFormInput,
} from "@/lib/admin/home-banners/types";
import {
  updateHomeBannerCarouselSettingsAction,
  type HomeBannerCarouselActionState,
} from "@/lib/admin/home-banners/mutations";

type Props = {
  initial: HomeBannerCarouselConfig;
};

export function HomeBannerCarouselSettingsForm({ initial }: Props) {
  const router = useRouter();
  const [state, formAction, pending] = useActionState(
    updateHomeBannerCarouselSettingsAction,
    undefined as HomeBannerCarouselActionState | undefined,
  );
  const [values, setValues] = useState<HomeBannerCarouselFormInput>(() =>
    carouselConfigToFormInput(initial),
  );

  useEffect(() => {
    if (state?.ok) router.refresh();
  }, [state, router]);

  return (
    <form
      action={formAction}
      className="rounded-[var(--ck-radius-card)] border border-ck-border bg-ck-bg-elevated/40 p-6 md:p-8"
    >
      <div className="space-y-2">
        <h2 className="text-lg font-semibold tracking-tight text-ck-text">Carousel automático</h2>
        <p className="text-sm text-ck-text-secondary">
          Intervalo entre imágenes y suavidad del desplazamiento horizontal en el Home.
        </p>
      </div>

      {state?.message ? (
        <p
          className={[
            "mt-6 rounded-[var(--ck-radius-card)] border px-4 py-3 text-sm",
            state.ok
              ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-300"
              : "border-[var(--ck-danger)]/40 bg-[var(--ck-danger-soft)]",
          ].join(" ")}
          role={state.ok ? "status" : "alert"}
        >
          {state.message}
        </p>
      ) : null}

      <div className="mt-8 grid gap-8 md:grid-cols-3 md:items-end">
        <Field
          id="autoplaySeconds"
          label="Segundos por imagen"
          hint="Por defecto 2. Entre 1 y 30."
          error={state?.errors?.autoplaySeconds}
        >
          <Input
            name="autoplaySeconds"
            inputMode="decimal"
            value={values.autoplaySeconds}
            onChange={(e) => setValues((v) => ({ ...v, autoplaySeconds: e.target.value }))}
          />
        </Field>
        <Field
          id="transitionMs"
          label="Duración del deslizamiento (ms)"
          hint="Qué tan suave pasa a la siguiente. Entre 200 y 2000."
          error={state?.errors?.transitionMs}
        >
          <Input
            name="transitionMs"
            inputMode="numeric"
            value={values.transitionMs}
            onChange={(e) => setValues((v) => ({ ...v, transitionMs: e.target.value }))}
          />
        </Field>
        <label className="flex items-center gap-3 pb-2 text-sm text-ck-text md:min-h-[2.75rem]">
          <input
            type="checkbox"
            name="autoplayEnabled"
            value="on"
            checked={values.autoplayEnabled}
            onChange={(e) => setValues((v) => ({ ...v, autoplayEnabled: e.target.checked }))}
            className="size-4 accent-[var(--ck-yellow)]"
          />
          Avance automático
        </label>
      </div>

      <div className="mt-8 flex justify-end">
        <Button type="submit" variant="primary" loading={pending}>
          Guardar carousel
        </Button>
      </div>
    </form>
  );
}
