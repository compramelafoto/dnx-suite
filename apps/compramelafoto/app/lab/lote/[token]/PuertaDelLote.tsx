"use client";

import { useEffect, useState } from "react";
import type { LoteParaElLab } from "@/lib/print-batches/lote-del-lab";
import { ENLACE_INVALIDO } from "@/lib/print-batches/puerta-del-lab";

type Lote = LoteParaElLab;
type Hacia = Lote["botones"][number]["hacia"];

const CONFIRMAR: Record<Hacia, string> = {
  EN_PRODUCCION: "¿Marcamos el lote como empezado?",
  LISTO: "¿Marcamos el lote como listo?",
  DESPACHADO: "¿Marcamos el lote como despachado?",
};

export default function PuertaDelLote({ token, inicial }: { token: string; inicial: Lote }) {
  const [lote, setLote] = useState<Lote>(inicial);
  const [invalido, setInvalido] = useState(false);
  const [enviando, setEnviando] = useState<Hacia | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [aviso, setAviso] = useState<string | null>(null);
  const base = `/api/lab-lote/${encodeURIComponent(token)}`;

  // Marca la primera apertura y deja la cookie del lote (ver la ruta).
  useEffect(() => {
    let activo = true;
    fetch(base, { cache: "no-store" })
      .then(async (r) => {
        if (!activo) return;
        if (r.status === 404) return setInvalido(true);
        const data = await r.json().catch(() => null);
        if (r.ok && data?.lote) setLote(data.lote);
      })
      .catch(() => {});
    return () => {
      activo = false;
    };
  }, [base]);

  async function mover(hacia: Hacia) {
    let pregunta = CONFIRMAR[hacia];
    if (hacia === "LISTO" && lote.pedidos.some((p) => p.retiraCliente)) {
      pregunta += "\n\nA los clientes que retiran acá les llega un correo avisando que ya pueden pasar.";
    }
    if (!window.confirm(pregunta)) return;
    setEnviando(hacia);
    setError(null);
    setAviso(null);
    try {
      const r = await fetch(base, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ hacia }),
      });
      const data = await r.json().catch(() => null);
      if (r.status === 404) return setInvalido(true);
      if (!r.ok || !data?.lote) {
        setError(data?.error || "No se pudo cambiar el estado. Probá de nuevo.");
        return;
      }
      setLote(data.lote);
      setAviso(`Listo: el lote quedó «${data.lote.textoDelEstado}».`);
    } catch {
      setError("No hay conexión. Probá de nuevo.");
    } finally {
      setEnviando(null);
    }
  }

  if (invalido) {
    return (
      <main className="min-h-[100dvh] bg-gray-50 flex items-center justify-center px-4">
        <div className="max-w-sm w-full rounded-xl border border-gray-200 bg-white p-6 text-center shadow-sm">
          <h1 className="text-lg font-semibold text-gray-900">{ENLACE_INVALIDO}</h1>
          <p className="mt-2 text-sm text-gray-600">Pedile al fotógrafo que te mande el enlace de nuevo.</p>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-[100dvh] bg-gray-50 px-4 py-6">
      <div className="mx-auto max-w-2xl space-y-4">
        <header className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
          <p className="text-sm text-gray-500">Lote de impresión de</p>
          <h1 className="text-xl font-semibold text-gray-900">{lote.fotografo}</h1>
          <p className="mt-1 text-base text-gray-800">{lote.nombre}</p>
          <dl className="mt-3 grid grid-cols-1 gap-2 text-sm sm:grid-cols-2">
            <div>
              <dt className="text-gray-500">Estado</dt>
              <dd className="font-medium text-gray-900">{lote.textoDelEstado}</dd>
            </div>
            <div>
              <dt className="text-gray-500">Entrega</dt>
              <dd className="font-medium text-gray-900">
                {lote.enviaElLab ? "Lo envían ustedes" : "Lo retira el fotógrafo"}
              </dd>
            </div>
            {lote.fechaPrometida && (
              <div>
                <dt className="text-gray-500">Para el</dt>
                <dd className="font-medium text-gray-900">{lote.fechaPrometida}</dd>
              </div>
            )}
            <div>
              <dt className="text-gray-500">Pedidos y copias</dt>
              <dd className="font-medium text-gray-900">
                {lote.pedidos.length} {lote.pedidos.length === 1 ? "pedido" : "pedidos"} · {lote.totalCopias}{" "}
                {lote.totalCopias === 1 ? "copia" : "copias"}
              </dd>
            </div>
          </dl>
          {lote.mensaje && (
            <div className="mt-4 rounded-lg bg-amber-50 p-3 text-sm text-amber-900">
              <p className="font-medium">Mensaje del fotógrafo</p>
              <p className="mt-1 whitespace-pre-line">{lote.mensaje}</p>
            </div>
          )}
        </header>

        {lote.botones.length > 0 && (
          <section className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
            <h2 className="text-base font-semibold text-gray-900">¿Cómo va?</h2>
            <div className="mt-3 flex flex-col gap-2 sm:flex-row sm:flex-wrap">
              {lote.botones.map((b) => (
                <button
                  key={b.hacia}
                  type="button"
                  onClick={() => mover(b.hacia)}
                  disabled={enviando != null}
                  className="min-h-[48px] rounded-lg bg-[#c27b3d] px-5 py-3 text-base font-medium text-white hover:bg-[#a9682f] disabled:opacity-60 touch-manipulation"
                >
                  {enviando === b.hacia ? "Guardando..." : b.texto}
                </button>
              ))}
            </div>
          </section>
        )}
        {aviso && <p className="rounded-lg bg-green-50 p-3 text-sm text-green-800">{aviso}</p>}
        {error && <p className="rounded-lg bg-red-50 p-3 text-sm text-red-800">{error}</p>}

        <section className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
          <h2 className="text-base font-semibold text-gray-900">Descargar las fotos</h2>
          {lote.partes === 0 ? (
            <p className="mt-2 text-sm text-gray-600">Este lote no tiene fotos para descargar.</p>
          ) : (
            <>
              {lote.partes > 1 && (
                <p className="mt-1 text-sm text-gray-600">
                  Es un lote grande: se baja en {lote.partes} partes de hasta 15 pedidos. Bajá todas.
                </p>
              )}
              <div className="mt-3 flex flex-col gap-2 sm:flex-row sm:flex-wrap">
                {Array.from({ length: lote.partes }, (_, i) => i + 1).map((parte) => (
                  <a
                    key={parte}
                    href={`${base}/zip?parte=${parte}`}
                    rel="noreferrer"
                    className="min-h-[48px] inline-flex items-center justify-center rounded-lg border border-gray-300 bg-white px-5 py-3 text-base font-medium text-gray-900 hover:bg-gray-50 touch-manipulation"
                  >
                    {lote.partes === 1 ? "Descargar el ZIP" : `Parte ${parte} de ${lote.partes}`}
                  </a>
                ))}
              </div>
              <p className="mt-2 text-xs text-gray-500">Las fotos vienen ordenadas en carpetas por medida y acabado.</p>
            </>
          )}
        </section>

        <section className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
          <h2 className="text-base font-semibold text-gray-900">Copias por medida y acabado</h2>
          <ul className="mt-2 divide-y divide-gray-100 text-sm">
            {lote.copias.map((c) => (
              <li key={c.texto} className="flex justify-between py-2">
                <span className="text-gray-800">{c.texto}</span>
                <span className="font-medium text-gray-900">{c.cantidad}</span>
              </li>
            ))}
          </ul>
        </section>

        <section className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
          <h2 className="text-base font-semibold text-gray-900">Pedidos</h2>
          <ul className="mt-2 divide-y divide-gray-100">
            {lote.pedidos.map((p, i) => (
              <li key={p.pedido ?? `fila-${i}`} className="py-3">
                <div className="flex items-baseline justify-between gap-3">
                  <p className="font-medium text-gray-900">{p.aNombreDe}</p>
                  {p.pedido != null && <span className="shrink-0 text-sm text-gray-500">Pedido #{p.pedido}</span>}
                </div>
                {p.album && <p className="text-sm text-gray-600">{p.album}</p>}
                <p className="text-sm text-gray-800">{p.copias || `${p.totalCopias} copias`}</p>
                {p.retiraCliente && (
                  <p className="mt-1 inline-block rounded bg-amber-100 px-2 py-1 text-xs font-semibold text-amber-900">
                    {p.retiraCliente}
                  </p>
                )}
              </li>
            ))}
          </ul>
        </section>
      </div>
    </main>
  );
}
