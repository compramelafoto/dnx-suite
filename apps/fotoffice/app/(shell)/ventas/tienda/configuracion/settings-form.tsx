"use client";

import { useState, useTransition } from "react";
import {
  MAX_PICKUP_ADDRESS,
  MAX_PICKUP_HOURS,
  MAX_PICKUP_INSTRUCTIONS,
  MAX_RETURNS_POLICY,
  type StoreSettingsValues,
} from "@/lib/store/settings-form";
import { saveStoreSettingsAction, type StoreSettingsActionResult } from "./actions";

/**
 * El formulario de la configuración de la tienda. Las reglas de verdad están en
 * `lib/store/settings-form.ts` y en la acción (Mercado Pago conectado para abrir).
 */
export function StoreSettingsForm({
  settings,
  defaultReturnsPolicy,
}: {
  settings: StoreSettingsValues;
  /** La que ve el comprador si el campo queda vacío. Se muestra como ejemplo. */
  defaultReturnsPolicy: string;
}) {
  const [resultado, setResultado] = useState<StoreSettingsActionResult | null>(null);
  const [guardando, startTransition] = useTransition();

  function guardar(fd: FormData) {
    startTransition(async () => {
      setResultado(await saveStoreSettingsAction(fd));
    });
  }

  return (
    // `onSubmit` y no `action`: un `<form action={fn}>` se resetea solo al terminar, y si el
    // guardado vuelve con un error se perdería lo que la persona escribió.
    <form
      onSubmit={(e) => {
        e.preventDefault();
        guardar(new FormData(e.currentTarget));
      }}
      className="space-y-6"
    >
      <section className="fo-card space-y-3 p-5">
        <h2 className="text-base font-semibold">Estado</h2>
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" name="isOpen" defaultChecked={settings.isOpen} />
          {/* El respaldo va DESPUÉS de la casilla: `FormData.get` devuelve la primera coincidencia. */}
          <input type="hidden" name="isOpen" value="off" />
          Tienda abierta
        </label>
        <p className="fo-helper">
          Abierta, aparece &quot;Tienda&quot; en el menú de tu sitio y se puede comprar. Para abrirla hace falta la
          dirección de retiro, un email para los avisos y Mercado Pago conectado.
        </p>
      </section>

      <section className="fo-card space-y-4 p-5">
        <h2 className="text-base font-semibold">Retiro en el local</h2>
        <div className="fo-field-stack">
          <label className="fo-label" htmlFor="pickupAddress">
            Dirección de retiro
          </label>
          <input
            id="pickupAddress"
            name="pickupAddress"
            className="fo-input"
            defaultValue={settings.pickupAddress ?? ""}
            maxLength={MAX_PICKUP_ADDRESS}
            placeholder="San Martín 1234, Rosario"
          />
        </div>
        <div className="fo-field-stack">
          <label className="fo-label" htmlFor="pickupHours">
            Horarios
          </label>
          <input
            id="pickupHours"
            name="pickupHours"
            className="fo-input"
            defaultValue={settings.pickupHours ?? ""}
            maxLength={MAX_PICKUP_HOURS}
            placeholder="Lunes a viernes de 10 a 18"
          />
        </div>
        <div className="fo-field-stack">
          <label className="fo-label" htmlFor="pickupInstructions">
            Indicaciones para retirar
          </label>
          <textarea
            id="pickupInstructions"
            name="pickupInstructions"
            rows={3}
            className="fo-input"
            defaultValue={settings.pickupInstructions ?? ""}
            maxLength={MAX_PICKUP_INSTRUCTIONS}
          />
          <p className="fo-helper">Por ejemplo: qué traer, a quién preguntar o por qué puerta entrar.</p>
        </div>
      </section>

      <section className="fo-card space-y-4 p-5">
        <h2 className="text-base font-semibold">Política de devoluciones</h2>
        <div className="fo-field-stack">
          <label className="fo-label" htmlFor="returnsPolicy">
            Texto que ve el comprador
          </label>
          <textarea
            id="returnsPolicy"
            name="returnsPolicy"
            rows={5}
            className="fo-input"
            defaultValue={settings.returnsPolicy ?? ""}
            maxLength={MAX_RETURNS_POLICY}
            placeholder={defaultReturnsPolicy}
          />
          <p className="fo-helper">Si lo dejás vacío, se muestra el texto de ejemplo.</p>
        </div>
      </section>

      <section className="fo-card space-y-4 p-5">
        <h2 className="text-base font-semibold">Avisos</h2>
        <div className="fo-field-stack">
          <label className="fo-label" htmlFor="notifyEmail">
            Email para los avisos de pedidos
          </label>
          <input
            id="notifyEmail"
            name="notifyEmail"
            type="email"
            className="fo-input"
            defaultValue={settings.notifyEmail ?? ""}
            maxLength={254}
          />
          <p className="fo-helper">A esta dirección llega un aviso cada vez que entra un pedido pagado.</p>
        </div>
      </section>

      <div className="flex flex-wrap items-center gap-4">
        <button type="submit" className="fo-btn fo-btn-primary text-sm" disabled={guardando}>
          {guardando ? "Guardando…" : "Guardar"}
        </button>
        {resultado ? (
          resultado.ok ? (
            <p className="text-sm text-[var(--fo-success)]">Listo, se guardó.</p>
          ) : (
            <p className="text-sm text-[var(--fo-danger)]" role="alert">
              {resultado.error}
            </p>
          )
        ) : null}
      </div>
    </form>
  );
}
