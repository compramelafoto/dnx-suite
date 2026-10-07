"use client";

import { useRouter } from "next/navigation";
import { useId, useState, useTransition } from "react";
import { Plus } from "lucide-react";
import { altaRapidaAction } from "@/app/actions/consultas";
import { marcaDeCampo, type CampoConError } from "@/lib/consultas/formulario";
import { AvisosConsulta, type AvisosVista } from "./avisos-consulta";

const MENSAJE_FALLA = "No se pudo guardar la consulta. Probá de nuevo.";

/**
 * Alta rápida en la primera columna del tablero (spec §3.1): nombre, teléfono o correo, y
 * categoría. El resto se completa en la ficha. Al guardar, el tablero se vuelve a cargar.
 */
export function AltaRapida({ categorias }: { categorias: { id: string; nombre: string }[] }) {
  const router = useRouter();
  const [pendiente, iniciar] = useTransition();
  const [abierta, setAbierta] = useState(false);
  const [nombre, setNombre] = useState("");
  const [dato, setDato] = useState("");
  const [categoriaId, setCategoriaId] = useState(categorias[0]?.id ?? "");
  const [error, setError] = useState<{ mensaje: string; campo?: CampoConError } | null>(null);
  const idError = useId();
  const marca = (c: CampoConError | readonly CampoConError[]) => marcaDeCampo(error, c, idError);
  const [avisos, setAvisos] = useState<AvisosVista | null>(null);
  const [estado, setEstado] = useState("");

  if (!abierta) {
    return (
      <div className="space-y-2">
        <button type="button" className="fo-btn fo-btn-ghost w-full justify-start text-xs" onClick={() => setAbierta(true)}>
          <Plus className="size-4" aria-hidden="true" /> Alta rápida
        </button>
        {estado ? (
          <p role="status" className="px-1 text-xs text-[var(--fo-success)]">
            {estado}
          </p>
        ) : null}
        {avisos ? <AvisosConsulta avisos={avisos} /> : null}
      </div>
    );
  }

  function guardar() {
    setError(null);
    if (!nombre.trim()) {
      setError({ mensaje: "Escribí el nombre.", campo: "nombre" });
      return;
    }
    if (!dato.trim()) {
      setError({ mensaje: "Escribí un teléfono o un correo.", campo: "telefonoOCorreo" });
      return;
    }
    if (!categoriaId) {
      setError({ mensaje: "Elegí una categoría.", campo: "categoria" });
      return;
    }
    iniciar(async () => {
      try {
        const r = await altaRapidaAction({ nombre, telefonoOCorreo: dato, categoriaId });
        if (!r.ok) {
          setError({ mensaje: r.error, campo: r.campo });
          return;
        }
        const hay =
          (r.avisos.fechaSuperpuesta?.length ?? 0) > 0 || (r.avisos.duplicados?.length ?? 0) > 0 || r.avisos.posibleDuplicado === true;
        setAvisos(hay ? r.avisos : null);
        setEstado(`Consulta de ${nombre.trim()} cargada.`);
        setNombre("");
        setDato("");
        setAbierta(false);
        router.refresh();
      } catch {
        setError({ mensaje: MENSAJE_FALLA });
      }
    });
  }

  return (
    <form
      className="space-y-2 rounded-lg border border-[var(--fo-border)] bg-[var(--fo-surface)] p-2 text-sm"
      aria-label="Alta rápida de una consulta"
      onSubmit={(e) => {
        e.preventDefault();
        guardar();
      }}
    >
      <fieldset className="space-y-2" disabled={pendiente}>
        <input className="fo-input" placeholder="Nombre" aria-label="Nombre" maxLength={200} {...marca(["nombre", "contacto"])} value={nombre} onChange={(e) => setNombre(e.target.value)} />
        <input
          className="fo-input"
          placeholder="Teléfono o correo"
          aria-label="Teléfono o correo"
          maxLength={254}
          {...marca(["telefonoOCorreo", "email", "telefono"])}
          value={dato}
          onChange={(e) => setDato(e.target.value)}
        />
        <select className="fo-input" aria-label="Categoría" {...marca("categoria")} value={categoriaId} onChange={(e) => setCategoriaId(e.target.value)}>
          {categorias.map((c) => (
            <option key={c.id} value={c.id}>
              {c.nombre}
            </option>
          ))}
        </select>
        {error ? (
          <p id={idError} role="alert" className="text-xs text-[var(--fo-danger)]">
            {error.mensaje}
          </p>
        ) : null}
        <div className="flex gap-2">
          <button type="submit" className="fo-btn fo-btn-primary text-xs">
            {pendiente ? "Guardando…" : "Agregar"}
          </button>
          <button type="button" className="fo-btn fo-btn-secondary text-xs" onClick={() => setAbierta(false)}>
            Cancelar
          </button>
        </div>
      </fieldset>
    </form>
  );
}
