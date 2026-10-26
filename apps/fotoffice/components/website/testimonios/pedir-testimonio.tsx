"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Mail, MessageCircle, MessageSquareQuote } from "lucide-react";
import { enviarPedidoTestimonioAction, pedirTestimonioAction } from "@/app/actions/testimonios";
import { abrirWhatsappEnPestana } from "@/components/mensajes/abrir-whatsapp-en-pestana";
import { CuerpoCompositor, idsCompositor } from "@/components/mensajes/cuerpo-compositor";
import { useDialogoModal } from "@/components/mensajes/use-dialogo-modal";
import { ETIQUETA_CANAL, type Canal } from "@/lib/plantillas/constantes";
import { tieneMarcadorSinCompletar } from "@/lib/plantillas/motor";
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
  const ref = useDialogoModal(abierto);
  const pendientes = tieneMarcadorSinCompletar(canal === "EMAIL" ? asunto : "") || tieneMarcadorSinCompletar(cuerpo);

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
    if (canal === "WHATSAPP") return enviarWhatsapp(pedido);
    setError(null);
    iniciarEnvio(async () => {
      try {
        const r = await enviarPedidoTestimonioAction({
          clientId,
          proyectoId,
          invitacionId: pedido.invitacionId,
          canal: "EMAIL",
          templateId: pedido.correo?.templateId ?? null,
          asunto,
          cuerpo,
        });
        // Enviado o fallido-y-registrado: el historial del cliente pudo cambiar.
        router.refresh();
        if (!r.ok) {
          setError(r.error);
          return;
        }
        setAviso(`Listo: el pedido de testimonio salió para ${pedido.correo?.destino ?? "el cliente"}.`);
        cerrar();
      } catch {
        setError(ERROR_CONEXION);
      }
    });
  }

  function enviarWhatsapp(p: PedidoPreparado) {
    setError(null);
    setEnlace(null);
    // En el clic: la pestaña se abre antes de esperar la acción (ver `abrirWhatsappEnPestana`).
    const envio = abrirWhatsappEnPestana(async () => {
      const r = await enviarPedidoTestimonioAction({ clientId, proyectoId, invitacionId: p.invitacionId, canal: "WHATSAPP", cuerpo });
      if (!r.ok) return r;
      return r.url ? { ok: true as const, url: r.url } : { ok: false as const, error: ERROR_CONEXION };
    });
    iniciarEnvio(async () => {
      try {
        const r = await envio;
        if (!r.ok) {
          setError(r.error);
          return;
        }
        router.refresh();
        if (r.enPestana) {
          setAviso("Se abrió WhatsApp en otra pestaña y quedó registrado en la ficha del cliente.");
          cerrar();
        } else {
          setEnlace(r.url);
        }
      } catch {
        setError(ERROR_CONEXION);
      }
    });
  }

  const destino = canal === "EMAIL" ? pedido?.correo?.destino : pedido?.whatsapp?.destino;
  const ids = idsCompositor("testimonio", clientId);

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
        aria-labelledby={ids.titulo}
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
          <CuerpoCompositor
            ids={ids}
            titulo="Pedir testimonio"
            descripcion={
              <p className="text-sm text-[var(--fo-muted)]">
                El mensaje lleva un enlace personal para que deje su testimonio (vence en 90 días y se usa una vez). Antes de
                publicarlo, lo revisás en Sitio web → Testimonios.
              </p>
            }
            destino={destino}
            antesDelTexto={
              <div className="space-y-2">
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
              </div>
            }
            canal={canal}
            asunto={asunto}
            onAsunto={setAsunto}
            cuerpo={cuerpo}
            onCuerpo={setCuerpo}
            ayuda="No borres el enlace: es por donde va a dejar su testimonio."
            pendientes={pendientes}
            error={error}
            enlace={enlace}
            enviando={enviando}
            ocupado={enviando}
            onEnviar={enviar}
            onCancelar={cerrar}
          />
        ) : null}
      </dialog>
    </div>
  );
}
