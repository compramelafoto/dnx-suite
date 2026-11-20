"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

type Props = {
  codigo: string;
  alumno: string;
  curso: string | null;
  escuela: string | null;
  paso: string;
  tituloPaso: string;
  acciones: { listo: boolean; entregado: boolean };
  fotos: Array<{ photoId: number; tipos: string[] }>;
  /** Sólo para el fotógrafo: libritos del pedido, para ver sus caras. */
  disenos: number[];
  esFotografo: boolean;
};

type Imagen = { chica: string; grande: string; texto: string };

export default function EntregaQr(p: Props) {
  const router = useRouter();
  const [enviando, setEnviando] = useState<null | "LISTO" | "ENTREGADO">(null);
  const [mensaje, setMensaje] = useState<{ tono: "ok" | "error"; texto: string } | null>(null);
  const [visor, setVisor] = useState<{ lista: Imagen[]; i: number } | null>(null);
  const [caras, setCaras] = useState<Imagen[] | null>(null);
  const base = `/api/escolar/entrega/${encodeURIComponent(p.codigo)}`;
  const fotos: Imagen[] = p.fotos.map((f) => ({
    chica: `${base}/foto/${f.photoId}?tam=chica`,
    grande: `${base}/foto/${f.photoId}?tam=grande`,
    texto: f.tipos.join(" · "),
  }));
  const entregado = p.paso === "ENTREGADO";

  // El fotógrafo ve también las caras del librito (generadas una vez y guardadas).
  const idsDisenos = p.disenos.join(",");
  useEffect(() => {
    if (!idsDisenos) return;
    let activo = true;
    Promise.all(
      idsDisenos.split(",").map((id) =>
        fetch(`/api/fotografo/disenos/${id}/miniaturas`, { credentials: "include" })
          .then((r) => r.json())
          .then((d) => (Array.isArray(d.caras) ? (d.caras as string[]) : [])),
      ),
    )
      .then((listas) => {
        if (!activo) return;
        const todas = listas.flat();
        setCaras(todas.map((url, i) => ({ chica: url, grande: url, texto: `Librito · cara ${i + 1} de ${todas.length}` })));
      })
      .catch(() => activo && setCaras([]));
    return () => {
      activo = false;
    };
  }, [idsDisenos]);

  async function marcar(accion: "LISTO" | "ENTREGADO") {
    setEnviando(accion);
    setMensaje(null);
    try {
      const r = await fetch(base, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ accion }),
      });
      const d = (await r.json().catch(() => ({}))) as { ok?: boolean; error?: string };
      if (!r.ok || !d.ok) throw new Error(d.error || "No se pudo actualizar.");
      setMensaje({
        tono: "ok",
        texto: accion === "LISTO" ? "Listo: quedó «Listo para entregar»." : p.esFotografo ? "Listo: quedó «Entregado»." : "¡Gracias! Quedó registrado que lo recibiste.",
      });
      router.refresh();
    } catch (e) {
      setMensaje({ tono: "error", texto: e instanceof Error ? e.message : "No se pudo actualizar." });
    } finally {
      setEnviando(null);
    }
  }

  const botonPrincipal =
    "w-full rounded-xl bg-[#c27b3d] px-4 py-4 text-base font-semibold text-white shadow-sm hover:bg-[#b06c31] disabled:opacity-60";
  const botonSecundario =
    "w-full rounded-xl border-2 border-[#c27b3d] px-4 py-4 text-base font-semibold text-[#c27b3d] hover:bg-[#c27b3d]/5 disabled:opacity-60";

  return (
    <div className="min-h-screen bg-[#f9fafb] px-4 py-8">
      <div className="mx-auto max-w-lg rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
        <p className="mb-1 text-xs uppercase tracking-wide text-gray-500">Pedido escolar</p>
        <h1 className="text-2xl font-bold text-gray-900">{p.alumno}</h1>
        <p className="mt-1 text-sm text-gray-600">{[p.curso, p.escuela].filter(Boolean).join(" · ") || "—"}</p>

        <div className={`mt-4 rounded-xl px-4 py-3 ${entregado ? "bg-emerald-50 text-emerald-800" : "bg-amber-50 text-amber-900"}`}>
          <p className="text-xs uppercase tracking-wide opacity-70">Estado</p>
          <p className="text-lg font-semibold">{entregado ? "Entregado ✓" : p.tituloPaso}</p>
        </div>

        {mensaje ? (
          <p
            role="status"
            className={`mt-4 rounded-lg px-3 py-2 text-sm font-medium ${mensaje.tono === "ok" ? "bg-emerald-50 text-emerald-800" : "bg-red-50 text-red-700"}`}
          >
            {mensaje.texto}
          </p>
        ) : null}

        {/* Botones: el fotógrafo mueve el pedido; los demás sólo confirman que lo recibieron. */}
        {!entregado ? (
          <div className="mt-5 space-y-3">
            {p.esFotografo && p.acciones.listo ? (
              <button type="button" disabled={enviando !== null} onClick={() => void marcar("LISTO")} className={botonSecundario}>
                {enviando === "LISTO" ? "Guardando…" : "Listo para entregar (paso 6)"}
              </button>
            ) : null}
            {p.acciones.entregado ? (
              <button type="button" disabled={enviando !== null} onClick={() => void marcar("ENTREGADO")} className={botonPrincipal}>
                {enviando === "ENTREGADO" ? "Guardando…" : p.esFotografo ? "Marcar entregado" : "Confirmar que lo recibí"}
              </button>
            ) : !p.esFotografo ? (
              <p className="text-sm text-gray-500">Cuando tengas el sobre en la mano, vas a poder confirmar acá que lo recibiste.</p>
            ) : null}
          </div>
        ) : null}

        {caras && caras.length ? (
          <section className="mt-6">
            <h2 className="mb-2 text-sm font-semibold text-gray-700">Librito</h2>
            <div className="flex gap-2 overflow-x-auto pb-1">
              {caras.map((img, i) => (
                <button key={img.chica} type="button" onClick={() => setVisor({ lista: caras, i })} className="h-24 shrink-0 overflow-hidden rounded-lg border border-gray-200">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={img.chica} alt={img.texto} loading="lazy" className="h-full w-auto object-contain" />
                </button>
              ))}
            </div>
          </section>
        ) : null}

        {fotos.length ? (
          <section className="mt-6">
            <h2 className="mb-2 text-sm font-semibold text-gray-700">Fotos que van en el sobre</h2>
            <div className="grid grid-cols-3 gap-2">
              {fotos.map((img, i) => (
                <button key={img.chica} type="button" onClick={() => setVisor({ lista: fotos, i })} className="text-left">
                  <span className="block aspect-[3/4] overflow-hidden rounded-lg border border-gray-200 bg-gray-100">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={img.chica} alt={img.texto} loading="lazy" className="h-full w-full object-cover" />
                  </span>
                  <span className="mt-0.5 block truncate text-[11px] text-gray-500">{img.texto}</span>
                </button>
              ))}
            </div>
            <p className="mt-2 text-xs text-gray-400">Las fotos se ven con marca de agua: las impresas van sin marca.</p>
          </section>
        ) : null}

        {p.esFotografo ? (
          <div className="mt-6 border-t border-gray-100 pt-4 text-sm">
            <Link href="/fotografo/escuelas/pedidos/pantalla" className="text-[#c27b3d] hover:underline">
              Abrir el tablero de pedidos escolares
            </Link>
          </div>
        ) : null}
      </div>
      {visor ? <Visor lista={visor.lista} inicio={visor.i} onCerrar={() => setVisor(null)} /> : null}
    </div>
  );
}

