"use client";

import { useState } from "react";
import {
  alumnosParaCorregir,
  mismoNombre,
  nombreCompleto,
  type CambioDeNombre,
} from "@/lib/design-v2/corregir-nombres";

/**
 * En el canje: la familia corrige un nombre mal escrito del listado del curso. El cambio va sólo en
 * su librito; al fotógrafo le llega un aviso para corregirlo también en los demás.
 */
export default function CorregirNombreDelListado({
  valoresSinCorregir,
  cambios,
  onCambios,
  fotografo,
}: {
  /** Los textos del librito antes de las correcciones de nombres (con los cursos ya sumados). */
  valoresSinCorregir: Record<string, string>;
  cambios: CambioDeNombre[];
  onCambios: (cambios: CambioDeNombre[]) => void;
  fotografo: string;
}) {
  const grupos = alumnosParaCorregir(valoresSinCorregir);
  const alumnos = grupos.flatMap((g, gi) => g.students.map((s, si) => ({ ...s, curso: g.title, clave: `${gi}-${si}` })));
  const [abierto, setAbierto] = useState(false);
  const [elegido, setElegido] = useState("");
  const [nombre, setNombre] = useState("");
  const [apellido, setApellido] = useState("");

  if (alumnos.length === 0) return null;

  const alumno = alumnos.find((a) => a.clave === elegido) ?? null;

  function elegir(clave: string) {
    setElegido(clave);
    const a = alumnos.find((x) => x.clave === clave);
    const previo = a ? cambios.find((c) => mismoNombre(c.de, a)) : null;
    setNombre(previo?.a.firstName ?? a?.firstName ?? "");
    setApellido(previo?.a.lastName ?? a?.lastName ?? "");
  }

  function aplicar() {
    if (!alumno || !nombre.trim() || !apellido.trim()) return;
    const de = { firstName: alumno.firstName, lastName: alumno.lastName };
    const a = { firstName: nombre.trim().replace(/\s+/g, " "), lastName: apellido.trim().replace(/\s+/g, " ") };
    const otros = cambios.filter((c) => !mismoNombre(c.de, de));
    const igual = a.firstName === de.firstName && a.lastName === de.lastName;
    onCambios(igual ? otros : [...otros, { de, a }]);
    setAbierto(false);
    setElegido("");
  }

  const input =
    "min-h-11 w-full rounded-lg border border-[#d8d0c7] px-3 text-base focus:border-[#c27b3d] focus:outline-none";

  return (
    <div className="mt-3">
      {cambios.length > 0 ? (
        <ul className="m-0 mb-2 list-none space-y-1 p-0">
          {cambios.map((c) => (
            <li
              key={nombreCompleto(c.de)}
              className="flex items-start justify-between gap-2 rounded-lg bg-[#eef6f1] px-3 py-2 text-sm text-[#1f5c42]"
            >
              <span>
                Corregiste «{nombreCompleto(c.de)}» → <strong>«{nombreCompleto(c.a)}»</strong>
              </span>
              <button
                type="button"
                className="shrink-0 text-xs font-medium underline"
                onClick={() => onCambios(cambios.filter((x) => x !== c))}
              >
                Deshacer
              </button>
            </li>
          ))}
        </ul>
      ) : null}

      {abierto ? (
        <div className="rounded-xl border border-[#efeae4] p-3">
          <label className="block">
            <span className="mb-1 block text-sm text-[#4b4f56]">¿Qué nombre está mal escrito?</span>
            <select className={input} value={elegido} onChange={(e) => elegir(e.target.value)}>
              <option value="">Elegí el alumno</option>
              {grupos.map((g, gi) => (
                <optgroup key={gi} label={g.title || "Listado"}>
                  {g.students.map((s, si) => (
                    <option key={si} value={`${gi}-${si}`}>
                      {nombreCompleto(s)}
                    </option>
                  ))}
                </optgroup>
              ))}
            </select>
          </label>
          {alumno ? (
            <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
              <label className="block">
                <span className="mb-1 block text-sm text-[#4b4f56]">Nombre</span>
                <input className={input} value={nombre} maxLength={100} onChange={(e) => setNombre(e.target.value)} />
              </label>
              <label className="block">
                <span className="mb-1 block text-sm text-[#4b4f56]">Apellido</span>
                <input className={input} value={apellido} maxLength={100} onChange={(e) => setApellido(e.target.value)} />
              </label>
            </div>
          ) : null}
          <div className="mt-3 flex gap-3">
            <button
              type="button"
              disabled={!alumno || !nombre.trim() || !apellido.trim()}
              onClick={aplicar}
              className="min-h-11 rounded-lg bg-[#c27b3d] px-4 text-sm font-semibold text-white disabled:bg-[#c9c3bc]"
            >
              Corregir
            </button>
            <button
              type="button"
              onClick={() => {
                setAbierto(false);
                setElegido("");
              }}
              className="min-h-11 px-2 text-sm text-[#6b6f76] underline"
            >
              Cancelar
            </button>
          </div>
          <p className="m-0 mt-2 text-xs text-[#6b6f76]">
            Se corrige en tu librito. Le avisamos a {fotografo} para que lo corrija también en los de los demás.
          </p>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => setAbierto(true)}
          className="min-h-11 rounded-lg border border-[#c27b3d] px-4 text-sm font-semibold text-[#a8652e]"
        >
          Corregir un nombre mal escrito
        </button>
      )}
    </div>
  );
}
