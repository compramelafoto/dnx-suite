"use client";

import { useMemo, useState } from "react";
import Button from "@/components/ui/Button";
import Card from "@/components/ui/Card";
import type { DesignV2Data } from "@/lib/design-v2/design-data";
import { alumnosParaCorregir, type CambioDeNombre, type NombreDeAlumno } from "@/lib/design-v2/corregir-nombres";

type Fila = { clave: string; curso: string; esElAlumno: boolean; de: NombreDeAlumno };

function filasDelLibrito(values: Record<string, string>): Fila[] {
  const filas: Fila[] = [];
  alumnosParaCorregir(values).forEach((g, gi) =>
    g.students.forEach((s, si) =>
      filas.push({
        clave: `${gi}-${si}`,
        curso: g.title,
        esElAlumno: s.isOwner,
        de: { firstName: s.firstName, lastName: s.lastName },
      }),
    ),
  );
  // Un librito sin listado igual tiene el nombre de la tapa.
  const first = values["student.firstName"] ?? "";
  const last = values["student.lastName"] ?? "";
  if ((first || last) && !filas.some((f) => f.esElAlumno)) {
    filas.unshift({ clave: "alumno", curso: "", esElAlumno: true, de: { firstName: first, lastName: last } });
  }
  return filas;
}

/**
 * «Corregir nombres»: el fotógrafo arregla un nombre mal escrito (de la tapa o del listado del
 * curso) y elige si el cambio va sólo en este librito o en todos los del álbum.
 */
