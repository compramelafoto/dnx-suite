"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { tomarMensajePrecargado } from "@repo/dnx-bot/ui";
import { Mail, MessageCircle } from "lucide-react";
import { abrirWhatsappAction, enviarCorreoAction, prepararMensajeAction } from "@/app/actions/mensajes";
import { ETIQUETA_CANAL, type Canal } from "@/lib/plantillas/constantes";
import { tieneMarcadorSinCompletar } from "@/lib/plantillas/motor";
import type { CanalDelPanel, PanelMensaje as DatosPanel } from "@/lib/plantillas/vista-mensaje";
import { abrirWhatsappEnPestana } from "./abrir-whatsapp-en-pestana";
import { CuerpoCompositor, idsCompositor } from "./cuerpo-compositor";
import { useDialogoModal } from "./use-dialogo-modal";

type TipoFicha = "CLIENTE" | "SOCIO" | "CONSULTA";

const ERROR_CONEXION = "No pudimos conectar con el servidor. Probá de nuevo.";

/**
 * La parte interactiva del botón "Mensaje": Correo y WhatsApp (deshabilitados con el motivo si
 * la persona no tiene adónde recibirlos) y el panel para elegir plantilla, retocar el texto y
 * enviarlo o abrir WhatsApp. Recibe objetos planos; todo se vuelve a validar en el servidor.
 */
export function PanelMensaje({ entityType, entityId, panel }: { entityType: TipoFicha; entityId: string; panel: DatosPanel }) {
  const router = useRouter();
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

  const ref = useDialogoModal(abierto);

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

  // DNX Bot («Abrir para enviar» de la tarjeta de mensaje): el texto llega por sessionStorage, una
  // sola vez, y se completa con los datos de la consulta igual que una plantilla. Enviar lo hace la persona.
  useEffect(() => {
    if (entityType !== "CONSULTA") return;
    // En el próximo ciclo: con el doble montaje de desarrollo, el primero se cancela antes de tomarlo.
    const t = setTimeout(() => tomarYPreparar(), 0);
    return () => clearTimeout(t);
    // Sólo al montar: el mensaje se toma una vez.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function tomarYPreparar() {
    let almacen: Storage | null = null;
    try {
      almacen = window.sessionStorage;
    } catch {
      almacen = null;
    }
    const m = tomarMensajePrecargado(almacen, "CONSULTA", entityId);
    if (!m) return;
    abrir(m.canal);
    iniciarPreparar(async () => {
      try {
        const r = await prepararMensajeAction({ canal: m.canal, entityType, entityId, texto: { asunto: m.asunto, cuerpo: m.cuerpo } });
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
    // La pestaña se abre YA, en el clic (si no, el navegador la bloquea): `abrirWhatsappEnPestana`
    // la abre antes de esperar la acción, corta el vínculo y la cierra si algo falla.
    const envio = abrirWhatsappEnPestana(() =>
      abrirWhatsappAction({ entityType, entityId, templateId: plantilla || null, cuerpo }),
    );
    iniciarEnvio(async () => {
      try {
        const r = await envio;
        if (!r.ok) {
          setError(r.error);
          return;
        }
        router.refresh();
        if (r.enPestana) {
          setAviso("Se abrió WhatsApp en otra pestaña y quedó registrado en la ficha.");
          cerrar();
        } else {
          setEnlace(r.url);
        }
      } catch {
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
        aria-labelledby={idsCompositor("mensaje", entityId).titulo}
        className="fo-card w-[92vw] max-w-2xl p-0 backdrop:bg-black/50"
        // Mientras se envía, Esc no cierra: el resultado tiene que verse.
        onCancel={(ev) => {
          if (ocupado) ev.preventDefault();
        }}
        onClose={() => {
          if (abierto) cerrar();
        }}
      >
        {canal && datos ? (
          <CuerpoCompositor
            ids={idsCompositor("mensaje", entityId)}
            titulo={canal === "EMAIL" ? "Enviar un correo" : "Mandar un WhatsApp"}
            destino={datos.destino}
            antesDelTexto={
              <>
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
              </>
            }
            canal={canal}
            asunto={asunto}
            onAsunto={setAsunto}
            cuerpo={cuerpo}
            onCuerpo={setCuerpo}
            textoBloqueado={preparando}
            ayuda={
              canal === "EMAIL"
                ? "Texto simple. [firma] se reemplaza por la firma de la organización; si no está, se agrega al final."
                : "Texto simple. [firma] se reemplaza por la firma de la organización; en WhatsApp sólo va si la escribís."
            }
            pendientes={pendientes}
            error={error}
            enlace={enlace}
            enviando={enviando}
            ocupado={ocupado}
            onEnviar={() => (canal === "EMAIL" ? enviarCorreo() : abrirWhatsapp())}
            onCancelar={cerrar}
          />
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
