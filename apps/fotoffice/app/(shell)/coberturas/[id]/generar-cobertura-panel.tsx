"use client";

import { useActionState, useId, useState } from "react";
import { coordenadasLegibles, enlaceDeMapa } from "@/lib/geocode/lugar";
import { crearCoberturaAction, type GenerarCoberturaState } from "../actions";

const inicial: GenerarCoberturaState = { error: null, ok: null };

type RolForm = { name: string; vacancies: number };

/**
 * El bloque para generar una cobertura desde una solicitud aprobada.
 *
 * Los valores por omisión (`sugerido`, `rolesSugeridos`) los calcula el servidor con
 * `sugerirCobertura` y `sugerirRoles` (ver `lib/coverages/generar-cobertura.ts`) y llegan como
 * props: es la misma lista que se guarda si la coordinación no toca nada. Acá solo se permite
 * agregar y quitar filas de rol antes de mandar el formulario — la validación real, incluido el
 * permiso, vuelve a pasar en `crearCoberturaAction` en el servidor.
 *
 * **Dice que está prellenado y de dónde sale.** Antes el formulario aparecía completo, sin
 * explicar que esos datos venían de la solicitud: quien coordinaba no sabía si estaba mirando
 * algo ya guardado o una propuesta que podía cambiar.
 */
export function GenerarCoberturaPanel({
  requestId,
  sugerido,
  rolesSugeridos,
  yaHayCoberturas,
}: {
  requestId: string;
  sugerido: {
    title: string;
    startsAt: string;
    endsAt: string;
    addressLine: string;
    city: string;
    /** El punto que marcó la organización en el formulario. `null` si no marcó ninguno. */
    latitude: number | null;
    longitude: number | null;
  };
  rolesSugeridos: RolForm[];
  /** Cambia el texto, no la regla: generar la segunda cobertura de un pedido es lo mismo. */
  yaHayCoberturas?: boolean;
}) {
  const [state, crear, creando] = useActionState(crearCoberturaAction, inicial);
  const [roles, setRoles] = useState<RolForm[]>(
    rolesSugeridos.length > 0 ? rolesSugeridos : [{ name: "", vacancies: 1 }],
  );
  const idBase = useId();

  function actualizarRol(i: number, cambios: Partial<RolForm>) {
    setRoles((actual) => actual.map((r, j) => (j === i ? { ...r, ...cambios } : r)));
  }

  return (
    <section className="fo-card space-y-5 p-5">
      <div className="space-y-1">
        <h2 className="text-base font-semibold">
          {yaHayCoberturas ? "Generar otra cobertura" : "Generar la cobertura"}
        </h2>
        <p className="fo-helper">
          {yaHayCoberturas
            ? "La solicitud sigue aprobada: una jornada de dos turnos son dos coberturas del mismo pedido."
            : "La cobertura es el trabajo concreto que se va a cubrir. Está prellenada con lo que pidió la organización: cambiá lo que haga falta antes de generarla."}
        </p>
      </div>

      {state.error ? (
        <p
          role="alert"
          className="fo-alert-error rounded-[var(--fo-radius-sm)] p-3 text-sm leading-relaxed text-[var(--fo-danger)]"
        >
          {state.error}
        </p>
      ) : null}

      <form action={crear} className="space-y-5">
        <input type="hidden" name="requestId" value={requestId} />

        <div className="grid gap-4 sm:grid-cols-2">
          <label className="fo-field-stack sm:col-span-2">
            <span className="fo-label">Título</span>
            <input name="title" defaultValue={sugerido.title} required className="fo-input" />
          </label>
          <label className="fo-field-stack">
            <span className="fo-label">Empieza</span>
            <input
              type="datetime-local"
              name="startsAt"
              defaultValue={sugerido.startsAt}
              required
              className="fo-input"
            />
          </label>
          <label className="fo-field-stack">
            <span className="fo-label">Termina</span>
            <input
              type="datetime-local"
              name="endsAt"
              defaultValue={sugerido.endsAt}
              required
              className="fo-input"
            />
          </label>
          <label className="fo-field-stack">
            <span className="fo-label">Dirección</span>
            <input name="addressLine" defaultValue={sugerido.addressLine} className="fo-input" />
          </label>
          <label className="fo-field-stack">
            <span className="fo-label">Ciudad</span>
            <input name="city" defaultValue={sugerido.city} className="fo-input" />
          </label>
          <div className="sm:col-span-2">
            <PuntoDelLugar latitude={sugerido.latitude} longitude={sugerido.longitude} />
          </div>
          <label className="fo-field-stack sm:col-span-2">
            <span className="fo-label">Instrucciones</span>
            <span className="fo-helper">
              Lo que quien vaya tiene que saber del día: dónde entrar, con quién hablar, qué no se
              puede fotografiar.
            </span>
            <textarea name="instructions" rows={2} className="fo-input" />
          </label>
        </div>

        <div className="space-y-3 border-t border-[var(--fo-border)] pt-4">
          <div className="space-y-1">
            <span className="fo-label">Roles y vacantes</span>
            <p className="fo-helper">
              Cuántas personas hacen falta y para qué. Son los lugares a los que después se anota
              o se invita a alguien.
            </p>
          </div>

          <ul className="space-y-2">
            {roles.map((r, i) => (
              <li key={i} className="flex flex-wrap items-end gap-2">
                <div className="fo-field-stack min-w-[12rem] flex-1">
                  <label className="fo-label text-xs" htmlFor={`${idBase}-rol-${i}`}>
                    Rol
                  </label>
                  <input
                    id={`${idBase}-rol-${i}`}
                    name="roleName"
                    value={r.name}
                    onChange={(e) => actualizarRol(i, { name: e.target.value })}
                    placeholder="Fotografía, video, drone…"
                    required
                    className="fo-input"
                  />
                </div>
                <div className="fo-field-stack w-24">
                  <label className="fo-label text-xs" htmlFor={`${idBase}-cupo-${i}`}>
                    Personas
                  </label>
                  <input
                    id={`${idBase}-cupo-${i}`}
                    type="number"
                    name="roleVacancies"
                    min={1}
                    value={r.vacancies}
                    onChange={(e) => actualizarRol(i, { vacancies: Number(e.target.value) })}
                    className="fo-input"
                  />
                </div>
                <button
                  type="button"
                  onClick={() => setRoles((actual) => actual.filter((_, j) => j !== i))}
                  disabled={roles.length <= 1}
                  className="fo-btn fo-btn-ghost min-h-11 text-sm"
                >
                  Quitar
                </button>
              </li>
            ))}
          </ul>

          <button
            type="button"
            onClick={() => setRoles((actual) => [...actual, { name: "", vacancies: 1 }])}
            className="fo-btn fo-btn-secondary min-h-11 text-sm"
          >
            Agregar otro rol
          </button>
        </div>

        <div className="space-y-2 border-t border-[var(--fo-border)] pt-4">
          <button
            type="submit"
            className="fo-btn fo-btn-primary min-h-12 w-full text-base sm:w-auto"
            disabled={creando}
          >
            {creando ? "Generando…" : "Generar la cobertura"}
          </button>
          <p className="fo-helper">
            Te lleva a la cobertura recién creada, donde se arma la convocatoria y el equipo.
            Todavía no se le avisa a nadie.
          </p>
        </div>
      </form>
    </section>
  );
}

