"use client";

import { useRouter } from "next/navigation";
import { useId, useState, useTransition } from "react";
import { crearPresupuestoAction } from "@/app/actions/presupuestos";
import { SelectorContacto, type ContactoElegido } from "@/components/consultas/selector-contacto";

type Opcion = { id: string; etiqueta: string };

/**
 * "Nuevo presupuesto" (spec §3.2): de una consulta del workspace o, sin consulta, creando una con
 * un contacto existente y su categoría (el alta de siempre, MANUAL). Crea el borrador y abre el
 * editor. Todas las reglas las vuelve a mirar el servidor.
 */
export function NuevoPresupuesto({
  consultas,
  consultaInicial,
  categorias,
  puedeCrearConsulta,
  contactoInicial,
}: {
  consultas: Opcion[];
  consultaInicial: string | null;
  categorias: { id: string; nombre: string }[];
  /** "Gestionar" en Consultas y "Ver" en Clientes. */
  puedeCrearConsulta: boolean;
  contactoInicial: ContactoElegido | null;
}) {
  const router = useRouter();
  const id = useId();
  const [pendiente, iniciar] = useTransition();
  const [modo, setModo] = useState<"consulta" | "nueva">(consultas.length > 0 || !puedeCrearConsulta ? "consulta" : "nueva");
  const [consulta, setConsulta] = useState(consultaInicial ?? consultas[0]?.id ?? "");
  const [contacto, setContacto] = useState<ContactoElegido | null>(contactoInicial);
  const [categoria, setCategoria] = useState(categorias[0]?.id ?? "");
  const [error, setError] = useState<string | null>(null);

  function crear() {
    setError(null);
    iniciar(async () => {
      const datos =
        modo === "consulta"
          ? { consultaLeadId: consulta || null }
          : { nuevaConsulta: contacto ? { contacto: { clientId: contacto.id }, categoriaId: categoria } : null };
      const r = await crearPresupuestoAction(datos).catch(() => ({ ok: false as const, error: "No se pudo crear el presupuesto. Probá de nuevo." }));
      if (r.ok) router.push(`/presupuestos/${encodeURIComponent(r.presupuestoId)}`);
      else setError(r.error);
    });
  }

  return (
    <section className="fo-card max-w-2xl space-y-4">
      {puedeCrearConsulta && consultas.length > 0 ? (
        <fieldset className="flex flex-wrap gap-4 text-sm">
          <legend className="sr-only">De dónde sale el presupuesto</legend>
          <label className="flex items-center gap-2">
            <input type="radio" name={`${id}-modo`} checked={modo === "consulta"} onChange={() => setModo("consulta")} />
            De una consulta
          </label>
          <label className="flex items-center gap-2">
            <input type="radio" name={`${id}-modo`} checked={modo === "nueva"} onChange={() => setModo("nueva")} />
            Crear la consulta con un contacto
          </label>
        </fieldset>
      ) : null}

      {modo === "consulta" ? (
        consultas.length > 0 ? (
          <div className="fo-field-stack">
            <label htmlFor={`${id}-consulta`} className="fo-label">
              Consulta
            </label>
            <select id={`${id}-consulta`} className="fo-input" value={consulta} onChange={(e) => setConsulta(e.target.value)}>
              {consultas.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.etiqueta}
                </option>
              ))}
            </select>
          </div>
        ) : (
          <p className="text-sm text-[var(--fo-muted)]">No hay consultas para elegir.</p>
        )
      ) : (
        <div className="space-y-3">
          <SelectorContacto etiqueta="Contacto" elegido={contacto} onElegir={setContacto} />
          <div className="fo-field-stack">
            <label htmlFor={`${id}-cat`} className="fo-label">
              Categoría de la consulta
            </label>
            <select id={`${id}-cat`} className="fo-input" value={categoria} onChange={(e) => setCategoria(e.target.value)}>
              {categorias.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.nombre}
                </option>
              ))}
            </select>
          </div>
        </div>
      )}

      <div className="flex flex-wrap items-center gap-3">
        <button type="button" className="fo-btn fo-btn-primary" disabled={pendiente || (modo === "consulta" ? !consulta : !contacto || !categoria)} onClick={crear}>
          {pendiente ? "Creando…" : "Crear presupuesto"}
        </button>
        {error ? (
          <p role="alert" className="text-sm text-[var(--fo-danger)]">
            {error}
          </p>
        ) : null}
      </div>
    </section>
  );
}
