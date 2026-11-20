"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Check, ClipboardList, Copy, Mail, MessageCircle } from "lucide-react";
import { crearEnvioCuestionarioAction } from "@/app/(shell)/clientes/cuestionarios-actions";

/**
 * «Enviar cuestionario» para la ficha del cliente: un botón que abre un diálogo para elegir el
 * cuestionario y después ofrece mandarlo por WhatsApp, por correo o copiar el enlace.
 *
 * No manda nada solo: WhatsApp y el correo se abren con el mensaje ya escrito y la persona lo
 * envía desde ahí. Si el cliente ya tenía un enlace pendiente de ese cuestionario, se reusa.
 */

export type EnviarCuestionarioProps = {
  clientId: string;
  telefono?: string | null;
  correo?: string | null;
  nombre?: string | null;
  cuestionarios: { id: string; nombre: string }[];
  /** `icono` (por defecto): botón chico con ícono. `boton`: con el texto «Enviar cuestionario». */
  variante?: "icono" | "boton";
};

type Listo = { cuestionarioNombre: string; enlace: string; whatsappUrl: string; mailtoUrl: string; reusado: boolean };

export function EnviarCuestionario({ clientId, telefono, correo, nombre, cuestionarios, variante = "icono" }: EnviarCuestionarioProps) {
  const ref = useRef<HTMLDialogElement>(null);
  const router = useRouter();
  const [listo, setListo] = useState<Listo | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [copiado, setCopiado] = useState(false);
  const [pendiente, iniciar] = useTransition();
  const tituloId = `enviar-cuestionario-${clientId}`;

  function abrir() {
    setListo(null);
    setError(null);
    setCopiado(false);
    ref.current?.showModal();
  }

  function cerrar() {
    ref.current?.close();
  }

  function elegir(cuestionarioId: string) {
    setError(null);
    iniciar(async () => {
      const r = await crearEnvioCuestionarioAction(clientId, cuestionarioId);
      if (!r.ok) {
        setError(r.error);
        return;
      }
      setListo({ cuestionarioNombre: r.cuestionarioNombre, enlace: r.enlace, whatsappUrl: r.whatsappUrl, mailtoUrl: r.mailtoUrl, reusado: r.reusado });
      // Para que «Información adicional» muestre el pendiente nuevo.
      router.refresh();
    });
  }

  async function copiar() {
    if (!listo) return;
    try {
      await navigator.clipboard.writeText(listo.enlace);
      setCopiado(true);
      setTimeout(() => setCopiado(false), 2000);
    } catch {
      setError("No se pudo copiar. Seleccioná el enlace y copialo a mano.");
    }
  }

  const sinCuestionarios = cuestionarios.length === 0;

  return (
    <>
      {variante === "boton" ? (
        <button type="button" className="fo-btn fo-btn-secondary inline-flex items-center gap-2 text-sm" onClick={abrir}>
          <ClipboardList className="h-4 w-4" aria-hidden />
          Enviar cuestionario
        </button>
      ) : (
        <button
          type="button"
          className="fo-btn fo-btn-ghost inline-flex h-9 w-9 items-center justify-center p-0"
          onClick={abrir}
          title="Enviar cuestionario"
          aria-label="Enviar cuestionario"
        >
          <ClipboardList className="h-4 w-4" aria-hidden />
        </button>
      )}

      <dialog ref={ref} aria-labelledby={tituloId} className="fo-card m-auto w-[92vw] max-w-md p-0 backdrop:bg-black/50">
        <div className="space-y-4 p-5 sm:p-6">
          <div className="space-y-1">
            <h2 id={tituloId} className="text-lg font-semibold text-[var(--fo-text)]">
              {listo ? listo.cuestionarioNombre : "Enviar cuestionario"}
            </h2>
            <p className="text-sm text-[var(--fo-muted)]">
              {listo
                ? listo.reusado
                  ? "Ya tenía este cuestionario sin responder: te damos el mismo enlace para reenviarlo."
                  : `El enlace está listo${nombre ? ` para ${nombre}` : ""}. Elegí cómo mandarlo.`
                : `Elegí qué cuestionario mandarle${nombre ? ` a ${nombre}` : ""}. Lo responde desde el celular, sin cuenta.`}
            </p>
          </div>

          {!listo ? (
            sinCuestionarios ? (
              <p className="text-sm text-[var(--fo-muted)]">No hay cuestionarios activos.</p>
            ) : (
              <ul className="space-y-2">
                {cuestionarios.map((c) => (
                  <li key={c.id}>
                    <button
                      type="button"
                      className="fo-btn fo-btn-secondary w-full justify-start text-left text-sm"
                      disabled={pendiente}
                      onClick={() => elegir(c.id)}
                    >
                      <ClipboardList className="h-4 w-4 shrink-0" aria-hidden />
                      <span>{c.nombre}</span>
                    </button>
                  </li>
                ))}
              </ul>
            )
          ) : (
            <div className="space-y-3">
              <div className="grid gap-2">
                <a
                  href={listo.whatsappUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="fo-btn fo-btn-primary inline-flex items-center justify-center gap-2 text-sm"
                >
                  <MessageCircle className="h-4 w-4" aria-hidden />
                  Enviar por WhatsApp
                </a>
                <a href={listo.mailtoUrl} className="fo-btn fo-btn-secondary inline-flex items-center justify-center gap-2 text-sm">
                  <Mail className="h-4 w-4" aria-hidden />
                  Enviar por correo
                </a>
                <button type="button" className="fo-btn fo-btn-secondary inline-flex items-center justify-center gap-2 text-sm" onClick={copiar}>
                  {copiado ? <Check className="h-4 w-4" aria-hidden /> : <Copy className="h-4 w-4" aria-hidden />}
                  {copiado ? "¡Copiado!" : "Copiar enlace"}
                </button>
              </div>
              {!telefono ? <p className="text-xs text-[var(--fo-muted)]">El cliente no tiene teléfono cargado: WhatsApp te va a pedir elegir el contacto.</p> : null}
              {!correo ? <p className="text-xs text-[var(--fo-muted)]">El cliente no tiene correo cargado: vas a tener que escribir la dirección.</p> : null}
              <input readOnly value={listo.enlace} className="fo-input w-full text-xs" aria-label="Enlace del cuestionario" onFocus={(e) => e.currentTarget.select()} />
            </div>
          )}

          {pendiente ? <p className="text-sm text-[var(--fo-muted)]">Preparando el enlace…</p> : null}
          {error ? (
            <p role="alert" className="text-sm text-[var(--fo-danger)]">
              {error}
            </p>
          ) : null}

          <div className="flex justify-between gap-2">
            {listo ? (
              <button type="button" className="fo-btn fo-btn-ghost text-sm" onClick={() => setListo(null)}>
                Elegir otro
              </button>
            ) : (
              <span />
            )}
            <button type="button" className="fo-btn fo-btn-secondary text-sm" onClick={cerrar}>
              Cerrar
            </button>
          </div>
        </div>
      </dialog>
    </>
  );
}
