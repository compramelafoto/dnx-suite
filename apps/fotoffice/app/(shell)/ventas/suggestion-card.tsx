"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import {
  ACCIONES_CON_MENSAJE,
  ETIQUETA_ACCION,
  ETIQUETA_RESULTADO,
  type PrioridadVenta,
} from "@/lib/sales-assistant/constants";
import { fechaVenta, textoEnDias, type FiltroBandeja } from "@/lib/sales-assistant/format";
import { enlaceWhatsapp } from "@/lib/sales-assistant/phone";
import type { TarjetaBandeja } from "@/lib/sales-assistant/repository";
import {
  archivarAction,
  descartarAction,
  marcarEnviadaAction,
  posponerAction,
  type PanelState,
} from "./actions";
import { EstadoPanel } from "./estado-panel";
import { ResultadoBotones } from "./resultado-botones";

const inicial: PanelState = { error: null, ok: null };

const TONO_PRIORIDAD: Record<PrioridadVenta, string> = {
  ALTA: "border-[var(--fo-danger-border)] bg-[var(--fo-danger-soft)] text-[var(--fo-danger)]",
  MEDIA: "border-[var(--fo-warning-border)] bg-[var(--fo-warning-soft)] text-[var(--fo-warning)]",
  BAJA: "border-[var(--fo-border)] bg-[var(--fo-surface-muted)] text-[var(--fo-muted)]",
};

/**
 * Una oportunidad de la bandeja y lo que se puede hacer con ella hoy.
 *
 * **Nada se manda solo.** "Abrir WhatsApp" arma un enlace wa.me con el texto que quedó en el
 * cuadro (editado o no) y lo abre; el mensaje lo envía la persona desde su teléfono. Recién
 * después se anota como enviado, y aparecen los botones para contar qué contestó. Esos botones
 * siguen ahí mientras el último envío no tenga resultado, aunque la corrida del día siguiente ya
 * haya dejado otra sugerencia vigente (`tarjeta.esperandoResultado`).
 *
 * El enlace se arma acá y no en el servidor para que salga con el texto que está en pantalla en
 * ese momento, no con el que se guardó.
 */