function Visor({ lista, inicio, onCerrar }: { lista: Imagen[]; inicio: number; onCerrar: () => void }) {
  const [i, setI] = useState(inicio);
  const ir = useCallback((paso: number) => setI((n) => (n + paso + lista.length) % lista.length), [lista.length]);
  useEffect(() => {
    const tecla = (e: KeyboardEvent) => {
      if (e.key === "Escape") onCerrar();
      else if (e.key === "ArrowRight") ir(1);
      else if (e.key === "ArrowLeft") ir(-1);
    };
    window.addEventListener("keydown", tecla);
    return () => window.removeEventListener("keydown", tecla);
  }, [onCerrar, ir]);
  const img = lista[i]!;
  const flecha = "absolute top-1/2 -translate-y-1/2 rounded-full bg-black/60 px-3 py-2 text-2xl leading-none text-white";
  return (
    <div className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-black/90 p-4" onClick={onCerrar}>
      <div className="relative flex w-full max-w-3xl items-center justify-center" onClick={(e) => e.stopPropagation()}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={img.grande} alt={img.texto} className="max-h-[80dvh] max-w-full rounded-lg object-contain" />
        {lista.length > 1 ? (
          <>
            <button type="button" aria-label="Anterior" onClick={() => ir(-1)} className={`${flecha} left-1`}>‹</button>
            <button type="button" aria-label="Siguiente" onClick={() => ir(1)} className={`${flecha} right-1`}>›</button>
          </>
        ) : null}
      </div>
      <p className="mt-3 text-sm text-white/80">
        {img.texto}
        {lista.length > 1 ? ` · ${i + 1} de ${lista.length}` : ""}
      </p>
      <button type="button" onClick={onCerrar} aria-label="Cerrar" className="absolute right-4 top-4 px-3 py-1 text-2xl text-white/80">✕</button>
    </div>
  );
}
