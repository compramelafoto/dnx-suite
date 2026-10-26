"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { ArrowRight, CalendarDays, Check, CheckCircle2, ExternalLink, Mail, MessageCircle, PackageCheck, Send, Undo2, X } from "lucide-react";
import { detalleTrabajoAction } from "@/app/actions/en-curso";
import { fechaBA, fechaHoraBA } from "@/lib/ficha/formato";
import { formatMinorArs } from "@/lib/membership/money";
import { importeSinCentavos, mensajeCandado } from "@/lib/pedidos/candado-saldo-puro";
import { FASE_INFO } from "@/lib/proyectos/en-curso-puro";
import type { TarjetaTrabajo } from "@/lib/proyectos/en-curso";
import type { DetalleTrabajo } from "@/lib/proyectos/en-curso-detalle";
import { ESTILO_URGENCIA, estadoDeTarjeta, textoEntrega } from "./estado-tarjeta";

type Acciones = {
  onAvanzar: () => void;
  onVolver: () => void;
  onCorreo: () => void;
  onEnviar: () => void;
  onLlego: () => void;
};

/**
 * Ficha flotante de un trabajo del tablero "En curso": se abre al tocar la tarjeta. Muestra en qué
 * paso está, qué hace cada acción antes de apretarla, y lo que la tarjeta no llega a mostrar (qué se
 * vendió, cobros, laboratorio, notas e historial). Los datos de la tarjeta se ven enseguida; el
 * resto se lee al abrir y se vuelve a leer cuando el trabajo cambia de paso.
 */
