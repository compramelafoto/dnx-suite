"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Mail, MessageCircle } from "lucide-react";
import { enviarMensajePedidoAction } from "@/app/actions/pedidos";
import type { Canal } from "@/lib/plantillas/constantes";
import type { OpcionesEnvioPedido } from "@/lib/pedidos/envio";
import { TEXTOS_POR_OMISION } from "@/lib/pedidos/pantalla";

const ERROR_CONEXION = "No pudimos conectar con el servidor. Probá de nuevo.";

/**
 * "Enviar por correo" y "WhatsApp" de un pedido (con "Gestionar"); con `cobroId`, del recibo de ese
 * cobro. El texto se edita CON variables (`[nombre]`, `[pedido_enlace]`, `[recibo_enlace]`…): las
 * completa el servidor con los datos reales. WhatsApp abre `wa.me` con el texto y el enlace.
 */
export function EnviarPedido({
  pedidoId,
  opciones,
  cobroId = null,
  compacto = false,
}: {
  pedidoId: string;
  opciones: OpcionesEnvioPedido;
  cobroId?: string | null;
  compacto?: boolean;
}) {
  const router = useRouter();
  const [pendiente, iniciar] = useTransition();
  const [canal, setCanal] = useState<Canal | null>(null);
  const [templateId, setTemplateId] = useState("");
  const [asunto, setAsunto] = useState("");
  const [cuerpo, setCuerpo] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [hecho, setHecho] = useState<string | null>(null);
  const [whatsappUrl, setWhatsappUrl] = useState<string | null>(null);
  const omision = cobroId ? TEXTOS_POR_OMISION.recibo : TEXTOS_POR_OMISION.pedido;

  function elegirPlantilla(c: Canal, id: string) {
    setTemplateId(id);
    const p = opciones.plantillas.find((x) => x.id === id && x.canal === c);
    if (p) {
      setAsunto(p.asunto ?? "");
      setCuerpo(p.cuerpo);
    } else {
      setAsunto(c === "EMAIL" ? omision.asunto : "");
      setCuerpo(omision[c]);
    }
  }

  function abrir(c: Canal) {
    setCanal(c);
    setError(null);
    setHecho(null);
    setWhatsappUrl(null);
    // Con recibo, el texto por omisión del recibo; sin recibo, la primera plantilla del canal.
    const primera = cobroId ? null : opciones.plantillas.find((p) => p.canal === c);
    elegirPlantilla(c, primera?.id ?? "");
  }

  function enviar(e: React.FormEvent) {
    e.preventDefault();
    if (!canal || pendiente) return;
    setError(null);
    // La pestaña de WhatsApp se abre YA, en el clic (si no, el navegador la bloquea).
    const pestana = canal === "WHATSAPP" && typeof window !== "undefined" ? window.open("", "_blank") : null;
    if (pestana) pestana.opener = null;
    iniciar(async () => {
      const r = await enviarMensajePedidoAction({
        pedidoId,
        canal,
        templateId: templateId || null,
        asunto: canal === "EMAIL" ? asunto : null,
        cuerpo,
        cobroId,
      }).catch(() => ({ ok: false as const, error: ERROR_CONEXION }));
      if (!r.ok) {
        pestana?.close();
        setError(r.error);
        if ("registrado" in r && r.registrado) router.refresh();
        return;
      }
      if (r.whatsappUrl) {
        if (pestana && !pestana.closed) {
          pestana.location.href = r.whatsappUrl;
          setHecho("Se abrió WhatsApp en otra pestaña y quedó registrado en el pedido.");
        } else {
          setWhatsappUrl(r.whatsappUrl);
          setHecho("Quedó registrado. El navegador no dejó abrir otra pestaña:");
        }
      } else {
        setHecho("Listo: el correo salió.");
      }
      setCanal(null);
      router.refresh();
    });
  }

  const sinDestino = canal === "EMAIL" ? !opciones.destino.correo : canal === "WHATSAPP" ? !opciones.destino.whatsapp : false;
  const delCanal = canal ? opciones.plantillas.filter((p) => p.canal === canal) : [];
  const clase = compacto ? "fo-btn fo-btn-ghost text-xs" : "fo-btn fo-btn-secondary text-sm";

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          className={clase}
          disabled={!opciones.destino.correo}
          title={opciones.destino.correo ? undefined : "El contacto no tiene un correo válido."}
          onClick={() => abrir("EMAIL")}
        >
          <Mail className="size-4" aria-hidden />
          Enviar por correo
        </button>
        <button
          type="button"
          className={clase}
          disabled={!opciones.destino.whatsapp}
          title={opciones.destino.whatsapp ? undefined : "El contacto no tiene un teléfono válido para WhatsApp."}
          onClick={() => abrir("WHATSAPP")}
        >
          <MessageCircle className="size-4" aria-hidden />
          WhatsApp
        </button>
        {hecho ? (
          <p role="status" className="text-sm text-[var(--fo-muted)]">
            {hecho}
            {whatsappUrl ? (
              <>
                {" "}
                <a href={whatsappUrl} target="_blank" rel="noopener noreferrer" className="text-[var(--fo-accent)] hover:underline">
                  Abrir WhatsApp
                </a>
              </>
            ) : null}
          </p>
        ) : null}
      </div>

      {canal ? (
        <form onSubmit={enviar} className="fo-card space-y-3">
          <p className="text-sm font-medium text-[var(--fo-text)]">
            {canal === "EMAIL" ? "Enviar por correo" : "Mandar por WhatsApp"}
            {cobroId ? " el recibo" : " el pedido"}
          </p>
          <label className="block space-y-1 text-sm">
            <span className="text-xs text-[var(--fo-muted)]">Plantilla</span>
            <select className="fo-input w-full" value={templateId} onChange={(e) => elegirPlantilla(canal, e.target.value)}>
              <option value="">Sin plantilla (escribo el texto)</option>
              {delCanal.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.nombre}
                </option>
              ))}
            </select>
          </label>
          {canal === "EMAIL" ? (
            <label className="block space-y-1 text-sm">
              <span className="text-xs text-[var(--fo-muted)]">Asunto</span>
              <input className="fo-input w-full" value={asunto} onChange={(e) => setAsunto(e.target.value)} maxLength={200} />
            </label>
          ) : null}
          <label className="block space-y-1 text-sm">
            <span className="text-xs text-[var(--fo-muted)]">Mensaje</span>
            <textarea className="fo-input min-h-[180px] w-full font-mono text-xs" value={cuerpo} onChange={(e) => setCuerpo(e.target.value)} />
          </label>
          <p className="text-xs text-[var(--fo-muted)]">
            Lo que va entre corchetes se completa al enviar con los datos reales.
            {cobroId ? " Si el texto no tiene el enlace del recibo, lo agregamos al final." : ""}
          </p>
          <div className="flex flex-wrap gap-2">
            <button type="submit" className="fo-btn fo-btn-primary text-sm" disabled={pendiente || sinDestino || !cuerpo.trim()}>
              {pendiente ? "Enviando…" : canal === "EMAIL" ? "Enviar" : "Abrir WhatsApp"}
            </button>
            <button type="button" className="fo-btn fo-btn-ghost text-sm" onClick={() => setCanal(null)} disabled={pendiente}>
              Cancelar
            </button>
          </div>
        </form>
      ) : null}

      {error ? (
        <p role="alert" className="text-sm text-[var(--fo-danger)]">
          {error}
        </p>
      ) : null}
    </div>
  );
}
