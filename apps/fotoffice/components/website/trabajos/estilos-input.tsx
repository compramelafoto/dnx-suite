"use client";

import { useId, useState } from "react";
import { X } from "lucide-react";
import { MAX_ESTILOS, MAX_LARGO_ESTILO, normalizarEstilos } from "@/lib/portfolio-estudio/reglas";

/**
 * Los estilos de un trabajo como fichas: se agregan con Enter o coma (o eligiendo una sugerencia
 * del rubro) y se quitan con ×. Los topes y los repetidos los resuelve `normalizarEstilos`.
 */
export function EstilosInput({
  valor,
  sugerencias,
  onChange,
}: {
  valor: string[];
  sugerencias: string[];
  onChange: (v: string[]) => void;
}) {
  const [texto, setTexto] = useState("");
  const lista = useId();
  const lleno = valor.length >= MAX_ESTILOS;

  function agregar(t: string) {
    if (!t.trim()) return;
    // Si ya existe en el rubro con otras mayúsculas, se usa esa forma para no partir el grupo.
    const clave = t.replace(/\s+/g, " ").trim().toLocaleLowerCase("es");
    const existente = sugerencias.find((s) => s.toLocaleLowerCase("es") === clave);
    onChange(normalizarEstilos([...valor, existente ?? t]));
    setTexto("");
  }

  const disponibles = sugerencias.filter((s) => !valor.some((v) => v.toLocaleLowerCase("es") === s.toLocaleLowerCase("es")));

  return (
    <div className="space-y-2">
      {valor.length > 0 ? (
        <ul className="flex flex-wrap gap-1.5">
          {valor.map((e) => (
            <li key={e} className="flex items-center gap-1 rounded-full border border-[var(--fo-border)] bg-[var(--fo-bg-elevated)] py-0.5 pl-2.5 pr-1 text-xs">
              {e}
              <button
                type="button"
                aria-label={`Quitar ${e}`}
                className="rounded-full p-0.5 text-[var(--fo-muted)] hover:text-[var(--fo-text)]"
                onClick={() => onChange(valor.filter((x) => x !== e))}
              >
                <X className="h-3 w-3" />
              </button>
            </li>
          ))}
        </ul>
      ) : null}
      <input
        value={texto}
        list={lista}
        disabled={lleno}
        maxLength={MAX_LARGO_ESTILO}
        placeholder={lleno ? `Máximo ${MAX_ESTILOS} estilos` : "Book previo, Fiesta, Sesión temática…"}
        className="fo-input"
        onChange={(e) => {
          const v = e.target.value;
          if (v.endsWith(",")) agregar(v.slice(0, -1));
          else if (disponibles.includes(v)) agregar(v);
          else setTexto(v);
        }}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            e.preventDefault();
            agregar(texto);
          }
        }}
        onBlur={() => agregar(texto)}
      />
      <datalist id={lista}>
        {disponibles.map((s) => (
          <option key={s} value={s} />
        ))}
      </datalist>
      <p className="text-xs text-[var(--fo-muted)]">Enter o coma para agregar. Puede tener varios.</p>
    </div>
  );
}
