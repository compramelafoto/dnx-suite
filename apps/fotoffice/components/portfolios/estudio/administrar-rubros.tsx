"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { borrarRubroAction, crearRubroAction, editarRubroAction, moverRubroAction, type AccionRubro } from "@/app/actions/portfolio-estudio";
import { MAX_ENLACES, MAX_NOMBRE_RUBRO, MAX_TITULO_ENLACE, type Enlace, type Rubro } from "@/lib/portfolio-estudio/reglas";

/** Crear, renombrar, ordenar y borrar rubros, y cargar sus presentaciones de venta (MANAGE). */
export function AdministrarRubros({ rubros }: { rubros: Rubro[] }) {
  const [nuevo, setNuevo] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pendiente, empezar] = useTransition();
  const router = useRouter();

  function correr(fn: () => Promise<AccionRubro>, despues?: () => void) {
    setError(null);
    empezar(async () => {
      const r = await fn();
      if (!r.ok) {
        setError(r.error);
        return;
      }
      despues?.();
      router.refresh();
    });
  }

  return (
    <details className="fo-card">
      <summary className="cursor-pointer text-sm font-medium">Administrar rubros</summary>
      <div className="mt-4 space-y-4">
        {error ? <p className="fo-alert-error text-sm">{error}</p> : null}
        <ul className="space-y-3">
          {rubros.map((r, i) => (
            <FilaRubro
              key={r.id}
              rubro={r}
              primero={i === 0}
              ultimo={i === rubros.length - 1}
              pendiente={pendiente}
              correr={correr}
            />
          ))}
        </ul>
        <form
          className="flex flex-wrap gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            correr(() => crearRubroAction(nuevo), () => setNuevo(""));
          }}
        >
          <input
            value={nuevo}
            onChange={(e) => setNuevo(e.target.value)}
            maxLength={MAX_NOMBRE_RUBRO}
            placeholder="Nuevo rubro (por ejemplo, Sesiones infantiles)"
            className="fo-input min-w-0 flex-1"
            aria-label="Nombre del rubro nuevo"
          />
          <button type="submit" className="fo-btn fo-btn-primary" disabled={pendiente || !nuevo.trim()}>
            Agregar rubro
          </button>
        </form>
      </div>
    </details>
  );
}

function FilaRubro({
  rubro,
  primero,
  ultimo,
  pendiente,
  correr,
}: {
  rubro: Rubro;
  primero: boolean;
  ultimo: boolean;
  pendiente: boolean;
  correr: (fn: () => Promise<AccionRubro>, despues?: () => void) => void;
}) {
  const [nombre, setNombre] = useState(rubro.nombre);
  const [enlaces, setEnlaces] = useState<Enlace[]>(rubro.enlaces);
  const [confirmando, setConfirmando] = useState(false);
  const cambiado = nombre.trim() !== rubro.nombre || JSON.stringify(enlaces) !== JSON.stringify(rubro.enlaces);

  return (
    <li className="space-y-2 rounded-[var(--fo-radius)] border border-[var(--fo-border)] p-3">
      <div className="flex flex-wrap items-center gap-2">
        <input value={nombre} onChange={(e) => setNombre(e.target.value)} maxLength={MAX_NOMBRE_RUBRO} className="fo-input min-w-0 flex-1" aria-label="Nombre del rubro" />
        <button type="button" className="fo-btn fo-btn-ghost text-xs" disabled={pendiente || primero} onClick={() => correr(() => moverRubroAction(rubro.id, -1))} aria-label={`Subir ${rubro.nombre}`}>
          ↑
        </button>
        <button type="button" className="fo-btn fo-btn-ghost text-xs" disabled={pendiente || ultimo} onClick={() => correr(() => moverRubroAction(rubro.id, 1))} aria-label={`Bajar ${rubro.nombre}`}>
          ↓
        </button>
        {confirmando ? (
          <span className="fo-alert-warning flex flex-wrap items-center gap-2 text-xs">
            Los trabajos de este rubro quedan sin etiquetar.
            <button type="button" className="fo-btn fo-btn-danger text-xs" disabled={pendiente} onClick={() => correr(() => borrarRubroAction(rubro.id))}>
              Sí, borrar
            </button>
            <button type="button" className="fo-btn fo-btn-ghost text-xs" onClick={() => setConfirmando(false)}>
              No
            </button>
          </span>
        ) : (
          <button type="button" className="fo-btn fo-btn-danger-outline text-xs" onClick={() => setConfirmando(true)}>
            Borrar
          </button>
        )}
      </div>

      <div className="space-y-2 pl-1">
        <p className="text-xs text-[var(--fo-muted)]">Presentaciones de venta (enlaces que empiezan con https://)</p>
        {enlaces.map((e, i) => (
          <div key={i} className="flex flex-wrap gap-2">
            <input
              value={e.titulo}
              onChange={(ev) => setEnlaces(enlaces.map((x, j) => (j === i ? { ...x, titulo: ev.target.value } : x)))}
              maxLength={MAX_TITULO_ENLACE}
              placeholder="Título"
              className="fo-input w-full sm:w-48"
              aria-label="Título de la presentación"
            />
            <input
              value={e.url}
              onChange={(ev) => setEnlaces(enlaces.map((x, j) => (j === i ? { ...x, url: ev.target.value } : x)))}
              placeholder="https://…"
              className="fo-input min-w-0 flex-1"
              aria-label="Enlace de la presentación"
            />
            <button type="button" className="fo-btn fo-btn-ghost text-xs" onClick={() => setEnlaces(enlaces.filter((_, j) => j !== i))}>
              Quitar
            </button>
          </div>
        ))}
        <div className="flex flex-wrap gap-2">
          {enlaces.length < MAX_ENLACES ? (
            <button type="button" className="fo-btn fo-btn-secondary text-xs" onClick={() => setEnlaces([...enlaces, { titulo: "", url: "" }])}>
              Agregar presentación
            </button>
          ) : null}
          {cambiado ? (
            <button type="button" className="fo-btn fo-btn-primary text-xs" disabled={pendiente} onClick={() => correr(() => editarRubroAction(rubro.id, { nombre, enlaces }))}>
              Guardar cambios
            </button>
          ) : null}
        </div>
      </div>
    </li>
  );
}
