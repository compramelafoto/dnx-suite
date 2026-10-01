"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Mail, MessageCircle } from "lucide-react";
import { abrirWhatsappAction, enviarCorreoAction, prepararMensajeAction } from "@/app/actions/mensajes";
import { ETIQUETA_CANAL, MAX_ASUNTO, MAX_CUERPO, type Canal } from "@/lib/plantillas/constantes";
import { tieneMarcadorSinCompletar } from "@/lib/plantillas/motor";
import type { CanalDelPanel, PanelMensaje as DatosPanel } from "@/lib/plantillas/vista-mensaje";

type TipoFicha = "CLIENTE" | "SOCIO" | "CONSULTA";

const ERROR_CONEXION = "No pudimos conectar con el servidor. Probá de nuevo.";

/**
 * La parte interactiva del botón "Mensaje": Correo y WhatsApp (deshabilitados con el motivo si
 * la persona no tiene adónde recibirlos) y el panel para elegir plantilla, retocar el texto y
 * enviarlo o abrir WhatsApp. Recibe objetos planos; todo se vuelve a validar en el servidor.
 */
export function PanelMensaje({ entityType, entityId, panel }: { entityType: TipoFicha; entityId: string; panel: DatosPanel }) {
  const router = useRouter();
  const ref = useRef<HTMLDialogElement>(null);
  const [canal, setCanal] = useState<Canal | null>(null);
  const [plantilla, setPlantilla] = useState("");
  const [asunto, setAsunto] = useState("");
  const [cuerpo, setCuerpo] = useState("");
  const [vacias, setVacias] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);
  /** Si el navegador bloqueó la pestaña nueva: el enlace para abrirla a mano. */
  const [enlace, setEnlace] = useState<string | null>(null);
  const [aviso, setAviso] = useState<string | null>(null);
  const [preparando, iniciarPreparar] = useTransition();
  const [enviando, iniciarEnvio] = useTransition();

  const datos: CanalDelPanel | null = canal === "EMAIL" ? panel.correo : canal === "WHATSAPP" ? panel.whatsapp : null;
  const abierto = canal !== null;
  const pendientes = tieneMarcadorSinCompletar(canal === "EMAIL" ? asunto : "") || tieneMarcadorSinCompletar(cuerpo);
  const ocupado = preparando || enviando;

  useEffect(() => {
    const d = ref.current;
    if (!d) return;
    if (abierto && !d.open) d.showModal();
    else if (!abierto && d.open) d.close();
  }, [abierto]);

  function abrir(c: Canal) {
    setCanal(c);
    setPlantilla("");
    setAsunto("");
    setCuerpo("");
    setVacias([]);
    setError(null);
    setEnlace(null);
    setAviso(null);
  }

  function cerrar() {
    setCanal(null);
  }

  function elegirPlantilla(id: string) {
    if (!canal) return;
    setPlantilla(id);
    setError(null);
    setEnlace(null);
    if (!id) {
      setAsunto("");
      setCuerpo("");
      setVacias([]);
      return;
    }
    iniciarPreparar(async () => {
      try {
        const r = await prepararMensajeAction({ canal, entityType, entityId, templateId: id });
        if (!r.ok) {
          setError(r.error);
          return;
        }
        setAsunto(r.asunto);
        setCuerpo(r.cuerpo);
        setVacias(r.vacias);
      } catch {
        setError(ERROR_CONEXION);
      }
    });
  }

  function enviarCorreo() {
    setError(null);
    iniciarEnvio(async () => {
      try {
        const r = await enviarCorreoAction({ entityType, entityId, templateId: plantilla || null, asunto, cuerpo });
        if (r.ok) {
          setAviso(`Listo: el correo salió para ${panel.correo.destino ?? "la persona"}.`);
          cerrar();
          router.refresh();
          return;
        }
        setError(r.error);
        // Un fallo del proveedor también queda en el historial.
        if (r.registrado) router.refresh();
      } catch {
        setError(ERROR_CONEXION);
      }
    });
  }

  function abrirWhatsapp() {
    setError(null);
    setEnlace(null);
    // La pestaña se abre YA, en el clic (si no, el navegador la bloquea); cuando llega el enlace,
    // se la lleva ahí. Sin `noopener` para poder dirigirla, y se corta el vínculo a mano.
    const pestana = typeof window !== "undefined" ? window.open("", "_blank") : null;
    if (pestana) pestana.opener = null;
    iniciarEnvio(async () => {
      try {
        const r = await abrirWhatsappAction({ entityType, entityId, templateId: plantilla || null, cuerpo });
        if (!r.ok) {
          pestana?.close();
          setError(r.error);
          return;
        }
        router.refresh();
        if (pestana && !pestana.closed) {
          pestana.location.href = r.url;
          setAviso("Se abrió WhatsApp en otra pestaña y quedó registrado en la ficha.");
          cerrar();
        } else {
          setEnlace(r.url);
        }
      } catch {
        pestana?.close();
        setError(ERROR_CONEXION);
      }
    });
  }

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap gap-2">
        <BotonCanal canal="EMAIL" datos={panel.correo} onAbrir={abrir} />
        <BotonCanal canal="WHATSAPP" datos={panel.whatsapp} onAbrir={abrir} />
      </div>
      {[panel.correo, panel.whatsapp].map((d, i) =>
        d.motivo ? (
          <p key={i} className="text-xs text-[var(--fo-muted)]">
            {i === 0 ? "Correo" : "WhatsApp"}: {d.motivo}
          </p>
        ) : null,
      )}
      {aviso ? (
        <p className="text-sm text-[var(--fo-success)]" role="status">
          {aviso}
        </p>
      ) : null}

      <dialog
        ref={ref}
        aria-labelledby={`mensaje-titulo-${entityId}`}
        className="fo-card w-[92vw] max-w-2xl p-0 backdrop:bg-black/50"
        onClose={() => {
          if (abierto) cerrar();
        }}
      >
        {canal && datos ? (
          <form
            className="space-y-4 p-6"
            onSubmit={(ev) => {
              ev.preventDefault();
              if (ocupado) return;
              if (canal === "EMAIL") enviarCorreo();
              else abrirWhatsapp();
            }}
          >
            <div className="space-y-1">
              <h2 id={`mensaje-titulo-${entityId}`} className="text-lg font-semibold text-[var(--fo-text)]">
                {canal === "EMAIL" ? "Enviar un correo" : "Mandar un WhatsApp"}
              </h2>
              <p className="break-all text-sm text-[var(--fo-muted)]">Para: {datos.destino}</p>
            </div>

            <div className="fo-field-stack">
              <label className="fo-label" htmlFor={`mensaje-plantilla-${entityId}`}>
                Plantilla
              </label>
              <select
                id={`mensaje-plantilla-${entityId}`}
                className="fo-input"
                value={plantilla}
                disabled={ocupado}
                onChange={(ev) => elegirPlantilla(ev.target.value)}
              >
                <option value="">Sin plantilla</option>
                {datos.plantillas.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.nombre}
                    {p.general ? " (General)" : ""}
                  </option>
                ))}
              </select>
              {preparando ? <p className="text-xs text-[var(--fo-muted)]">Completando con los datos…</p> : null}
            </div>

            {vacias.length > 0 ? (
              <p className="rounded-md border border-[var(--fo-warning-border)] bg-[var(--fo-warning-soft)] p-3 text-sm text-[var(--fo-warning)]">
                Quedaron vacías porque falta el dato: {vacias.map((v) => `[${v}]`).join(", ")}. Revisá el texto antes de
                {canal === "EMAIL" ? " enviarlo" : " mandarlo"}.
              </p>
            ) : null}

            {canal === "EMAIL" ? (
              <div className="fo-field-stack">
                <label className="fo-label" htmlFor={`mensaje-asunto-${entityId}`}>
                  Asunto
                </label>
                <input
                  id={`mensaje-asunto-${entityId}`}
                  className="fo-input"
                  value={asunto}
                  maxLength={MAX_ASUNTO}
                  required
                  disabled={preparando}
                  onChange={(ev) => setAsunto(ev.target.value)}
                />
              </div>
            ) : null}

            <div className="fo-field-stack">
              <label className="fo-label" htmlFor={`mensaje-cuerpo-${entityId}`}>
                Mensaje
              </label>
              <textarea
                id={`mensaje-cuerpo-${entityId}`}
                className="fo-input min-h-56 font-[inherit]"
                value={cuerpo}
                maxLength={MAX_CUERPO[canal]}
                required
                disabled={preparando}
                onChange={(ev) => setCuerpo(ev.target.value)}
              />
              <p className="text-xs text-[var(--fo-muted)]">
                {canal === "EMAIL"
                  ? "Texto simple. [firma] se reemplaza por la firma de la organización; si no está, se agrega al final."
                  : "Texto simple. [firma] se reemplaza por la firma de la organización; en WhatsApp sólo va si la escribís."}{" "}
                {cuerpo.length.toLocaleString("es-AR")} / {MAX_CUERPO[canal].toLocaleString("es-AR")}
              </p>
            </div>

            {pendientes ? (
              <p className="rounded-md border border-[var(--fo-warning-border)] bg-[var(--fo-warning-soft)] p-3 text-sm text-[var(--fo-warning)]">
                Hay textos entre corchetes en MAYÚSCULAS para completar a mano (por ejemplo, un enlace). Reemplazalos antes de
                {canal === "EMAIL" ? " enviar" : " abrir WhatsApp"}.
              </p>
            ) : null}

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
                <button type="submit" className="fo-btn fo-btn-primary text-sm" disabled={ocupado || !cuerpo.trim()}>
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

function BotonCanal({ canal, datos, onAbrir }: { canal: Canal; datos: CanalDelPanel; onAbrir: (c: Canal) => void }) {
  const Icono = canal === "EMAIL" ? Mail : MessageCircle;
  const deshabilitado = datos.destino === null;
  return (
    <button
      type="button"
      className="fo-btn fo-btn-secondary text-sm"
      disabled={deshabilitado}
      title={deshabilitado ? (datos.motivo ?? undefined) : undefined}
      onClick={() => onAbrir(canal)}
    >
      <Icono className="size-4" aria-hidden />
      {ETIQUETA_CANAL[canal]}
    </button>
  );
}