export function FichaFlotante({
  t,
  hoy,
  estudio,
  puedeOperar,
  ocupada,
  aviso,
  acciones,
  onCerrar,
}: {
  t: TarjetaTrabajo;
  hoy: string;
  estudio: string;
  puedeOperar: boolean;
  ocupada: boolean;
  aviso: { ok: boolean; texto: string } | null;
  acciones: Acciones;
  onCerrar: () => void;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  const [detalle, setDetalle] = useState<DetalleTrabajo | null>(null);
  const [error, setError] = useState<string | null>(null);
  const e = estadoDeTarjeta(t, hoy, estudio);

  useEffect(() => {
    const d = ref.current;
    if (d && !d.open) d.showModal();
  }, []);

  // Al abrir y cada vez que el trabajo cambia de paso o se manda al laboratorio: el historial cambió.
  useEffect(() => {
    let vigente = true;
    detalleTrabajoAction(t.proyectoId).then(
      (r) => {
        if (!vigente) return;
        setError(r.ok ? null : r.error);
        if (r.ok) setDetalle(r.detalle);
      },
      () => vigente && setError("No se pudo cargar el detalle. Probá de nuevo."),
    );
    return () => {
      vigente = false;
    };
  }, [t.proyectoId, t.enteredStageAt, t.enviadoAt, t.cerrado]);

  const operable = puedeOperar && !t.cerrado;

  return (
    <dialog
      ref={ref}
      aria-labelledby="ficha-flotante-titulo"
      className="fo-card m-auto max-h-[90vh] w-[94vw] max-w-2xl overflow-y-auto p-0 backdrop:bg-black/50"
      onClose={onCerrar}
      // Un clic en el fondo oscuro (fuera de la ficha) la cierra.
      onClick={(ev) => {
        if (ev.target === ref.current) ref.current?.close();
      }}
    >
      <div className="space-y-5 p-5 sm:p-6">
        {/* Encabezado */}
        <header className="flex items-start gap-3">
          <div className="min-w-0 flex-1 space-y-1">
            <h2 id="ficha-flotante-titulo" className="text-xl font-semibold text-[var(--fo-text)]">
              {t.cliente}
            </h2>
            <p className="text-sm text-[var(--fo-muted)]">
              {t.nombre} · N° {t.numero}
            </p>
            <div className="flex flex-wrap items-center gap-1.5 pt-1">
              <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs tabular-nums ${ESTILO_URGENCIA[e.urgencia]}`}>
                <CalendarDays className="size-3.5" aria-hidden />
                {t.cerrado ? "Entregado" : t.entrega ? `${textoEntrega(t.entrega, e.urgencia)} · ${fechaBA(`${t.entrega}T12:00:00Z`)}` : "Sin fecha de entrega"}
              </span>
              {t.pedido ? (
                e.debe > 0 ? (
                  <span className="rounded-full bg-[var(--fo-danger-soft)] px-2 py-0.5 text-xs font-semibold text-[var(--fo-danger)]">
                    {e.retiene ? "Retenido · debe" : "Debe"} {importeSinCentavos(e.debe)}
                  </span>
                ) : (
                  <span className="rounded-full bg-emerald-500/10 px-2 py-0.5 text-xs font-semibold text-[var(--fo-success)]">Pagado</span>
                )
              ) : null}
              <span className="rounded-full bg-[var(--fo-surface-hover)] px-2 py-0.5 text-xs text-[var(--fo-text-secondary)]">{t.recorrido.nombre}</span>
            </div>
          </div>
          <button
            type="button"
            onClick={() => ref.current?.close()}
            aria-label="Cerrar"
            className="flex size-8 shrink-0 items-center justify-center rounded-[var(--fo-radius-sm)] text-[var(--fo-muted)] hover:bg-[var(--fo-surface-hover)] hover:text-[var(--fo-text)]"
          >
            <X className="size-5" aria-hidden />
          </button>
        </header>

        {/* Dónde está */}
        <Seccion titulo="Dónde está">
          <ol className="space-y-1.5">
            {e.orden.map((etapa, i) => {
              const hecha = i < e.indice;
              const ahora = i === e.indice && !t.cerrado;
              return (
                <li key={etapa.id} className="flex items-center gap-2.5 text-sm">
                  <span
                    className={`flex size-5 shrink-0 items-center justify-center rounded-full text-[10px] font-semibold ${
                      hecha
                        ? "bg-[var(--fo-accent)] text-[var(--fo-on-accent,#fff)]"
                        : ahora
                          ? "border-2 border-[var(--fo-accent)] text-[var(--fo-accent)]"
                          : "border border-[var(--fo-border)] text-[var(--fo-muted-soft)]"
                    }`}
                    aria-hidden
                  >
                    {hecha ? <Check className="size-3" /> : i + 1}
                  </span>
                  <span className={ahora ? "font-semibold text-[var(--fo-text)]" : hecha ? "text-[var(--fo-text-secondary)]" : "text-[var(--fo-muted)]"}>
                    {etapa.name}
                  </span>
                  {ahora ? (
                    <span className="text-xs text-[var(--fo-muted)]">← está acá desde el {fechaHoraBA(t.enteredStageAt)}</span>
                  ) : null}
                </li>
              );
            })}
          </ol>
          {t.cerrado ? <p className="text-sm text-[var(--fo-success)]">Trabajo terminado{t.cerradoAt ? ` el ${fechaHoraBA(t.cerradoAt)}` : ""}.</p> : null}
          <p className="text-xs text-[var(--fo-muted)]">
            Columna del tablero: {FASE_INFO[t.fase].titulo}. {FASE_INFO[t.fase].ayuda}
          </p>
        </Seccion>

        {/* Qué sigue */}
        {operable ? (
          <Seccion titulo="¿Qué sigue?">
            <div className="space-y-2">
              {e.porEnviar ? (
                <>
                  <Accion
                    principal
                    icono={<Send className="size-4" aria-hidden />}
                    texto={`Enviar a ${t.proveedor}`}
                    explicacion={`Le manda el pedido por correo a ${t.proveedor} y el trabajo pasa a «${e.siguiente?.name ?? "En el proveedor"}».`}
                    onClick={acciones.onEnviar}
                    disabled={ocupada}
                  />
                  {e.siguiente ? (
                    <Accion
                      icono={<ArrowRight className="size-4" aria-hidden />}
                      texto="Ya se lo mandé"
                      explicacion={`Pasa a «${e.siguiente.name}» sin mandarle ningún correo a ${t.proveedor}. Usalo si el pedido ya salió por WhatsApp o en mano.`}
                      onClick={acciones.onAvanzar}
                      disabled={ocupada}
                    />
                  ) : null}
                </>
              ) : t.fase === "EN_PROVEEDOR" ? (
                <>
                  <Accion
                    principal
                    icono={<PackageCheck className="size-4" aria-hidden />}
                    texto="Llegó"
                    explicacion={`Pasa a «Listo para retirar»${t.email ? ` y le avisa por correo a ${t.email}` : ""}.`}
                    onClick={acciones.onLlego}
                    disabled={ocupada}
                  />
                  {e.siguiente ? (
                    <Accion
                      icono={<ArrowRight className="size-4" aria-hidden />}
                      texto={`Pasar a «${e.siguiente.name}»`}
                      explicacion="Avanza un solo paso, a mano."
                      onClick={acciones.onAvanzar}
                      disabled={ocupada}
                    />
                  ) : null}
                </>
              ) : t.fase === "LISTO" ? (
                <>
                  <Accion
                    principal
                    icono={<Check className="size-4" aria-hidden />}
                    texto="Entregado"
                    explicacion={
                      e.retiene && t.pedido
                        ? mensajeCandado(t.pedido.numero, t.pedido.saldoMinor)
                        : e.siguiente
                          ? `Pasa a «${e.siguiente.name}»: el cliente ya se lo llevó.`
                          : "Termina el trabajo: el cliente ya se lo llevó."
                    }
                    onClick={acciones.onAvanzar}
                    disabled={ocupada || e.retiene}
                  />
                  {e.whatsapp ? (
                    <Accion
                      icono={<MessageCircle className="size-4" aria-hidden />}
                      texto="Avisar por WhatsApp"
                      explicacion="Abre WhatsApp con el mensaje de «ya está listo para retirar» escrito."
                      href={e.whatsapp}
                    />
                  ) : null}
                  {t.email ? (
                    <Accion
                      icono={<Mail className="size-4" aria-hidden />}
                      texto="Reenviar el correo"
                      explicacion={`Le vuelve a mandar a ${t.email} el aviso de que está listo.`}
                      onClick={acciones.onCorreo}
                      disabled={ocupada}
                    />
                  ) : null}
                </>
              ) : (
                <Accion
                  principal
                  icono={e.siguiente ? <ArrowRight className="size-4" aria-hidden /> : <CheckCircle2 className="size-4" aria-hidden />}
                  texto={e.siguiente ? `Pasar a «${e.siguiente.name}»` : "Terminar"}
                  explicacion={e.siguiente ? "Avanza el trabajo al paso siguiente." : "Cierra el trabajo como terminado."}
                  onClick={acciones.onAvanzar}
                  disabled={ocupada}
                />
              )}
              {e.anterior ? (
                <Accion
                  icono={<Undo2 className="size-4" aria-hidden />}
                  texto={`Volver a «${e.anterior.name}»`}
                  explicacion="Deshace el último paso, por si se avanzó sin querer."
                  onClick={acciones.onVolver}
                  disabled={ocupada}
                />
              ) : null}
            </div>
          </Seccion>
        ) : puedeOperar && t.cerrado && e.anterior ? (
          <Seccion titulo="¿Qué sigue?">
            <Accion
              icono={<Undo2 className="size-4" aria-hidden />}
              texto={`Reabrir en «${e.anterior.name}»`}
              explicacion="Vuelve a poner el trabajo en curso, por si se cerró sin querer."
              onClick={acciones.onVolver}
              disabled={ocupada}
            />
          </Seccion>
        ) : null}

        {aviso ? (
          <p role="status" className={`text-sm ${aviso.ok ? "text-[var(--fo-success)]" : "text-[var(--fo-danger)]"}`}>
            {aviso.texto}
          </p>
        ) : null}

        {/* Lo que se lee al abrir */}
        {error ? (
          <p className="text-sm text-[var(--fo-danger)]">{error}</p>
        ) : !detalle ? (
          <p className="text-sm text-[var(--fo-muted)]">Cargando el detalle…</p>
        ) : (
          <Detalle t={t} d={detalle} />
        )}

        <footer className="flex flex-wrap items-center justify-end gap-2 border-t border-[var(--fo-border)] pt-4">
          <Link href={`/proyectos/${t.proyectoId}`} className="fo-btn fo-btn-secondary inline-flex items-center gap-1.5 text-sm">
            Abrir la ficha completa
            <ExternalLink className="size-3.5" aria-hidden />
          </Link>
          <button type="button" onClick={() => ref.current?.close()} className="fo-btn fo-btn-primary text-sm">
            Cerrar
          </button>
        </footer>
      </div>
    </dialog>
  );
}

function Detalle({ t, d }: { t: TarjetaTrabajo; d: DetalleTrabajo }) {
  return (
    <>
      {d.descripcion || d.responsable ? (
        <Seccion titulo="Trabajo">
          {d.descripcion ? <p className="whitespace-pre-line text-sm text-[var(--fo-text)]">{d.descripcion}</p> : null}
          {d.responsable ? <Dato etiqueta="Responsable" valor={d.responsable} /> : null}
        </Seccion>
      ) : null}

      {d.pedido ? (
        <Seccion titulo={`Pedido N° ${d.pedido.numero}`}>
          {d.pedido.items.length > 0 ? (
            <ul className="space-y-0.5 text-sm text-[var(--fo-text)]">
              {d.pedido.items.map((i, k) => (
                <li key={k}>
                  <span className="tabular-nums text-[var(--fo-muted)]">{i.cantidad} ×</span> {i.nombre}
                </li>
              ))}
            </ul>
          ) : null}
          <div className="grid grid-cols-3 gap-2 rounded-[var(--fo-radius-sm)] bg-[var(--fo-surface-hover)] p-3 text-sm">
            <Importe etiqueta="Total" minor={d.pedido.totalMinor} />
            <Importe etiqueta="Cobrado" minor={d.pedido.cobradoMinor} />
            <Importe etiqueta="Saldo" minor={Math.max(0, d.pedido.totalMinor - d.pedido.cobradoMinor)} peligro={d.pedido.totalMinor > d.pedido.cobradoMinor} />
          </div>
          {d.pedido.cobros.length > 0 ? (
            <ul className="space-y-0.5 text-xs text-[var(--fo-muted)]">
              {d.pedido.cobros.map((c) => (
                <li key={c.id}>
                  {fechaHoraBA(c.fecha)} · {c.medio} · <span className="tabular-nums">{formatMinorArs(c.montoMinor)}</span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-xs text-[var(--fo-muted)]">Todavía no tiene cobros.</p>
          )}
          <Dato etiqueta="Estado del pedido" valor={d.pedido.estado} />
          <Link href={`/pedidos/${encodeURIComponent(d.pedido.id)}`} className="inline-block text-sm text-[var(--fo-accent)] hover:underline">
            Ver el pedido
          </Link>
        </Seccion>
      ) : null}

      {d.impresion ? (
        <Seccion titulo={`Copias impresas · pedido N° ${d.impresion.numero}`}>
          <ul className="space-y-0.5 text-sm text-[var(--fo-text)]">
            {d.impresion.copias.map((c) => (
              <li key={`${c.tamano}-${c.papel}`}>
                <span className="tabular-nums text-[var(--fo-muted)]">{c.cantidad} ×</span> {c.tamano} · {c.papel}
              </li>
            ))}
          </ul>
          <Dato etiqueta="Entrega" valor={d.impresion.entrega ? `Envío a ${d.impresion.entrega.direccion}` : "Retira en el local"} />
        </Seccion>
      ) : null}

      {t.proveedor ? (
        <Seccion titulo="Laboratorio">
          <Dato etiqueta="Proveedor" valor={t.proveedor} />
          <Dato etiqueta="Envío" valor={t.enviadoAt ? `Se le mandó el ${fechaHoraBA(t.enviadoAt)}` : "Todavía no se le mandó"} />
          {d.proveedorRef ? <Dato etiqueta="Referencia" valor={d.proveedorRef} /> : null}
        </Seccion>
      ) : null}

      {t.telefono || t.email ? (
        <Seccion titulo="Contacto">
          {t.telefono ? <Dato etiqueta="Teléfono" valor={t.telefono} /> : null}
          {t.email ? <Dato etiqueta="Correo" valor={t.email} /> : null}
        </Seccion>
      ) : null}

      {d.notas.length > 0 ? (
        <Seccion titulo="Notas">
          <ul className="space-y-2">
            {d.notas.map((n) => (
              <li key={n.id} className="text-sm">
                <p className="whitespace-pre-line text-[var(--fo-text)]">{n.texto}</p>
                <p className="text-xs text-[var(--fo-muted)]">
                  {n.autor ? `${n.autor} · ` : ""}
                  {fechaHoraBA(n.fecha)}
                </p>
              </li>
            ))}
          </ul>
        </Seccion>
      ) : null}

      {d.historial.length > 0 ? (
        <Seccion titulo="Historial">
          <ul className="space-y-1.5">
            {d.historial.map((p) => (
              <li key={p.id} className="text-sm">
                <span className="text-[var(--fo-text)]">
                  {p.clase === "inicio"
                    ? `Entró en «${p.a}»`
                    : p.clase === "cierre"
                      ? `Se cerró: ${p.a}`
                      : p.clase === "vencimiento"
                        ? `Cambió el vencimiento de «${p.a}»`
                        : `De «${p.de}» a «${p.a}»`}
                </span>
                <span className="block text-xs text-[var(--fo-muted)]">
                  {fechaHoraBA(p.fecha)} · {p.quien}
                  {p.evento ? ` · ${p.evento}` : ""}
                </span>
                {p.nota ? <span className="block text-xs text-[var(--fo-text-secondary)]">{p.nota}</span> : null}
              </li>
            ))}
          </ul>
        </Seccion>
      ) : null}
    </>
  );
}

function Seccion({ titulo, children }: { titulo: string; children: React.ReactNode }) {
  return (
    <section className="space-y-2">
      <h3 className="text-xs font-semibold uppercase tracking-wide text-[var(--fo-muted-soft)]">{titulo}</h3>
      {children}
    </section>
  );
}

function Dato({ etiqueta, valor }: { etiqueta: string; valor: string }) {
  return (
    <p className="text-sm">
      <span className="text-[var(--fo-muted)]">{etiqueta}: </span>
      <span className="text-[var(--fo-text)]">{valor}</span>
    </p>
  );
}

function Importe({ etiqueta, minor, peligro }: { etiqueta: string; minor: number; peligro?: boolean }) {
  return (
    <div>
      <p className="text-xs text-[var(--fo-muted)]">{etiqueta}</p>
      <p className={`font-semibold tabular-nums ${peligro ? "text-[var(--fo-danger)]" : "text-[var(--fo-text)]"}`}>{importeSinCentavos(minor)}</p>
    </div>
  );
}

/** Una acción con su explicación al lado, para saber qué hace antes de apretarla. */
function Accion({
  icono,
  texto,
  explicacion,
  onClick,
  href,
  disabled,
  principal,
}: {
  icono: React.ReactNode;
  texto: string;
  explicacion: string;
  onClick?: () => void;
  href?: string;
  disabled?: boolean;
  principal?: boolean;
}) {
  const clase = `inline-flex min-h-9 w-full shrink-0 items-center justify-center gap-1.5 rounded-[var(--fo-radius-sm)] px-3 py-1.5 text-sm leading-tight font-semibold transition disabled:opacity-50 sm:w-56 ${
    principal
      ? "bg-[var(--fo-accent)] text-[var(--fo-on-accent,#fff)] hover:bg-[var(--fo-accent-hover)]"
      : "border border-[var(--fo-border)] bg-[var(--fo-bg-elevated)] text-[var(--fo-text)] hover:border-[var(--fo-accent)]"
  }`;
  return (
    <div className="flex flex-col gap-1.5 sm:flex-row sm:items-center sm:gap-3">
      {href ? (
        <a href={href} target="_blank" rel="noreferrer" className={clase}>
          {icono}
          <span className="text-center">{texto}</span>
        </a>
      ) : (
        <button type="button" onClick={onClick} disabled={disabled} className={clase}>
          {icono}
          <span className="text-center">{texto}</span>
        </button>
      )}
      <p className="text-xs text-[var(--fo-muted)]">{explicacion}</p>
    </div>
  );
}
