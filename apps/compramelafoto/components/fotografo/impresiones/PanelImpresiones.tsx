"use client";

import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import Card from "@/components/ui/Card";
import { DsEmptyState } from "@/components/ui/DsEmptyState";
import BarraDePasos from "@/components/fotografo/BarraDePasos";
import TablaParaImprimir from "./TablaParaImprimir";
import TarjetaDeLote from "./TarjetaDeLote";
import DialogoEnviarLote, { type DatosDeEnvio } from "./DialogoEnviarLote";
import {
  agruparEnElLaboratorio,
  columnaDelLote,
  confirmacionAlMover,
  confirmacionAlSacar,
  confirmacionDeEntrega,
  conteoDelPanel,
  laboratorioDeLaSeleccion,
  NOTA_PARA_IMPRIMIR,
  PASOS_DEL_PANEL,
  pasoInicialDelPanel,
  pedidosListosParaEntregar,
  textoDeCopiasDelPanel,
  type Columna,
  type DatosDelPanel,
  type EntradaDelPanel,
  type LoteDelPanel,
  type PedidoListo,
} from "@/lib/print-batches/panel";
import type { EstadoLote } from "@/lib/print-batches/reglas";

const ERROR_DE_RED = "No pudimos conectarnos. Revisá tu conexión y probá de nuevo.";

