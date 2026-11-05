"use client";

import { useState } from "react";
import Button from "@/components/ui/Button";
import { SUPPORTED_COUNTRIES, normalizeCountryInput } from "@/lib/international/countries";

type Props = {
  /** Texto libre que ya tenía el perfil ("México"); sirve para preseleccionar. */
  currentCountryText?: string | null;
  onSaved: (countryCode: string) => void;
};

export default function CountryPromptBanner({ currentCountryText, onSaved }: Props) {
  const [value, setValue] = useState(normalizeCountryInput(currentCountryText) ?? "");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function save() {
    if (!value || saving) return;
    setSaving(true);
    setError(null);
    try {
      const res = await fetch("/api/fotografo/update", {
        method: "PATCH",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ countryCode: value }),
      });
      if (res.ok) {
        onSaved(value);
        return;
      }
      const data = await res.json().catch(() => null);
      setError(typeof data?.error === "string" ? data.error : "No pudimos guardar tu país. Probá de nuevo.");
    } catch {
      setError("No pudimos guardar tu país. Probá de nuevo.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="rounded-lg border border-amber-200 bg-amber-50/80 p-4">
      <p className="text-sm font-semibold text-gray-900 m-0">CompraMeLaFoto ahora funciona en otros países</p>
      <p className="text-sm text-gray-600 mt-1 mb-3 m-0">
        Por eso necesitamos saber de qué país sos. Elegilo una sola vez para que tus álbumes muestren la moneda correcta.
      </p>
      <div className="flex flex-wrap items-center gap-2">
        <select
          aria-label="País"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          className="rounded-md border border-gray-300 bg-white px-3 py-1.5 text-sm text-gray-900"
        >
          <option value="">Elegí tu país</option>
          {SUPPORTED_COUNTRIES.map((c) => (
            <option key={c.code} value={c.code}>
              {c.name}
            </option>
          ))}
        </select>
        <Button variant="secondary" size="sm" onClick={save} disabled={!value || saving}>
          {saving ? "Guardando..." : "Guardar"}
        </Button>
      </div>
      {error ? (
        <p role="alert" className="text-sm text-red-700 mt-2 mb-0">
          {error}
        </p>
      ) : null}
    </div>
  );
}
