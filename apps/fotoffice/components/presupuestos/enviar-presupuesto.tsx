"use client";

import { useRouter } from "next/navigation";
import { useMemo, useState, useTransition } from "react";
import { enviarPresupuestoAction } from "@/app/actions/presupuestos";
import type { Canal } from "@/lib/plantillas/constantes";
import type { OpcionesDeEnvio } from "@/lib/presupuestos/envio";

/**
 * "Enviar" / "Reenviar" y "Copiar enlace" de un presupuesto (con "Gestionar"). El texto se edita
 * CON variables (`[nombre]`, `[presupuesto_enlace]`…): las completa el servidor al enviar, con el
 * número y el enlace reales. Las reglas (borrador, vencido, doble clic, topes) las mira el servidor.
 */
export function EnviarPresupuesto({ presupuestoId, opciones }: { presupuestoId: string; opciones: OpcionesDeEnvio }) {
  const router = useRouter();
  const [pendiente, iniciar] = useTransition();
  const [abierto, setAbierto] = useState(false);
  const canalInicial: Canal = opciones.destino.correo || !opciones.destino.whatsapp ? "EMAIL" : "WHATSAPP";
  const [canal, setCanal] = useState<Canal>(canalInicial);
  const delCanal = useMemo(() => opciones.plantillas.filter((p) => p.canal === canal), [opciones.plantillas, canal]);
  const [templateId, setTemplateId] = useState<string>(delCanal[0]?.id ?? "");
  const [asunto, setAsunto] = useState(delCanal[0]?.asunto ?? "");
  const [cuerpo, setCuerpo] = useState(delCanal[0]?.cuerpo ?? "");
  const [error, setError] = useState<string | null>(null);
  const [hecho, setHecho] = useState<string | null>(null);
  const [whatsappUrl, setWhatsappUrl] = useState<string | null>(null);
  const [copiado, setCopiado] = useState(false);

  const reenviar = !opciones.hayBorrador;
  if (opciones.bloqueo && !opciones.enlace) {
    return <p className="fo-card text-sm text-[var(--fo-muted)]">{opciones.bloqueo}</p>;
  }

  function elegirPlantilla(id: string, lista = delCanal) {
    setTemplateId(id);
    const p = lista.find((x) => x.id === id);
    setAsunto(p?.asunto ?? "");
    setCuerpo(p?.cuerpo ?? "");
  }

  function elegirCanal(c: Canal) {
    setCanal(c);
    const lista = opciones.plantillas.filter((p) => p.canal === c);
    elegirPlantilla(lista[0]?.id ?? "", lista);
  }

  function enviar(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setHecho(null);
    setWhatsappUrl(null);
    iniciar(async () => {
      const r = await enviarPresupuestoAction({
        presupuestoId,
        canal,
        templateId: templateId || null,
        asunto: canal === "EMAIL" ? asunto : null,
        cuerpo,
        reenviar,
      }).catch(() => ({ ok: false as const, error: "No se pudo enviar. Probá de nuevo." }));
      if (r.ok) {
        if (r.repetido) setHecho("Ya se había enviado hace un momento: no mandamos nada nuevo.");
        else if (r.whatsappUrl) {
          setWhatsappUrl(r.whatsappUrl);
          setHecho("Listo. Abrí WhatsApp para mandar el mensaje.");
          window.open(r.whatsappUrl, "_blank", "noopener,noreferrer");
        } else setHecho("Listo: el presupuesto salió por correo.");
        setAbierto(false);
        router.refresh();
      } else {
        setError(r.error);
        if ("enviado" in r && r.enviado) router.refresh();
      }
    });
  }

  async function copiar() {
    if (!opciones.enlace) return;
    try {
      await navigator.clipboard.writeText(opciones.enlace);
      setCopiado(true);
      setTimeout(() => setCopiado(false), 2000);
    } catch {
      window.prompt("Copiá el enlace:", opciones.enlace);
    }
  }

  const puedeAbrir = !opciones.bloqueo && (opciones.hayBorrador || opciones.puedeReenviar);
  const sinDestino = canal === "EMAIL" ? !opciones.destino.correo : !opciones.destino.whatsapp;

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        {puedeAbrir ? (
          <button type="button" className="fo-btn fo-btn-primary text-sm" onClick={() => setAbierto((v) => !v)} aria-expanded={abierto}>
            {reenviar ? "Reenviar" : "Enviar"}
          </button>
        ) : null}
        {opciones.enlace ? (
          <button type="button" className="fo-btn fo-btn-secondary text-sm" onClick={copiar}>
            {copiado ? "¡Copiado!" : "Copiar enlace"}
          </button>
        ) : null}
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

      {abierto ? (
        <form onSubmit={enviar} className="fo-card space-y-3">
          <fieldset className="flex flex-wrap gap-4 text-sm">
            <legend className="mb-1 text-xs text-[var(--fo-muted)]">Por dónde</legend>
            {(["EMAIL", "WHATSAPP"] as const).map((c) => (
              <label key={c} className="flex items-center gap-2">
                <input type="radio" name="canal" value={c} checked={canal === c} onChange={() => elegirCanal(c)} />
                {c === "EMAIL" ? "Correo" : "WhatsApp"}
                {(c === "EMAIL" ? !opciones.destino.correo : !opciones.destino.whatsapp) ? (
                  <span className="text-xs text-[var(--fo-muted)]">({c === "EMAIL" ? "sin correo" : "sin teléfono"})</span>
                ) : null}
              </label>
            ))}
          </fieldset>
          <label className="block space-y-1 text-sm">
            <span className="text-xs text-[var(--fo-muted)]">Plantilla</span>
            <select className="fo-input w-full" value={templateId} onChange={(e) => elegirPlantilla(e.target.value)}>
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
            <textarea className="fo-input min-h-[200px] w-full font-mono text-xs" value={cuerpo} onChange={(e) => setCuerpo(e.target.value)} />
          </label>
          <p className="text-xs text-[var(--fo-muted)]">
            Lo que va entre corchetes se completa al enviar (el número y el enlace son los reales). Si el texto no tiene
            el enlace, lo agregamos al final.
            {reenviar ? " Reenviar manda el mismo enlace: no cambia la versión ni la validez." : ""}
          </p>
          <div className="flex flex-wrap gap-2">
            <button type="submit" className="fo-btn fo-btn-primary text-sm" disabled={pendiente || sinDestino || !cuerpo.trim()}>
              {pendiente ? "Enviando…" : canal === "EMAIL" ? "Enviar por correo" : "Preparar WhatsApp"}
            </button>
            <button type="button" className="fo-btn fo-btn-ghost text-sm" onClick={() => setAbierto(false)} disabled={pendiente}>
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
