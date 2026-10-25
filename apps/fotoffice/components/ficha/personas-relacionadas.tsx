"use client";

import { useId, useState, useTransition } from "react";
import Link from "next/link";
import { Plus, Trash2 } from "lucide-react";
import { borrarRelacionAction } from "@/app/actions/ficha";
import { NuevaRelacion } from "./nueva-relacion";
import type { PersonaFicha, RelacionVista } from "./tipos";

/** Las personas vinculadas con esta (familia, pareja, proveedor…), con alta y baja del vínculo. */
export function PersonasRelacionadas({
  persona,
  nombre,
  relaciones,
  palabraSocio = "socio",
}: {
  persona: PersonaFicha;
  /** Nombre de esta persona, para la pregunta del vínculo. */
  nombre: string;
  relaciones: RelacionVista[];
  palabraSocio?: string;
}) {
  const id = useId();
  const [agregando, setAgregando] = useState(false);
  const [confirmando, setConfirmando] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pendiente, iniciar] = useTransition();

  function borrar(relacionId: string) {
    setError(null);
    iniciar(async () => {
      const r = await borrarRelacionAction(persona, relacionId);
      if (!r.ok) setError(r.error);
      setConfirmando(null);
    });
  }

  return (
    <section className="fo-card space-y-3 p-4" aria-labelledby={`${id}-titulo`}>
      <div className="flex items-center justify-between gap-2">
        <h2 id={`${id}-titulo`} className="text-sm font-semibold">
          Personas relacionadas
        </h2>
        {agregando ? null : (
          <button type="button" className="fo-btn fo-btn-ghost !min-h-8 text-xs" onClick={() => setAgregando(true)}>
            <Plus className="size-3.5" aria-hidden />
            Agregar
          </button>
        )}
      </div>

      {relaciones.length === 0 && !agregando ? (
        <p className="text-sm text-[var(--fo-muted)]">Sin personas relacionadas.</p>
      ) : null}

      {relaciones.length > 0 ? (
        <ul className="divide-y divide-[var(--fo-border)]">
          {relaciones.map((r) => (
            <li key={r.id} className="py-2 text-sm">
              <div className="flex items-start gap-2">
                <div className="min-w-0 flex-1">
                  <Link href={r.otra.href} className="font-medium text-[var(--fo-text)] hover:underline">
                    {r.otra.nombre}
                  </Link>
                  <p className="text-xs text-[var(--fo-muted)]">
                    {r.etiqueta}
                    {r.otra.tipo === "SOCIO" ? ` · ${palabraSocio}` : ""}
                  </p>
                  {r.nota ? <p className="mt-0.5 text-xs text-[var(--fo-text-secondary)]">{r.nota}</p> : null}
                </div>
                <button
                  type="button"
                  className="fo-icon-btn fo-icon-btn-danger"
                  onClick={() => setConfirmando(r.id)}
                  disabled={pendiente}
                  aria-label={`Quitar el vínculo con ${r.otra.nombre}`}
                  title="Quitar vínculo"
                >
                  <Trash2 className="size-4" />
                </button>
              </div>
              {confirmando === r.id ? (
                <div className="mt-2 flex flex-wrap items-center justify-end gap-2 text-xs" role="group" aria-label="Confirmar">
                  <span>¿Quitar el vínculo con {r.otra.nombre}? La persona no se borra.</span>
                  <button type="button" className="fo-btn fo-btn-ghost text-xs" onClick={() => setConfirmando(null)} disabled={pendiente}>
                    Cancelar
                  </button>
                  <button type="button" className="fo-btn fo-btn-danger text-xs" onClick={() => borrar(r.id)} disabled={pendiente}>
                    Quitar
                  </button>
                </div>
              ) : null}
            </li>
          ))}
        </ul>
      ) : null}

      {agregando ? (
        <NuevaRelacion persona={persona} nombre={nombre} palabraSocio={palabraSocio} alTerminar={() => setAgregando(false)} />
      ) : null}

      {error ? (
        <p role="alert" className="text-sm text-[var(--fo-danger)]">
          {error}
        </p>
      ) : null}
    </section>
  );
}
