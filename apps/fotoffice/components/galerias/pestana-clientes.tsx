"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import {
  agregarClienteGaleriaAction, anularEnlaceGaleriaAction, buscarContactosGaleriaAction, enlaceDeClienteGaleriaAction,
  enviarEnlaceGaleriaPorCorreoAction, regenerarEnlaceGaleriaAction, whatsappDeClienteGaleriaAction,
} from "@/app/actions/galerias";
import { SelectorContacto, type ContactoElegido } from "@/components/consultas/selector-contacto";
import { ETIQUETA_ESTADO_CLIENTE, MAX_CLIENTES_POR_GALERIA, type EstadoCliente, type EstadoGaleria } from "@/lib/galerias/constantes";
import { fechaHoraBA } from "@/lib/ficha/formato";

const ERROR_CONEXION = "No pudimos conectar con el servidor. Probá de nuevo.";

export type ClienteVista = {
  id: string;
  clientId: string | null;
  nombre: string;
  email: string | null;
  telefono: string | null;
  estado: EstadoCliente;
  anulado: boolean;
  elegidas: number;
  /** ISO o null. */
  ultimaVez: string | null;
  enviadoEn: string | null;
  finalizadoEn: string | null;
};

const CLASE_ESTADO: Record<EstadoCliente, string> = {
  EN_PROGRESO: "bg-blue-100 text-blue-800",
  EN_REVISION: "bg-violet-100 text-violet-800",
  FINALIZADO: "bg-green-100 text-green-800",
};