/**
 * El punto que marcó la organización, y que viaja con la cobertura.
 *
 * No es un campo editable: acá se decide si el punto se copia o no. Corregirlo con un mapa sería
 * otra pantalla —la coordinación no estuvo en el lugar; la organización sí—. Lo que sí puede
 * hacer quien coordina es **descartarlo**, para el caso en que el pin haya quedado
 * evidentemente mal y sea peor tenerlo que no tenerlo.
 *
 * Los dos campos ocultos son lo único que viaja. La acción los revalida con la misma función del
 * DNX GEO ENGINE que el formulario público: un oculto es tan editable como cualquier otro campo.
 */
function PuntoDelLugar({
  latitude,
  longitude,
}: {
  latitude: number | null;
  longitude: number | null;
}) {
  const [conservar, setConservar] = useState(true);
  const hayPunto = latitude != null && longitude != null;

  if (!hayPunto) {
    return (
      <p className="fo-helper">
        La organización no marcó ningún punto en el mapa. Quien vaya llega con la dirección
        escrita.
      </p>
    );
  }

  return (
    <div className="space-y-2 rounded-[var(--fo-radius-sm)] border border-[var(--fo-border)] bg-[var(--fo-surface-muted)] p-3">
      {conservar ? (
        <>
          <input type="hidden" name="latitude" value={String(latitude)} />
          <input type="hidden" name="longitude" value={String(longitude)} />
        </>
      ) : null}
      <p className="text-sm leading-relaxed">
        <span className="font-medium">
          {conservar ? "El punto del mapa viaja con la cobertura." : "El punto quedó descartado."}
        </span>{" "}
        <span className="text-[var(--fo-muted)] tabular-nums">
          {coordenadasLegibles(latitude, longitude)}
        </span>
      </p>
      <div className="flex flex-wrap items-center gap-2">
        <a
          href={enlaceDeMapa(latitude, longitude)}
          target="_blank"
          rel="noopener noreferrer"
          className="fo-btn fo-btn-secondary min-h-11 text-sm"
        >
          Ver dónde cae
        </a>
        <button
          type="button"
          onClick={() => setConservar((c) => !c)}
          className="fo-btn fo-btn-ghost min-h-11 text-sm"
        >
          {conservar ? "Descartar el punto" : "Volver a usarlo"}
        </button>
      </div>
    </div>
  );
}
