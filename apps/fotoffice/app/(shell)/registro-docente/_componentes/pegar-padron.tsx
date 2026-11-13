"use client";

import { useMemo, useState } from "react";
import { leerPadron } from "@/lib/registro-docente/padron";
import { pegarPadronAction } from "../actions";

/** Pegar el padrón desde Excel con vista previa antes de guardar. */
export function PegarPadron({ cursoId, abierto }: { cursoId: string; abierto: boolean }) {
  const [texto, setTexto] = useState("");
  const leido = useMemo(() => leerPadron(texto), [texto]);

  return (
    <details open={abierto} className="fo-card p-5">
      <summary className="cursor-pointer font-semibold">Pegar el padrón desde Excel</summary>
      <form action={pegarPadronAction} className="mt-3 space-y-3">
        <input type="hidden" name="cursoId" value={cursoId} />
        <p className="fo-helper">
          Copiá las columnas de la planilla (Excel, Google Sheets o la que bajás de Mi Escuela) y pegalas acá. Sirve con «Apellido» y «Nombre» separados o
          juntos («PÉREZ, Juan»), con o sin DNI. Se respeta el orden en que las pegues. Si alguien ya está en el curso, no se repite.
        </p>
        <textarea
          name="padron"
          value={texto}
          onChange={(e) => setTexto(e.target.value)}
          rows={8}
          className="fo-input w-full font-mono text-sm"
          placeholder={"Apellido\tNombre\tDNI\nGÓMEZ\tAna Laura\t45123456"}
        />
        {texto.trim() ? (
          <div className="space-y-2">
            <p className="text-sm">
              Se {leido.filas.length === 1 ? "leyó" : "leyeron"} <strong>{leido.filas.length}</strong> {leido.filas.length === 1 ? "estudiante" : "estudiantes"}.
            </p>
            {leido.avisos.map((a) => (
              <p key={a} className="fo-alert-warning text-sm">
                {a}
              </p>
            ))}
            <div className="max-h-72 overflow-auto rounded border border-[var(--fo-border)]">
              <table className="w-full text-sm">
                <thead className="bg-[var(--fo-surface-muted)] text-left">
                  <tr>
                    <th className="p-2">#</th>
                    <th className="p-2">Apellido</th>
                    <th className="p-2">Nombre</th>
                    <th className="p-2">DNI</th>
                    <th className="p-2">Cond.</th>
                  </tr>
                </thead>
                <tbody>
                  {leido.filas.map((f, i) => (
                    <tr key={f.renglon} className={f.revisar ? "bg-[var(--fo-warning-soft)]" : ""}>
                      <td className="p-2 text-[var(--fo-muted)]">{i + 1}</td>
                      <td className="p-2">{f.apellido}</td>
                      <td className="p-2">{f.nombre}</td>
                      <td className="p-2">{f.dni ?? "—"}</td>
                      <td className="p-2">{f.condicion}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        ) : null}
        <button className="fo-btn fo-btn-primary" disabled={!leido.filas.length}>
          Agregar {leido.filas.length || ""} al curso
        </button>
      </form>
    </details>
  );
}
