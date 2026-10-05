"use client";

import { useState, useTransition } from "react";
import {
  saveCommunityLinkAction,
  saveDuesSettingsAction,
  saveFeeValueAction,
  sendDuesReminderNowAction,
} from "@/app/actions/dues-settings";
import type { PersonVocabulary } from "@/lib/vocabulario/personas";
import { WhatsappGroupButton } from "@/components/brand/whatsapp-group-button";

function Estado({ ok, error }: { ok: string | null; error: string | null }) {
  if (error) {
    return (
      <p className="text-xs text-[var(--fo-danger)]" role="alert">
        {error}
      </p>
    );
  }
  if (ok) return <p className="text-xs text-[var(--fo-success)]">{ok}</p>;
  return null;
}

export function DuesSettingsForm({
  defaults,
  vocabulary,
}: {
  defaults: {
    generationDay: number;
    dueDay: number;
    graceDays: number;
    reminderDay: number;
    initialDuesCount: number;
    recommendationEnabled: boolean;
    recommendationBenefitPercent: number;
  };
  vocabulary: PersonVocabulary;
}) {
  const [ok, setOk] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pendiente, startTransition] = useTransition();

  return (
    <form
      action={(data) =>
        startTransition(async () => {
          setOk(null);
          setError(null);
          const r = await saveDuesSettingsAction(data);
          if (r.ok) setOk("Guardado.");
          else setError(r.error);
        })
      }
      className="space-y-4"
    >
      <div className="grid gap-4 sm:grid-cols-2">
        <label className="space-y-1 text-xs">
          <span className="text-[var(--fo-muted-soft)]">Día en que se genera la cuota</span>
          <input name="generationDay" type="number" min={1} max={28} defaultValue={defaults.generationDay} className="fo-input w-full" />
        </label>
        <label className="space-y-1 text-xs">
          <span className="text-[var(--fo-muted-soft)]">Día de vencimiento</span>
          <input name="dueDay" type="number" min={1} max={28} defaultValue={defaults.dueDay} className="fo-input w-full" />
        </label>
        <label className="space-y-1 text-xs">
          <span className="text-[var(--fo-muted-soft)]">Días de gracia</span>
          <input name="graceDays" type="number" min={0} max={60} defaultValue={defaults.graceDays} className="fo-input w-full" />
        </label>
        <label className="space-y-1 text-xs">
          <span className="text-[var(--fo-muted-soft)]">Día del recordatorio</span>
          <input name="reminderDay" type="number" min={1} max={28} defaultValue={defaults.reminderDay} className="fo-input w-full" />
        </label>
        <label className="space-y-1 text-xs">
          <span className="text-[var(--fo-muted-soft)]">Cuotas de ingreso</span>
          <input name="initialDuesCount" type="number" min={0} max={12} defaultValue={defaults.initialDuesCount} className="fo-input w-full" />
        </label>
      </div>
      <p className="text-xs text-[var(--fo-muted)] leading-relaxed">
        Los días se limitan a 28: un día 30 dejaría a febrero sin generación de cuotas.
      </p>

      {/*
        Las recomendaciones viven acá, con las cuotas, y no en una pantalla propia: el
        beneficio no es dinero ni un premio aparte, es un descuento sobre la cuota.
      */}
      <div className="space-y-3 border-t border-[var(--fo-border)] pt-4">
        <h3 className="text-sm font-semibold">Recomendaciones</h3>
        <label className="flex items-center gap-2 text-xs">
          <input
            name="recommendationEnabled"
            type="checkbox"
            defaultChecked={defaults.recommendationEnabled}
          />
          <span>{`Los ${vocabulary.plural} pueden recomendar colegas desde su portal`}</span>
        </label>
        <label className="space-y-1 text-xs sm:max-w-xs">
          <span className="text-[var(--fo-muted-soft)]">Cuota que se bonifica (%)</span>
          <input
            name="recommendationBenefitPercent"
            inputMode="decimal"
            defaultValue={defaults.recommendationBenefitPercent}
            className="fo-input w-full"
          />
        </label>
        <p className="text-xs text-[var(--fo-muted)] leading-relaxed">
          Por cada colega que se asocie por su enlace y termine de pagar su ingreso. 100 = una
          cuota entera. El descuento se aplica solo sobre una cuota mensual: nunca es dinero.
        </p>
      </div>
      <button type="submit" disabled={pendiente} className="fo-btn fo-btn-primary text-sm disabled:opacity-60">
        {pendiente ? "Guardando…" : "Guardar configuración"}
      </button>
      <Estado ok={ok} error={error} />
    </form>
  );
}

