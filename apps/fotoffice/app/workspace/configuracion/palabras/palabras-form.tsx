"use client";

import { useActionState, useState } from "react";
import type { FraseDeEjemplo } from "@/lib/vocabulario/ejemplos";
import { DEFAULT_PERSON_TERMS, personVocabulary } from "@/lib/vocabulario/personas";
import { aplicarVocabulario } from "@/lib/vocabulario/plantilla";
import { PALABRA_MAX } from "@/lib/vocabulario/validacion";
import { updatePersonWordsAction, type PalabrasState } from "./actions";

/**
 * Las dos palabras, y cómo va a quedar el sistema con ellas.
 *
 * Los campos son controlados —y no `defaultValue` como en el resto de la configuración— por
 * una sola razón: la vista previa. Alguien que escribe "voluntario" tiene que leer "Todos los
 * voluntarios, su estado y su ficha" **antes** de guardar, no descubrirlo al abrir el menú.
 *
 * La vista previa usa exactamente las mismas funciones que las pantallas de verdad
 * (`personVocabulary` + `aplicarVocabulario`) sobre los mismos textos del catálogo de
 * módulos. No es una imitación de lo que va a pasar: es lo que va a pasar.
 *
 * `required` no aparece en ningún campo a propósito. La validación es del servidor; el HTML
 * no controla nada que llegue por POST directo.
 */
export function PalabrasForm({
  canEdit,
  ejemplos,
  initial,
}: {
  canEdit: boolean;
  ejemplos: FraseDeEjemplo[];
  initial: { singular: string; plural: string };
}) {
  const [state, action, pending] = useActionState(
    updatePersonWordsAction,
    undefined as PalabrasState | undefined,
  );
  const [singular, setSingular] = useState(initial.singular);
  const [plural, setPlural] = useState(initial.plural);

  const vocabulario = personVocabulary({ singular, plural });
  const sinConfigurar = !singular.trim() && !plural.trim();

  return (
    <form action={action} className="space-y-6">
      <fieldset disabled={!canEdit} className="fo-card space-y-5 border-0 p-5">
        <legend className="px-1 text-sm font-semibold">Cómo les decís acá</legend>
        <Palabra
          label="Una sola persona"
          name="personSingular"
          value={singular}
          onChange={setSingular}
          placeholder={DEFAULT_PERSON_TERMS.singular}
          helper="Como lo diría una frase del sistema: “la ficha del …”."
        />
        <Palabra
          label="Varias personas"
          name="personPlural"
          value={plural}
          onChange={setPlural}
          placeholder={DEFAULT_PERSON_TERMS.plural}
          helper="Como lo diría una frase del sistema: “el padrón de …”."
        />
        <p className="text-xs leading-relaxed text-[var(--fo-muted)]">
          Las mayúsculas se resuelven solas: escribís la palabra una vez y el sistema la usa
          con mayúscula donde corresponde. Dejando los dos campos vacíos y guardando, todo
          vuelve a decir {DEFAULT_PERSON_TERMS.singular} y {DEFAULT_PERSON_TERMS.plural}.
        </p>
      </fieldset>

      <section className="fo-card space-y-4 p-5" aria-live="polite">
        <h2 className="text-sm font-semibold">Cómo va a quedar</h2>
        {sinConfigurar ? (
          <p className="text-xs leading-relaxed text-[var(--fo-muted)]">
            Así se lee hoy, sin nada configurado.
          </p>
        ) : null}
        <ul className="space-y-3">
          {ejemplos.map((frase) => (
            <li key={frase.donde} className="space-y-1">
              <span className="block text-xs text-[var(--fo-muted-soft)]">{frase.donde}</span>
              <span className="block text-sm leading-relaxed text-[var(--fo-text)]">
                {aplicarVocabulario(frase.plantilla, vocabulario)}
              </span>
            </li>
          ))}
        </ul>
      </section>

      {/*
        Qué NO cambia. Va junto a la vista previa y no en una ayuda escondida: una expectativa
        mal puesta acá se descubre tarde —cuando alguien abre un correo viejo o un texto legal
        y sigue leyendo la palabra anterior— y para entonces ya molesta.
      */}
      <section className="fo-card space-y-2 p-5">
        <h2 className="text-sm font-semibold">Qué no cambia</h2>
        <ul className="list-disc space-y-1 pl-5 text-xs leading-relaxed text-[var(--fo-muted)]">
          <li>Los textos legales (términos, privacidad) y los avisos de la plataforma.</li>
          <li>Los correos que ya se enviaron: quedan como se enviaron.</li>
          <li>
            El nombre del módulo en la lista general de FotoOffice, que es la misma para todas
            las instituciones.
          </li>
          <li>
            Lo que alguien escribió a mano —notas, motivos de baja, textos cargados en el
            sitio— no se reescribe.
          </li>
        </ul>
      </section>

      {state?.error ? (
        <p role="alert" className="text-sm text-[var(--fo-danger)]">
          {state.error}
        </p>
      ) : null}
      {state?.ok ? <p className="text-sm text-[var(--fo-success)]">Guardado.</p> : null}

      {canEdit ? (
        <button type="submit" className="fo-btn fo-btn-primary min-h-11" disabled={pending}>
          {pending ? "Guardando…" : "Guardar palabras"}
        </button>
      ) : null}
    </form>
  );
}

function Palabra({
  label,
  name,
  value,
  onChange,
  placeholder,
  helper,
}: {
  label: string;
  name: string;
  value: string;
  onChange: (v: string) => void;
  placeholder: string;
  helper: string;
}) {
  return (
    <label className="block space-y-2">
      <span className="text-sm font-medium">{label}</span>
      <input
        name={name}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        maxLength={PALABRA_MAX}
        autoComplete="off"
        className="w-full min-h-11 rounded-xl border border-[var(--fo-border)] bg-[var(--fo-bg)] px-4 py-3 text-sm"
      />
      <span className="block text-xs leading-relaxed text-[var(--fo-muted)]">{helper}</span>
    </label>
  );
}
