"use client";

import { track } from "@vercel/analytics";
import { CheckCircle2 } from "lucide-react";
import { useState, type FormEvent, type ReactNode } from "react";

import { DNX_ESCOLAR_SOURCE, SCHOOL_LEAD_LEVELS, UTM_KEYS, type UtmParams } from "@/lib/dnx-escolar/lead-notes";

type FormState = {
  schoolName: string;
  city: string;
  contactName: string;
  email: string;
  phone: string;
  approxStudents: string;
  message: string;
  levels: string[];
};

const INITIAL: FormState = {
  schoolName: "",
  city: "",
  contactName: "",
  email: "",
  phone: "",
  approxStudents: "",
  message: "",
  levels: [],
};

/** Lee los utm_* de la URL actual. El servidor los vuelve a limpiar. */
function readUtmFromLocation(): UtmParams {
  if (typeof window === "undefined") return {};
  const params = new URLSearchParams(window.location.search);
  const utm: UtmParams = {};
  for (const key of UTM_KEYS) {
    const value = params.get(key)?.trim();
    if (value) utm[key] = value.slice(0, 100);
  }
  return utm;
}

const INPUT =
  "mt-1.5 w-full rounded-xl border border-zinc-300 bg-white px-3.5 py-2.5 text-base text-zinc-900 outline-none transition placeholder:text-zinc-400 focus:border-zinc-900 focus:ring-2 focus:ring-zinc-900/10";

function Campo({ label, opcional, children }: { label: string; opcional?: boolean; children: ReactNode }) {
  return (
    <label className="block text-sm font-medium text-zinc-800">
      {label}
      {opcional ? <span className="font-normal text-zinc-500"> (opcional)</span> : null}
      {children}
    </label>
  );
}

export default function EscolarLeadForm() {
  const [form, setForm] = useState<FormState>(INITIAL);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [enviado, setEnviado] = useState(false);

  const set = (field: keyof Omit<FormState, "levels">) => (value: string) =>
    setForm((prev) => ({ ...prev, [field]: value }));

  const toggleLevel = (level: string) =>
    setForm((prev) => ({
      ...prev,
      levels: prev.levels.includes(level) ? prev.levels.filter((l) => l !== level) : [...prev.levels, level],
    }));

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const approx = form.approxStudents.trim();
      const res = await fetch("/api/school-leads", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          schoolName: form.schoolName,
          city: form.city,
          contactName: form.contactName,
          email: form.email,
          whatsapp: form.phone,
          approxStudents: approx ? Number(approx) : null,
          message: form.message,
          levels: form.levels,
          source: DNX_ESCOLAR_SOURCE,
          utm: readUtmFromLocation(),
        }),
      });
      const data = (await res.json().catch(() => ({}))) as { ok?: boolean; error?: string };
      if (!res.ok || !data.ok) {
        throw new Error(data.error || "No pudimos enviar la solicitud. Probá de nuevo o escribinos por WhatsApp.");
      }
      track("dnx_escolar_lead_enviado");
      setEnviado(true);
      setForm(INITIAL);
    } catch (err) {
      setError(err instanceof Error ? err.message : "No pudimos enviar la solicitud.");
    } finally {
      setLoading(false);
    }
  }

  if (enviado) {
    return (
      <div role="status" className="rounded-3xl border border-emerald-200 bg-emerald-50 p-6 md:p-8">
        <CheckCircle2 className="h-8 w-8 text-emerald-700" aria-hidden />
        <h3 className="mt-3 text-xl font-semibold text-zinc-900">¡Gracias! Recibimos la solicitud.</h3>
        <p className="mt-2 text-zinc-700">
          Te vamos a contactar por email o teléfono para conocer al colegio y armar una propuesta a medida.
        </p>
        <button
          type="button"
          onClick={() => setEnviado(false)}
          className="mt-5 text-sm font-semibold text-zinc-700 underline underline-offset-4 hover:text-zinc-900"
        >
          Enviar otra solicitud
        </button>
      </div>
    );
  }

  return (
    <form onSubmit={onSubmit} className="space-y-4 rounded-3xl border border-zinc-200 bg-white p-5 md:p-8">
      <div className="grid gap-4 sm:grid-cols-2">
        <Campo label="Institución">
          <input
            className={INPUT}
            required
            minLength={2}
            maxLength={160}
            autoComplete="organization"
            value={form.schoolName}
            onChange={(e) => set("schoolName")(e.target.value)}
          />
        </Campo>
        <Campo label="Localidad">
          <input
            className={INPUT}
            required
            minLength={2}
            maxLength={120}
            autoComplete="address-level2"
            placeholder="Rosario, Funes, Roldán…"
            value={form.city}
            onChange={(e) => set("city")(e.target.value)}
          />
        </Campo>
        <Campo label="Nombre de contacto">
          <input
            className={INPUT}
            required
            minLength={2}
            maxLength={120}
            autoComplete="name"
            value={form.contactName}
            onChange={(e) => set("contactName")(e.target.value)}
          />
        </Campo>
        <Campo label="Email">
          <input
            className={INPUT}
            type="email"
            required
            maxLength={254}
            autoComplete="email"
            value={form.email}
            onChange={(e) => set("email")(e.target.value)}
          />
        </Campo>
        <Campo label="Teléfono / WhatsApp">
          <input
            className={INPUT}
            type="tel"
            required
            minLength={6}
            maxLength={40}
            autoComplete="tel"
            inputMode="tel"
            value={form.phone}
            onChange={(e) => set("phone")(e.target.value)}
          />
        </Campo>
        <Campo label="Cantidad aproximada de alumnos" opcional>
          <input
            className={INPUT}
            type="number"
            min={0}
            max={100000}
            inputMode="numeric"
            value={form.approxStudents}
            onChange={(e) => set("approxStudents")(e.target.value)}
          />
        </Campo>
      </div>

      <fieldset>
        <legend className="text-sm font-medium text-zinc-800">Niveles</legend>
        <div className="mt-2 flex flex-wrap gap-2">
          {SCHOOL_LEAD_LEVELS.map((level) => {
            const checked = form.levels.includes(level);
            return (
              <label
                key={level}
                className={`flex cursor-pointer items-center gap-2 rounded-full border px-4 py-2 text-sm transition ${
                  checked ? "border-zinc-900 bg-zinc-900 text-white" : "border-zinc-300 bg-white text-zinc-700 hover:border-zinc-500"
                }`}
              >
                <input type="checkbox" className="sr-only" checked={checked} onChange={() => toggleLevel(level)} />
                {level}
              </label>
            );
          })}
        </div>
      </fieldset>

      <Campo label="Mensaje" opcional>
        <textarea
          className={`${INPUT} min-h-[96px]`}
          maxLength={2000}
          value={form.message}
          onChange={(e) => set("message")(e.target.value)}
        />
      </Campo>

      {error ? (
        <p role="alert" className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
          {error}
        </p>
      ) : null}

      <button
        type="submit"
        disabled={loading}
        className="inline-flex w-full items-center justify-center rounded-full bg-zinc-900 px-5 py-3.5 text-sm font-semibold text-white transition hover:bg-zinc-700 disabled:cursor-not-allowed disabled:opacity-60"
      >
        {loading ? "Enviando…" : "Quiero una propuesta para mi colegio"}
      </button>
      <p className="text-xs text-zinc-500">
        Usamos estos datos sólo para responder tu consulta.
      </p>
    </form>
  );
}
