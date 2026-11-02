"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { INTERVALO_CELULAR_MS, type Comando, type EstadoPantalla } from "@/lib/control-remoto/protocolo";

/**
 * El control remoto en el celular: botones grandes para el pulgar, la lista para saltar y lo que se
 * ve ahora en la pantalla. Se abre escaneando el QR de la pantalla (`/control-remoto/<id>#<código>`).
 * Copia idéntica en FOTOFFICE (`apps/fotoffice/components/control-remoto/ControlCelular.tsx`).
 */

type Fase = "conectando" | "listo" | "sin-acceso";

async function hablar(id: string, body: Record<string, unknown>) {
  const res = await fetch(`/api/control-remoto/${id}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
    cache: "no-store",
    credentials: "same-origin",
  });
  return { res, data: (await res.json().catch(() => ({}))) as Record<string, unknown> };
}

function vibrar() {
  try {
    navigator.vibrate?.(12);
  } catch {}
}

export default function ControlCelular({ id }: { id: string }) {
  const [fase, setFase] = useState<Fase>("conectando");
  const [aviso, setAviso] = useState("");
  const [estado, setEstado] = useState<EstadoPantalla | null>(null);
  const [pantallaConectada, setPantallaConectada] = useState(false);
  const [lista, setLista] = useState(false);
  const [nota, setNota] = useState(false);
  const [enviando, setEnviando] = useState(false);
  const leerAhora = useRef<() => void>(() => {});

  // Vincular: primero se prueba la cookie (recarga del mismo celular); si no, se canjea el código.
  useEffect(() => {
    let cancelado = false;
    let t: number | undefined;

    const leer = async () => {
      window.clearTimeout(t);
      try {
        const { res, data } = await hablar(id, { accion: "leer" });
        if (cancelado) return;
        if (res.status === 410) {
          setFase("sin-acceso");
          setAviso("Este control se desconectó: la pantalla pidió un código nuevo, o se apagó el control remoto.");
          return;
        }
        if (res.ok) {
          setEstado((data.estado as EstadoPantalla | null) ?? null);
          setPantallaConectada(Boolean(data.pantallaConectada));
          setFase("listo");
        }
      } catch {
        setPantallaConectada(false);
      }
      if (!cancelado) t = window.setTimeout(leer, INTERVALO_CELULAR_MS);
    };
    leerAhora.current = () => void leer();

    (async () => {
      const codigo = window.location.hash.replace(/^#/, "");
      const { res } = await hablar(id, { accion: "leer" }).catch(() => ({ res: null }));
      if (cancelado) return;
      if (!res?.ok && codigo) {
        const v = await hablar(id, { accion: "vincular", codigo }).catch(() => null);
        if (cancelado) return;
        if (!v?.res.ok) {
          setFase("sin-acceso");
          setAviso(String(v?.data.error || "No se pudo conectar. Revisá la conexión y escaneá el QR de nuevo."));
          return;
        }
      } else if (!res?.ok) {
        setFase("sin-acceso");
        setAviso("Para manejar la pantalla, escaneá el QR que aparece al tocar «Control remoto».");
        return;
      }
      // El código ya se usó: se saca de la dirección para que no quede en el historial.
      window.history.replaceState(null, "", window.location.pathname);
      void leer();
    })();

    return () => {
      cancelado = true;
      window.clearTimeout(t);
    };
  }, [id]);

  // Que el celular no se apague en medio de la charla.
  useEffect(() => {
    if (fase !== "listo") return;
    let lock: { release: () => Promise<void> } | null = null;
    const pedir = () => {
      const wl = (navigator as Navigator & { wakeLock?: { request: (t: "screen") => Promise<typeof lock> } }).wakeLock;
      wl?.request("screen").then((l) => (lock = l)).catch(() => {});
    };
    pedir();
    const alVolver = () => document.visibilityState === "visible" && pedir();
    document.addEventListener("visibilitychange", alVolver);
    return () => {
      document.removeEventListener("visibilitychange", alVolver);
      void lock?.release().catch(() => {});
    };
  }, [fase]);

  const mandar = useCallback(
    async (comando: Comando, confirmar?: string) => {
      if (confirmar && !window.confirm(confirmar)) return;
      vibrar();
      setEnviando(true);
      try {
        const { res, data } = await hablar(id, { accion: "ordenar", comando });
        if (res.status === 410) {
          setFase("sin-acceso");
          setAviso(String(data.error || "Este control se desconectó."));
        }
      } catch {
        setAviso("No se pudo mandar la orden. Revisá la conexión.");
      } finally {
        setEnviando(false);
        // La pantalla tarda menos de un segundo en obedecer: se vuelve a leer enseguida.
        window.setTimeout(() => leerAhora.current(), 500);
      }
    },
    [id],
  );

  if (fase !== "listo") {
    return (
      <main className="fixed inset-0 z-[10000] flex items-center justify-center bg-slate-950 p-6 text-center text-white">
        <div className="max-w-xs space-y-3">
          <p className="text-5xl" aria-hidden>
            📱
          </p>
          <p className="text-2xl font-bold">{fase === "conectando" ? "Conectando…" : "Control remoto"}</p>
          {aviso ? <p className="text-lg leading-snug text-white/70">{aviso}</p> : null}
        </div>
      </main>
    );
  }

  const nav = estado?.navegacion;
  const items = estado?.lista?.items ?? [];

  return (
    <main
      className="fixed inset-0 z-[10000] flex select-none flex-col bg-slate-950 text-white"
      style={{ paddingTop: "env(safe-area-inset-top)", paddingBottom: "env(safe-area-inset-bottom)" }}
    >
      <header className="flex items-center justify-between gap-3 px-5 pb-2 pt-4">
        <p className="min-w-0 truncate text-sm font-semibold text-white/60">{estado?.titulo ?? "Control remoto"}</p>
        <span
          className={`shrink-0 rounded-full px-3 py-1 text-xs font-semibold ${pantallaConectada ? "bg-emerald-500/20 text-emerald-300" : "bg-amber-500/20 text-amber-200"}`}
        >
          {pantallaConectada ? "● Pantalla conectada" : "● Buscando la pantalla…"}
        </span>
      </header>

      <section className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto px-5 pb-4">
        {!estado ? (
          <p className="mt-10 text-center text-lg text-white/60">Esperando a la pantalla…</p>
        ) : (
          <>
            <div className="rounded-3xl bg-white/[0.06] p-5">
              {estado.posicion ? (
                <p className="text-sm font-semibold uppercase tracking-widest text-white/50">
                  {estado.posicion.nombre} <span className="tabular-nums text-white">{estado.posicion.actual}</span> de{" "}
                  <span className="tabular-nums">{estado.posicion.total}</span>
                </p>
              ) : null}
              {estado.detalle ? <p className="mt-2 text-2xl font-bold leading-tight">{estado.detalle}</p> : null}
              {estado.aviso ? <p className="mt-3 text-lg font-semibold text-amber-300">{estado.aviso}</p> : null}
              {estado.nota ? (
                <div className="mt-3">
                  <button type="button" onClick={() => setNota((v) => !v)} className="text-sm font-semibold text-white/60 underline">
                    {nota ? "Ocultar la nota" : "Ver la nota para vos"}
                  </button>
                  {nota ? <p className="mt-2 whitespace-pre-line text-base leading-relaxed text-white/80">{estado.nota}</p> : null}
                </div>
              ) : null}
            </div>

            {estado.botones?.length ? (
              <div className="grid gap-3">
                {estado.botones.map((b) => (
                  <button
                    key={b.id}
                    type="button"
                    disabled={b.deshabilitado || enviando}
                    onClick={() => void mandar({ tipo: "boton", id: b.id }, b.confirmar)}
                    className={`min-h-16 rounded-2xl px-5 py-4 text-xl font-bold active:scale-[0.98] disabled:opacity-35 ${
                      b.tono === "principal"
                        ? "bg-amber-400 text-slate-950"
                        : b.tono === "peligro"
                          ? "border border-red-400/40 text-red-300"
                          : "bg-white/10 text-white"
                    }`}
                  >
                    {b.etiqueta}
                  </button>
                ))}
              </div>
            ) : null}

            {estado.lista && items.length ? (
              <button
                type="button"
                onClick={() => setLista(true)}
                className="min-h-14 rounded-2xl border border-white/15 px-5 py-3 text-lg font-semibold text-white/85"
              >
                ☰ {estado.lista.titulo}
              </button>
            ) : null}
          </>
        )}
      </section>

      {nav ? (
        <nav className="grid grid-cols-[1fr_1.6fr] gap-3 px-5 pb-5 pt-2">
          <button
            type="button"
            disabled={!nav.anterior}
            onClick={() => void mandar({ tipo: "anterior" })}
            className="h-28 rounded-3xl bg-white/10 text-2xl font-bold active:scale-[0.98] disabled:opacity-30"
            aria-label="Anterior"
          >
            ← Anterior
          </button>
          <button
            type="button"
            disabled={!nav.siguiente}
            onClick={() => void mandar({ tipo: "siguiente" })}
            className="h-28 rounded-3xl bg-amber-400 text-3xl font-extrabold text-slate-950 active:scale-[0.98] disabled:opacity-30"
            aria-label="Siguiente"
          >
            Siguiente →
          </button>
        </nav>
      ) : null}

      {lista && estado?.lista ? (
        <div className="fixed inset-0 z-[10001] flex flex-col bg-slate-950">
          <div className="flex items-center justify-between px-5 pb-3 pt-5" style={{ paddingTop: "max(1.25rem, env(safe-area-inset-top))" }}>
            <p className="text-xl font-bold">{estado.lista.titulo}</p>
            <button type="button" onClick={() => setLista(false)} className="rounded-full bg-white/10 px-5 py-2 text-base font-semibold">
              Cerrar
            </button>
          </div>
          <ol className="min-h-0 flex-1 space-y-1 overflow-y-auto px-3 pb-8">
            {items.map((it, i) => {
              const nuevoGrupo = it.grupo && it.grupo !== items[i - 1]?.grupo;
              const actual = it.id === estado.lista?.actual;
              return (
                <li key={it.id}>
                  {nuevoGrupo ? <p className="px-2 pb-1 pt-4 text-xs font-bold uppercase tracking-widest text-amber-300">{it.grupo}</p> : null}
                  <button
                    type="button"
                    onClick={() => {
                      setLista(false);
                      void mandar({ tipo: "ir", id: it.id });
                    }}
                    className={`flex min-h-14 w-full items-center gap-3 rounded-2xl px-3 py-2 text-left text-lg ${actual ? "bg-white/15 font-bold" : "text-white/85 active:bg-white/10"}`}
                  >
                    <span className="w-8 shrink-0 text-right text-sm tabular-nums text-white/40">{i + 1}</span>
                    <span className="min-w-0 flex-1">
                      {it.etiqueta}
                      {it.nota ? <span className="block text-sm font-normal text-white/50">{it.nota}</span> : null}
                    </span>
                  </button>
                </li>
              );
            })}
          </ol>
        </div>
      ) : null}
    </main>
  );
}
