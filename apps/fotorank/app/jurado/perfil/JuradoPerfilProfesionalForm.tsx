"use client";

import { useState, useTransition } from "react";
import { judgeUpdateProfessionalProfileAction } from "../../actions/judgeProfessionalProfile";
import { DIRECTORY_PRIVACY_NOTE, EXTERNAL_PAYMENT_DISCLAIMER } from "../../lib/fotorank/judges/legalCopy";

type Initial = {
  displayNameOverride: string | null;
  professionalHeadline: string | null;
  shortBio: string | null;
  specialtiesText: string;
  experienceYears: number | null;
  languagesText: string;
  region: string | null;
  city: string | null;
  country: string | null;
  portfolioUrl: string | null;
  isAvailableForJuryWork: boolean;
  availabilityNotes: string | null;
  availableRemote: boolean;
  availableInPerson: boolean;
  preferredContestScopes: string | null;
  compensationMode: string;
  pricingMode: string;
  priceAmount: number | null;
  priceCurrency: string | null;
  priceNotes: string | null;
  priceUnit: string | null;
  isListedInProfessionalDirectory: boolean;
  showPricingPublicly: boolean;
  showLocationPublicly: boolean;
  showWebsitePublicly: boolean;
  showInstagramPublicly: boolean;
};

export function JuradoPerfilProfesionalForm({ initial }: { initial: Initial }) {
  const [f, setF] = useState(initial);
  const [msg, setMsg] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [pending, start] = useTransition();

  const submit = () => {
    setMsg(null);
    setErr(null);
    start(async () => {
      const r = await judgeUpdateProfessionalProfileAction({
        ...f,
        experienceYears: f.experienceYears === null || f.experienceYears === ("" as unknown as number) ? null : Number(f.experienceYears),
        priceAmount: f.priceAmount === null || f.priceAmount === ("" as unknown as number) ? null : Number(f.priceAmount),
      });
      if (!r.ok) setErr(r.error);
      else setMsg("Cambios guardados.");
    });
  };

  return (
    <div className="space-y-10">
      {err ? (
        <div className="rounded-lg border border-red-500/40 bg-red-500/10 px-4 py-3 text-sm text-red-100">{err}</div>
      ) : null}
      {msg ? (
        <div className="rounded-lg border border-emerald-500/40 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-100">{msg}</div>
      ) : null}

      <section className="fr-recuadro space-y-6 rounded-xl border border-fr-border bg-fr-card">
        <h2 className="font-sans text-lg font-semibold text-fr-primary">Presentación</h2>
        <Field
          label="Nombre para mostrar (opcional)"
          hint="Si lo dejás vacío, usamos tu nombre y apellido registrados."
          value={f.displayNameOverride ?? ""}
          onChange={(v) => setF((s) => ({ ...s, displayNameOverride: v || null }))}
        />
        <Field
          label="Titular / headline"
          value={f.professionalHeadline ?? ""}
          onChange={(v) => setF((s) => ({ ...s, professionalHeadline: v || null }))}
        />
        <div className="space-y-2">
          <label className="text-sm font-semibold text-fr-primary">Bio breve</label>
          <textarea
            className="min-h-[100px] w-full rounded-lg border border-fr-border bg-fr-bg px-4 py-3 text-sm text-fr-primary"
            value={f.shortBio ?? ""}
            onChange={(e) => setF((s) => ({ ...s, shortBio: e.target.value || null }))}
          />
        </div>
      </section>

      <section className="fr-recuadro space-y-6 rounded-xl border border-fr-border bg-fr-card">
        <h2 className="font-sans text-lg font-semibold text-fr-primary">Especialidades y experiencia</h2>
        <div className="space-y-2">
          <label className="text-sm font-semibold text-fr-primary">Especialidades</label>
          <p className="text-xs text-fr-muted">Separadas por coma.</p>
          <input
            className="w-full rounded-lg border border-fr-border bg-fr-bg px-4 py-3 text-sm text-fr-primary"
            value={f.specialtiesText}
            onChange={(e) => setF((s) => ({ ...s, specialtiesText: e.target.value }))}
            placeholder="Retrato, documental, fine art…"
          />
        </div>
        <div className="space-y-2">
          <label className="text-sm font-semibold text-fr-primary">Años de experiencia</label>
          <input
            type="number"
            min={0}
            max={80}
            className="w-full max-w-[200px] rounded-lg border border-fr-border bg-fr-bg px-4 py-3 text-sm text-fr-primary"
            value={f.experienceYears ?? ""}
            onChange={(e) =>
              setF((s) => ({
                ...s,
                experienceYears: e.target.value === "" ? null : Number(e.target.value),
              }))
            }
          />
        </div>
        <div className="space-y-2">
          <label className="text-sm font-semibold text-fr-primary">Idiomas</label>
          <p className="text-xs text-fr-muted">Separados por coma.</p>
          <input
            className="w-full rounded-lg border border-fr-border bg-fr-bg px-4 py-3 text-sm text-fr-primary"
            value={f.languagesText}
            onChange={(e) => setF((s) => ({ ...s, languagesText: e.target.value }))}
          />
        </div>
        <div className="grid gap-4 sm:grid-cols-3">
          <Field label="País" value={f.country ?? ""} onChange={(v) => setF((s) => ({ ...s, country: v || null }))} />
          <Field label="Región / provincia" value={f.region ?? ""} onChange={(v) => setF((s) => ({ ...s, region: v || null }))} />
          <Field label="Ciudad" value={f.city ?? ""} onChange={(v) => setF((s) => ({ ...s, city: v || null }))} />
        </div>
        <Field
          label="Portfolio (URL)"
          value={f.portfolioUrl ?? ""}
          onChange={(v) => setF((s) => ({ ...s, portfolioUrl: v || null }))}
        />
      </section>

      <section className="fr-recuadro space-y-6 rounded-xl border border-fr-border bg-fr-card">
        <h2 className="font-sans text-lg font-semibold text-fr-primary">Disponibilidad</h2>
        <Toggle
          label="Disponible para nuevos jurados"
          checked={f.isAvailableForJuryWork}
          onChange={(v) => setF((s) => ({ ...s, isAvailableForJuryWork: v }))}
        />
        <Toggle label="Trabajo remoto" checked={f.availableRemote} onChange={(v) => setF((s) => ({ ...s, availableRemote: v }))} />
        <Toggle
          label="Presencial"
          checked={f.availableInPerson}
          onChange={(v) => setF((s) => ({ ...s, availableInPerson: v }))}
        />
        <div className="space-y-2">
          <label className="text-sm font-semibold text-fr-primary">Notas de disponibilidad</label>
          <textarea
            className="min-h-[80px] w-full rounded-lg border border-fr-border bg-fr-bg px-4 py-3 text-sm text-fr-primary"
            value={f.availabilityNotes ?? ""}
            onChange={(e) => setF((s) => ({ ...s, availabilityNotes: e.target.value || null }))}
          />
        </div>
        <Field
          label="Alcances preferidos (texto libre)"
          value={f.preferredContestScopes ?? ""}
          onChange={(v) => setF((s) => ({ ...s, preferredContestScopes: v || null }))}
        />
      </section>

      <section className="fr-recuadro space-y-6 rounded-xl border border-fr-border bg-fr-card">
        <h2 className="font-sans text-lg font-semibold text-fr-primary">Modalidad económica</h2>
        <p className="text-xs leading-relaxed text-fr-muted">{EXTERNAL_PAYMENT_DISCLAIMER}</p>
        <div className="space-y-2">
          <label className="text-sm font-semibold text-fr-primary">Compensación</label>
          <select
            className="w-full rounded-lg border border-fr-border bg-fr-bg px-4 py-3 text-sm text-fr-primary"
            value={f.compensationMode}
            onChange={(e) => setF((s) => ({ ...s, compensationMode: e.target.value }))}
          >
            <option value="VOLUNTEER">Ad honorem</option>
            <option value="PAID">Pago</option>
            <option value="BOTH">Ambos</option>
          </select>
        </div>
        <div className="space-y-2">
          <label className="text-sm font-semibold text-fr-primary">Cómo mostrar el precio</label>
          <select
            className="w-full rounded-lg border border-fr-border bg-fr-bg px-4 py-3 text-sm text-fr-primary"
            value={f.pricingMode}
            onChange={(e) => setF((s) => ({ ...s, pricingMode: e.target.value }))}
          >
            <option value="NOT_SHOWN">No mostrar</option>
            <option value="FIXED">Precio fijo</option>
            <option value="STARTING_AT">Desde</option>
            <option value="NEGOTIABLE">A convenir</option>
          </select>
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <label className="text-sm font-semibold text-fr-primary">Monto (opcional)</label>
            <input
              type="number"
              step="0.01"
              className="w-full rounded-lg border border-fr-border bg-fr-bg px-4 py-3 text-sm text-fr-primary"
              value={f.priceAmount ?? ""}
              onChange={(e) =>
                setF((s) => ({
                  ...s,
                  priceAmount: e.target.value === "" ? null : Number(e.target.value),
                }))
              }
            />
          </div>
          <Field
            label="Moneda (ej. USD, ARS)"
            value={f.priceCurrency ?? ""}
            onChange={(v) => setF((s) => ({ ...s, priceCurrency: v || null }))}
          />
        </div>
        <div className="space-y-2">
          <label className="text-sm font-semibold text-fr-primary">Unidad</label>
          <select
            className="w-full rounded-lg border border-fr-border bg-fr-bg px-4 py-3 text-sm text-fr-primary"
            value={f.priceUnit ?? ""}
            onChange={(e) => setF((s) => ({ ...s, priceUnit: e.target.value || null }))}
          >
            <option value="">—</option>
            <option value="PER_CONTEST">Por concurso</option>
            <option value="PER_CATEGORY">Por categoría</option>
            <option value="PER_HOUR">Por hora</option>
            <option value="CUSTOM">Otro</option>
          </select>
        </div>
        <div className="space-y-2">
          <label className="text-sm font-semibold text-fr-primary">Notas de honorarios</label>
          <textarea
            className="min-h-[72px] w-full rounded-lg border border-fr-border bg-fr-bg px-4 py-3 text-sm text-fr-primary"
            value={f.priceNotes ?? ""}
            onChange={(e) => setF((s) => ({ ...s, priceNotes: e.target.value || null }))}
          />
        </div>
      </section>

      <section className="fr-recuadro space-y-6 rounded-xl border border-fr-border bg-fr-card">
        <h2 className="font-sans text-lg font-semibold text-fr-primary">Visibilidad pública</h2>
        <p className="text-xs leading-relaxed text-fr-muted">{DIRECTORY_PRIVACY_NOTE}</p>
        <Toggle
          label="Aparecer en el directorio para organizadores"
          checked={f.isListedInProfessionalDirectory}
          onChange={(v) => setF((s) => ({ ...s, isListedInProfessionalDirectory: v }))}
        />
        <Toggle
          label="Mostrar honorarios en el directorio"
          checked={f.showPricingPublicly}
          onChange={(v) => setF((s) => ({ ...s, showPricingPublicly: v }))}
        />
        <Toggle
          label="Mostrar ubicación aproximada"
          checked={f.showLocationPublicly}
          onChange={(v) => setF((s) => ({ ...s, showLocationPublicly: v }))}
        />
        <Toggle
          label="Mostrar sitio web en la ficha"
          checked={f.showWebsitePublicly}
          onChange={(v) => setF((s) => ({ ...s, showWebsitePublicly: v }))}
        />
        <Toggle
          label="Mostrar Instagram en la ficha"
          checked={f.showInstagramPublicly}
          onChange={(v) => setF((s) => ({ ...s, showInstagramPublicly: v }))}
        />
      </section>

      <div className="flex justify-end">
        <button type="button" disabled={pending} onClick={submit} className="fr-btn fr-btn-primary">
          Guardar cambios
        </button>
      </div>
    </div>
  );
}

function Field(props: { label: string; hint?: string; value: string; onChange: (v: string) => void }) {
  return (
    <div className="space-y-2">
      <label className="text-sm font-semibold text-fr-primary">{props.label}</label>
      {props.hint ? <p className="text-xs text-fr-muted">{props.hint}</p> : null}
      <input
        className="w-full rounded-lg border border-fr-border bg-fr-bg px-4 py-3 text-sm text-fr-primary"
        value={props.value}
        onChange={(e) => props.onChange(e.target.value)}
      />
    </div>
  );
}

function Toggle(props: { label: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <label className="flex cursor-pointer items-start gap-4 rounded-lg border border-fr-border bg-fr-bg px-4 py-4">
      <input
        type="checkbox"
        className="mt-1 h-4 w-4 accent-gold"
        checked={props.checked}
        onChange={(e) => props.onChange(e.target.checked)}
      />
      <span className="text-sm leading-snug text-fr-primary">{props.label}</span>
    </label>
  );
}