function TarjetaCliente({ c, galeriaId, estadoGaleria, puedeGestionar }: { c: ClienteVista; galeriaId: string; estadoGaleria: EstadoGaleria; puedeGestionar: boolean }) {
  const router = useRouter();
  const [pendiente, iniciar] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [aviso, setAviso] = useState<string | null>(null);
  const [manual, setManual] = useState<string | null>(null);
  const [abrir, setAbrir] = useState<string | null>(null);
  const compartible = estadoGaleria === "PUBLICADA" && !c.anulado;

  function limpiar() {
    setError(null);
    setAviso(null);
    setManual(null);
    setAbrir(null);
  }

  function copiar() {
    limpiar();
    iniciar(async () => {
      const r = await enlaceDeClienteGaleriaAction(c.id).catch(() => ({ ok: false as const, error: ERROR_CONEXION }));
      if (!r.ok) return setError(r.error);
      try {
        await navigator.clipboard.writeText(r.url);
        setAviso("Enlace copiado. Quien lo tenga puede ver las fotos y elegir: mandáselo sólo a esa persona.");
      } catch {
        setManual(r.url);
      }
    });
  }

  function correo() {
    limpiar();
    iniciar(async () => {
      const r = await enviarEnlaceGaleriaPorCorreoAction(c.id).catch(() => ({ ok: false as const, error: ERROR_CONEXION }));
      if (!r.ok) return setError(r.error);
      setAviso("Estamos mandando el correo. Cuando salga (o si no sale), queda anotado en el Historial.");
      router.refresh();
    });
  }

  function whatsapp() {
    limpiar();
    iniciar(async () => {
      const r = await whatsappDeClienteGaleriaAction(c.id).catch(() => ({ ok: false as const, error: ERROR_CONEXION }));
      if (!r.ok) return setError(r.error);
      const ventana = window.open(r.url, "_blank", "noopener,noreferrer");
      if (!ventana) setAbrir(r.url);
    });
  }

  function regenerar() {
    if (!window.confirm(`¿Generar un enlace nuevo para ${c.nombre}? El enlace anterior deja de funcionar al instante.`)) return;
    limpiar();
    iniciar(async () => {
      const r = await regenerarEnlaceGaleriaAction(c.id).catch(() => ({ ok: false as const, error: ERROR_CONEXION }));
      if (!r.ok) return setError(r.error);
      setAviso(c.anulado ? "Listo: el enlace volvió a estar habilitado, con una dirección nueva." : "Listo: el enlace anterior dejó de funcionar. Copiá o mandá el nuevo.");
      router.refresh();
    });
  }

  function anular() {
    if (!window.confirm(`¿Anular el enlace de ${c.nombre}? Deja de poder entrar a la galería. Lo que ya eligió se conserva.`)) return;
    limpiar();
    iniciar(async () => {
      const r = await anularEnlaceGaleriaAction(c.id).catch(() => ({ ok: false as const, error: ERROR_CONEXION }));
      if (!r.ok) return setError(r.error);
      router.refresh();
    });
  }

  return (
    <li className={`space-y-2 py-4 first:pt-0 last:pb-0 ${c.estado === "EN_REVISION" && !c.anulado ? "-mx-2 rounded-lg bg-violet-50 px-2" : ""}`}>
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="font-medium text-[var(--fo-text)]">{c.nombre}</p>
          <p className="break-all text-xs text-[var(--fo-muted)]">{[c.email, c.telefono].filter(Boolean).join(" · ") || "Sin correo ni teléfono"}</p>
        </div>
        <div className="flex flex-wrap items-center gap-1">
          {c.anulado ? <span className="rounded-full bg-red-100 px-2 py-0.5 text-xs font-medium text-red-800">Enlace anulado</span> : null}
          <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${CLASE_ESTADO[c.estado]}`}>{ETIQUETA_ESTADO_CLIENTE[c.estado]}</span>
        </div>
      </div>
      <p className="text-xs text-[var(--fo-muted)]">
        {c.elegidas === 1 ? "1 foto elegida" : `${c.elegidas.toLocaleString("es-AR")} fotos elegidas`}
        {c.ultimaVez ? ` · Última visita: ${fechaHoraBA(c.ultimaVez)}` : " · Todavía no entró"}
        {c.enviadoEn ? ` · Envió su selección el ${fechaHoraBA(c.enviadoEn)}` : ""}
        {c.finalizadoEn ? ` · Finalizada el ${fechaHoraBA(c.finalizadoEn)}` : ""}
      </p>
      {c.estado !== "EN_PROGRESO" || c.elegidas > 0 ? (
        <p className="text-sm">
          <Link href={`/galerias/${encodeURIComponent(galeriaId)}/clientes/${encodeURIComponent(c.id)}`} className="font-medium text-[var(--fo-accent)] hover:underline">
            {c.estado === "EN_REVISION" ? "Revisar la selección" : "Ver la selección"}
          </Link>
        </p>
      ) : null}

      {puedeGestionar ? (
        <>
          <div className="flex flex-wrap gap-2 pt-1">
            <button type="button" className="fo-btn fo-btn-secondary text-xs" disabled={pendiente || !compartible} onClick={copiar}>
              Copiar enlace
            </button>
            <button type="button" className="fo-btn fo-btn-secondary text-xs" disabled={pendiente || !compartible || !c.email} onClick={correo} title={!c.email ? "Este cliente no tiene correo" : undefined}>
              Enviar por correo
            </button>
            <button type="button" className="fo-btn fo-btn-secondary text-xs" disabled={pendiente || !compartible || !c.telefono} onClick={whatsapp} title={!c.telefono ? "Este cliente no tiene teléfono" : undefined}>
              WhatsApp
            </button>
            <button type="button" className="fo-btn fo-btn-secondary text-xs" disabled={pendiente} onClick={regenerar}>
              {c.anulado ? "Habilitar con enlace nuevo" : "Generar enlace nuevo"}
            </button>
            {!c.anulado ? (
              <button type="button" className="fo-btn fo-btn-secondary text-xs text-[var(--fo-danger)]" disabled={pendiente} onClick={anular}>
                Anular
              </button>
            ) : null}
          </div>
          {!compartible && !c.anulado ? (
            <p className="text-xs text-[var(--fo-muted)]">
              {estadoGaleria === "BORRADOR" ? "Publicá la galería para poder compartir los enlaces." : "La galería está archivada: reactivala para compartir los enlaces."}
            </p>
          ) : null}
        </>
      ) : null}

      {manual ? (
        <label className="block space-y-1 pt-1 text-xs">
          <span className="text-[var(--fo-muted)]">No pudimos copiarlo solos: copialo de acá.</span>
          <input className="fo-input w-full" readOnly value={manual} onFocus={(e) => e.currentTarget.select()} />
        </label>
      ) : null}
      {abrir ? (
        <p className="text-xs">
          <a href={abrir} target="_blank" rel="noopener noreferrer" className="text-[var(--fo-accent)] hover:underline">
            Abrir WhatsApp con el mensaje
          </a>
        </p>
      ) : null}
      <div aria-live="polite">
        {error ? (
          <p role="alert" className="text-sm text-[var(--fo-danger)]">
            {error}
          </p>
        ) : aviso ? (
          <p role="status" className="text-sm text-[var(--fo-muted)]">
            {aviso}
          </p>
        ) : null}
      </div>
    </li>
  );
}

/**
 * Pestaña "Clientes" de la galería: cada cliente con su estado y su enlace personal (copiar, correo, WhatsApp,
 * enlace nuevo, anular) y el alta de clientes nuevos (contacto del proyecto, otro contacto o alta rápida).
 * Los enlaces sólo se comparten con la galería publicada. Las reglas las vuelve a mirar el servidor.
 */
export function PestanaClientes({
  galeriaId, estadoGaleria, clientes, sugerido, puedeGestionar, puedeBuscarContactos,
}: {
  galeriaId: string;
  estadoGaleria: EstadoGaleria;
  clientes: ClienteVista[];
  /** El contacto del proyecto, para agregarlo con un clic (null si ya está o si no se puede ver Clientes). */
  sugerido: ContactoElegido | null;
  puedeGestionar: boolean;
  puedeBuscarContactos: boolean;
}) {
  const router = useRouter();
  const [pendiente, iniciar] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [elegido, setElegido] = useState<ContactoElegido | null>(null);
  const [rapida, setRapida] = useState({ nombre: "", email: "", telefono: "" });
  const lleno = clientes.length >= MAX_CLIENTES_POR_GALERIA;
  const excluir = clientes.flatMap((c) => (c.clientId ? [c.clientId] : []));

  function agregar(datos: Record<string, unknown>, alTerminar?: () => void) {
    setError(null);
    iniciar(async () => {
      const r = await agregarClienteGaleriaAction(galeriaId, datos).catch(() => ({ ok: false as const, error: ERROR_CONEXION }));
      if (!r.ok) return setError(r.error);
      alTerminar?.();
      router.refresh();
    });
  }

  return (
    <div className="space-y-4">
      <section aria-labelledby="clientes-titulo" className="fo-card space-y-3 p-4">
        <h2 id="clientes-titulo" className="text-sm font-semibold uppercase tracking-wide text-[var(--fo-muted-soft)]">
          Clientes de la galería ({clientes.length}/{MAX_CLIENTES_POR_GALERIA})
        </h2>
        {clientes.length === 0 ? (
          <p className="text-sm text-[var(--fo-muted)]">Todavía no agregaste a nadie. Cada cliente recibe su propio enlace y su selección es independiente.</p>
        ) : (
          <ul className="divide-y divide-[var(--fo-border)] text-sm">
            {clientes.map((c) => (
              <TarjetaCliente key={`${c.id}:${c.anulado}:${c.estado}`} c={c} galeriaId={galeriaId} estadoGaleria={estadoGaleria} puedeGestionar={puedeGestionar} />
            ))}
          </ul>
        )}
      </section>

      {puedeGestionar ? (
        <section aria-labelledby="agregar-cliente-titulo" className="fo-card space-y-4 p-4">
          <h2 id="agregar-cliente-titulo" className="text-sm font-semibold uppercase tracking-wide text-[var(--fo-muted-soft)]">
            Agregar un cliente
          </h2>
          {lleno ? <p role="status" className="text-sm text-[var(--fo-muted)]">La galería ya tiene el máximo de {MAX_CLIENTES_POR_GALERIA} clientes.</p> : null}

          {sugerido && !lleno ? (
            <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg bg-[var(--fo-surface-muted)] px-3 py-2 text-sm">
              <span className="min-w-0">
                <span className="font-medium">{sugerido.nombre}</span>
                <span className="ml-1 text-xs text-[var(--fo-muted)]">contacto del proyecto</span>
              </span>
              <button type="button" className="fo-btn fo-btn-primary text-sm" disabled={pendiente} onClick={() => agregar({ clientId: sugerido.id })}>
                Agregar
              </button>
            </div>
          ) : null}

          {!lleno ? (
            <>
              {puedeBuscarContactos ? (
                <div className="space-y-2">
                  <SelectorContacto etiqueta="Otro contacto" elegido={elegido} onElegir={setElegido} excluir={excluir} deshabilitado={pendiente} buscar={buscarContactosGaleriaAction} />
                  <button type="button" className="fo-btn fo-btn-secondary text-sm" disabled={pendiente || !elegido} onClick={() => elegido && agregar({ clientId: elegido.id }, () => setElegido(null))}>
                    Agregar contacto
                  </button>
                </div>
              ) : (
                <p className="text-xs text-[var(--fo-muted)]">Para elegir un contacto necesitás permiso para ver Clientes. Igual podés hacer un alta rápida.</p>
              )}

              <form
                className="space-y-3"
                aria-label="Alta rápida de un cliente"
                onSubmit={(e) => {
                  e.preventDefault();
                  agregar({ nombre: rapida.nombre, email: rapida.email, telefono: rapida.telefono }, () => setRapida({ nombre: "", email: "", telefono: "" }));
                }}
              >
                <p className="text-sm font-medium">Alta rápida</p>
                <div className="fo-field-stack">
                  <label className="fo-label" htmlFor="gal-rapida-nombre">Nombre</label>
                  <input id="gal-rapida-nombre" className="fo-input" maxLength={120} required value={rapida.nombre} onChange={(e) => setRapida({ ...rapida, nombre: e.target.value })} disabled={pendiente} />
                </div>
                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="fo-field-stack">
                    <label className="fo-label" htmlFor="gal-rapida-email">Correo</label>
                    <input id="gal-rapida-email" type="email" className="fo-input" maxLength={254} value={rapida.email} onChange={(e) => setRapida({ ...rapida, email: e.target.value })} disabled={pendiente} />
                  </div>
                  <div className="fo-field-stack">
                    <label className="fo-label" htmlFor="gal-rapida-tel">Teléfono (WhatsApp, con código de país)</label>
                    <input id="gal-rapida-tel" type="tel" className="fo-input" maxLength={30} placeholder="+54 9 341 555 0000" value={rapida.telefono} onChange={(e) => setRapida({ ...rapida, telefono: e.target.value })} disabled={pendiente} />
                  </div>
                </div>
                <p className="text-xs text-[var(--fo-muted)]">Hace falta un correo o un teléfono para poder avisarle.</p>
                <button type="submit" className="fo-btn fo-btn-secondary text-sm" disabled={pendiente || rapida.nombre.trim() === "" || (rapida.email.trim() === "" && rapida.telefono.trim() === "")}>
                  Agregar cliente
                </button>
              </form>
            </>
          ) : null}

          <div aria-live="polite">
            {error ? (
              <p role="alert" className="text-sm text-[var(--fo-danger)]">
                {error}
              </p>
            ) : null}
          </div>
        </section>
      ) : null}
    </div>
  );
}
