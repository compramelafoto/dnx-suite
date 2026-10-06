"use client";

import { useState, useTransition } from "react";
import { PROVINCES } from "@/lib/store/shipping/provinces";
import { MAX_ZONE_NAME } from "@/lib/store/shipping/zone-form";
import { deleteShippingZoneAction, saveShippingZoneAction, type ShippingActionResult } from "./actions";
import { Resultado } from "./shipping-settings-form";

/**
 * La tabla de precios por zona: alta, edición y baja. Cada zona llega a códigos postales,
 * provincias y/o el resto del país, y tiene escalones "hasta X gramos → $Y". Las reglas de
 * verdad están en `lib/store/shipping/zone-form.ts` y en la acción (un solo "resto del país").
 */

export type ZoneView = {
  id: string;
  name: string;
  postalCodes: string[];
  provinceCodes: string[];
  isRestOfCountry: boolean;
  /** Ordenados por peso; el precio ya escrito como se edita ("1500,50"). */
  rates: { maxGrams: number; priceText: string }[];
};

const NOMBRE_PROVINCIA = new Map(PROVINCES.map((p) => [p.code, p.name]));

export function ShippingZonesEditor({ zones }: { zones: ZoneView[] }) {
  // `null` = nada abierto; "nueva" = el formulario de alta; un id = esa zona en edición.
  const [abierta, setAbierta] = useState<string | null>(null);

  return (
    <section className="fo-card space-y-4 p-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-base font-semibold">Tabla de precios por zona</h2>
        {abierta !== "nueva" ? (
          <button type="button" className="fo-btn fo-btn-secondary text-sm" onClick={() => setAbierta("nueva")}>
            Nueva zona
          </button>
        ) : null}
      </div>
      <p className="fo-helper">
        Si un código postal está en una zona, gana esa; si no, la zona de su provincia; si no, la del resto del país.
        Dentro de la zona se usa el primer escalón que alcance para el peso del paquete.
      </p>

      {abierta === "nueva" ? <ZoneForm zone={null} onDone={() => setAbierta(null)} /> : null}

      {zones.length === 0 && abierta !== "nueva" ? (
        <p className="text-sm text-[var(--fo-muted)]">Todavía no cargaste zonas.</p>
      ) : null}

      <ul className="space-y-3">
        {zones.map((z) =>
          abierta === z.id ? (
            <li key={z.id}>
              <ZoneForm zone={z} onDone={() => setAbierta(null)} />
            </li>
          ) : (
            <li key={z.id}>
              <ZoneSummary zone={z} onEdit={() => setAbierta(z.id)} />
            </li>
          ),
        )}
      </ul>
    </section>
  );
}

function ZoneSummary({ zone, onEdit }: { zone: ZoneView; onEdit: () => void }) {
  const [resultado, setResultado] = useState<ShippingActionResult | null>(null);
  const [borrando, startTransition] = useTransition();

  const destinos = [
    zone.postalCodes.length > 0 ? `CP ${zone.postalCodes.join(", ")}` : null,
    zone.provinceCodes.length > 0
      ? zone.provinceCodes.map((c) => NOMBRE_PROVINCIA.get(c) ?? c).join(", ")
      : null,
    zone.isRestOfCountry ? "Resto del país" : null,
  ].filter(Boolean);

  return (
    <div className="rounded-md border border-[var(--fo-border)] p-4 text-sm">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="space-y-1">
          <p className="font-semibold">{zone.name}</p>
          <p className="text-[var(--fo-muted)]">{destinos.join(" · ")}</p>
          <p>
            {zone.rates.map((r) => `hasta ${r.maxGrams} g: $ ${r.priceText}`).join(" · ")}
          </p>
        </div>
        <div className="flex gap-2">
          <button type="button" className="fo-btn fo-btn-secondary text-sm" onClick={onEdit}>
            Editar
          </button>
          <button
            type="button"
            className="fo-btn fo-btn-secondary text-sm"
            disabled={borrando}
            onClick={() => {
              if (!window.confirm(`¿Borrar la zona "${zone.name}" y sus precios?`)) return;
              startTransition(async () => {
                setResultado(await deleteShippingZoneAction(zone.id));
              });
            }}
          >
            {borrando ? "Borrando…" : "Borrar"}
          </button>
        </div>
      </div>
      {resultado && !resultado.ok ? <Resultado resultado={resultado} /> : null}
    </div>
  );
}

type FilaEscalon = { key: number; maxGrams: string; price: string };

