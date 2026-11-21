"use client";

import { useRouter } from "next/navigation";
import { useId, useState, useTransition } from "react";
import { crearPresupuestoAction } from "@/app/actions/presupuestos";
import { SelectorContacto, type ContactoElegido } from "@/components/consultas/selector-contacto";
import { Check, MessagesSquare, UserPlus } from "lucide-react";

/** Hasta cuántas consultas se muestran como tarjetas para tocar; con más, un desplegable. */
const CONSULTAS_COMO_TARJETAS = 8;

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
  /** La consulta que se creó aunque el presupuesto falló: se ofrece abrirla en vez de crear otra. */
  const [consultaCreada, setConsultaCreada] = useState<string | null>(null);

  function crear() {
    setError(null);
    iniciar(async () => {
      const datos =
        modo === "consulta"
          ? { consultaLeadId: consulta || null }
          : { nuevaConsulta: contacto ? { contacto: { clientId: contacto.id }, categoriaId: categoria } : null };
      const r = await crearPresupuestoAction(datos).catch(() => ({ ok: false as const, error: "No se pudo crear la cotización. Probá de nuevo." }));
      if (r.ok) router.push(`/presupuestos/${encodeURIComponent(r.presupuestoId)}`);
      else {
        setError(r.error);
        setConsultaCreada("leadId" in r && r.leadId ? r.leadId : null);
      }
    });
  }

  const opcionModo = (valor: "consulta" | "nueva", titulo: string, detalle: string, Icono: typeof MessagesSquare) => {
    const elegido = modo === valor;
    return (
      <label
        className={`flex cursor-pointer items-start gap-3 rounded-[var(--fo-radius)] border p-4 transition-colors ${
          elegido ? "border-[var(--fo-accent)] bg-[var(--fo-accent-soft)] ring-1 ring-[var(--fo-accent)]" : "border-[var(--fo-border)] hover:border-[var(--fo-border-strong)]"
        }`}
      >
        <input type="radio" className="sr-only" name={`${id}-modo`} checked={elegido} onChange={() => setModo(valor)} />
        <Icono className={`mt-0.5 size-5 shrink-0 ${elegido ? "text-[var(--fo-accent)]" : "text-[var(--fo-muted)]"}`} aria-hidden="true" />
        <span className="space-y-0.5">
          <span className="block text-sm font-semibold text-[var(--fo-text)]">{titulo}</span>
          <span className="block text-xs text-[var(--fo-muted)]">{detalle}</span>
        </span>
      </label>
    );
  };

  return (
    <section className="fo-card max-w-2xl space-y-5">
      {puedeCrearConsulta && consultas.length > 0 ? (
        <fieldset className="space-y-2">
          <legend className="mb-2 text-sm font-semibold text-[var(--fo-text)]">¿Para quién es?</legend>
          <div className="grid gap-3 sm:grid-cols-2">
            {opcionModo("consulta", "Una consulta que ya está", "Elegí la consulta: la cotización queda en su ficha.", MessagesSquare)}
            {opcionModo("nueva", "Un contacto sin consulta", "Se crea la consulta con su categoría y se arma la cotización.", UserPlus)}
          </div>
        </fieldset>
      ) : null}

      {modo === "consulta" ? (
        consultas.length === 1 && consultaInicial ? (
          // Vino desde la ficha de la consulta: no hay nada que elegir.
          <div className="flex items-center gap-3 rounded-[var(--fo-radius)] border border-[var(--fo-border)] bg-[var(--fo-bg)] px-4 py-3 text-sm">
            <MessagesSquare className="size-5 shrink-0 text-[var(--fo-accent)]" aria-hidden="true" />
            <span className="min-w-0">
              <span className="block text-xs text-[var(--fo-muted)]">Cotización para la consulta</span>
              <span className="block truncate font-semibold text-[var(--fo-text)]">{consultas[0]!.etiqueta}</span>
            </span>
          </div>
        ) : consultas.length > 0 && consultas.length <= CONSULTAS_COMO_TARJETAS ? (
          <fieldset className="space-y-2">
            <legend className="mb-2 text-sm font-semibold text-[var(--fo-text)]">Consulta</legend>
            <ul className="space-y-2">
              {consultas.map((c) => {
                const elegida = consulta === c.id;
                return (
                  <li key={c.id}>
                    <label
                      className={`flex cursor-pointer items-center gap-3 rounded-[var(--fo-radius-sm)] border px-3 py-2.5 text-sm transition-colors ${
                        elegida ? "border-[var(--fo-accent)] bg-[var(--fo-accent-soft)]" : "border-[var(--fo-border)] hover:border-[var(--fo-border-strong)]"
                      }`}
                    >
                      <input type="radio" className="sr-only" name={`${id}-consulta`} checked={elegida} onChange={() => setConsulta(c.id)} />
                      <span
                        aria-hidden="true"
                        className={`flex size-5 shrink-0 items-center justify-center rounded-full border-2 ${
                          elegida ? "border-[var(--fo-accent)] bg-[var(--fo-accent)] text-white" : "border-[var(--fo-border-strong)]"
                        }`}
                      >
                        {elegida ? <Check className="size-3" /> : null}
                      </span>
                      <span className={`min-w-0 truncate ${elegida ? "font-semibold text-[var(--fo-text)]" : "text-[var(--fo-text-secondary)]"}`}>{c.etiqueta}</span>
                    </label>
                  </li>
                );
              })}
            </ul>
          </fieldset>
        ) : consultas.length > 0 ? (
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

      <p className="text-xs text-[var(--fo-muted)]">Al crearla se abre el armado: buscás en el catálogo, ajustás precios y la enviás.</p>
      <div className="flex flex-wrap items-center gap-3">
        <button type="button" className="fo-btn fo-btn-primary" disabled={pendiente || (modo === "consulta" ? !consulta : !contacto || !categoria)} onClick={crear}>
          {pendiente ? "Creando…" : "Crear y empezar a armar"}
        </button>
        {error ? (
          <p role="alert" className="text-sm text-[var(--fo-danger)]">
            {error}
            {consultaCreada ? (
              <>
                {" "}
                <a href={`/consultas/${encodeURIComponent(consultaCreada)}`} className="underline">
                  Abrir la consulta
                </a>
              </>
            ) : null}
          </p>
        ) : null}
      </div>
    </section>
  );
}
