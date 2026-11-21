"use client";

import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import Link from "next/link";
import ColumnaParaImprimir from "./ColumnaParaImprimir";
import TarjetaDeLote from "./TarjetaDeLote";
import DialogoEnviarLote, { type DatosDeEnvio } from "./DialogoEnviarLote";
import { columnaDelLote, confirmacionAlMover, type Columna, type DatosDelPanel, type LoteDelPanel } from "@/lib/print-batches/panel";
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

function ColumnaDelPanel({ titulo, cantidad, unidad, nota, children }: { titulo: string; cantidad: number; unidad?: string; nota?: string; children: ReactNode }) {
  return (
    <section className="ds-stack-section min-w-0 gap-2 rounded-xl bg-gray-100/70 p-2.5">
      <header className="flex items-baseline justify-between gap-2 px-0.5">
        <h2 className="text-sm font-semibold text-gray-900">
          {titulo} <span className="font-normal tabular-nums text-gray-500">{cantidad}{unidad ? ` ${unidad}` : ""}</span>
        </h2>
        {nota ? <span className="text-[11px] text-gray-500">{nota}</span> : null}
      </header>
      <div className="space-y-2">{children}</div>
    </section>
  );
}

function Vacio({ children }: { children: ReactNode }) {
  return <p className="rounded-lg border border-dashed border-gray-200 bg-white/60 px-3 py-4 text-center text-xs text-gray-500">{children}</p>;
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

  useEffect(() => {
    if (!datos || resaltado == null || yaDesplazo.current) return;
    yaDesplazo.current = true;
    const el = document.getElementById(`lote-${resaltado}`);
    if (el) el.scrollIntoView({ behavior: "smooth", block: "center" });
    else setAviso("Ese lote ya no está en el panel (se anuló o se cerró hace más de 30 días).");
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
        setResaltado(data.batchId ?? null);
        setAviso(`Listo: armaste el ${data.nombre}. Revisalo y mandalo al laboratorio.`);
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

  function quitar(lote: LoteDelPanel, entradaId: number, motivo: "SACAR" | "REIMPRIMIR") {
    const texto =
      motivo === "SACAR"
        ? `¿Sacar este pedido del ${lote.nombre}? Vuelve a «Para imprimir».`
        : `¿Reimprimir este pedido? Sale del ${lote.nombre} y vuelve a «Para imprimir» para armarlo en otro lote.`;
    if (!window.confirm(texto)) return;
    void accion(`/api/fotografo/impresiones/entradas/${entradaId}`, { motivo });
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
  const armados = porColumna("PARA_IMPRIMIR");
  const enLab = porColumna("EN_LABORATORIO");
  const listos = porColumna("LISTOS");
  const entregados = porColumna("ENTREGADOS");
  const disponibles = datos.paraImprimir.filter((p) => p.motivo == null).length;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="max-w-3xl text-sm text-gray-600 ds-readable-text">
          Elegí los pedidos, armá el lote y mandalo al laboratorio. Seguí acá cada lote hasta entregarle las copias a tus clientes.
        </p>
        <Link href="/fotografo/impresiones/laboratorios" className="rounded-lg border border-gray-200 bg-white px-3 py-2 text-xs font-medium text-gray-700 hover:bg-gray-50">
          Mis laboratorios
        </Link>
      </div>

      {error ? <Mensaje tipo="error">{error}</Mensaje> : null}
      {aviso ? <Mensaje tipo="ok">{aviso}</Mensaje> : null}

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4 items-start">
        <ColumnaDelPanel titulo="Para imprimir" cantidad={disponibles}>
          <ColumnaParaImprimir
            pedidos={datos.paraImprimir}
            laboratorios={datos.laboratorios}
            seleccion={seleccion}
            onCambiarSeleccion={setSeleccion}
            armando={ocupado}
            onArmar={armar}
            lotesArmados={armados.length ? <div className="space-y-2">{armados.map(tarjeta)}</div> : null}
          />
        </ColumnaDelPanel>
        <ColumnaDelPanel titulo="En el laboratorio" cantidad={enLab.length} unidad="lotes">
          {enLab.length ? enLab.map(tarjeta) : <Vacio>No hay lotes en el laboratorio.</Vacio>}
        </ColumnaDelPanel>
        <ColumnaDelPanel titulo="Listos para entregar" cantidad={listos.length} unidad="lotes">
          {listos.length ? listos.map(tarjeta) : <Vacio>Cuando recibas un lote, sus pedidos aparecen acá para entregar.</Vacio>}
        </ColumnaDelPanel>
        <ColumnaDelPanel titulo="Entregados" cantidad={entregados.length} unidad="lotes" nota="Últimos 30 días">
          {entregados.length ? entregados.map(tarjeta) : <Vacio>Todavía no hay lotes entregados.</Vacio>}
        </ColumnaDelPanel>
      </div>

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
