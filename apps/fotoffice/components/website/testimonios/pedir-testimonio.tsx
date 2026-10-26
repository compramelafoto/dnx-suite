"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Mail, MessageCircle, MessageSquareQuote } from "lucide-react";
import { enviarPedidoTestimonioAction, pedirTestimonioAction } from "@/app/actions/testimonios";
import { ETIQUETA_CANAL, MAX_ASUNTO, MAX_CUERPO, type Canal } from "@/lib/plantillas/constantes";
import type { PedidoPreparado } from "@/lib/testimonios/pedido";

const ERROR_CONEXION = "No pudimos conectar con el servidor. Probá de nuevo.";

/**
 * Botón «Pedir testimonio» de la ficha del cliente y del proyecto. Al tocarlo se crea la invitación
 * personal y se abre el compositor con el pedido ya escrito (`[link_testimonio]` completado): por
 * correo con la plantilla «Pedido de testimonio» o por WhatsApp. Si el cliente no tiene correo, sólo
 * se ofrece WhatsApp. Se envía como cualquier mensaje y queda en la línea de tiempo del cliente.
 */
export function PedirTestimonio({ clientId, proyectoId = null }: { clientId: string; proyectoId?: string | null }) {
  const router = useRouter();
  const ref = useRef<HTMLDialogElement>(null);
  const [pedido, setPedido] = useState<PedidoPreparado | null>(null);
  const [canal, setCanal] = useState<Canal>("EMAIL");
  const [asunto, setAsunto] = useState("");
  const [cuerpo, setCuerpo] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [aviso, setAviso] = useState<string | null>(null);
  /** Si el navegador bloqueó la pestaña nueva: el enlace para abrirla a mano. */
  const [enlace, setEnlace] = useState<string | null>(null);
  const [preparando, iniciarPreparar] = useTransition();
  const [enviando, iniciarEnvio] = useTransition();
  const abierto = pedido !== null;

  useEffect(() => {
    const d = ref.current;
    if (!d) return;
    if (abierto && !d.open) d.showModal();
    else if (!abierto && d.open) d.close();
  }, [abierto]);

  function elegirCanal(c: Canal, p: PedidoPreparado | null = pedido) {
    if (!p) return;
    setCanal(c);
    setError(null);
    if (c === "EMAIL" && p.correo) {
      setAsunto(p.correo.asunto);
      setCuerpo(p.correo.cuerpo);
    } else if (c === "WHATSAPP" && p.whatsapp) {
      setAsunto("");
      setCuerpo(p.whatsapp.cuerpo);
    }
  }

  function pedir() {
    setError(null);
    setAviso(null);
    setEnlace(null);
    iniciarPreparar(async () => {
      try {
        const r = await pedirTestimonioAction({ clientId, proyectoId });
        if (!r.ok) {
          setError(r.error);
          return;
        }
        setPedido(r);
        elegirCanal(r.correo ? "EMAIL" : "WHATSAPP", r);
      } catch {
        setError(ERROR_CONEXION);
      }
    });
  }

  function cerrar() {
    setPedido(null);
  }

  function enviar() {
    if (!pedido) return;
    setError(null);
    setEnlace(null);
    // WhatsApp: la pestaña se abre YA, en el clic (si no, el navegador la bloquea), y después se la
    // lleva al enlace. Sin `noopener` para poder dirigirla; el vínculo se corta a mano.
    const pestana = canal === "WHATSAPP" && typeof window !== "undefined" ? window.open("", "_blank") : null;
    if (pestana) pestana.opener = null;
    iniciarEnvio(async () => {
      try {
        const r = await enviarPedidoTestimonioAction({
          clientId,
          proyectoId,
          invitacionId: pedido.invitacionId,
          canal,
          templateId: canal === "EMAIL" ? (pedido.correo?.templateId ?? null) : null,
          asunto: canal === "EMAIL" ? asunto : undefined,
          cuerpo,
        });
        if (!r.ok) {
          pestana?.close();
          setError(r.error);
          router.refresh();
          return;
        }
        router.refresh();
        if (canal === "EMAIL") {
          setAviso(`Listo: el pedido de testimonio salió para ${pedido.correo?.destino ?? "el cliente"}.`);
          cerrar();
          return;
        }
        if (r.url && pestana && !pestana.closed) {
          pestana.location.href = r.url;
          setAviso("Se abrió WhatsApp en otra pestaña y quedó registrado en la ficha del cliente.");
          cerrar();
        } else {
          setEnlace(r.url ?? null);
        }
      } catch {
        pestana?.close();
        setError(ERROR_CONEXION);
      }
    });
  }

  const destino = canal === "EMAIL" ? pedido?.correo?.destino : pedido?.whatsapp?.destino;

  return (
    <div className="space-y-2">
      <button type="button" className="fo-btn fo-btn-secondary text-sm" onClick={pedir} disabled={preparando}>
        <MessageSquareQuote className="size-4" aria-hidden />
        {preparando ? "Preparando…" : "Pedir testimonio"}
      </button>
      {!abierto && error ? (
        <p className="text-sm text-[var(--fo-danger)]" role="alert">
          {error}
        </p>
      ) : null}
      {aviso ? (
        <p className="text-sm text-[var(--fo-success)]" role="status">
          {aviso}
        </p>
      ) : null}

      <dialog
        ref={ref}
        aria-labelledby={`testimonio-titulo-${clientId}`}
        className="fo-card w-[92vw] max-w-2xl p-0 backdrop:bg-black/50"
        // Mientras se envía, Esc no cierra: el resultado tiene que verse.
        onCancel={(ev) => {
          if (enviando) ev.preventDefault();
        }}
        onClose={() => {
          if (abierto) cerrar();
        }}
      >
        {pedido ? (
          <form
            className="space-y-4 p-6"
            onSubmit={(ev) => {
              ev.preventDefault();
              if (!enviando) enviar();
            }}
          >
            <div className="space-y-1">
              <h2 id={`testimonio-titulo-${clientId}`} className="text-lg font-semibold text-[var(--fo-text)]">
                Pedir testimonio
              </h2>
              <p className="text-sm text-[var(--fo-muted)]">
                El mensaje lleva un enlace personal para que deje su testimonio (vence en 90 días y se usa una vez). Antes de
                publicarlo, lo revisás en Sitio web → Testimonios.
              </p>
            </div>

            <div className="flex flex-wrap gap-2" role="group" aria-label="Por dónde mandarlo">
              {(["EMAIL", "WHATSAPP"] as const).map((c) => {
                const disponible = c === "EMAIL" ? pedido.correo : pedido.whatsapp;
                const motivo = c === "EMAIL" ? pedido.motivos.correo : pedido.motivos.whatsapp;
                const Icono = c === "EMAIL" ? Mail : MessageCircle;
                return (
                  <button
                    key={c}
                    type="button"
                    className={`fo-btn text-sm ${canal === c ? "fo-btn-primary" : "fo-btn-secondary"}`}
                    aria-pressed={canal === c}
                    disabled={!disponible || enviando}
                    title={!disponible ? (motivo ?? undefined) : undefined}
                    onClick={() => elegirCanal(c)}
                  >
                    <Icono className="size-4" aria-hidden />
                    {ETIQUETA_CANAL[c]}
                  </button>
                );
              })}
            </div>
            {!pedido.correo && pedido.motivos.correo ? (
              <p className="text-xs text-[var(--fo-muted)]">Correo: {pedido.motivos.correo} Se puede pedir por WhatsApp.</p>
            ) : null}
            {!pedido.whatsapp && pedido.motivos.whatsapp ? (
              <p className="text-xs text-[var(--fo-muted)]">WhatsApp: {pedido.motivos.whatsapp}</p>
            ) : null}

            <p className="break-all text-sm text-[var(--fo-muted)]">Para: {destino}</p>

            {canal === "EMAIL" ? (
              <div className="fo-field-stack">
                <label className="fo-label" htmlFor={`testimonio-asunto-${clientId}`}>
                  Asunto
                </label>
                <input
                  id={`testimonio-asunto-${clientId}`}
                  className="fo-input"
                  value={asunto}
                  maxLength={MAX_ASUNTO}
                  required
                  onChange={(ev) => setAsunto(ev.target.value)}
                />
              </div>
            ) : null}

            <div className="fo-field-stack">
              <label className="fo-label" htmlFor={`testimonio-cuerpo-${clientId}`}>
                Mensaje
              </label>
              <textarea
                id={`testimonio-cuerpo-${clientId}`}
                className="fo-input min-h-56 font-[inherit]"
                value={cuerpo}
                maxLength={MAX_CUERPO[canal]}
                required
                onChange={(ev) => setCuerpo(ev.target.value)}
              />
              <p className="text-xs text-[var(--fo-muted)]">
                No borres el enlace: es por donde va a dejar su testimonio. {cuerpo.length.toLocaleString("es-AR")} /{" "}
                {MAX_CUERPO[canal].toLocaleString("es-AR")}
              </p>
            </div>

            {error ? (
              <p className="text-sm text-[var(--fo-danger)]" role="alert">
                {error}
              </p>
            ) : null}

            {enlace ? (
              <p className="text-sm text-[var(--fo-text)]" role="status">
                El navegador no dejó abrir otra pestaña. Quedó registrado;{" "}
                <a href={enlace} target="_blank" rel="noopener noreferrer" className="font-medium text-[var(--fo-accent)] hover:underline">
                  abrí WhatsApp desde acá
                </a>
                .
              </p>
            ) : null}

            <div className="flex flex-wrap justify-end gap-2">
              <button type="button" className="fo-btn fo-btn-secondary text-sm" onClick={cerrar} disabled={enviando}>
                {enlace ? "Cerrar" : "Cancelar"}
              </button>
              {enlace ? null : (
                <button type="submit" className="fo-btn fo-btn-primary text-sm" disabled={enviando || !cuerpo.trim()}>
                  {canal === "EMAIL" ? (enviando ? "Enviando…" : "Enviar") : enviando ? "Abriendo…" : "Abrir WhatsApp"}
                </button>
              )}
            </div>
          </form>
        ) : null}
      </dialog>
    </div>
  );
}
