"use client";

import { useState } from "react";
import { Check, Copy, MessageCircle, Mail } from "lucide-react";
import type { DatosDeCuestionariosDelCliente, CuestionarioPendiente } from "@/lib/cuestionarios/cuestionarios-servidor";
import { EnviarCuestionario } from "./enviar-cuestionario";

/**
 * «Información adicional» de la ficha del cliente: lo que respondió en los cuestionarios,
 * agrupado por cuestionario y sección (pregunta en gris chico, respuesta debajo), y los que
 * todavía no respondió, con «Reenviar» y «Copiar enlace».
 *
 * Recibe los datos ya cargados: `datosDeCuestionariosDelCliente(workspaceId, clientId)`.
 */

export type InformacionAdicionalProps = {
  clientId: string;
  datos: DatosDeCuestionariosDelCliente;
  /** Si puede mandar cuestionarios («Gestionar» en Clientes). Por defecto, sí. */
  puedeEnviar?: boolean;
  /** Mostrar el título «Información adicional» (por defecto, sí). */
  conTitulo?: boolean;
};

function fecha(iso: string | null): string {
  if (!iso) return "";
  try {
    return new Intl.DateTimeFormat("es-AR", { timeZone: "America/Argentina/Buenos_Aires", day: "2-digit", month: "2-digit", year: "numeric" }).format(new Date(iso));
  } catch {
    return "";
  }
}

export function InformacionAdicional({ clientId, datos, puedeEnviar = true, conTitulo = true }: InformacionAdicionalProps) {
  const enviar = puedeEnviar && datos.disponible && datos.cuestionarios.length > 0 ? (
    <EnviarCuestionario
      clientId={clientId}
      telefono={datos.cliente.telefono}
      correo={datos.cliente.correo}
      nombre={datos.cliente.nombre}
      cuestionarios={datos.cuestionarios}
    />
  ) : null;

  const vacio = datos.respondidos.length === 0;

  return (
    <section className="space-y-4" aria-label="Información adicional">
      {conTitulo ? (
        <div className="flex items-center justify-between gap-2">
          <h2 className="text-base font-semibold text-[var(--fo-text)]">Información adicional</h2>
          {!vacio ? enviar : null}
        </div>
      ) : null}

      {vacio ? (
        <div className="space-y-3 rounded-lg border border-dashed border-[var(--fo-border)] p-4 text-center">
          <p className="text-sm text-[var(--fo-muted)]">Todavía no respondió ningún cuestionario</p>
          {puedeEnviar && datos.disponible && datos.cuestionarios.length > 0 ? (
            <EnviarCuestionario
              clientId={clientId}
              telefono={datos.cliente.telefono}
              correo={datos.cliente.correo}
              nombre={datos.cliente.nombre}
              cuestionarios={datos.cuestionarios}
              variante="boton"
            />
          ) : null}
        </div>
      ) : (
        <div className="space-y-3">
          {datos.respondidos.map((r) => (
            <details key={r.envioId} className="group rounded-lg border border-[var(--fo-border)]" open={datos.respondidos.length === 1}>
              <summary className="flex cursor-pointer list-none items-baseline justify-between gap-2 px-4 py-3">
                <span className="text-sm font-semibold text-[var(--fo-text)]">{r.cuestionarioNombre}</span>
                <span className="text-xs text-[var(--fo-muted)]">{r.respondidoEn ? `Respondido el ${fecha(r.respondidoEn)}` : "Respondido"}</span>
              </summary>
              <div className="space-y-4 border-t border-[var(--fo-border)] px-4 py-3">
                {r.grupos.map((g) => (
                  <div key={g.seccion} className="space-y-2">
                    <h3 className="text-xs font-semibold uppercase tracking-wide text-[var(--fo-muted)]">{g.seccion}</h3>
                    <dl className="grid gap-x-6 gap-y-2 sm:grid-cols-2">
                      {g.items.map((it) => (
                        <div key={it.preguntaId} className="min-w-0">
                          <dt className="text-xs text-[var(--fo-muted)]">{it.etiqueta}</dt>
                          <dd className="whitespace-pre-line break-words text-sm text-[var(--fo-text)]">{it.valor}</dd>
                        </div>
                      ))}
                    </dl>
                  </div>
                ))}
              </div>
            </details>
          ))}
        </div>
      )}

      {datos.pendientes.length > 0 ? (
        <div className="space-y-2">
          <h3 className="text-xs font-semibold uppercase tracking-wide text-[var(--fo-muted)]">Sin responder</h3>
          <ul className="space-y-2">
            {datos.pendientes.map((p) => (
              <Pendiente key={p.envioId} pendiente={p} />
            ))}
          </ul>
        </div>
      ) : null}
    </section>
  );
}

function Pendiente({ pendiente }: { pendiente: CuestionarioPendiente }) {
  const [copiado, setCopiado] = useState(false);
  const [abierto, setAbierto] = useState(false);

  async function copiar() {
    try {
      await navigator.clipboard.writeText(pendiente.enlace);
      setCopiado(true);
      setTimeout(() => setCopiado(false), 2000);
    } catch {
      window.prompt("Copiá el enlace:", pendiente.enlace);
    }
  }

  return (
    <li className="rounded-lg border border-[var(--fo-border)] px-3 py-2">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="min-w-0">
          <p className="truncate text-sm text-[var(--fo-text)]">{pendiente.cuestionarioNombre}</p>
          <p className="text-xs text-[var(--fo-muted)]">Mandado el {fecha(pendiente.creadoEn)}</p>
        </div>
        <div className="flex gap-1">
          <button type="button" className="fo-btn fo-btn-ghost text-xs" onClick={() => setAbierto((a) => !a)} aria-expanded={abierto}>
            Reenviar
          </button>
          <button type="button" className="fo-btn fo-btn-ghost inline-flex items-center gap-1 text-xs" onClick={copiar}>
            {copiado ? <Check className="h-3.5 w-3.5" aria-hidden /> : <Copy className="h-3.5 w-3.5" aria-hidden />}
            {copiado ? "¡Copiado!" : "Copiar enlace"}
          </button>
        </div>
      </div>
      {abierto ? (
        <div className="mt-2 flex flex-wrap gap-2">
          <a href={pendiente.whatsappUrl} target="_blank" rel="noopener noreferrer" className="fo-btn fo-btn-secondary inline-flex items-center gap-1 text-xs">
            <MessageCircle className="h-3.5 w-3.5" aria-hidden />
            Por WhatsApp
          </a>
          <a href={pendiente.mailtoUrl} className="fo-btn fo-btn-secondary inline-flex items-center gap-1 text-xs">
            <Mail className="h-3.5 w-3.5" aria-hidden />
            Por correo
          </a>
        </div>
      ) : null}
    </li>
  );
}