export default function CorregirNombresPanel({
  designId,
  values,
  beforeSave,
  onSaved,
}: {
  designId: string;
  values: Record<string, string>;
  beforeSave: () => Promise<boolean>;
  onSaved: (data: DesignV2Data, status: string | null) => void;
}) {
  const filas = useMemo(() => filasDelLibrito(values), [values]);
  const [abierto, setAbierto] = useState(false);
  const [editados, setEditados] = useState<Record<string, NombreDeAlumno>>({});
  const [alcance, setAlcance] = useState<"este" | "todos">("todos");
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hecho, setHecho] = useState<string | null>(null);
  const [buscar, setBuscar] = useState("");

  if (filas.length === 0) return null;

  const cambios: CambioDeNombre[] = filas.flatMap((f) => {
    const a = editados[f.clave];
    if (!a) return [];
    const nuevo = { firstName: a.firstName.trim(), lastName: a.lastName.trim() };
    return nuevo.firstName !== f.de.firstName || nuevo.lastName !== f.de.lastName ? [{ de: f.de, a: nuevo }] : [];
  });
  const incompleto = cambios.some((c) => !c.a.firstName || !c.a.lastName);
  const q = buscar.trim().toLocaleLowerCase("es");
  const visibles = q
    ? filas.filter((f) => `${f.de.firstName} ${f.de.lastName}`.toLocaleLowerCase("es").includes(q))
    : filas;

  function cerrar() {
    setAbierto(false);
    setEditados({});
    setError(null);
    setBuscar("");
  }

  async function guardar() {
    setGuardando(true);
    setError(null);
    setHecho(null);
    try {
      if (!(await beforeSave())) return;
      const res = await fetch(`/api/fotografo/disenos/${designId}/nombres`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ cambios, alcance }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok || !body.ok) throw new Error(body.error || "No se pudieron corregir los nombres.");
      onSaved(body.data, body.status ?? null);
      const partes = [
        alcance === "todos"
          ? `Corregido en ${body.disenos} ${body.disenos === 1 ? "librito" : "libritos"}`
          : "Corregido en este librito",
      ];
      if (body.padron > 0) partes.push("y en la lista del colegio");
      let texto = `${partes.join(" ")}.`;
      if (body.volvieronARevision > 0) {
        texto += ` ${body.volvieronARevision} ${body.volvieronARevision === 1 ? "estaba aprobado y volvió" : "estaban aprobados y volvieron"} a revisión: hay que aprobarlos de nuevo.`;
      }
      setHecho(texto);
      cerrar();
    } catch (e) {
      setError(e instanceof Error ? e.message : "No se pudieron corregir los nombres.");
    } finally {
      setGuardando(false);
    }
  }

  return (
    <Card className="mt-4 p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <p className="text-sm font-semibold text-[#111827]">Nombres</p>
          <p className="text-xs text-[#6b7280]">¿Hay un nombre mal escrito en la tapa o en el listado? Corregilo acá.</p>
        </div>
        {!abierto ? (
          <Button size="sm" variant="secondary" onClick={() => { setAbierto(true); setHecho(null); }}>
            Corregir nombres
          </Button>
        ) : null}
      </div>
      {hecho ? (
        <p role="status" className="mt-2 rounded-lg bg-emerald-50 px-3 py-2 text-sm text-emerald-900">
          {hecho}
        </p>
      ) : null}

      {abierto ? (
        <div className="mt-3">
          {filas.length > 8 ? (
            <input
              type="search"
              placeholder="Buscar un alumno"
              value={buscar}
              onChange={(e) => setBuscar(e.target.value)}
              className="mb-2 w-full rounded-lg border border-[#d1d5db] px-3 py-2 text-sm"
            />
          ) : null}
          <div className="max-h-96 overflow-y-auto rounded-lg border border-[#e5e7eb]">
            <table className="w-full text-sm">
              <thead className="sticky top-0 bg-[#f9fafb] text-left text-xs text-[#6b7280]">
                <tr>
                  <th className="px-3 py-2 font-medium">Nombre</th>
                  <th className="px-3 py-2 font-medium">Apellido</th>
                </tr>
              </thead>
              <tbody>
                {visibles.map((f, i) => {
                  const actual = editados[f.clave] ?? f.de;
                  const cambiado = actual.firstName !== f.de.firstName || actual.lastName !== f.de.lastName;
                  const cursoNuevo = f.curso && (i === 0 || visibles[i - 1]?.curso !== f.curso);
                  return (
                    <FilaDeNombre
                      key={f.clave}
                      curso={cursoNuevo ? f.curso : null}
                      esElAlumno={f.esElAlumno}
                      valor={actual}
                      cambiado={cambiado}
                      onChange={(v) => setEditados((prev) => ({ ...prev, [f.clave]: v }))}
                    />
                  );
                })}
              </tbody>
            </table>
          </div>

          <fieldset className="mt-3 space-y-1">
            <legend className="text-xs font-medium text-[#374151]">¿Dónde aplico la corrección?</legend>
            <label className="flex items-start gap-2 text-sm text-[#111827]">
              <input type="radio" className="mt-1" checked={alcance === "todos"} onChange={() => setAlcance("todos")} />
              <span>
                En todos los libritos del álbum <span className="text-[#6b7280]">(y en la lista del colegio, para los canjes que vienen)</span>
              </span>
            </label>
            <label className="flex items-start gap-2 text-sm text-[#111827]">
              <input type="radio" className="mt-1" checked={alcance === "este"} onChange={() => setAlcance("este")} />
              <span>Sólo en este librito</span>
            </label>
          </fieldset>
          <p className="mt-2 text-xs text-[#6b7280]">
            Los libritos que ya estaban aprobados vuelven a revisión. Los que se mandaron a imprimir no se tocan.
          </p>

          {error ? <p className="mt-2 text-sm text-red-700">{error}</p> : null}
          <div className="mt-3 flex gap-2">
            <Button size="sm" variant="primary" onClick={() => void guardar()} disabled={guardando || cambios.length === 0 || incompleto}>
              {guardando ? "Guardando…" : cambios.length > 1 ? `Guardar ${cambios.length} correcciones` : "Guardar corrección"}
            </Button>
            <Button size="sm" variant="secondary" onClick={cerrar} disabled={guardando}>
              Cancelar
            </Button>
          </div>
          {incompleto ? <p className="mt-1 text-xs text-red-700">Cada alumno necesita nombre y apellido.</p> : null}
        </div>
      ) : null}
    </Card>
  );
}

function FilaDeNombre({
  curso,
  esElAlumno,
  valor,
  cambiado,
  onChange,
}: {
  curso: string | null;
  esElAlumno: boolean;
  valor: NombreDeAlumno;
  cambiado: boolean;
  onChange: (v: NombreDeAlumno) => void;
}) {
  const input = `w-full rounded border px-2 py-1 text-sm ${cambiado ? "border-amber-400 bg-amber-50" : "border-[#e5e7eb]"}`;
  return (
    <>
      {curso ? (
        <tr>
          <td colSpan={2} className="bg-[#f3f4f6] px-3 py-1 text-xs font-semibold text-[#374151]">
            {curso}
          </td>
        </tr>
      ) : null}
      <tr className="border-t border-[#f3f4f6]">
        <td className="px-3 py-1">
          <input
            aria-label="Nombre"
            className={input}
            value={valor.firstName}
            maxLength={100}
            onChange={(e) => onChange({ ...valor, firstName: e.target.value })}
          />
        </td>
        <td className="px-3 py-1">
          <div className="flex items-center gap-2">
            <input
              aria-label="Apellido"
              className={input}
              value={valor.lastName}
              maxLength={100}
              onChange={(e) => onChange({ ...valor, lastName: e.target.value })}
            />
            {esElAlumno ? <span className="shrink-0 text-xs font-semibold text-[#6b7280]">Este librito</span> : null}
          </div>
        </td>
      </tr>
    </>
  );
}
