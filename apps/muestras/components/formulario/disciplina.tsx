"use client";

import { useState } from "react";
import { DISCIPLINES, DISCIPLINE_LABELS, PHOTOGRAPHY, isDiscipline, parseOtherDisciplines, type Discipline } from "@repo/muestras";
import type { MarcaId } from "@/lib/marca";

const campo = "w-full rounded-[2px] border border-[var(--mf-line)] bg-white px-3 py-2";
const MAX_OTRAS = 5;

/**
 * Disciplina principal y secundarias de la muestra (Muestras de Arte, etapa 2).
 *
 * - En arte: la principal es un `select` obligatorio (sin elegir de entrada si es nueva).
 * - En fotografía: la principal viaja en un campo oculto (FOTOGRAFIA si es nueva) y se puede
 *   cambiar dentro de «Más opciones», cerrado de entrada: el formulario se ve como siempre.
 *
 * Si una muestra publicada de fotografía pasa a otra disciplina, se pide confirmar el cambio de
 * dominio (`confirmarCambioDeCasa`); el servidor exige lo mismo.
 */
export function CamposDeDisciplina({
  marca, guardada, otrasGuardadas, publicada,
}: { marca: MarcaId; guardada?: string | null; otrasGuardadas?: string[] | null; publicada: boolean }) {
  const inicial: Discipline | "" = isDiscipline(guardada) ? guardada : marca === "ARTE" && guardada == null ? "" : PHOTOGRAPHY;
  const [principal, setPrincipal] = useState<Discipline | "">(inicial);
  const [otras, setOtras] = useState<Discipline[]>(() => (inicial ? parseOtherDisciplines(otrasGuardadas ?? [], inicial) : []));
  const visibles = principal ? otras.filter((d) => d !== principal) : otras;
  // Sólo cambia de casa la que estaba guardada como fotografía (o es nueva, en fotografía).
  const eraFotografia = inicial === PHOTOGRAPHY;
  const vaAArte = principal !== "" && principal !== PHOTOGRAPHY;
  const pideConfirmar = publicada && eraFotografia && vaAArte;

  const elegir = (v: string) => setPrincipal(isDiscipline(v) ? v : "");
  const alternar = (d: Discipline, si: boolean) =>
    setOtras((p) => (si ? (p.includes(d) ? p : [...p, d]) : p.filter((x) => x !== d)));

  const secundarias = (
    <fieldset className="space-y-2">
      <legend className="text-[15px]">Otras disciplinas (optativo, hasta {MAX_OTRAS})</legend>
      <div className="grid gap-1 sm:grid-cols-2">
        {DISCIPLINES.filter((d) => d !== principal).map((d) => {
          const marcada = visibles.includes(d);
          return (
            <label key={d} className="flex items-center gap-2 text-[15px]">
              <input
                type="checkbox" name="otherDisciplines" value={d} checked={marcada}
                disabled={!marcada && visibles.length >= MAX_OTRAS}
                onChange={(e) => alternar(d, e.target.checked)}
              />
              {DISCIPLINE_LABELS[d]}
            </label>
          );
        })}
      </div>
    </fieldset>
  );

  const aviso = (vaAArte && (marca === "FOTOGRAFIA" || eraFotografia)) ? (
    <div role="status" className="space-y-2 rounded-[2px] bg-amber-50 p-3 text-sm text-amber-900">
      <p>Esta muestra va a vivir en muestrasdearte.com</p>
      {pideConfirmar ? (
        <label className="flex items-start gap-2">
          <input type="checkbox" name="confirmarCambioDeCasa" />
          Ya está publicada: confirmo que deja de verse en muestrasfotograficas.com y pasa a muestrasdearte.com.
        </label>
      ) : null}
    </div>
  ) : null;

  if (marca === "ARTE") {
    return (
      <div className="space-y-3">
        <label className="block">Disciplina principal
          <select name="primaryDiscipline" required className={campo} value={principal} onChange={(e) => elegir(e.target.value)}>
            <option value="" disabled>Elegí una disciplina</option>
            {DISCIPLINES.map((d) => <option key={d} value={d}>{DISCIPLINE_LABELS[d]}</option>)}
          </select>
        </label>
        {aviso}
        {secundarias}
      </div>
    );
  }

  return (
    <>
      <input type="hidden" name="primaryDiscipline" value={principal || PHOTOGRAPHY} />
      {/* Cerrado de entrada; abierto si la muestra ya es de otra disciplina, para que se vea. */}
      <details className="text-[15px]" open={inicial !== PHOTOGRAPHY}>
        <summary className="cursor-pointer underline underline-offset-4">Más opciones</summary>
        <div className="mt-3 space-y-3">
          <label className="block">Disciplina principal
            <select className={campo} value={principal || PHOTOGRAPHY} onChange={(e) => elegir(e.target.value)}>
              {DISCIPLINES.map((d) => <option key={d} value={d}>{DISCIPLINE_LABELS[d]}</option>)}
            </select>
          </label>
          {aviso}
          {secundarias}
        </div>
      </details>
    </>
  );
}
