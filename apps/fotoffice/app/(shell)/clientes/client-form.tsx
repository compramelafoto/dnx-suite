"use client";

import { useState } from "react";
import { saveClientAction } from "./actions";
import {
  CLIENT_KINDS,
  CLIENT_STATUSES,
  DOC_TYPES,
  IVA_CONDITION_LABELS,
  IVA_CONDITIONS,
  type ClientKind,
} from "@/lib/clients/constants";

type ClientRecord = {
  id: string;
  kind: string;
  firstName: string | null;
  lastName: string | null;
  businessName: string | null;
  docType: string | null;
  docNumber: string | null;
  ivaCondition: string;
  email: string | null;
  phone: string | null;
  address: string | null;
  city: string | null;
  notes: string | null;
  status: string;
};

const STATUS_LABELS: Record<string, string> = {
  ACTIVO: "Activo",
  INACTIVO: "Inactivo",
};

/**
 * Alta y edición de un cliente.
 *
 * El único motivo para correr en el navegador es el selector Persona/Empresa: según lo que
 * se elija cambia si se pide nombre y apellido o razón social, y mostrar los tres juntos
 * confunde más de lo que ahorra. La validación de verdad no se movió de
 * `lib/clients/client-form.ts`.
 */
export function ClientForm({ client, error }: { client: ClientRecord | null; error?: string }) {
  const [kind, setKind] = useState<ClientKind>((client?.kind as ClientKind) ?? "PERSONA");

  return (
    <form action={saveClientAction} className="space-y-6">
      {client ? <input type="hidden" name="clientId" value={client.id} /> : null}

      {error ? (
        <p className="fo-card p-4 text-sm text-[var(--fo-danger)]" role="alert">
          {error}
        </p>
      ) : null}

      <section className="fo-card space-y-4 p-5">
        <h2 className="text-base font-semibold">Identidad</h2>
        <div className="fo-field-stack">
          <label className="fo-label" htmlFor="kind">
            Tipo
          </label>
          <select
            id="kind"
            name="kind"
            className="fo-input"
            value={kind}
            onChange={(e) => setKind(e.target.value as ClientKind)}
          >
            {CLIENT_KINDS.map((k) => (
              <option key={k} value={k}>
                {k === "PERSONA" ? "Persona" : "Empresa"}
              </option>
            ))}
          </select>
        </div>

        {kind === "EMPRESA" ? (
          <div className="fo-field-stack">
            <label className="fo-label" htmlFor="businessName">
              Razón social
            </label>
            <input
              id="businessName"
              name="businessName"
              className="fo-input"
              defaultValue={client?.businessName ?? ""}
              required
            />
          </div>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="fo-field-stack">
              <label className="fo-label" htmlFor="firstName">
                Nombre
              </label>
              <input
                id="firstName"
                name="firstName"
                className="fo-input"
                defaultValue={client?.firstName ?? ""}
              />
            </div>
            <div className="fo-field-stack">
              <label className="fo-label" htmlFor="lastName">
                Apellido
              </label>
              <input
                id="lastName"
                name="lastName"
                className="fo-input"
                defaultValue={client?.lastName ?? ""}
              />
            </div>
          </div>
        )}
        {/* El campo del tipo que no se muestra igual viaja vacío: si alguien pasa de
            Empresa a Persona, la razón social vieja no tiene que quedar pegada atrás. */}
      </section>

      <section className="fo-card space-y-4 p-5">
        <h2 className="text-base font-semibold">Datos fiscales</h2>
        <div className="grid gap-4 sm:grid-cols-3">
          <div className="fo-field-stack">
            <label className="fo-label" htmlFor="docType">
              Tipo de documento
            </label>
            <select
              id="docType"
              name="docType"
              className="fo-input"
              defaultValue={client?.docType ?? ""}
            >
              <option value="">Sin documento</option>
              {DOC_TYPES.map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </select>
          </div>
          <div className="fo-field-stack">
            <label className="fo-label" htmlFor="docNumber">
              Número de documento
            </label>
            <input
              id="docNumber"
              name="docNumber"
              className="fo-input"
              defaultValue={client?.docNumber ?? ""}
              placeholder="20-12345678-9"
            />
          </div>
          <div className="fo-field-stack">
            <label className="fo-label" htmlFor="ivaCondition">
              Condición frente al IVA
            </label>
            <select
              id="ivaCondition"
              name="ivaCondition"
              className="fo-input"
              defaultValue={client?.ivaCondition ?? "CONSUMIDOR_FINAL"}
            >
              {IVA_CONDITIONS.map((c) => (
                <option key={c} value={c}>
                  {IVA_CONDITION_LABELS[c]}
                </option>
              ))}
            </select>
          </div>
        </div>
        <p className="fo-helper">
          Un responsable inscripto necesita CUIT: sin eso no se le va a poder facturar.
        </p>
      </section>

      <section className="fo-card space-y-4 p-5">
        <h2 className="text-base font-semibold">Contacto</h2>
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="fo-field-stack">
            <label className="fo-label" htmlFor="email">
              Correo
            </label>
            <input
              id="email"
              name="email"
              type="email"
              className="fo-input"
              defaultValue={client?.email ?? ""}
            />
          </div>
          <div className="fo-field-stack">
            <label className="fo-label" htmlFor="phone">
              Teléfono
            </label>
            <input
              id="phone"
              name="phone"
              className="fo-input"
              defaultValue={client?.phone ?? ""}
            />
          </div>
          <div className="fo-field-stack">
            <label className="fo-label" htmlFor="address">
              Dirección
            </label>
            <input
              id="address"
              name="address"
              className="fo-input"
              defaultValue={client?.address ?? ""}
            />
          </div>
          <div className="fo-field-stack">
            <label className="fo-label" htmlFor="city">
              Ciudad
            </label>
            <input
              id="city"
              name="city"
              className="fo-input"
              defaultValue={client?.city ?? ""}
            />
          </div>
        </div>
      </section>

      <section className="fo-card space-y-4 p-5">
        <h2 className="text-base font-semibold">Notas y estado</h2>
        <div className="fo-field-stack">
          <label className="fo-label" htmlFor="notes">
            Notas internas
          </label>
          <textarea
            id="notes"
            name="notes"
            rows={3}
            className="fo-input"
            defaultValue={client?.notes ?? ""}
          />
          <p className="fo-helper">Sólo la ve el equipo. El cliente nunca la lee.</p>
        </div>
        <div className="fo-field-stack sm:max-w-xs">
          <label className="fo-label" htmlFor="status">
            Estado
          </label>
          <select
            id="status"
            name="status"
            className="fo-input"
            defaultValue={client?.status ?? "ACTIVO"}
          >
            {CLIENT_STATUSES.map((s) => (
              <option key={s} value={s}>
                {STATUS_LABELS[s]}
              </option>
            ))}
          </select>
        </div>
      </section>

      <div className="fo-form-actions">
        <button type="submit" className="fo-btn fo-btn-primary text-sm">
          {client ? "Guardar cambios" : "Crear cliente"}
        </button>
      </div>
    </form>
  );
}
