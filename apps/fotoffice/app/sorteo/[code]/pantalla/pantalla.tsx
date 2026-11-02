"use client";

import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import type { BotonRemoto, Comando, EstadoPantalla } from "@/lib/control-remoto/protocolo";
import { usePantallaRemota } from "@/components/control-remoto/usePantallaRemota";
import { BotonControlRemoto } from "@/components/control-remoto/BotonControlRemoto";
import { drawLiveRafflePrizeAction, resetLiveRaffleResultsAction } from "../actions";
import { LogosBanner, type LogoBanner } from "../logos-banner";

type Prize = {
  id: string;
  title: string;
  sponsorName: string | null;
  sponsorLogoUrl: string | null;
};
type Result = { round: number; entrantId: string; prizeId: string | null };
type Poll = {
  id: string;
  question: string;
  kind: "OPCIONES" | "TEXTO";
  options: string[];
  totals: number[];
  answers: string[];
  isOpen: boolean;
};

/** Cuánto gira la ruleta de nombres antes de mostrar al ganador. */
const GIRO_MS = 3500;

export function Pantalla(props: {
  code: string;
  token: string;
  title: string;
  logoUrl: string | null;
  qr: string;
  registrationOpen: boolean;
  usePrizeList: boolean;
  results: Result[];
  entrants: { id: string; name: string }[];
  prizes: Prize[];
  polls: Poll[];
  logos: LogoBanner[];
}) {
  const router = useRouter();
  const [, startTransition] = useTransition();
  const [vista, setVista] = useState<"sorteo" | "encuestas">("sorteo");
  const [pollId, setPollId] = useState<string | null>(props.polls[0]?.id ?? null);
  const conListado = props.usePrizeList && props.prizes.length > 0;

  /**
   * Los resultados como estaban al apretar "Sortear". La acción del servidor refresca la página
   * apenas guarda al ganador, antes de que termine la ruleta: sin esto, el nombre aparecía en la
   * lista lateral mientras todavía giraba.
   */
  const [congelados, setCongelados] = useState<Result[] | null>(null);
  const results = congelados ?? props.results;
  /**
   * "Limpiar": el último resultado que se sacó de la pantalla. Lo anterior sigue guardado (el
   * administrador lo ve en el panel); sólo deja de mostrarse acá. Se recuerda en el navegador
   * para que sobreviva a recargar la página.
   */
  const claveLimpieza = `fo-sorteo-limpio-${props.code}`;
  const [limpioHasta, setLimpioHasta] = useState<{ round: number; entrantId: string } | null>(null);
  // Se lee después de montar: el servidor no tiene el almacenamiento del navegador.
  useEffect(() => {
    try {
      const v = window.localStorage.getItem(claveLimpieza);
      // eslint-disable-next-line react-hooks/set-state-in-effect -- dato del navegador, sólo existe al montar
      if (v) setLimpioHasta(JSON.parse(v) as { round: number; entrantId: string });
    } catch {
      // Sin almacenamiento del navegador, no hay limpieza guardada.
    }
  }, [claveLimpieza]);
  // Si ese resultado ya no existe (se resetearon los resultados), la limpieza no corre más.
  const corte =
    limpioHasta && results.some((r) => r.round === limpioHasta.round && r.entrantId === limpioHasta.entrantId)
      ? limpioHasta.round
      : 0;
  const visibles = results.filter((r) => r.round > corte);
  /** El QR en grande, en el centro, para proyectarlo. */
  const [qrGrande, setQrGrande] = useState(false);

  const ganadorDePremio = useMemo(
    () => new Map(results.filter((r) => r.prizeId).map((r) => [r.prizeId as string, r])),
    [results],
  );
  const [prizeId, setPrizeId] = useState<string | null>(
    () => props.prizes.find((p) => !ganadorDePremio.has(p.id))?.id ?? props.prizes[0]?.id ?? null,
  );
  const [girando, setGirando] = useState(false);
  const [nombreGiro, setNombreGiro] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const girandoRef = useRef(false);
  /** Sin listado: el sponsor tocado en el banner y el premio que se escribió, para el próximo sorteo. */
  const [eligiendo, setEligiendo] = useState<LogoBanner | null>(null);
  const [textoPremio, setTextoPremio] = useState("");
  const [destacado, setDestacado] = useState<{ sponsorId: string; url: string; name: string | null; title: string } | null>(null);
  /** Premios de sorteos ya hechos que se sacaron de la pantalla tocando el logo grande. */
  const [ocultos, setOcultos] = useState<ReadonlySet<number>>(new Set());

  const nombre = useMemo(() => new Map(props.entrants.map((e) => [e.id, e.name])), [props.entrants]);
  const premio = conListado ? (props.prizes.find((p) => p.id === prizeId) ?? null) : null;
  // El resultado que se muestra en grande: el del premio elegido, o el último sorteo sin listado.
  const resultado = conListado
    ? premio
      ? (ganadorDePremio.get(premio.id) ?? null)
      : null
    : (results[results.length - 1] ?? null);
  const poll = props.polls.find((p) => p.id === pollId) ?? null;
  const premioPorId = useMemo(() => new Map(props.prizes.map((p) => [p.id, p])), [props.prizes]);
  // Lo que se muestra en grande sin listado: el premio elegido para el próximo sorteo o, si no hay,
  // el del último sorteo (hasta que se lo saque tocándolo).
  const premioDeResultado =
    !conListado && resultado?.prizeId && !ocultos.has(resultado.round) ? (premioPorId.get(resultado.prizeId) ?? null) : null;
  const logoGrande = !conListado
    ? destacado
      ? { url: destacado.url, name: destacado.name, title: destacado.title }
      : premioDeResultado
        ? { url: premioDeResultado.sponsorLogoUrl, name: premioDeResultado.sponsorName, title: premioDeResultado.title }
        : null
    : null;

  function elegirSponsor(logo: LogoBanner) {
    if (girandoRef.current || conListado || !logo.sponsorId) return;
    // El último premio que se sorteó con esta marca, para no tener que escribirlo de nuevo.
    const anterior = [...props.results]
      .reverse()
      .map((r) => (r.prizeId ? premioPorId.get(r.prizeId) : undefined))
      .find((p) => p && p.sponsorLogoUrl === logo.url);
    setTextoPremio(destacado?.sponsorId === logo.sponsorId ? destacado.title : (anterior?.title ?? ""));
    setEligiendo(logo);
  }

  function confirmarPremio() {
    if (!eligiendo?.sponsorId) return;
    setDestacado({ sponsorId: eligiendo.sponsorId, url: eligiendo.url, name: eligiendo.name, title: textoPremio.trim() });
    setEligiendo(null);
  }

  function sacarLogoGrande() {
    if (girandoRef.current) return;
    if (destacado) setDestacado(null);
    else if (resultado) setOcultos((prev) => new Set(prev).add(resultado.round));
  }

  useEffect(() => {
    if (!qrGrande) return;
    const cerrar = (e: KeyboardEvent) => {
      if (e.key === "Escape") setQrGrande(false);
    };
    window.addEventListener("keydown", cerrar);
    return () => window.removeEventListener("keydown", cerrar);
  }, [qrGrande]);

  // Inscriptos, votos y resultados llegan solos: se refresca cada pocos segundos, salvo mientras gira.
  useEffect(() => {
    const t = setInterval(() => {
      if (!girandoRef.current) startTransition(() => router.refresh());
    }, 4000);
    return () => clearInterval(t);
  }, [router]);

  async function sortear(redoRound?: number) {
    if (girandoRef.current) return;
    setError(null);
    girandoRef.current = true;
    setCongelados(props.results);
    setGirando(true);
    const nombres = props.entrants.map((e) => e.name);
    const ruleta = setInterval(() => {
      setNombreGiro(nombres[Math.floor(Math.random() * nombres.length)] ?? "");
    }, 70);
    const [r] = await Promise.all([
      drawLiveRafflePrizeAction({
        code: props.code,
        token: props.token,
        prizeId: redoRound === undefined && premio ? premio.id : undefined,
        redoRound,
        premio: redoRound === undefined && destacado ? { sponsorId: destacado.sponsorId, title: destacado.title } : undefined,
      }).catch(() => ({ ok: false as const, error: "No se pudo sortear. Revisá la conexión y probá de nuevo." })),
      new Promise((res) => setTimeout(res, GIRO_MS)),
    ]);
    clearInterval(ruleta);
    if (r.ok) {
      setNombreGiro(nombre.get(r.winnerId) ?? null);
      // El premio ya quedó guardado con ese sorteo: desde ahora se muestra como su resultado.
      if (redoRound === undefined) setDestacado(null);
    } else setError(r.error);
    router.refresh();
    // Se deja el nombre final hasta que llegue el refresco con el ganador guardado.
    setTimeout(() => {
      girandoRef.current = false;
      setGirando(false);
      setNombreGiro(null);
      setCongelados(null);
    }, 800);
  }

  /** `confirmado`: la pregunta ya se hizo en el celular del control remoto. */
  async function resetear(confirmado = false) {
    if (girandoRef.current) return;
    if (!confirmado && !window.confirm("¿Borrar todos los resultados y empezar el sorteo de cero? Los inscriptos y las encuestas no se tocan.")) return;
    setError(null);
    const r = await resetLiveRaffleResultsAction({ code: props.code, token: props.token }).catch(() => ({
      ok: false as const,
      error: "No se pudo resetear. Revisá la conexión y probá de nuevo.",
    }));
    if (!r.ok) setError(r.error);
    setLimpioHasta(null);
    try {
      window.localStorage.removeItem(claveLimpieza);
    } catch {
      // nada que borrar
    }
    setPrizeId(props.prizes[0]?.id ?? null);
    router.refresh();
  }

  function limpiar() {
    if (girandoRef.current) return;
    const ultimo = results[results.length - 1];
    if (!ultimo) return;
    const marca = { round: ultimo.round, entrantId: ultimo.entrantId };
    setLimpioHasta(marca);
    try {
      window.localStorage.setItem(claveLimpieza, JSON.stringify(marca));
    } catch {
      // Sin almacenamiento del navegador la limpieza dura hasta recargar.
    }
  }

  function siguientePremio() {
    const resto = props.prizes.filter((p) => !ganadorDePremio.has(p.id) && p.id !== prizeId);
    if (resto[0]) setPrizeId(resto[0].id);
  }

  // El logo grande sigue aunque se limpie; el nombre y "No está, volver a sortear" no.
  const resultadoVisible = resultado && resultado.round > corte ? resultado : null;
  const enPantalla = girando ? nombreGiro : resultadoVisible ? (nombre.get(resultadoVisible.entrantId) ?? "—") : null;
  const puedeSortearNuevo = conListado ? !!premio && !resultado : true;
  const haySiguientePremio = conListado && props.prizes.some((p) => !ganadorDePremio.has(p.id) && p.id !== prizeId);

  // Control remoto: el celular ve lo mismo que esta pantalla y toca los mismos botones.
  const indicePremio = premio ? props.prizes.indexOf(premio) : -1;
  const indicePoll = poll ? props.polls.indexOf(poll) : -1;
  const botonesSorteo: BotonRemoto[] = [
    ...(puedeSortearNuevo
      ? [{ id: "sortear", etiqueta: girando ? "Sorteando…" : "🎰 Sortear", tono: "principal" as const, deshabilitado: girando || props.entrants.length === 0 }]
      : haySiguientePremio
        ? [{ id: "siguiente-premio", etiqueta: "Siguiente premio", tono: "principal" as const, deshabilitado: girando }]
        : []),
    ...(resultado && !girando ? [{ id: "resortear", etiqueta: "No está, volver a sortear" }] : []),
    ...(logoGrande && !girando ? [{ id: "sacar-logo", etiqueta: "Sacar el logo de la pantalla" }] : []),
    { id: "vista-encuestas", etiqueta: "Mostrar encuestas", deshabilitado: girando },
    ...(props.results.length > 0
      ? [
          {
            id: "resetear",
            etiqueta: "Resetear resultados",
            tono: "peligro" as const,
            deshabilitado: girando,
            confirmar: "¿Borrar todos los resultados y empezar el sorteo de cero? Los inscriptos y las encuestas no se tocan.",
          },
        ]
      : []),
  ];
  const sponsorsElegibles = props.logos.filter((l) => l.sponsorId);
  const estadoRemoto: EstadoPantalla =
    vista === "sorteo"
      ? {
          titulo: props.title,
          posicion: conListado && premio ? { actual: indicePremio + 1, total: props.prizes.length, nombre: "Premio" } : undefined,
          detalle: premio?.title ?? logoGrande?.title ?? `Sorteo ${Math.max(props.results.length + (girando ? 1 : 0), 1)}`,
          aviso: girando ? "Sorteando…" : error ? error : resultado ? `Salió: ${nombre.get(resultado.entrantId) ?? "—"}` : undefined,
          nota: `${props.entrants.length} participantes`,
          navegacion: conListado ? { anterior: indicePremio > 0 && !girando, siguiente: indicePremio < props.prizes.length - 1 && !girando } : undefined,
          botones: botonesSorteo,
          lista: conListado
            ? {
                titulo: "Elegir premio",
                actual: premio ? `premio:${premio.id}` : null,
                items: props.prizes.map((p) => {
                  const g = ganadorDePremio.get(p.id);
                  return { id: `premio:${p.id}`, etiqueta: p.title, nota: g ? `Ganó ${nombre.get(g.entrantId) ?? "—"}` : "Sin sortear" };
                }),
              }
            : sponsorsElegibles.length
              ? {
                  titulo: "Elegir el sponsor del próximo premio",
                  actual: destacado ? `sponsor:${destacado.sponsorId}` : null,
                  items: sponsorsElegibles.map((l) => ({ id: `sponsor:${l.sponsorId}`, etiqueta: l.name ?? "Sponsor" })),
                }
              : undefined,
        }
      : {
          titulo: props.title,
          posicion: poll ? { actual: indicePoll + 1, total: props.polls.length, nombre: "Pregunta" } : undefined,
          detalle: poll?.question ?? "No hay encuestas cargadas.",
          nota: poll ? `${poll.kind === "TEXTO" ? poll.answers.length : poll.totals.reduce((a, b) => a + b, 0)} respuestas · ${poll.isOpen ? "abierta" : "cerrada"}` : undefined,
          navegacion: props.polls.length > 1 ? { anterior: indicePoll > 0, siguiente: indicePoll < props.polls.length - 1 } : undefined,
          botones: [{ id: "vista-sorteo", etiqueta: "Volver al sorteo", tono: "principal" }],
          lista: props.polls.length
            ? {
                titulo: "Elegir pregunta",
                actual: poll ? `encuesta:${poll.id}` : null,
                items: props.polls.map((p, i) => ({ id: `encuesta:${p.id}`, etiqueta: `${i + 1}. ${p.question}` })),
              }
            : undefined,
        };

  function alComando(c: Comando) {
    if (c.tipo === "anterior" || c.tipo === "siguiente") {
      const paso = c.tipo === "siguiente" ? 1 : -1;
      if (vista === "encuestas") {
        const p = props.polls[indicePoll + paso];
        if (p) setPollId(p.id);
      } else if (conListado && !girandoRef.current) {
        const p = props.prizes[indicePremio + paso];
        if (p) setPrizeId(p.id);
      }
      return;
    }
    if (c.tipo === "ir") {
      const [tipo, id] = [c.id.slice(0, c.id.indexOf(":")), c.id.slice(c.id.indexOf(":") + 1)];
      if (tipo === "premio" && !girandoRef.current && props.prizes.some((p) => p.id === id)) setPrizeId(id);
      else if (tipo === "encuesta" && props.polls.some((p) => p.id === id)) setPollId(id);
      else if (tipo === "sponsor" && !girandoRef.current) {
        const logo = sponsorsElegibles.find((l) => l.sponsorId === id);
        if (logo?.sponsorId) setDestacado({ sponsorId: logo.sponsorId, url: logo.url, name: logo.name, title: "" });
      }
      return;
    }
    if (c.id === "sortear" && puedeSortearNuevo && props.entrants.length > 0) void sortear();
    else if (c.id === "resortear" && resultado) void sortear(resultado.round);
    else if (c.id === "siguiente-premio") siguientePremio();
    else if (c.id === "sacar-logo") sacarLogoGrande();
    else if (c.id === "vista-encuestas") setVista("encuestas");
    else if (c.id === "vista-sorteo") setVista("sorteo");
    else if (c.id === "resetear") void resetear(true);
  }

  const remoto = usePantallaRemota({
    clave: `control-remoto:sorteo:${props.code}`,
    pedido: { ambito: "sorteo", code: props.code, token: props.token },
    estado: estadoRemoto,
    alComando,
  });

  return (
    <div className="flex min-h-screen flex-col bg-neutral-950 text-white">
      <header className="flex items-center justify-between gap-6 px-8 py-5">
        <div className="flex items-center gap-5">
          {props.logoUrl ? (
            // eslint-disable-next-line @next/next/no-img-element -- logo subido a R2
            <img src={props.logoUrl} alt="" className="h-16 w-auto max-w-[14rem] rounded bg-neutral-900 object-contain p-2" />
          ) : null}
          <div>
            <h1 className="text-3xl font-semibold tracking-tight">{props.title}</h1>
            <p className="text-lg text-white/60">
              <span className="tabular-nums">{props.entrants.length}</span> participantes
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {!conListado && visibles.length > 0 ? (
            <button
              type="button"
              disabled={girando}
              onClick={limpiar}
              title="Saca los resultados de la pantalla. Siguen guardados en el panel."
              className="rounded-full bg-white/10 px-4 py-2 text-sm font-semibold text-white/90 hover:bg-white/20 disabled:opacity-40"
            >
              Limpiar
            </button>
          ) : null}
          {results.length > 0 ? (
            <button
              type="button"
              disabled={girando}
              onClick={() => void resetear()}
              className="mr-2 rounded-full px-4 py-2 text-sm text-white/50 hover:bg-white/10 hover:text-white disabled:opacity-40"
            >
              Resetear resultados
            </button>
          ) : null}
          <BotonControlRemoto remoto={remoto} className="mr-2 rounded-full px-4 py-2 text-sm text-white/70 hover:bg-white/10 hover:text-white" />
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
            <div className="space-y-3">
              <p className="text-sm uppercase tracking-[0.3em] text-white/50">
                {conListado ? "Se sortea" : `Sorteo ${girando ? results.length + 1 : Math.max(results.length, 1)}`}
              </p>
              {premio ? (
                <>
                  <p className="text-5xl font-semibold">{premio.title}</p>
                  {premio.sponsorName || premio.sponsorLogoUrl ? (
                    <div className="flex items-center justify-center gap-3 text-xl text-white/70">
                      {premio.sponsorLogoUrl ? (
                        // eslint-disable-next-line @next/next/no-img-element -- logo subido a R2
                        <img src={premio.sponsorLogoUrl} alt="" className="h-12 w-auto rounded bg-neutral-900 object-contain p-1" />
                      ) : null}
                      {premio.sponsorName ? <span>Dona {premio.sponsorName}</span> : null}
                    </div>
                  ) : null}
                </>
              ) : null}
            </div>

            {logoGrande ? (
              <button
                type="button"
                onClick={sacarLogoGrande}
                disabled={girando}
                title="Sacar de la pantalla"
                className="flex flex-col items-center gap-4 rounded-2xl p-2 transition-opacity hover:opacity-80"
              >
                {logoGrande.url ? (
                  // eslint-disable-next-line @next/next/no-img-element -- logo subido a R2
                  <img src={logoGrande.url} alt={logoGrande.name ?? ""} className="h-40 w-auto max-w-[28rem] object-contain md:h-48" />
                ) : null}
                {logoGrande.title ? <span className="text-4xl font-semibold md:text-5xl">{logoGrande.title}</span> : null}
              </button>
            ) : null}

            <div className="flex min-h-[9rem] items-center justify-center">
              {enPantalla ? (
                <p className={`text-6xl font-bold md:text-7xl ${girando ? "text-white/70" : "text-amber-300"}`} aria-live="polite">
                  {enPantalla}
                </p>
              ) : (
                <p className="text-2xl text-white/40">¿Quién sale?</p>
              )}
            </div>

            {error ? <p className="rounded-lg bg-red-500/20 px-4 py-2 text-red-200">{error}</p> : null}

            <div className="flex flex-wrap justify-center gap-3">
              {resultadoVisible && !girando ? (
                <button
                  type="button"
                  onClick={() => sortear(resultadoVisible.round)}
                  className="rounded-full bg-white/10 px-6 py-3 text-lg hover:bg-white/20"
                >
                  No está, volver a sortear
                </button>
              ) : null}
              {puedeSortearNuevo ? (
                <button
                  type="button"
                  disabled={girando || props.entrants.length === 0}
                  onClick={() => sortear()}
                  className="rounded-full bg-amber-400 px-10 py-4 text-2xl font-semibold text-neutral-950 disabled:opacity-40"
                >
                  {girando ? "Sorteando…" : "Sortear"}
                </button>
              ) : haySiguientePremio ? (
                <button
                  type="button"
                  disabled={girando}
                  onClick={siguientePremio}
                  className="rounded-full bg-amber-400 px-6 py-3 text-lg font-semibold text-neutral-950 disabled:opacity-40"
                >
                  Siguiente premio
                </button>
              ) : null}
            </div>
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
            <button
              type="button"
              onClick={() => setQrGrande(true)}
              title="Mostrar el QR en grande"
              className="block w-full space-y-2 rounded-2xl bg-white p-4 text-center text-neutral-950 transition-transform hover:scale-[1.02]"
            >
              {/* eslint-disable-next-line @next/next/no-img-element -- QR generado en el servidor */}
              <img src={props.qr} alt="QR para anotarse" className="mx-auto w-full" />
              <span className="block font-semibold">Escaneá y participá</span>
            </button>
          ) : null}
          {conListado ? (
            <div className="space-y-2">
              <p className="text-sm uppercase tracking-widest text-white/50">Premios</p>
              <ul className="space-y-2">
                {props.prizes.map((p) => {
                  const g = ganadorDePremio.get(p.id);
                  return (
                    <li key={p.id}>
                      <button
                        type="button"
                        disabled={girando}
                        onClick={() => setPrizeId(p.id)}
                        className={`w-full rounded-lg px-3 py-2 text-left text-sm ${p.id === prizeId ? "bg-white/20" : "bg-white/5 hover:bg-white/10"}`}
                      >
                        <span className="block font-medium">{p.title}</span>
                        <span className="block text-white/60">{g ? `Ganó ${nombre.get(g.entrantId) ?? "—"}` : "Sin sortear"}</span>
                      </button>
                    </li>
                  );
                })}
              </ul>
            </div>
          ) : visibles.length > 0 ? (
            <div className="space-y-2">
              <p className="text-sm uppercase tracking-widest text-white/50">Resultados</p>
              <ol className="max-h-[50vh] space-y-1 overflow-y-auto">
                {[...visibles].reverse().map((r, i) => (
                  <li key={r.round} className="flex gap-3 rounded-lg bg-white/5 px-3 py-2 text-sm">
                    <span className="w-6 tabular-nums text-white/50">{visibles.length - i}.</span>
                    <span className="min-w-0 flex-1">
                      <span className="block font-medium">{nombre.get(r.entrantId) ?? "—"}</span>
                      {r.prizeId && premioPorId.get(r.prizeId) ? (
                        <span className="mt-0.5 flex items-center gap-2 text-xs text-white/60">
                          {premioPorId.get(r.prizeId)?.sponsorLogoUrl ? (
                            // eslint-disable-next-line @next/next/no-img-element -- logo subido a R2
                            <img src={premioPorId.get(r.prizeId)?.sponsorLogoUrl ?? ""} alt="" className="h-5 w-auto max-w-[4rem] object-contain" />
                          ) : null}
                          <span className="truncate">{premioPorId.get(r.prizeId)?.title}</span>
                        </span>
                      ) : null}
                    </span>
                  </li>
                ))}
              </ol>
            </div>
          ) : null}
        </aside>
      </main>

      <LogosBanner logos={props.logos} size="lg" onSelect={conListado ? undefined : elegirSponsor} />

      {qrGrande ? (
        <div
          role="dialog"
          aria-label="QR para anotarse"
          onClick={() => setQrGrande(false)}
          className="fixed inset-0 z-50 flex cursor-zoom-out flex-col items-center justify-center gap-6 bg-neutral-950/95 p-6"
        >
          <p className="text-center text-4xl font-semibold md:text-5xl">{props.title}</p>
          <div className="rounded-3xl bg-white p-6">
            {/* eslint-disable-next-line @next/next/no-img-element -- QR generado en el servidor */}
            <img src={props.qr} alt="QR para anotarse" className="h-[min(70vh,80vw)] w-[min(70vh,80vw)] [image-rendering:pixelated]" />
          </div>
          <p className="text-3xl font-semibold text-amber-300 md:text-4xl">Escaneá y participá</p>
          <p className="text-sm text-white/40">Tocá en cualquier lado o apretá Esc para volver</p>
        </div>
      ) : null}

      {eligiendo ? (
        <div className="fixed inset-0 z-50 flex items-end justify-center pb-40" onClick={() => setEligiendo(null)}>
          <form
            onClick={(e) => e.stopPropagation()}
            onSubmit={(e) => {
              e.preventDefault();
              confirmarPremio();
            }}
            className="flex w-full max-w-md items-center gap-3 rounded-2xl border border-white/10 bg-neutral-900/95 p-3 shadow-2xl backdrop-blur"
          >
            {/* eslint-disable-next-line @next/next/no-img-element -- logo subido a R2 */}
            <img src={eligiendo.url} alt="" className="h-10 w-auto max-w-[5rem] shrink-0 object-contain" />
            <input
              autoFocus
              onFocus={(e) => e.currentTarget.select()}
              value={textoPremio}
              onChange={(e) => setTextoPremio(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Escape") setEligiendo(null);
              }}
              maxLength={120}
              placeholder="¿Qué premio se sortea?"
              className="min-w-0 flex-1 bg-transparent text-base text-white placeholder:text-white/40 focus:outline-none"
            />
            <button type="submit" className="shrink-0 rounded-full bg-amber-400 px-4 py-1.5 text-sm font-semibold text-neutral-950">
              Listo
            </button>
          </form>
        </div>
      ) : null}
    </div>
  );
}

