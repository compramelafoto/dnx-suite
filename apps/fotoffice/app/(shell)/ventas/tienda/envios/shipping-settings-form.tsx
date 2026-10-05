"use client";

import { useState, useTransition } from "react";
import { MAX_HANDLING_NOTE, type ShippingSettingsValues } from "@/lib/store/shipping/settings-form";
import { saveShippingSettingsAction, type ShippingActionResult } from "./actions";

/**
 * Formulario de la configuración de envíos. Las reglas de verdad están en
 * `lib/store/shipping/settings-form.ts` (y la acción agrega si Correo está conectado).
 */
export function ShippingSettingsForm({
  settings,
  surchargeText,
  correoActive,
}: {
  settings: ShippingSettingsValues;
  /** El recargo guardado, ya escrito como se edita ("10,5" o "1500,50"). */
  surchargeText: string;
  correoActive: boolean;
}) {
  const [resultado, setResultado] = useState<ShippingActionResult | null>(null);
  const [guardando, startTransition] = useTransition();
  const [source, setSource] = useState(settings.source);
  const [surchargeKind, setSurchargeKind] = useState(settings.surchargeKind);

  return (
    // `onSubmit` y no `action`: un `<form action={fn}>` se resetea solo al terminar, y si el
    // guardado vuelve con un error se perdería lo que la persona escribió.
    <form
      onSubmit={(e) => {
        e.preventDefault();
        const fd = new FormData(e.currentTarget);
        startTransition(async () => {
          setResultado(await saveShippingSettingsAction(fd));
        });
      }}
      className="space-y-6"
    >
      <section className="fo-card space-y-3 p-5">
        <h2 className="text-base font-semibold">Formas de entrega</h2>
        <Casilla name="pickupEnabled" checked={settings.pickupEnabled} label="Retiro en la sede (gratis)" />
        <Casilla name="homeDeliveryEnabled" checked={settings.homeDeliveryEnabled} label="Envío a domicilio" />
        <Casilla
          name="branchDeliveryEnabled"
          checked={settings.branchDeliveryEnabled}
          label="Envío a una sucursal de Correo Argentino"
        />
        <p className="fo-helper">
          El envío a sucursal sólo funciona con Correo Argentino conectado y elegido como fuente del precio.
        </p>
        <div className="fo-field-stack">
          <label className="fo-label" htmlFor="originPostalCode">
            Código postal desde donde despachás
          </label>
          <input
            id="originPostalCode"
            name="originPostalCode"
            className="fo-input max-w-[12rem]"
            defaultValue={settings.originPostalCode ?? ""}
            maxLength={8}
            inputMode="numeric"
            placeholder="2000"
          />
          <p className="fo-helper">Hace falta para enviar a domicilio o a sucursal.</p>
        </div>
      </section>

      <section className="fo-card space-y-4 p-5">
        <h2 className="text-base font-semibold">De dónde sale el precio</h2>
        <fieldset className="space-y-2 text-sm">
          <label className="flex items-center gap-2">
            <input
              type="radio"
              name="source"
              value="TABLE"
              checked={source === "TABLE"}
              onChange={() => setSource("TABLE")}
            />
            Mi tabla de precios por zona
          </label>
          <label className="flex items-center gap-2">
            <input
              type="radio"
              name="source"
              value="CORREO_ARGENTINO"
              checked={source === "CORREO_ARGENTINO"}
              onChange={() => setSource("CORREO_ARGENTINO")}
              disabled={!correoActive && source !== "CORREO_ARGENTINO"}
            />
            Correo Argentino (el precio de MiCorreo en el momento)
          </label>
        </fieldset>
        {!correoActive ? (
          <p className="fo-helper">Para usar Correo Argentino, primero conectalo más abajo.</p>
        ) : null}
        <Casilla
          name="tableAsFallback"
          checked={settings.tableAsFallback}
          label="Si Correo Argentino no responde, usar mi tabla"
        />
      </section>

      <section className="fo-card space-y-4 p-5">
        <h2 className="text-base font-semibold">Recargo</h2>
        <p className="fo-helper">Se suma al precio del envío. El comprador ve un solo número.</p>
        <div className="flex flex-wrap items-end gap-3">
          <div className="fo-field-stack">
            <label className="fo-label" htmlFor="surchargeKind">
              Tipo
            </label>
            <select
              id="surchargeKind"
              name="surchargeKind"
              className="fo-input"
              value={surchargeKind}
              onChange={(e) => setSurchargeKind(e.target.value as ShippingSettingsValues["surchargeKind"])}
            >
              <option value="NONE">Sin recargo</option>
              <option value="PERCENT">Porcentaje</option>
              <option value="FIXED">Monto fijo</option>
            </select>
          </div>
          {surchargeKind !== "NONE" ? (
            <div className="fo-field-stack">
              <label className="fo-label" htmlFor="surchargeValue">
                {surchargeKind === "PERCENT" ? "Porcentaje (%)" : "Monto ($)"}
              </label>
              <input
                // La clave cambia con el tipo: el valor de un porcentaje no sirve como monto.
                key={surchargeKind}
                id="surchargeValue"
                name="surchargeValue"
                className="fo-input max-w-[10rem]"
                defaultValue={surchargeKind === settings.surchargeKind ? surchargeText : ""}
                inputMode="decimal"
                placeholder={surchargeKind === "PERCENT" ? "10" : "1500"}
              />
            </div>
          ) : null}
        </div>
      </section>

      <section className="fo-card space-y-4 p-5">
        <h2 className="text-base font-semibold">Paquete</h2>
        <p className="fo-helper">
          El peso del paquete es la suma de los productos más el embalaje. Si un producto no tiene peso cargado, se usa el
          peso por unidad por defecto. Las medidas son las de la caja por defecto.
        </p>
        <div className="grid gap-4 sm:grid-cols-2">
          <Numero name="packagingGrams" label="Peso del embalaje (g)" value={settings.packagingGrams} />
          <Numero name="defaultUnitGrams" label="Peso por unidad por defecto (g)" value={settings.defaultUnitGrams} />
        </div>
        <div className="grid gap-4 sm:grid-cols-3">
          <Numero name="boxLengthCm" label="Largo de la caja (cm)" value={settings.boxLengthCm} />
          <Numero name="boxWidthCm" label="Ancho (cm)" value={settings.boxWidthCm} />
          <Numero name="boxHeightCm" label="Alto (cm)" value={settings.boxHeightCm} />
        </div>
      </section>

      <section className="fo-card space-y-4 p-5">
        <h2 className="text-base font-semibold">Aviso para el comprador</h2>
        <div className="fo-field-stack">
          <label className="fo-label" htmlFor="handlingNote">
            Texto que se muestra al elegir envío
          </label>
          <input
            id="handlingNote"
            name="handlingNote"
            className="fo-input"
            defaultValue={settings.handlingNote ?? ""}
            maxLength={MAX_HANDLING_NOTE}
            placeholder="Despachamos en 48 h hábiles"
          />
        </div>
      </section>

      <div className="flex flex-wrap items-center gap-4">
        <button type="submit" className="fo-btn fo-btn-primary text-sm" disabled={guardando}>
          {guardando ? "Guardando…" : "Guardar"}
        </button>
        <Resultado resultado={resultado} />
      </div>
    </form>
  );
}

function Casilla({ name, checked, label }: { name: string; checked: boolean; label: string }) {
  return (
    <label className="flex items-center gap-2 text-sm">
      <input type="checkbox" name={name} defaultChecked={checked} />
      {/* El respaldo va DESPUÉS de la casilla: `FormData.get` devuelve la primera coincidencia. */}
      <input type="hidden" name={name} value="off" />
      {label}
    </label>
  );
}

function Numero({ name, label, value }: { name: string; label: string; value: number }) {
  return (
    <div className="fo-field-stack">
      <label className="fo-label" htmlFor={name}>
        {label}
      </label>
      <input id={name} name={name} className="fo-input" defaultValue={String(value)} inputMode="numeric" />
    </div>
  );
}

export function Resultado({ resultado }: { resultado: ShippingActionResult | null }) {
  if (!resultado) return null;
  return resultado.ok ? (
    <p className="text-sm text-[var(--fo-success)]">{resultado.message ?? "Listo, se guardó."}</p>
  ) : (
    <p className="text-sm text-[var(--fo-danger)]" role="alert">
      {resultado.error}
    </p>
  );
}