export function SuggestionCard({
  tarjeta,
  filtro,
  whatsappDisponible,
  alboomUrl,
  diasHastaEvento,
}: {
  tarjeta: TarjetaBandeja;
  filtro: FiltroBandeja;
  whatsappDisponible: boolean;
  alboomUrl: string | null;
  diasHastaEvento: number | null;
}) {
  const s = tarjeta.sugerencia;
  const [texto, setTexto] = useState(s?.mensaje ?? "");
  const [enviada, setEnviada] = useState(s?.estado === "ENVIADA");
  // El envío del que falta saber qué contestó: el que ya venía de la base, o el que se acaba de
  // anotar desde esta tarjeta.
  const [esperaRespuesta, setEsperaRespuesta] = useState(tarjeta.esperandoResultado);
  const [sugerenciaEnviadaId, setSugerenciaEnviadaId] = useState(tarjeta.sugerenciaEnviadaId);
  const [state, setState] = useState<PanelState>(inicial);
  const [ocupado, startTransition] = useTransition();

  function correr(accion: () => Promise<PanelState>, siSaleBien?: () => void) {
    startTransition(async () => {
      const r = await accion();
      setState(r);
      if (!r.error) siSaleBien?.();
    });
  }

  const vigente = s !== null && (s.estado === "PENDIENTE" || s.estado === "POSPUESTA");
  const llevaMensaje = s !== null && ACCIONES_CON_MENSAJE.includes(s.accion);
  const paraCerrar = filtro === "PARA_CERRAR";
  const archivada = filtro === "ARCHIVADAS";

  function abrirWhatsapp() {
    if (!s) return;
    const url = enlaceWhatsapp(tarjeta.telefono, texto);
    if (!url) return;
    window.open(url, "_blank", "noopener");
    correr(
      () => marcarEnviadaAction(s.id, texto),
      () => {
        setEnviada(true);
        setEsperaRespuesta(true);
        setSugerenciaEnviadaId(s.id);
      },
    );
  }

  return (
    <article className="fo-card space-y-4 !p-4 sm:!p-5">
      <header className="space-y-1">
        <div className="flex flex-wrap items-start justify-between gap-2">
          <h2 className="min-w-0 text-base font-semibold leading-snug">{tarjeta.nombre}</h2>
          {s ? (
            <span
              className={`inline-flex shrink-0 items-center rounded-full border px-2.5 py-0.5 text-xs font-medium ${
                TONO_PRIORIDAD[tarjeta.prioridad ?? s.prioridad]
              }`}
            >
              {ETIQUETA_ACCION[s.accion]}
            </span>
          ) : null}
        </div>
        <p className="text-sm text-[var(--fo-text-secondary)]">
          {[
            tarjeta.tipoEvento,
            tarjeta.fechaEvento
              ? `${fechaVenta(tarjeta.fechaEvento)}${diasHastaEvento !== null ? ` (${textoEnDias(diasHastaEvento)})` : ""}`
              : "Sin fecha de evento",
          ]
            .filter(Boolean)
            .join(" · ")}
        </p>
        <p className="text-xs text-[var(--fo-muted)]">
          Etapa en Alboom: {tarjeta.etapa}
          {tarjeta.ultimoResultado ? ` · Última respuesta: ${ETIQUETA_RESULTADO[tarjeta.ultimoResultado]}` : ""}
        </p>
      </header>

      {paraCerrar ? (
        <p className="text-sm leading-relaxed">{tarjeta.motivoCierre ?? s?.motivo ?? "Hace mucho que no se mueve."}</p>
      ) : s ? (
        <p className="text-sm leading-relaxed">{s.motivo}</p>
      ) : (
        <p className="text-sm text-[var(--fo-muted)]">Sin sugerencia hoy.</p>
      )}

      {!paraCerrar && !archivada && vigente && llevaMensaje && !enviada ? (
        s?.mensaje ? (
          <div className="space-y-3">
            <label className="fo-field-stack">
              <span className="fo-label">Mensaje propuesto (lo podés cambiar)</span>
              <textarea
                value={texto}
                onChange={(e) => setTexto(e.target.value)}
                rows={5}
                className="fo-input text-base sm:text-sm"
              />
            </label>
            {whatsappDisponible ? (
              <button
                type="button"
                onClick={abrirWhatsapp}
                disabled={ocupado || texto.trim() === ""}
                className="fo-btn fo-btn-primary min-h-11 w-full text-base sm:w-auto"
              >
                Abrir WhatsApp
              </button>
            ) : (
              <p className="fo-alert-warning rounded-[var(--fo-radius-sm)] p-3 text-sm">
                Número inválido en Alboom
              </p>
            )}
          </div>
        ) : (
          <p className="text-sm text-[var(--fo-muted)]">Sin sugerencia hoy.</p>
        )
      ) : null}

      {esperaRespuesta && !paraCerrar && !archivada ? (
        <ResultadoBotones opportunityId={tarjeta.oportunidadId} suggestionId={sugerenciaEnviadaId} />
      ) : null}

      <EstadoPanel state={state} />

      <footer className="flex flex-wrap gap-2">
        {paraCerrar ? (
          <button
            type="button"
            onClick={() => correr(() => archivarAction(tarjeta.oportunidadId, true))}
            disabled={ocupado}
            className="fo-btn fo-btn-secondary min-h-11"
          >
            Archivar en el asistente
          </button>
        ) : null}
        {archivada ? (
          <button
            type="button"
            onClick={() => correr(() => archivarAction(tarjeta.oportunidadId, false))}
            disabled={ocupado}
            className="fo-btn fo-btn-secondary min-h-11"
          >
            Desarchivar
          </button>
        ) : null}
        {!paraCerrar && !archivada && vigente && !enviada && s ? (
          <>
            {([1, 3, 7] as const).map((dias) => (
              <button
                key={dias}
                type="button"
                onClick={() => correr(() => posponerAction(s.id, dias))}
                disabled={ocupado}
                className="fo-btn fo-btn-ghost min-h-11"
              >
                Posponer {dias === 1 ? "1 día" : `${dias} días`}
              </button>
            ))}
            <button
              type="button"
              onClick={() => correr(() => descartarAction(s.id))}
              disabled={ocupado}
              className="fo-btn fo-btn-ghost min-h-11"
            >
              Descartar sugerencia
            </button>
          </>
        ) : null}
        {alboomUrl ? (
          <a href={alboomUrl} target="_blank" rel="noopener noreferrer" className="fo-btn fo-btn-ghost min-h-11">
            {paraCerrar ? "Abrir en Alboom" : "Ver en Alboom"}
          </a>
        ) : null}
        <Link href={`/ventas/${tarjeta.oportunidadId}`} className="fo-btn fo-btn-ghost min-h-11">
          Ver detalle
        </Link>
      </footer>
    </article>
  );
}
