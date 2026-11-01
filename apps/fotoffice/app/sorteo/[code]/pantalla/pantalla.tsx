"use client";

import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { drawLiveRafflePrizeAction } from "../actions";
import { LogosBanner } from "../logos-banner";

type Prize = {
  id: string;
  title: string;
  sponsorName: string | null;
  sponsorLogoUrl: string | null;
  winnerEntrantId: string | null;
};
type Poll = { id: string; question: string; options: string[]; totals: number[]; isOpen: boolean };

/** Cuánto gira la ruleta de nombres antes de mostrar al ganador. */
const GIRO_MS = 3500;

export function Pantalla(props: {
  code: string;
  token: string;
  title: string;
  logoUrl: string | null;
  qr: string;
  registrationOpen: boolean;
  entrants: { id: string; name: string }[];
  prizes: Prize[];
  polls: Poll[];
  logos: { url: string; name: string | null }[];
}) {
  const router = useRouter();
  const [, startTransition] = useTransition();
  const [vista, setVista] = useState<"sorteo" | "encuestas">("sorteo");
  const [pollId, setPollId] = useState<string | null>(props.polls[0]?.id ?? null);
  const [prizeId, setPrizeId] = useState<string | null>(
    () => props.prizes.find((p) => !p.winnerEntrantId)?.id ?? props.prizes[0]?.id ?? null,
  );
  const [girando, setGirando] = useState(false);
  const [nombreGiro, setNombreGiro] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const girandoRef = useRef(false);

  const nombre = useMemo(() => new Map(props.entrants.map((e) => [e.id, e.name])), [props.entrants]);
  const premio = props.prizes.find((p) => p.id === prizeId) ?? null;
  const ganador = premio?.winnerEntrantId ? nombre.get(premio.winnerEntrantId) ?? "—" : null;
  const poll = props.polls.find((p) => p.id === pollId) ?? null;

  // Inscriptos y votos llegan solos: se refresca cada pocos segundos, salvo mientras gira.
  useEffect(() => {
    const t = setInterval(() => {
      if (!girandoRef.current) startTransition(() => router.refresh());
    }, 4000);
    return () => clearInterval(t);
  }, [router]);

  async function sortear(markAbsentId?: string) {
    if (!premio || girandoRef.current) return;
    setError(null);
    girandoRef.current = true;
    setGirando(true);
    const nombres = props.entrants.map((e) => e.name);
    const ruleta = setInterval(() => {
      setNombreGiro(nombres[Math.floor(Math.random() * nombres.length)] ?? "");
    }, 70);
    const [resultado] = await Promise.all([
      drawLiveRafflePrizeAction({ code: props.code, token: props.token, prizeId: premio.id, markAbsentId }).catch(() => ({
        ok: false as const,
        error: "No se pudo sortear. Revisá la conexión y probá de nuevo.",
      })),
      new Promise((r) => setTimeout(r, GIRO_MS)),
    ]);
    clearInterval(ruleta);
    if (resultado.ok) setNombreGiro(nombre.get(resultado.winnerId) ?? null);
    else setError(resultado.error);
    router.refresh();
    // Se deja el nombre final hasta que llegue el refresco con el ganador guardado.
    setTimeout(() => {
      girandoRef.current = false;
      setGirando(false);
      setNombreGiro(null);
    }, 800);
  }

  function siguientePremio() {
    const resto = props.prizes.filter((p) => !p.winnerEntrantId && p.id !== prizeId);
    if (resto[0]) setPrizeId(resto[0].id);
  }

  const enPantalla = girando ? nombreGiro : ganador;

  return (
    <div className="flex min-h-screen flex-col bg-neutral-950 text-white">
      <header className="flex items-center justify-between gap-6 px-8 py-5">
        <div className="flex items-center gap-5">
          {props.logoUrl ? (
            // eslint-disable-next-line @next/next/no-img-element -- logo subido a R2
            <img src={props.logoUrl} alt="" className="h-16 w-auto max-w-[14rem] rounded bg-white object-contain p-2" />
          ) : null}
          <div>
            <h1 className="text-3xl font-semibold tracking-tight">{props.title}</h1>
            <p className="text-lg text-white/60">
              <span className="tabular-nums">{props.entrants.length}</span> participantes
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {(["sorteo", "encuestas"] as const).map((v) => (
            <button
              key={v}
              type="button"
              onClick={() => setVista(v)}
              className={`rounded-full px-4 py-2 text-sm ${vista === v ? "bg-white text-neutral-950" : "bg-white/10 text-white/80 hover:bg-white/20"}`}
            >
              {v === "sorteo" ? "Sorteo" : "Encuestas"}
            </button>
          ))}
        </div>
      </header>

      <main className="grid flex-1 gap-8 px-8 pb-8 lg:grid-cols-[1fr_18rem]">
        {vista === "sorteo" ? (
          <section className="flex flex-col items-center justify-center gap-8 rounded-2xl bg-white/5 p-8 text-center">
            {premio ? (
              <>
                <div className="space-y-3">
                  <p className="text-sm uppercase tracking-[0.3em] text-white/50">Se sortea</p>
                  <p className="text-5xl font-semibold">{premio.title}</p>
                  {premio.sponsorName || premio.sponsorLogoUrl ? (
                    <div className="flex items-center justify-center gap-3 text-xl text-white/70">
                      {premio.sponsorLogoUrl ? (
                        // eslint-disable-next-line @next/next/no-img-element -- logo subido a R2
                        <img src={premio.sponsorLogoUrl} alt="" className="h-12 w-auto rounded bg-white object-contain p-1" />
                      ) : null}
                      {premio.sponsorName ? <span>Dona {premio.sponsorName}</span> : null}
                    </div>
                  ) : null}
                </div>

                <div className="flex min-h-[9rem] items-center justify-center">
                  {enPantalla ? (
                    <p
                      className={`text-6xl font-bold md:text-7xl ${girando ? "text-white/70" : "text-amber-300"}`}
                      aria-live="polite"
                    >
                      {enPantalla}
                    </p>
                  ) : (
                    <p className="text-2xl text-white/40">¿Quién se lo lleva?</p>
                  )}
                </div>

                {error ? <p className="rounded-lg bg-red-500/20 px-4 py-2 text-red-200">{error}</p> : null}

                <div className="flex flex-wrap justify-center gap-3">
                  {!premio.winnerEntrantId ? (
                    <button
                      type="button"
                      disabled={girando || props.entrants.length === 0}
                      onClick={() => sortear()}
                      className="rounded-full bg-amber-400 px-10 py-4 text-2xl font-semibold text-neutral-950 disabled:opacity-40"
                    >
                      {girando ? "Sorteando…" : "Sortear"}
                    </button>
                  ) : (
                    <>
                      <button
                        type="button"
                        disabled={girando}
                        onClick={() => sortear(premio.winnerEntrantId ?? undefined)}
                        className="rounded-full bg-white/10 px-6 py-3 text-lg hover:bg-white/20 disabled:opacity-40"
                      >
                        No está, volver a sortear
                      </button>
                      {props.prizes.some((p) => !p.winnerEntrantId && p.id !== premio.id) ? (
                        <button
                          type="button"
                          disabled={girando}
                          onClick={siguientePremio}
                          className="rounded-full bg-amber-400 px-6 py-3 text-lg font-semibold text-neutral-950 disabled:opacity-40"
                        >
                          Siguiente premio
                        </button>
                      ) : null}
                    </>
                  )}
                </div>
              </>
            ) : (
              <p className="text-2xl text-white/50">Cargá los premios desde el panel de FOTOFFICE.</p>
            )}
          </section>
        ) : (
          <section className="space-y-6 rounded-2xl bg-white/5 p-8">
            {props.polls.length === 0 ? (
              <p className="text-2xl text-white/50">No hay encuestas cargadas.</p>
            ) : (
              <>
                <div className="flex flex-wrap gap-2">
                  {props.polls.map((p, i) => (
                    <button
                      key={p.id}
                      type="button"
                      onClick={() => setPollId(p.id)}
                      className={`rounded-full px-4 py-2 text-sm ${p.id === pollId ? "bg-white text-neutral-950" : "bg-white/10 text-white/80"}`}
                    >
                      Pregunta {i + 1}
                    </button>
                  ))}
                </div>
                {poll ? <ResultadosEncuesta poll={poll} /> : null}
              </>
            )}
          </section>
        )}

        <aside className="space-y-6">
          {props.registrationOpen ? (
            <div className="space-y-2 rounded-2xl bg-white p-4 text-center text-neutral-950">
              {/* eslint-disable-next-line @next/next/no-img-element -- QR generado en el servidor */}
              <img src={props.qr} alt="QR para anotarse" className="mx-auto w-full" />
              <p className="font-semibold">Escaneá y participá</p>
            </div>
          ) : null}
          <div className="space-y-2">
            <p className="text-sm uppercase tracking-widest text-white/50">Premios</p>
            <ul className="space-y-2">
              {props.prizes.map((p) => (
                <li key={p.id}>
                  <button
                    type="button"
                    disabled={girando}
                    onClick={() => setPrizeId(p.id)}
                    className={`w-full rounded-lg px-3 py-2 text-left text-sm ${p.id === prizeId ? "bg-white/20" : "bg-white/5 hover:bg-white/10"}`}
                  >
                    <span className="block font-medium">{p.title}</span>
                    <span className="block text-white/60">
                      {p.winnerEntrantId ? `Ganó ${nombre.get(p.winnerEntrantId) ?? "—"}` : "Sin sortear"}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          </div>
        </aside>
      </main>

      <LogosBanner logos={props.logos} size="lg" />
    </div>
  );
}

function ResultadosEncuesta({ poll }: { poll: Poll }) {
  const total = poll.totals.reduce((a, b) => a + b, 0);
  return (
    <div className="space-y-6">
      <div>
        <p className="text-4xl font-semibold">{poll.question}</p>
        <p className="mt-1 text-lg text-white/50">
          {total} {total === 1 ? "voto" : "votos"} {poll.isOpen ? "· votación abierta" : "· votación cerrada"}
        </p>
      </div>
      <div className="space-y-5">
        {poll.options.map((o, i) => {
          const pct = total ? Math.round((poll.totals[i] / total) * 100) : 0;
          return (
            <div key={i} className="space-y-2">
              <div className="flex justify-between text-2xl">
                <span>{o}</span>
                <span className="tabular-nums text-white/70">{pct} %</span>
              </div>
              <div className="h-5 rounded-full bg-white/10">
                <div className="h-5 rounded-full bg-amber-400 transition-[width] duration-700" style={{ width: `${pct}%` }} />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