function ZoneForm({ zone, onDone }: { zone: ZoneView | null; onDone: () => void }) {
  const [resultado, setResultado] = useState<ShippingActionResult | null>(null);
  const [guardando, startTransition] = useTransition();
  const [filas, setFilas] = useState<FilaEscalon[]>(() => {
    const cargadas = (zone?.rates ?? []).map((r, i) => ({ key: i, maxGrams: String(r.maxGrams), price: r.priceText }));
    return cargadas.length > 0 ? cargadas : [{ key: 0, maxGrams: "", price: "" }];
  });

  function agregarFila() {
    setFilas((f) => [...f, { key: Math.max(-1, ...f.map((x) => x.key)) + 1, maxGrams: "", price: "" }]);
  }

  function cambiarFila(key: number, campo: "maxGrams" | "price", valor: string) {
    setFilas((f) => f.map((x) => (x.key === key ? { ...x, [campo]: valor } : x)));
  }

  function quitarFila(key: number) {
    setFilas((f) => (f.length > 1 ? f.filter((x) => x.key !== key) : f));
  }

  const prefijo = zone ? `zona-${zone.id}` : "zona-nueva";

  return (
    <form
      // `onSubmit` y no `action`: un error no tiene que borrar lo escrito.
      onSubmit={(e) => {
        e.preventDefault();
        const fd = new FormData(e.currentTarget);
        startTransition(async () => {
          const r = await saveShippingZoneAction(fd);
          setResultado(r);
          if (r.ok) onDone();
        });
      }}
      className="space-y-4 rounded-md border border-[var(--fo-border)] p-4"
    >
      {zone ? <input type="hidden" name="zoneId" value={zone.id} /> : null}

      <div className="fo-field-stack">
        <label className="fo-label" htmlFor={`${prefijo}-name`}>
          Nombre de la zona
        </label>
        <input
          id={`${prefijo}-name`}
          name="name"
          className="fo-input"
          defaultValue={zone?.name ?? ""}
          maxLength={MAX_ZONE_NAME}
          placeholder="Rosario y alrededores"
        />
      </div>

      <div className="fo-field-stack">
        <label className="fo-label" htmlFor={`${prefijo}-cps`}>
          Códigos postales
        </label>
        <textarea
          id={`${prefijo}-cps`}
          name="postalCodes"
          rows={2}
          className="fo-input"
          defaultValue={zone?.postalCodes.join(", ") ?? ""}
          placeholder="2000, 2001, 2002"
        />
        <p className="fo-helper">Separados por coma o espacio. Podés dejarlo vacío si la zona es por provincia.</p>
      </div>

      <fieldset className="space-y-2">
        <legend className="fo-label">Provincias enteras</legend>
        <div className="grid gap-1 text-sm sm:grid-cols-2 lg:grid-cols-3">
          {PROVINCES.map((p) => (
            <label key={p.code} className="flex items-center gap-2">
              <input
                type="checkbox"
                name="provinceCodes"
                value={p.code}
                defaultChecked={zone?.provinceCodes.includes(p.code) ?? false}
              />
              {p.name}
            </label>
          ))}
        </div>
      </fieldset>

      <label className="flex items-center gap-2 text-sm">
        <input type="checkbox" name="isRestOfCountry" defaultChecked={zone?.isRestOfCountry ?? false} />
        {/* El respaldo va DESPUÉS de la casilla: `FormData.get` devuelve la primera coincidencia. */}
        <input type="hidden" name="isRestOfCountry" value="off" />
        Resto del país (todo lo que no cubre otra zona)
      </label>

      <fieldset className="space-y-2">
        <legend className="fo-label">Precios por peso</legend>
        {filas.map((f) => (
          <div key={f.key} className="flex flex-wrap items-center gap-2 text-sm">
            <span>Hasta</span>
            <input
              name="rateMaxGrams"
              className="fo-input w-28"
              value={f.maxGrams}
              onChange={(e) => cambiarFila(f.key, "maxGrams", e.target.value)}
              inputMode="numeric"
              placeholder="1000"
              aria-label="Peso máximo en gramos"
            />
            <span>gramos →</span>
            <span>$</span>
            <input
              name="ratePrice"
              className="fo-input w-32"
              value={f.price}
              onChange={(e) => cambiarFila(f.key, "price", e.target.value)}
              inputMode="decimal"
              placeholder="3500"
              aria-label="Precio en pesos"
            />
            {filas.length > 1 ? (
              <button type="button" className="text-[var(--fo-muted)] underline" onClick={() => quitarFila(f.key)}>
                Quitar
              </button>
            ) : null}
          </div>
        ))}
        <button type="button" className="text-sm underline" onClick={agregarFila}>
          Agregar escalón
        </button>
      </fieldset>

      <div className="flex flex-wrap items-center gap-3">
        <button type="submit" className="fo-btn fo-btn-primary text-sm" disabled={guardando}>
          {guardando ? "Guardando…" : zone ? "Guardar zona" : "Crear zona"}
        </button>
        <button type="button" className="fo-btn fo-btn-secondary text-sm" onClick={onDone} disabled={guardando}>
          Cancelar
        </button>
        <Resultado resultado={resultado && !resultado.ok ? resultado : null} />
      </div>
    </form>
  );
}