function ResultadosEncuesta({ poll }: { poll: Poll }) {
  const total = poll.kind === "TEXTO" ? poll.answers.length : poll.totals.reduce((a, b) => a + b, 0);
  return (
    <div className="space-y-6">
      <div>
        <p className="text-4xl font-semibold">{poll.question}</p>
        <p className="mt-1 text-lg text-white/50">
          {total} {total === 1 ? "respuesta" : "respuestas"} {poll.isOpen ? "· abierta" : "· cerrada"}
        </p>
      </div>
      {poll.kind === "TEXTO" ? (
        <ul className="grid gap-3 md:grid-cols-2">
          {poll.answers.map((a, i) => (
            <li key={i} className="whitespace-pre-line rounded-xl bg-white/10 p-4 text-lg leading-relaxed">
              {a}
            </li>
          ))}
        </ul>
      ) : (
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
          {poll.answers.length > 0 ? (
            <div className="space-y-2 pt-2">
              <p className="text-sm uppercase tracking-widest text-white/50">Escribieron en &quot;Otra&quot;</p>
              <div className="flex flex-wrap gap-2">
                {poll.answers.map((a, i) => (
                  <span key={i} className="rounded-full bg-white/10 px-4 py-2 text-lg">
                    {a}
                  </span>
                ))}
              </div>
            </div>
          ) : null}
        </div>
      )}
    </div>
  );
}
