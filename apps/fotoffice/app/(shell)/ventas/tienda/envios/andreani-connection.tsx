"use client";

import { useRef, useState, useTransition } from "react";
import {
  connectAndreaniAction,
  disconnectAndreaniAction,
  testAndreaniConnectionAction,
  type ShippingActionResult,
} from "./actions";
import { ANDREANI_TEST_MODE_WARNING } from "@/lib/store/shipping/order-destination";
import { Resultado } from "./shipping-settings-form";

/**
 * Conexión con Andreani. Mismo molde que la de Correo Argentino: la contraseña nunca viene
 * precargada ni vuelve del servidor; la pantalla sólo recibe estado, ambiente, el usuario y los
 * códigos enmascarados (y la sucursal de origen, que es un dato público).
 */

export type AndreaniConnectionView = {
  status: "ACTIVE" | "REVOKED" | "NEEDS_RECONSENT";
  env: "QA" | "PROD" | null;
  userMasked: string;
  clientCodeMasked: string | null;
  contractHomeMasked: string | null;
  contractBranchMasked: string | null;
  originBranch: string | null;
};

export function AndreaniConnectionCard({
  connection,
  originPostalCode,
}: {
  connection: AndreaniConnectionView | null;
  /** El CP de origen guardado: es el CP de prueba por defecto. */
  originPostalCode: string | null;
}) {
  const [resultado, setResultado] = useState<ShippingActionResult | null>(null);
  const [pendiente, startTransition] = useTransition();
  const formRef = useRef<HTMLFormElement>(null);
  const activa = connection?.status === "ACTIVE";
  // Sin conexión activa el formulario se muestra siempre; con conexión, a pedido.
  const [mostrarFormulario, setMostrarFormulario] = useState(false);
  const verFormulario = !activa || mostrarFormulario;
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

  const datos = connection
    ? [
        `Usuario ${connection.userMasked}`,
        connection.clientCodeMasked ? `Cliente ${connection.clientCodeMasked}` : "",
        connection.env ? (connection.env === "PROD" ? "Producción" : "Pruebas") : "",
      ].filter(Boolean)
    : [];
  const contratos = connection
    ? [
        connection.contractHomeMasked ? `Domicilio ${connection.contractHomeMasked}` : "",
        connection.contractBranchMasked ? `Sucursal ${connection.contractBranchMasked}` : "Sin contrato de sucursal",
        connection.originBranch ? `Sucursal de origen ${connection.originBranch}` : "",
      ].filter(Boolean)
    : [];

  return (
    <section className="fo-card space-y-4 p-5">
      <h2 className="text-base font-semibold">Andreani</h2>

      {connection ? (
        <div className="space-y-1 text-sm">
          <p>
            Estado:{" "}
            {activa ? (
              <span className="text-[var(--fo-success)]">conectado</span>
            ) : (
              <span className="text-[var(--fo-danger)]">Andreani dejó de aceptar las credenciales, volvé a conectar</span>
            )}
          </p>
          <p className="text-[var(--fo-muted)]">{datos.join(" · ")}</p>
          <p className="text-[var(--fo-muted)]">Contratos: {contratos.join(" · ")}</p>
          {connection.env === "QA" ? (
            <p role="status" className="font-medium text-[var(--fo-danger)]">
              {ANDREANI_TEST_MODE_WARNING}
            </p>
          ) : null}
          <div className="flex flex-wrap gap-2 pt-2">
            {activa ? (
              <button
                type="button"
                className="fo-btn fo-btn-secondary text-sm"
                disabled={pendiente}
                onClick={() => correr(testAndreaniConnectionAction, "Probando con Andreani…")}
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
                if (!window.confirm("¿Desconectar Andreani? Se borran las credenciales guardadas.")) return;
                correr(disconnectAndreaniAction, "Desconectando…");
              }}
            >
              Desconectar
            </button>
          </div>
        </div>
      ) : (
        <p className="fo-helper">
          Conectá tu cuenta de Andreani para cotizar con el precio de Andreani y ofrecer envío a sus sucursales. El
          usuario, la contraseña, el código de cliente y los contratos te los da tu ejecutivo de cuenta de Andreani.
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
              () => connectAndreaniAction(fd),
              "Conectando con Andreani…",
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
            <label className="fo-label" htmlFor="andreani-env">
              Ambiente
            </label>
            <select
              id="andreani-env"
              name="env"
              className="fo-input max-w-[16rem]"
              defaultValue={connection?.env ?? "PROD"}
            >
              <option value="PROD">Producción</option>
              <option value="QA">Pruebas</option>
            </select>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <Campo id="andreani-user" name="user" label="Usuario" />
            <Campo id="andreani-password" name="password" label="Contraseña" password />
            <Campo id="andreani-clientCode" name="clientCode" label="Código de cliente" />
            <Campo id="andreani-contractHome" name="contractHome" label="Contrato de envío a domicilio" />
            <Campo id="andreani-contractBranch" name="contractBranch" label="Contrato de envío a sucursal (opcional)" />
            <Campo id="andreani-originBranch" name="originBranch" label="Sucursal de origen (opcional)" />
            <Campo
              id="andreani-testPostalCode"
              name="testPostalCode"
              label="Código postal de prueba"
              defaultValue={originPostalCode ?? ""}
              placeholder="2000"
            />
          </div>
          <p className="fo-helper">
            Al conectar hacemos una cotización de prueba a ese código postal para confirmar el código de cliente y el
            contrato. Sin contrato de sucursal, sólo se puede enviar a domicilio. Todo se guarda cifrado.
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
  password = false,
  defaultValue,
  placeholder,
}: {
  id: string;
  name: string;
  label: string;
  password?: boolean;
  defaultValue?: string;
  placeholder?: string;
}) {
  return (
    <div className="fo-field-stack">
      <label className="fo-label" htmlFor={id}>
        {label}
      </label>
      <input
        id={id}
        name={name}
        type={password ? "password" : "text"}
        className="fo-input"
        autoComplete={password ? "new-password" : "off"}
        maxLength={200}
        defaultValue={defaultValue}
        placeholder={placeholder}
      />
    </div>
  );
}