async function postear(url: string, body: unknown): Promise<string | null> {
  try {
    const res = await fetch(url, {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    if (res.ok) return null;
    const data = await res.json().catch(() => ({}));
    return data?.error || "No se pudo completar la acción. Probá de nuevo.";
  } catch {
    return ERROR_DE_RED;
  }
}

/** El lote de `?lote=<id>` (la etiqueta del lote tiene un QR que lleva acá). */
function loteDeLaUrl(): number | null {
  if (typeof window === "undefined") return null;
  const id = Number(new URLSearchParams(window.location.search).get("lote"));
  return Number.isSafeInteger(id) && id > 0 ? id : null;
}

function Vacio({ children }: { children: ReactNode }) {
  return (
    <Card className="overflow-hidden p-0">
      <DsEmptyState variant="tight">{children}</DsEmptyState>
    </Card>
  );
}

function Subtitulo({ children }: { children: ReactNode }) {
  return <h3 className="m-0 text-sm font-semibold text-gray-700">{children}</h3>;
}

function GrillaDeLotes({ children }: { children: ReactNode }) {
  return <div className="grid items-start gap-4 lg:grid-cols-2">{children}</div>;
}

/** «Listos para entregar» como tabla, igual que «Pedidos escolares». */
function TablaListos({ listos, ocupado, onEntregar }: { listos: PedidoListo[]; ocupado: boolean; onEntregar: (p: PedidoListo) => void }) {
  return (
    <div className="ds-table-scroll overflow-x-auto rounded-xl border border-gray-100 bg-white">
      <table className="w-full min-w-[760px] text-sm">
        <thead>
          <tr className="border-b border-gray-200 bg-gray-50">
            <th className="text-left py-3 px-3 font-medium">Pedido</th>
            <th className="text-left py-3 px-3 font-medium">Lote</th>
            <th className="text-left py-3 px-3 font-medium">Copias</th>
            <th className="text-left py-3 px-3 font-medium">Entrega</th>
            <th className="text-left py-3 px-3 font-medium">Qué hacer</th>
          </tr>
        </thead>
        <tbody>
          {listos.map((p) => {
            const e = p.entrada;
            return (
              <tr key={e.id} className="border-b border-gray-100 align-top hover:bg-gray-50">
                <td className="py-3 px-3">
                  <span className="font-medium text-gray-900">{e.cliente}</span>
                  <div className="text-xs text-gray-500">Pedido #{e.albumOrderId ?? "—"}</div>
                </td>
                <td className="py-3 px-3 whitespace-nowrap">{p.lote.nombre}</td>
                <td className="py-3 px-3">{textoDeCopiasDelPanel(e.copias)}</td>
                <td className="py-3 px-3">{e.retiraCliente ? "Retira en el laboratorio" : "La entregás vos"}</td>
                <td className="py-3 px-3">
                  <div className="flex flex-wrap items-center gap-3">
                    <button
                      type="button"
                      disabled={ocupado}
                      onClick={() => onEntregar(p)}
                      className="inline-flex items-center rounded-lg bg-[#c27b3d] px-3 py-1.5 text-xs font-semibold text-white hover:bg-[#b06a2f] disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      Entregado
                    </button>
                    {e.codigoQr ? (
                      <a
                        href={`/pedido/entrega/${encodeURIComponent(e.codigoQr)}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-xs text-[#c27b3d] hover:underline"
                      >
                        Ver el QR del sobre
                      </a>
                    ) : null}
                  </div>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function Mensaje({ tipo, children }: { tipo: "error" | "ok"; children: ReactNode }) {
  return (
    <p role={tipo === "error" ? "alert" : "status"} className={tipo === "error" ? "rounded-lg bg-red-50 px-3 py-2 text-sm text-red-800" : "rounded-lg bg-emerald-50 px-3 py-2 text-sm text-emerald-800"}>
      {children}
    </p>
  );
}

export default function PanelImpresiones() {
  const [datos, setDatos] = useState<DatosDelPanel | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [aviso, setAviso] = useState<string | null>(null);
  const [ocupado, setOcupado] = useState(false);
  const [seleccion, setSeleccion] = useState<Set<number>>(new Set());
  const [enviarLote, setEnviarLote] = useState<LoteDelPanel | null>(null);
  const [errorEnvio, setErrorEnvio] = useState<string | null>(null);
  const [resaltado, setResaltado] = useState<number | null>(null);
  // null = todavía no eligió: se abre en el primer paso con pedidos (o en el del lote del QR).
  const [paso, setPaso] = useState<Columna | null>(null);
  const [avisarImpresos, setAvisarImpresos] = useState(true);
  const yaDesplazo = useRef(false);

  const cargar = useCallback(async () => {
    try {
      const res = await fetch("/api/fotografo/impresiones", { credentials: "include", cache: "no-store" });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.error || "No pudimos cargar tus impresiones.");
      // No borra `error`: recargar después de una acción fallida no tiene que esconder el motivo.
      // El error se limpia al empezar la próxima acción del usuario.
      setDatos(data as DatosDelPanel);
    } catch (e: unknown) {
      setError(e instanceof Error && e.message !== "Failed to fetch" ? e.message : ERROR_DE_RED);
    }
  }, []);

  useEffect(() => {
    setResaltado(loteDeLaUrl());
    void cargar();
  }, [cargar]);

  // El lote resaltado (el del QR de la etiqueta, o el recién armado): abre su paso y lo muestra.
  useEffect(() => {
    if (!datos || resaltado == null || yaDesplazo.current) return;
    yaDesplazo.current = true;
    const lote = datos.lotes.find((l) => l.id === resaltado);
    const suPaso = lote ? columnaDelLote(lote.estado) : null;
    if (!suPaso) {
      setAviso("Ese lote ya no está en el panel (se anuló o se cerró hace más de 30 días).");
      return;
    }
    setPaso(suPaso);
    requestAnimationFrame(() => document.getElementById(`lote-${resaltado}`)?.scrollIntoView({ behavior: "smooth", block: "center" }));
  }, [datos, resaltado]);

  async function accion(url: string, body: unknown, exito?: string): Promise<boolean> {
    setOcupado(true);
    setError(null);
    setAviso(null);
    const fallo = await postear(url, body);
    if (fallo) setError(fallo);
    else if (exito) setAviso(exito);
    await cargar();
    setOcupado(false);
    return fallo == null;
  }

  async function armar(albumOrderIds: number[], labContactId: number | null) {
    let nuevo: number | null = null;
    setOcupado(true);
    setError(null);
    setAviso(null);
    try {
      const res = await fetch("/api/fotografo/impresiones/lotes", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ albumOrderIds, labContactId }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) setError(data?.error || "No se pudo armar el lote. Probá de nuevo.");
      else {
        setSeleccion(new Set());
        nuevo = typeof data.batchId === "number" ? data.batchId : null;
        setAviso(`Listo: armaste el ${data.nombre}. Revisalo y mandalo al laboratorio.`);
      }
    } catch {
      setError(ERROR_DE_RED);
    }
    await cargar();
    // Recién con los datos nuevos: si no, el lote recién armado todavía no está y se avisaría que no existe.
    if (nuevo != null) {
      yaDesplazo.current = false;
      setResaltado(nuevo);
    }
    setOcupado(false);
  }

  async function marcarImpresos(albumOrderIds: number[]) {
    const n = albumOrderIds.length;
    const pedidos = `${n} ${n === 1 ? "pedido" : "pedidos"}`;
    const texto = [
      `¿Marcar ${pedidos} como ya impresos?`,
      "Es para lo que imprimiste por tu cuenta, sin mandarlo a un laboratorio. Pasan a «Listos para entregar» y los entregás vos.",
      avisarImpresos ? "Les avisamos por correo a los clientes que sus copias están listas." : "No les mandamos correo a los clientes.",
    ].join("\n\n");
    if (!window.confirm(texto)) return;
    setOcupado(true);
    setError(null);
    setAviso(null);
    try {
      const res = await fetch("/api/fotografo/impresiones/lotes", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ accion: "IMPRESOS_POR_FUERA", albumOrderIds, avisar: avisarImpresos }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) setError(data?.error || "No se pudieron marcar como impresos. Probá de nuevo.");
      else {
        setSeleccion(new Set());
        setAviso(`Listo: ${pedidos} ${n === 1 ? "quedó" : "quedaron"} como ya impresos, en «Listos para entregar».`);
      }
    } catch {
      setError(ERROR_DE_RED);
    }
    await cargar();
    setOcupado(false);
  }

  async function confirmarEnvio(lote: LoteDelPanel, d: DatosDeEnvio) {
    if (!window.confirm(`¿Enviar el ${lote.nombre}? Le llega un correo al laboratorio con el enlace.`)) return;
    setOcupado(true);
    setErrorEnvio(null);
    const fallo = await postear(`/api/fotografo/impresiones/lotes/${lote.id}`, {
      accion: "ENVIAR",
      labContactId: d.labContactId,
      mensaje: d.mensaje,
      entregaPreferida: d.entregaPreferida,
      fechaPrometida: d.fechaPrometida || null,
    });
    await cargar();
    setOcupado(false);
    if (fallo) {
      setErrorEnvio(fallo);
      return;
    }
    setEnviarLote(null);
    setAviso(`Mandamos el ${lote.nombre} al laboratorio.`);
  }

  function deshacer(lote: LoteDelPanel) {
    if (!window.confirm(`¿Deshacer el ${lote.nombre}? Los pedidos vuelven a «Para imprimir».`)) return;
    void accion(`/api/fotografo/impresiones/lotes/${lote.id}`, { accion: "DESHACER" }, `Deshiciste el ${lote.nombre}.`);
  }

  function mover(lote: LoteDelPanel, hacia: EstadoLote) {
    const aviso = confirmacionAlMover(lote, hacia);
    if (aviso && !window.confirm(aviso)) return;
    void accion(`/api/fotografo/impresiones/lotes/${lote.id}`, { accion: "MOVER", hacia });
  }

  function pagado(lote: LoteDelPanel) {
    if (!window.confirm(`¿Marcar el ${lote.nombre} como pagado al laboratorio? Es sólo un registro: el pago lo hacés por fuera.`)) return;
    void accion(`/api/fotografo/impresiones/lotes/${lote.id}`, { accion: "PAGADO_AL_LAB" });
  }

  function quitar(lote: LoteDelPanel, e: EntradaDelPanel) {
    if (!window.confirm(confirmacionAlSacar(lote, e.albumOrderId))) return;
    const n = e.albumOrderId != null ? ` #${e.albumOrderId}` : "";
    const lab = lote.estado !== "ARMADO" && !lote.porFuera && ["ENVIADO", "EN_PRODUCCION", "LISTO", "DESPACHADO"].includes(lote.estado);
    void accion(
      `/api/fotografo/impresiones/entradas/${e.id}`,
      { motivo: "SACAR" },
      `Sacaste el pedido${n} del ${lote.nombre}: volvió a «Para imprimir».${lab ? " Le avisamos al laboratorio por correo." : ""}`,
    );
  }

  function entregar(p: PedidoListo) {
    if (!window.confirm(confirmacionDeEntrega(p.entrada.albumOrderId))) return;
    const n = p.entrada.albumOrderId != null ? ` #${p.entrada.albumOrderId}` : "";
    void accion(`/api/fotografo/impresiones/entradas/${p.entrada.id}`, { accion: "ENTREGADO" }, `Listo: el pedido${n} quedó entregado.`);
  }

  if (!datos) {
    return error ? <Mensaje tipo="error">{error}</Mensaje> : <p className="text-gray-600">Cargando...</p>;
  }

  const porColumna = (c: Columna) => datos.lotes.filter((l) => columnaDelLote(l.estado) === c);
  const tarjeta = (l: LoteDelPanel) => (
    <TarjetaDeLote
      key={l.id}
      lote={l}
      resaltado={resaltado === l.id}
      ocupado={ocupado}
      onEnviar={(x) => {
        setErrorEnvio(null);
        setEnviarLote(x);
      }}
      onDeshacer={deshacer}
      onMover={mover}
      onPagadoAlLab={pagado}
      onQuitar={quitar}
    />
  );
  const conteo = conteoDelPanel(datos);
  const vista: Columna = paso ?? pasoInicialDelPanel(conteo);
  const info = PASOS_DEL_PANEL.find((p) => p.clave === vista)!;
  const armados = porColumna("PARA_IMPRIMIR");
  const enLab = porColumna("EN_LABORATORIO");
  const recibidos = porColumna("LISTOS");
  const listos = pedidosListosParaEntregar(datos.lotes);
  const entregados = porColumna("ENTREGADOS");
  const elegidos = datos.paraImprimir.filter((p) => seleccion.has(p.albumOrderId));
  const lab = laboratorioDeLaSeleccion(elegidos);

  function elegirPaso(c: Columna) {
    setPaso(c);
    setSeleccion(new Set());
    setError(null);
    setAviso(null);
  }

  return (
    <div className="space-y-6">
      <BarraDePasos
        pasos={PASOS_DEL_PANEL.map((p) => ({ ...p, cantidad: conteo[p.clave] }))}
        activo={vista}
        onElegir={elegirPaso}
        anchoMinimo={600}
      />

      {/* Lo que hay que hacer en este paso */}
      <Card className="space-y-2 p-4">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h2 className="m-0 text-base font-semibold text-gray-900">
            {info.numero}. {info.titulo}
            <span className="ml-2 text-sm font-normal text-gray-500">{info.ayuda}</span>
          </h2>
          {vista === "PARA_IMPRIMIR" && elegidos.length > 0 ? (
            <span className="text-sm text-gray-700">
              {elegidos.length} {elegidos.length === 1 ? "marcado" : "marcados"}
            </span>
          ) : null}
        </div>
        {vista === "PARA_IMPRIMIR" && datos.paraImprimir.length > 0 ? (
          <div className="flex flex-wrap items-center gap-3">
            <button
              type="button"
              disabled={ocupado || elegidos.length === 0 || !lab.ok}
              onClick={() => lab.ok && void armar(elegidos.map((p) => p.albumOrderId), lab.labContactId)}
              className="inline-flex items-center rounded-lg bg-[#c27b3d] px-4 py-2 text-sm font-semibold text-white hover:bg-[#b06a2f] disabled:cursor-not-allowed disabled:opacity-50"
            >
              {ocupado
                ? "Armando…"
                : elegidos.length > 0
                  ? `Armar lote con ${elegidos.length} ${elegidos.length === 1 ? "pedido" : "pedidos"}`
                  : "Marcá pedidos para armar un lote"}
            </button>
            <button
              type="button"
              disabled={ocupado || elegidos.length === 0}
              onClick={() => void marcarImpresos(elegidos.map((p) => p.albumOrderId))}
              className="inline-flex items-center rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-semibold text-gray-800 hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-50"
              title="Para los que imprimiste por tu cuenta, sin mandarlos a un laboratorio"
            >
              {elegidos.length > 0 ? `Ya los imprimí (${elegidos.length})` : "Ya los imprimí"}
            </button>
            <label className="inline-flex items-center gap-1.5 text-xs text-gray-600">
              <input
                type="checkbox"
                checked={avisarImpresos}
                onChange={(ev) => setAvisarImpresos(ev.target.checked)}
                className="h-3.5 w-3.5 accent-[#c27b3d]"
              />
              Avisar a los clientes por correo
            </label>
            {!lab.ok ? <span className="text-sm text-red-700">{lab.error}</span> : null}
          </div>
        ) : null}
        {error ? <Mensaje tipo="error">{error}</Mensaje> : null}
        {aviso ? <Mensaje tipo="ok">{aviso}</Mensaje> : null}
      </Card>

      {vista === "PARA_IMPRIMIR" ? (
        <>
          {armados.length ? (
            <section className="space-y-3">
              <Subtitulo>Lotes armados, sin mandar todavía</Subtitulo>
              <GrillaDeLotes>{armados.map(tarjeta)}</GrillaDeLotes>
            </section>
          ) : null}
          <section className="space-y-3">
            {armados.length ? <Subtitulo>Pedidos para armar un lote</Subtitulo> : null}
            {datos.paraImprimir.length ? (
              <TablaParaImprimir
                pedidos={datos.paraImprimir}
                laboratorios={datos.laboratorios}
                seleccion={seleccion}
                onCambiarSeleccion={setSeleccion}
                deshabilitada={ocupado}
              />
            ) : (
              <Vacio>No hay pedidos pagados con copias para imprimir.</Vacio>
            )}
            <p className="m-0 text-xs text-gray-500">{NOTA_PARA_IMPRIMIR}</p>
          </section>
        </>
      ) : null}

      {vista === "EN_LABORATORIO" ? (
        enLab.length ? (
          agruparEnElLaboratorio(enLab).map((g) => (
            <section key={g.titulo} className="space-y-3">
              <Subtitulo>
                {g.titulo} <span className="font-normal text-gray-500">({g.lotes.length})</span>
              </Subtitulo>
              <GrillaDeLotes>{g.lotes.map(tarjeta)}</GrillaDeLotes>
            </section>
          ))
        ) : (
          <Vacio>No hay lotes en el laboratorio.</Vacio>
        )
      ) : null}

      {vista === "LISTOS" ? (
        <>
          {listos.length ? (
            <TablaListos listos={listos} ocupado={ocupado} onEntregar={entregar} />
          ) : (
            <Vacio>Cuando un pedido esté listo para retirar, aparece acá para marcarlo entregado.</Vacio>
          )}
          {recibidos.length ? (
            <section className="space-y-3">
              <Subtitulo>Lotes recibidos o impresos por fuera (se cierran solos cuando se entrega todo)</Subtitulo>
              <GrillaDeLotes>{recibidos.map(tarjeta)}</GrillaDeLotes>
            </section>
          ) : null}
        </>
      ) : null}

      {vista === "ENTREGADOS" ? (
        entregados.length ? <GrillaDeLotes>{entregados.map(tarjeta)}</GrillaDeLotes> : <Vacio>Todavía no hay lotes entregados.</Vacio>
      ) : null}

      {enviarLote ? (
        <DialogoEnviarLote
          lote={enviarLote}
          laboratorios={datos.laboratorios}
          enviando={ocupado}
          error={errorEnvio}
          onCancelar={() => setEnviarLote(null)}
          onEnviar={(d) => void confirmarEnvio(enviarLote, d)}
        />
      ) : null}
    </div>
  );
}
