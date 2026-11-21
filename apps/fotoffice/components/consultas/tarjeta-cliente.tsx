"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { ExternalLink, Mail, MessageCircle, Paperclip, Pencil, Phone, Pin, StickyNote } from "lucide-react";
import { DialogoNotas } from "@/components/circuitos/dialogo-notas";
import { iniciales } from "@/lib/circuitos/tablero-vista";
import type { ResumenContacto } from "@/lib/consultas/resumen-contacto";
import { claseDeColorEtiqueta, fechaHoraBA } from "@/lib/ficha/formato";

/** Notas que entran en la tarjeta; el resto, en la ventana o en la ficha. */
const NOTAS_A_LA_VISTA = 3;

/**
 * El cliente de la consulta, siempre a la vista en la ficha: cómo contactarlo, qué se sabe de él
 * (etiquetas, notas, archivos) y los dos caminos a su ficha: editar los datos o verla completa.
 * Las notas se escriben en la misma ventana que el ícono de notas del tablero.
 */
export function TarjetaCliente({
  cliente,
  whatsapp,
  resumen,
  puedeGestionar,
}: {
  cliente: { id: string; nombre: string; telefono: string | null; email: string | null };
  /** Enlace de WhatsApp ya armado (con el número normalizado), si hay teléfono. */
  whatsapp: string | null;
  /** Etiquetas, notas y archivos del cliente; null sin "Ver" en Clientes. */
  resumen: ResumenContacto | null;
  /** "Gestionar" en Clientes: editar los datos y escribir notas. */
  puedeGestionar: boolean;
}) {
  const router = useRouter();
  const [notasAbiertas, setNotasAbiertas] = useState(false);
  const fichaHref = `/clientes/${cliente.id}`;
  const notas = resumen?.notas.slice(0, NOTAS_A_LA_VISTA) ?? [];
  const hayMasNotas = (resumen?.notas.length ?? 0) > NOTAS_A_LA_VISTA || resumen?.masNotas === true;

  return (
    <section aria-labelledby="tarjeta-cliente-titulo" className="fo-card space-y-4">
      <div className="flex items-center gap-3">
        <span
          aria-hidden="true"
          className="inline-flex size-11 shrink-0 items-center justify-center rounded-full bg-[var(--fo-accent-soft)] text-sm font-semibold text-[var(--fo-accent-hover)]"
        >
          {iniciales(cliente.nombre)}
        </span>
        <div className="min-w-0">
          <p className="text-[11px] font-medium uppercase tracking-wide text-[var(--fo-muted)]">Cliente</p>
          <h2 id="tarjeta-cliente-titulo" className="truncate text-base font-semibold text-[var(--fo-text)]" title={cliente.nombre}>
            {resumen ? (
              <Link href={fichaHref} className="hover:text-[var(--fo-accent-hover)] hover:underline">
                {cliente.nombre}
              </Link>
            ) : (
              cliente.nombre
            )}
          </h2>
        </div>
      </div>

      {/* Contactarlo: un toque. */}
      <ul className="space-y-1.5 text-sm">
        {cliente.telefono ? (
          <li className="flex items-center gap-2">
            <Phone className="size-4 shrink-0 text-[var(--fo-muted)]" aria-hidden="true" />
            <a href={`tel:${cliente.telefono}`} className="min-w-0 flex-1 truncate tabular-nums text-[var(--fo-text)] hover:text-[var(--fo-accent-hover)]">
              {cliente.telefono}
            </a>
            {whatsapp ? (
              <a
                href={whatsapp}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 rounded-full bg-[var(--fo-success-soft)] px-2 py-0.5 text-xs font-medium text-[var(--fo-success)] hover:bg-[var(--fo-success-border)]"
              >
                <MessageCircle className="size-3.5" aria-hidden="true" /> WhatsApp
              </a>
            ) : null}
          </li>
        ) : null}
        {cliente.email ? (
          <li className="flex items-center gap-2">
            <Mail className="size-4 shrink-0 text-[var(--fo-muted)]" aria-hidden="true" />
            <a href={`mailto:${cliente.email}`} className="min-w-0 truncate text-[var(--fo-text)] hover:text-[var(--fo-accent-hover)]">
              {cliente.email}
            </a>
          </li>
        ) : null}
        {!cliente.telefono && !cliente.email ? <li className="text-[var(--fo-muted)]">Sin teléfono ni correo cargados.</li> : null}
      </ul>

      {resumen && resumen.etiquetas.length > 0 ? (
        <ul className="flex flex-wrap gap-1.5" aria-label="Etiquetas del cliente">
          {resumen.etiquetas.map((e) => (
            <li key={e.id} className={`rounded-full px-2 py-0.5 text-xs font-medium ${claseDeColorEtiqueta(e.color)}`}>
              {e.nombre}
            </li>
          ))}
        </ul>
      ) : null}

      {resumen ? (
        <div className="space-y-2 border-t border-[var(--fo-border-muted)] pt-3">
          <div className="flex items-center justify-between gap-2">
            <h3 className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-[var(--fo-muted)]">
              <StickyNote className="size-3.5" aria-hidden="true" /> Notas
            </h3>
            <button type="button" className="text-xs font-medium text-[var(--fo-accent-hover)] hover:underline" onClick={() => setNotasAbiertas(true)}>
              {puedeGestionar ? "+ Agregar nota" : "Ver todas"}
            </button>
          </div>
          {notas.length === 0 ? (
            <p className="text-sm text-[var(--fo-muted)]">Todavía no hay notas sobre este cliente.</p>
          ) : (
            <ul className="space-y-2">
              {notas.map((n) => (
                <li key={n.id} className="rounded-[var(--fo-radius-sm)] bg-[var(--fo-surface-muted)] px-3 py-2 text-sm">
                  <p className="line-clamp-3 whitespace-pre-line break-words text-[var(--fo-text)]">{n.texto}</p>
                  <p className="mt-1 flex items-center gap-1 text-[11px] text-[var(--fo-muted)]">
                    {n.fijada ? <Pin className="size-3" aria-label="Fijada" /> : null}
                    {[fechaHoraBA(n.fecha), n.autor || null].filter(Boolean).join(" · ")}
                  </p>
                </li>
              ))}
            </ul>
          )}
          {hayMasNotas ? (
            <button type="button" className="text-xs text-[var(--fo-accent-hover)] hover:underline" onClick={() => setNotasAbiertas(true)}>
              Ver todas las notas
            </button>
          ) : null}
          {resumen.adjuntos.length > 0 ? (
            <p className="flex items-center gap-1.5 pt-1 text-xs text-[var(--fo-muted)]">
              <Paperclip className="size-3.5" aria-hidden="true" />
              {resumen.adjuntos.length === 1 ? "1 archivo" : `${resumen.adjuntos.length} archivos`} en su ficha
            </p>
          ) : null}
        </div>
      ) : null}

      {resumen ? (
        <div className="grid grid-cols-2 gap-2 border-t border-[var(--fo-border-muted)] pt-3">
          {puedeGestionar ? (
            <Link href={`${fichaHref}?editar=1`} className="fo-btn fo-btn-secondary min-h-9! px-3! text-xs">
              <Pencil className="size-3.5" aria-hidden="true" /> Editar datos
            </Link>
          ) : null}
          <Link href={fichaHref} className={`fo-btn fo-btn-secondary min-h-9! px-3! text-xs ${puedeGestionar ? "" : "col-span-2"}`}>
            <ExternalLink className="size-3.5" aria-hidden="true" /> Ficha completa
          </Link>
        </div>
      ) : null}

      {resumen ? (
        <DialogoNotas
          key={notasAbiertas ? cliente.id : "cerrada"}
          cliente={notasAbiertas ? { id: cliente.id, titulo: cliente.nombre } : null}
          onCerrar={(huboCambios) => {
            setNotasAbiertas(false);
            if (huboCambios) router.refresh();
          }}
        />
      ) : null}
    </section>
  );
}