export function FeeValueForm({
  categories,
  today,
}: {
  categories: Array<{ id: string; name: string }>;
  today: string;
}) {
  const [ok, setOk] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pendiente, startTransition] = useTransition();

  return (
    <form
      action={(data) =>
        startTransition(async () => {
          setOk(null);
          setError(null);
          const r = await saveFeeValueAction(data);
          if (r.ok) setOk("Valor cargado. El anterior quedó cerrado en esa fecha.");
          else setError(r.error);
        })
      }
      className="space-y-4"
    >
      <div className="grid gap-4 sm:grid-cols-2">
        <label className="space-y-1 text-xs">
          <span className="text-[var(--fo-muted-soft)]">Importe de la cuota</span>
          <input name="amount" inputMode="decimal" placeholder="47.000" className="fo-input w-full" />
        </label>
        <label className="space-y-1 text-xs">
          <span className="text-[var(--fo-muted-soft)]">Rige desde</span>
          <input name="validFrom" type="date" defaultValue={today} className="fo-input w-full" />
        </label>
        <label className="space-y-1 text-xs">
          <span className="text-[var(--fo-muted-soft)]">Categoría</span>
          <select name="categoryId" className="fo-input w-full" defaultValue="">
            <option value="">Todas (valor general)</option>
            {categories.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </label>
        <label className="space-y-1 text-xs">
          <span className="text-[var(--fo-muted-soft)]">Acta de comisión directiva (opcional)</span>
          <input name="boardMinutesRef" placeholder="Acta N° 412" className="fo-input w-full" />
        </label>
      </div>
      <p className="text-xs text-[var(--fo-muted)] leading-relaxed">
        No se edita el valor vigente: se carga uno nuevo con su fecha. Los cargos ya emitidos
        apuntan al valor con el que se calcularon, y reescribirlo cambiaría la historia de lo
        que se le cobró a la gente.
      </p>
      <button type="submit" disabled={pendiente} className="fo-btn fo-btn-primary text-sm disabled:opacity-60">
        {pendiente ? "Guardando…" : "Cargar valor"}
      </button>
      <Estado ok={ok} error={error} />
    </form>
  );
}

/**
 * El botón del recordatorio manual. Pide confirmación porque sale a personas reales y un
 * correo enviado no se puede retirar.
 */
export function SendReminderButton({ recipients }: { recipients: number }) {
  const [ok, setOk] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pendiente, startTransition] = useTransition();

  return (
    <div className="space-y-2">
      <button
        type="button"
        disabled={pendiente || recipients === 0}
        className="fo-btn fo-btn-primary text-sm disabled:opacity-60"
        onClick={() => {
          if (!window.confirm(`Se va a enviar el recordatorio a ${recipients} personas. ¿Seguimos?`)) return;
          startTransition(async () => {
            setOk(null);
            setError(null);
            const r = await sendDuesReminderNowAction();
            if (r.ok) setOk(r.message);
            else setError(r.error);
          });
        }}
      >
        {pendiente ? "Enviando… (puede tardar un par de minutos)" : "Enviar recordatorio ahora"}
      </button>
      <Estado ok={ok} error={error} />
    </div>
  );
}

/** El enlace al grupo de WhatsApp, con la vista previa del botón que van a ver los socios. */
export function CommunityLinkForm({
  defaultUrl,
  vocabulary,
}: {
  defaultUrl: string | null;
  vocabulary: PersonVocabulary;
}) {
  const [ok, setOk] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [guardado, setGuardado] = useState(defaultUrl);
  const [pendiente, startTransition] = useTransition();

  return (
    <form
      action={(data) =>
        startTransition(async () => {
          setOk(null);
          setError(null);
          const r = await saveCommunityLinkAction(data);
          if (r.ok) {
            const valor = String(data.get("communityWhatsappUrl") ?? "").trim();
            setGuardado(valor || null);
            setOk(valor ? "Guardado." : "Listo: ya no se muestra el grupo.");
          } else setError(r.error);
        })
      }
      className="space-y-3"
    >
      <label className="block space-y-1 text-xs">
        <span className="text-[var(--fo-muted-soft)]">Enlace de invitación al grupo</span>
        <input
          name="communityWhatsappUrl"
          type="url"
          inputMode="url"
          placeholder="https://chat.whatsapp.com/..."
          defaultValue={defaultUrl ?? ""}
          className="fo-input w-full"
        />
      </label>
      <p className="text-xs leading-relaxed text-[var(--fo-muted)]">
        {`Les llega a los ${vocabulary.plural} en el correo de bienvenida y lo tienen como botón en el inicio de su portal. Sólo lo ven ${vocabulary.plural} activos: nunca aparece en el sitio público ni en el formulario para asociarse. Dejalo vacío para no mostrarlo.`}
      </p>
      {guardado ? (
        <div className="space-y-1.5">
          <p className="text-xs text-[var(--fo-muted-soft)]">Así lo ven:</p>
          <WhatsappGroupButton href={guardado} />
        </div>
      ) : null}
      <button type="submit" disabled={pendiente} className="fo-btn fo-btn-secondary text-sm disabled:opacity-60">
        {pendiente ? "Guardando…" : "Guardar enlace"}
      </button>
      <Estado ok={ok} error={error} />
    </form>
  );
}
