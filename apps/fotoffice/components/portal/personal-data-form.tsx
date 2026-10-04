"use client";

import { useActionState } from "react";
import {
  savePortalPersonalDataAction,
  type PortalPersonalDataState,
} from "@/app/actions/portal-personal-data";

const initial: PortalPersonalDataState = { error: null, ok: null };

export type DatosPersonalesDefaults = {
  firstName: string;
  lastName: string;
  documentType: string | null;
  documentNumber: string | null;
  email: string | null;
  phone: string | null;
  birthDate: Date | string | null;
  address: string | null;
  city: string | null;
  province: string | null;
  postalCode: string | null;
};

/** Los tipos que la institución usa de verdad. El resto entra por `extraTipoDocumento`. */
const TIPOS_DOCUMENTO = [
  { value: "DNI", label: "DNI" },
  { value: "CUIT", label: "CUIT / CUIL" },
  { value: "PASAPORTE", label: "Pasaporte" },
] as const;

/**
 * Una fecha de la ficha, en el formato que entiende un <input type="date">.
 *
 * Se lee en UTC, no en la zona del navegador: la ficha guarda el día, y leerlo en horario
 * argentino le restaría tres horas y mostraría el día anterior a todo el padrón.
 */
function aInputFecha(d: Date | string | null | undefined): string {
  if (!d) return "";
  const x = new Date(d);
  if (Number.isNaN(x.getTime())) return "";
  const pad = (v: number) => String(v).padStart(2, "0");
  return `${x.getUTCFullYear()}-${pad(x.getUTCMonth() + 1)}-${pad(x.getUTCDate())}`;
}

/**
 * Los datos personales del socio, editables por el propio socio.
 *
 * Todo lo que está acá es suyo y lo cambia sin pedir permiso. Lo que decide la institución
 * —número, categoría, estado, fecha de ingreso— se muestra aparte y en modo lectura: son
 * datos que el socio necesita ver (antes no los veía en ninguna parte) pero que no le
 * corresponde editar a él.
 */
