"use client";

import { useRef, useState, useTransition } from "react";
import {
  connectCorreoAction,
  disconnectCorreoAction,
  testCorreoConnectionAction,
  type ShippingActionResult,
} from "./actions";
import { Resultado } from "./shipping-settings-form";

/**
 * Conexión con MiCorreo (Correo Argentino). Las contraseñas nunca vienen precargadas ni
 * vuelven del servidor: la pantalla sólo recibe estado, email, ambiente y el número de
 * cliente enmascarado.
 */

export type CorreoConnectionView = {
  status: "ACTIVE" | "REVOKED" | "NEEDS_RECONSENT";
  accountEmail: string;
  env: "TEST" | "PROD" | null;
  customerIdMasked: string | null;
};

export function CorreoConnectionCard({ connection }: { connection: CorreoConnectionView | null }) {
  const [resultado, setResultado] = useState<ShippingActionResult | null>(null);
  const [pendiente, startTransition] = useTransition();
  const formRef = useRef<HTMLFormElement>(null);
  const activa = connection?.status === "ACTIVE";
  // Sin conexión activa el formulario se muestra siempre; con conexión, a pedido.
  const [mostrarFormulario, setMostrarFormulario] = useState(false);
  const verFormulario = !activa || mostrarFormulario;

  // Qué se está haciendo, para el texto de espera.
  const [enCurso, setEnCurso] = useState("");

  function correr(
    accion: () => Promise<ShippingActionResult>,
    textoEspera: string,
    alTerminar?: (r: ShippingActionResult) => void,
  ) {
    setResultado(null);
    setEnCurso(textoEspera);
    startTransition(async () => {
      const r = await accion();
      setResultado(r);
      alTerminar?.(r);
    });
  }

  return (
    <section className="fo-card space-y-4 p-5">
      <h2 className="text-base font-semibold">Correo Argentino</h2>

      {connection ? (
        <div className="space-y-1 text-sm">
          <p>
            Estado:{" "}
            {activa ? (
              <span className="text-[var(--fo-success)]">conectado</span>
            ) : (
              <span className="text-[var(--fo-danger)]">
                Correo dejó de aceptar las credenciales, volvé a conectar
              </span>
            )}
          </p>
          <p className="text-[var(--fo-muted)]">
            Cuenta MiCorreo: {connection.accountEmail}
            {connection.customerIdMasked ? ` · Cliente ${connection.customerIdMasked}` : ""}
            {connection.env ? ` · ${connection.env === "PROD" ? "Producción" : "Pruebas"}` : ""}
          </p>
          <div className="flex flex-wrap gap-2 pt-2">
            {activa ? (
              <button
                type="button"
                className="fo-btn fo-btn-secondary text-sm"
                disabled={pendiente}
                onClick={() => correr(testCorreoConnectionAction, "Probando con Correo Argentino…")}
              >
                Probar conexión
              </button>
            ) : null}
            {activa && !mostrarFormulario ? (
              <button type="button" className="fo-btn fo-btn-secondary text-sm" onClick={() => setMostrarFormulario(true)}>
                Cambiar credenciales
              </button>
            ) : null}
            <button
              type="button"
              className="fo-btn fo-btn-secondary text-sm"
              disabled={pendiente}
              onClick={() => {
                if (!window.confirm("¿Desconectar Correo Argentino? Se borran las credenciales guardadas.")) return;
                correr(disconnectCorreoAction, "Desconectando…");
              }}
            >
              Desconectar
            </button>
          </div>
        </div>
      ) : (
        <p className="fo-helper">
          Conectá tu cuenta de MiCorreo para cotizar con el precio de Correo Argentino y ofrecer envío a sucursal. Los
          datos de la API te los da Correo Argentino al darte de alta como cliente corporativo.
        </p>
      )}

      {verFormulario ? (
        <form
          ref={formRef}
          // `onSubmit` y no `action`: un error no tiene que borrar lo escrito.
          onSubmit={(e) => {
            e.preventDefault();
            const fd = new FormData(e.currentTarget);
            correr(
              () => connectCorreoAction(fd),
              "Conectando con Correo Argentino…",
              (r) => {
                if (r.ok) {
                  formRef.current?.reset();
                  setMostrarFormulario(false);
                }
              },
            );
          }}
          className="space-y-4"
          autoComplete="off"
        >
          <div className="fo-field-stack">
            <label className="fo-label" htmlFor="correo-env">
              Ambiente
            </label>
            <select
              id="correo-env"
              name="env"
              className="fo-input max-w-[16rem]"
              defaultValue={connection?.env ?? "PROD"}
            >
              <option value="PROD">Producción</option>
              <option value="TEST">Pruebas</option>
            </select>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <Campo id="correo-apiUser" name="apiUser" label="Usuario de la API" />
            <Campo id="correo-apiPassword" name="apiPassword" label="Contraseña de la API" password />
            <Campo id="correo-accountEmail" name="accountEmail" label="Email de MiCorreo" type="email" />
            <Campo id="correo-accountPassword" name="accountPassword" label="Contraseña de MiCorreo" password />
          </div>
          <p className="fo-helper">
            La contraseña de MiCorreo sólo se usa para obtener tu número de cliente: no se guarda. El usuario y la
            contraseña de la API se guardan cifrados.
          </p>
          <div className="flex flex-wrap gap-2">
            <button type="submit" className="fo-btn fo-btn-primary text-sm" disabled={pendiente}>
              {connection ? "Volver a conectar" : "Conectar"}
            </button>
            {activa ? (
              <button
                type="button"
                className="fo-btn fo-btn-secondary text-sm"
                onClick={() => setMostrarFormulario(false)}
                disabled={pendiente}
              >
                Cancelar
              </button>
            ) : null}
          </div>
        </form>
      ) : null}

      {pendiente ? <p className="text-sm text-[var(--fo-muted)]">{enCurso}</p> : null}
      <Resultado resultado={resultado} />
    </section>
  );
}

function Campo({
  id,
  name,
  label,
  type = "text",
  password = false,
}: {
  id: string;
  name: string;
  label: string;
  type?: string;
  password?: boolean;
}) {
  return (
    <div className="fo-field-stack">
      <label className="fo-label" htmlFor={id}>
        {label}
      </label>
      <input
        id={id}
        name={name}
        type={password ? "password" : type}
        className="fo-input"
        autoComplete={password ? "new-password" : "off"}
        maxLength={200}
      />
    </div>
  );
}
