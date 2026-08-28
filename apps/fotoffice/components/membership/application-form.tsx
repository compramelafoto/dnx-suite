"use client";

import { useActionState, useState } from "react";
import { PhotoGuide } from "./photo-guide";
import {
  submitApplicationAction,
  type ApplicationFormState,
} from "@/app/actions/membership-applications";

const initial: ApplicationFormState = { error: null, ok: null };

type Condicion = "PLENA" | "REDUCIDA" | "COLABORADOR";

export function MembershipApplicationForm({
  workspaceSlug,
  institutionName,
  monthlyAmountLabel,
  initialDuesCount,
}: {
  workspaceSlug: string;
  institutionName: string;
  /** Cuota mensual plena, ya formateada. */
  monthlyAmountLabel: string | null;
  initialDuesCount: number;
}) {
  const action = submitApplicationAction.bind(null, workspaceSlug);
  const [state, submit, pending] = useActionState(action, initial);
  const [quiereCarnet, setQuiereCarnet] = useState(false);
  const [condicion, setCondicion] = useState<Condicion>("PLENA");

  if (state.ok) {
    return (
      <div className="fo-card space-y-2 p-6">
        <h2 className="text-lg font-semibold">Solicitud enviada</h2>
        <p className="text-sm text-[var(--fo-muted)] leading-relaxed">{state.ok}</p>
      </div>
    );
  }

  return (
    <form action={submit} className="space-y-6">
      {/* La escala se declara con las palabras de la persona; el sistema la traduce. */}
      <input
        type="hidden"
        name="declaredFeeScale"
        value={condicion === "REDUCIDA" ? "REDUCIDA" : "PLENA"}
      />

      <section className="fo-card space-y-4 p-5">
        <h2 className="text-sm font-semibold">¿Quién sos?</h2>
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="fo-field-stack">
            <label className="fo-label" htmlFor="firstName">
              Nombre
            </label>
            <input id="firstName" name="firstName" className="fo-input" required maxLength={120} />
          </div>
          <div className="fo-field-stack">
            <label className="fo-label" htmlFor="lastName">
              Apellido
            </label>
            <input id="lastName" name="lastName" className="fo-input" required maxLength={120} />
          </div>
          <div className="fo-field-stack">
            <label className="fo-label" htmlFor="documentNumber">
              Documento
            </label>
            <input id="documentNumber" name="documentNumber" className="fo-input" maxLength={32} />
            <input type="hidden" name="documentType" value="DNI" />
          </div>
          <div className="fo-field-stack">
            <label className="fo-label" htmlFor="taxId">
              CUIT <span className="text-[var(--fo-muted-soft)]">(opcional)</span>
            </label>
            <input id="taxId" name="taxId" className="fo-input" maxLength={24} />
          </div>
          <div className="fo-field-stack">
            <label className="fo-label" htmlFor="birthDate">
              Fecha de nacimiento <span className="text-[var(--fo-muted-soft)]">(opcional)</span>
            </label>
            <input id="birthDate" name="birthDate" type="date" className="fo-input" />
          </div>
        </div>
      </section>

      <section className="fo-card space-y-4 p-5">
        <h2 className="text-sm font-semibold">¿Cómo te ubicamos?</h2>
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="fo-field-stack">
            <label className="fo-label" htmlFor="email">
              Email
            </label>
            <input id="email" name="email" type="email" className="fo-input" required />
          </div>
          <div className="fo-field-stack">
            <label className="fo-label" htmlFor="phone">
              Teléfono
            </label>
            <input id="phone" name="phone" className="fo-input" maxLength={40} />
          </div>
          <div className="fo-field-stack sm:col-span-2">
            <label className="fo-label" htmlFor="noticeAddress">
              Domicilio
            </label>
            <input
              id="noticeAddress"
              name="noticeAddress"
              className="fo-input"
              required
              maxLength={240}
            />
            <p className="fo-helper">
              Es el domicilio donde la institución te va a enviar las comunicaciones formales.
            </p>
          </div>
          <div className="fo-field-stack">
            <label className="fo-label" htmlFor="city">
              Ciudad
            </label>
            <input id="city" name="city" className="fo-input" maxLength={120} />
          </div>
          <div className="fo-field-stack">
            <label className="fo-label" htmlFor="province">
              Provincia
            </label>
            <input id="province" name="province" className="fo-input" maxLength={120} />
          </div>
          <div className="fo-field-stack">
            <label className="fo-label" htmlFor="postalCode">
              Código postal
            </label>
            <input id="postalCode" name="postalCode" className="fo-input" maxLength={20} />
          </div>
        </div>
      </section>

      <section className="fo-card space-y-4 p-5">
        <h2 className="text-sm font-semibold">¿Qué sos?</h2>
        <div className="space-y-2">
          {(
            [
              ["PLENA", "Profesional en ejercicio", "Cuota plena. Vota y puede integrar la comisión directiva."],
              ["REDUCIDA", "Estudiante", "Cuota con descuento, según el convenio vigente con tu institución. La Secretaría verifica tu condición antes de aplicarlo."],
              ["COLABORADOR", "Aficionado", "Aporte libre, con un mínimo. No vota."],
            ] as const
          ).map(([value, title, desc]) => (
            <label
              key={value}
              className={
                "flex cursor-pointer gap-3 rounded-lg border p-3 " +
                (condicion === value
                  ? "border-[var(--fo-accent,#1d4ed8)]"
                  : "border-[var(--fo-border)]")
              }
            >
              <input
                type="radio"
                name="condicion"
                value={value}
                checked={condicion === value}
                onChange={() => setCondicion(value)}
                className="mt-1"
              />
              <span>
                <span className="block text-sm font-medium">{title}</span>
                <span className="block text-xs text-[var(--fo-muted)]">{desc}</span>
              </span>
            </label>
          ))}
        </div>

        {condicion === "REDUCIDA" ? (
          <div className="fo-field-stack">
            <label className="fo-label" htmlFor="originInstitution">
              ¿De qué institución sos estudiante?
            </label>
            <input
              id="originInstitution"
              name="originInstitution"
              className="fo-input"
              required
              maxLength={200}
              placeholder="Escuela, terciario o universidad"
            />
            <p className="fo-helper">
              ⚠️ La cuota reducida queda sujeta a que la Secretaría confirme tu condición de
              estudiante. Si no se confirma, se te va a cobrar la cuota plena.
            </p>
          </div>
        ) : null}

        {condicion === "COLABORADOR" ? (
          <div className="fo-field-stack">
            <label className="fo-label" htmlFor="ownDuesAmount">
              ¿Con cuánto querés aportar por mes?
            </label>
            <input
              id="ownDuesAmount"
              name="ownDuesAmount"
              inputMode="decimal"
              className="fo-input"
              required
            />
            {monthlyAmountLabel ? (
              <p className="fo-helper">El mínimo es {monthlyAmountLabel} por mes.</p>
            ) : null}
          </div>
        ) : null}
      </section>

      {monthlyAmountLabel ? (
        <section className="fo-card space-y-1 p-5">
          <h2 className="text-sm font-semibold">Qué se paga al ingresar</h2>
          <p className="text-sm text-[var(--fo-muted)] leading-relaxed">
            Al aprobarse tu solicitud vas a pagar <strong>{initialDuesCount} cuotas</strong> por
            adelantado. Después seguís mes a mes, con vencimiento el día 10.
          </p>
          <p className="text-xs text-[var(--fo-muted)]">
            La cuota plena de {institutionName} es de {monthlyAmountLabel} por mes.
          </p>
        </section>
      ) : null}

      {/*
        Se pregunta acá y no después porque es una decisión de plata: quien se asocia tiene que
        poder sumar lo que va a pagar antes de enviar, no enterarse por una pantalla posterior.
        La foto no se pide en este formulario. El formulario es público y abrir la subida de
        archivos a internet solo para esto no compensa: se sube desde el portal, ya como socio.
      */}
      <section className="fo-card space-y-3 p-5">
        <h2 className="text-sm font-semibold">La credencial de socio</h2>
        <label className="flex items-start gap-3 text-sm leading-relaxed">
          <input
            type="checkbox"
            name="wantsPrintedCard"
            checked={quiereCarnet}
            onChange={(e) => setQuiereCarnet(e.target.checked)}
            className="mt-1 h-4 w-4 shrink-0"
          />
          <span>
            Quiero también la <strong>credencial impresa</strong>
            {monthlyAmountLabel ? (
              <>
                , que cuesta <strong>{monthlyAmountLabel}</strong> por única vez
              </>
            ) : null}
            .
          </span>
        </label>
        <p className="text-xs text-[var(--fo-muted)] leading-relaxed">
          La credencial digital la tenés siempre, sin costo, en tu portal de socio. La impresa es
          opcional y <strong>no se paga ahora</strong>: primero subís tu foto desde el portal y
          recién ahí la pedís y la abonás.
        </p>

        {/*
          Las instrucciones aparecen recién al pedir la credencial: a quien no la quiere, un
          instructivo de foto carnet solo le agrega ruido a un formulario que ya es largo.
        */}
        {quiereCarnet ? (
          <div className="space-y-2 rounded-lg border border-[var(--fo-border)] p-4">
            <p className="text-sm font-medium">La foto que vas a necesitar</p>
            <p className="text-xs text-[var(--fo-muted)] leading-relaxed">
              Es un <strong>archivo digital</strong> que vas a subir desde el portal. No hace
              falta imprimirla ni llevarla en papel: la credencial se imprime acá.
            </p>
            <PhotoGuide />

            <ul className="list-disc space-y-1 pl-5 text-xs text-[var(--fo-muted)] leading-relaxed">
              <li>
                <strong>Cuadrada</strong>, relación 1:1 — el equivalente digital del 4×4 cm.
              </li>
              <li>
                <strong>800 × 800 píxeles o más.</strong> El mínimo para que imprima bien es
                472 × 472, que es 4×4 cm a 300 DPI.
              </li>
              <li>JPG, PNG o WebP, hasta 3 MB.</li>
              <li><strong>Fondo blanco</strong>, liso y sin sombras.</li>
              <li>De frente, con la cara descubierta y centrada.</li>
              <li>Sin anteojos oscuros, sin gorra y sin filtros.</li>
              <li>Buena luz, sin reflejos y bien enfocada.</li>
            </ul>
            <p className="text-xs text-[var(--fo-muted)] leading-relaxed">
              <strong>No la subas ahora.</strong> Una vez que la Secretaría apruebe tu solicitud
              vas a poder cargarla desde tu portal de socio. Podés ir teniéndola lista.
            </p>
          </div>
        ) : null}
      </section>

      {state.error ? (
        <p className="text-sm text-[var(--fo-danger)]" role="alert">
          {state.error}
        </p>
      ) : null}

      <button type="submit" disabled={pending} className="fo-btn fo-btn-primary">
        {pending ? "Enviando…" : "Enviar solicitud"}
      </button>
      <p className="text-xs text-[var(--fo-muted)] leading-relaxed">
        Enviar la solicitud no te asocia todavía: la Secretaría la revisa y te avisa por email.
      </p>
    </form>
  );
}