export function PersonalDataForm({ defaults }: { defaults: DatosPersonalesDefaults }) {
  const [state, submit, pending] = useActionState(savePortalPersonalDataAction, initial);

  // El servidor devuelve un solo campo conflictivo por vez: se valida en orden y se corta en
  // el primero. Alcanza para señalar dónde mirar sin inventar un mapa de errores que la
  // acción no produce.
  const errorDe = (campo: string) => (state.field === campo ? state.error : null);

  const tipoGuardado = (defaults.documentType ?? "").trim().toUpperCase();
  const tipoEsConocido = TIPOS_DOCUMENTO.some((t) => t.value === tipoGuardado);
  // Un padrón migrado trae tipos que no están en la lista ("LIBRETA", "OTR"). Si no se
  // agregan como opción, abrir la pantalla y guardar se lo cambiaría en silencio.
  const extraTipoDocumento = tipoGuardado && !tipoEsConocido ? tipoGuardado : null;

  return (
    <form action={submit} className="space-y-4">
      <section className="fo-card space-y-5 p-5">
        <div className="space-y-1">
          <h2 className="text-sm font-semibold">Tus datos personales</h2>
          <p className="fo-helper">
            Son los que figuran en tu ficha y los que salen impresos en tu credencial.
            Actualizalos cuando quieras: queda registrado que el cambio lo hiciste vos.
          </p>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <Campo
            id="firstName"
            label="Nombre"
            required
            defaultValue={defaults.firstName}
            maxLength={100}
            autoComplete="given-name"
            error={errorDe("firstName")}
          />
          <Campo
            id="lastName"
            label="Apellido"
            required
            defaultValue={defaults.lastName}
            maxLength={100}
            autoComplete="family-name"
            error={errorDe("lastName")}
          />
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div className="fo-field-stack">
            <label className="fo-label" htmlFor="documentType">
              Tipo de documento
            </label>
            <select
              id="documentType"
              name="documentType"
              className="fo-input"
              defaultValue={tipoGuardado}
            >
              <option value="">Sin documento</option>
              {TIPOS_DOCUMENTO.map((t) => (
                <option key={t.value} value={t.value}>
                  {t.label}
                </option>
              ))}
              {extraTipoDocumento ? (
                <option value={extraTipoDocumento}>{extraTipoDocumento}</option>
              ) : null}
            </select>
          </div>
          <Campo
            id="documentNumber"
            label="Número de documento"
            defaultValue={defaults.documentNumber ?? ""}
            maxLength={60}
            inputMode="numeric"
            helper="Sin puntos ni guiones."
            error={errorDe("documentNumber")}
          />
        </div>

        <div className="sm:max-w-xs">
          <Campo
            id="birthDate"
            label="Fecha de nacimiento"
            type="date"
            defaultValue={aInputFecha(defaults.birthDate)}
            autoComplete="bday"
            error={errorDe("birthDate")}
          />
        </div>
      </section>

      <section className="fo-card space-y-5 p-5">
        <div className="space-y-1">
          <h2 className="text-sm font-semibold">Cómo te contactamos</h2>
          <p className="fo-helper">
            Acá llegan los avisos de la institución y los de tus cuotas. No se publican nunca.
          </p>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <Campo
            id="email"
            label="Email"
            type="email"
            defaultValue={defaults.email ?? ""}
            maxLength={200}
            autoComplete="email"
            helper="Es la dirección a la que te escribe la institución. Tu forma de iniciar sesión no cambia."
            error={errorDe("email")}
          />
          <Campo
            id="phone"
            label="Teléfono"
            type="tel"
            defaultValue={defaults.phone ?? ""}
            maxLength={60}
            autoComplete="tel"
            error={errorDe("phone")}
          />
        </div>
      </section>

      <section className="fo-card space-y-5 p-5">
        <div className="space-y-1">
          <h2 className="text-sm font-semibold">Tu domicilio</h2>
          <p className="fo-helper">
            Se usa para lo que haya que mandarte. Tampoco se publica.
          </p>
        </div>

        <Campo
          id="address"
          label="Dirección"
          defaultValue={defaults.address ?? ""}
          maxLength={200}
          autoComplete="street-address"
          placeholder="Calle y número"
          error={errorDe("address")}
        />
        <div className="grid gap-4 sm:grid-cols-3">
          <Campo
            id="city"
            label="Ciudad"
            defaultValue={defaults.city ?? ""}
            maxLength={120}
            autoComplete="address-level2"
            error={errorDe("city")}
          />
          <Campo
            id="province"
            label="Provincia"
            defaultValue={defaults.province ?? ""}
            maxLength={120}
            autoComplete="address-level1"
            error={errorDe("province")}
          />
          <Campo
            id="postalCode"
            label="Código postal"
            defaultValue={defaults.postalCode ?? ""}
            maxLength={20}
            autoComplete="postal-code"
            error={errorDe("postalCode")}
          />
        </div>
      </section>

      {/* El error sin campo asociado no tiene dónde apoyarse arriba: se muestra acá. */}
      {state.error && !state.field ? (
        <p className="text-sm text-[var(--fo-danger)]" role="alert">
          {state.error}
        </p>
      ) : null}
      {state.error && state.field ? (
        <p className="text-sm text-[var(--fo-danger)]" role="alert">
          Revisá el campo marcado más arriba.
        </p>
      ) : null}
      {state.ok ? (
        <p className="text-sm text-[var(--fo-success)]" role="status">
          {state.ok}
        </p>
      ) : null}

      <button type="submit" disabled={pending} className="fo-btn fo-btn-primary text-sm">
        {pending ? "Guardando…" : "Guardar mis datos"}
      </button>
    </form>
  );
}

function Campo({
  id,
  label,
  error,
  helper,
  ...input
}: {
  id: string;
  label: string;
  error?: string | null;
  helper?: string;
} & React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <div className="fo-field-stack">
      <label className="fo-label" htmlFor={id}>
        {label}
      </label>
      <input
        id={id}
        name={id}
        className="fo-input"
        aria-invalid={error ? true : undefined}
        aria-describedby={error ? `${id}-error` : undefined}
        {...input}
      />
      {helper ? <p className="fo-helper">{helper}</p> : null}
      {error ? (
        <p id={`${id}-error`} className="text-xs text-[var(--fo-danger)]">
          {error}
        </p>
      ) : null}
    </div>
  );
}
