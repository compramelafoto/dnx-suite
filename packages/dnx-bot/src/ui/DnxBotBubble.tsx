"use client";

import { Fragment, useCallback, useEffect, useRef, useState } from "react";
import { formatBotText } from "./format";
import { parseSseBuffer } from "../sse";
import {
  botonGlobito,
  campaniaInicial,
  estadoUrl,
  globitoBody,
  olvidarCampaniaPendiente,
  parseDnxbotParam,
  parseGlobito,
  progresoInicial,
  stripDnxbotParam,
  tarjetaProgreso,
  type AlmacenSimple,
  type Globito,
  type GlobitoAccion,
  type GlobitoBoton,
  type ProgresoEscolar,
} from "./globito";
import { applyDecision, applySseEvent, dropEmptyBot, seedIntro, type Item } from "./items";
import { debeMostrarGlobitoDiferido, estadoUrlComprador, marcarGlobitoVisto, paginaActual, textoTicket, type Audiencia } from "./comprador";
import {
  CADA_LLAMADO_MS,
  CSS_MASCOTA,
  DURACION_ENTRADA,
  DURACION_LLAMADO_MS,
  MAX_LLAMADOS,
  PRIMER_LLAMADO_MS,
  tipoEntrada,
  type FaseMascota,
} from "./entrada";
import { EVENTO_ABRIR, leerPedidoAbrir } from "./abrir";
import { CalculoCard } from "./CalculoCard";

export type DnxBotBubbleProps = {
  basePath: string;
  mascotSrc: string;
  bottomOffsetPx?: number;
  rutasPermitidas?: string[];
  /** Sin la prop (o "fotografo") la burbuja funciona como siempre. "comprador": página con búsqueda, globito diferido y nunca se abre sola. */
  audiencia?: Audiencia;
  /** false: la app no tiene tickets del bot (FOTOFFICE): no se ofrece «Hablar con una persona». */
  conTickets?: boolean;
};

export function DnxBotBubble({ basePath, mascotSrc, bottomOffsetPx = 24, rutasPermitidas, audiencia = "fotografo", conTickets = true }: DnxBotBubbleProps) {
  const [estado, setEstado] = useState<{ enabled: boolean; alerta?: boolean; saludo?: string; sugerencias?: string[]; globito?: unknown; globitoDemoraMs?: unknown; progresoEscolar?: unknown } | null>(null);
  const [open, setOpen] = useState(false);
  // El temporizador del globito diferido lee si la ventana está abierta en el momento de dispararse.
  const openRef = useRef(false);
  useEffect(() => { openRef.current = open; }, [open]);
  const [globito, setGlobito] = useState<Globito | null>(null);
  // true cuando la persona llegó desde el mail (?dnxbot=): el globito es el saludo dentro de la ventana.
  const [globitoEnVentana, setGlobitoEnVentana] = useState(false);
  const [introProgreso, setIntroProgreso] = useState<ProgresoEscolar | null>(null);
  const [items, setItems] = useState<Item[]>([]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [deciding, setDeciding] = useState<Set<string>>(new Set());
  const decidingRef = useRef<Set<string>>(new Set());
  const [ticketBusy, setTicketBusy] = useState(false);
  const ticketRef = useRef(false);
  const listRef = useRef<HTMLDivElement>(null);
  // Mascota: entra animada (grande la primera vez de la visita), se acomoda y recién ahí aparece el globito.
  const [fase, setFase] = useState<FaseMascota | null>(null);
  const [entradaLista, setEntradaLista] = useState(false);
  const [sinMovimiento, setSinMovimiento] = useState(false);
  // Una vez abierta la ventana, la mascota deja de llamar la atención.
  const yaAbrioRef = useRef(false);
  useEffect(() => { if (open) yaAbrioRef.current = true; }, [open]);

  useEffect(() => {
    let almacen: AlmacenSimple | null = null;
    try {
      almacen = window.sessionStorage;
    } catch {
      almacen = null;
    }
    if (audiencia === "comprador") {
      // Compradores: sin `?dnxbot=` ni campaña pendiente; la ventana nunca se abre sola.
      let timer: ReturnType<typeof setTimeout> | null = null;
      let vivo = true;
      fetch(estadoUrlComprador(basePath, location.pathname, location.search))
        .then((r) => r.json())
        .then((e) => {
          if (!vivo) return;
          setEstado(e);
          setIntroProgreso(progresoInicial(e));
          const g = e?.enabled ? parseGlobito(e?.globito) : null;
          const demora = typeof e?.globitoDemoraMs === "number" ? e.globitoDemoraMs : 0;
          if (g && demora > 0) {
            timer = setTimeout(() => {
              if (openRef.current || !debeMostrarGlobitoDiferido(almacen, g.campaign)) return;
              setGlobito(g);
              marcarGlobitoVisto(almacen, g.campaign);
            }, demora);
          }
        })
        .catch(() => { if (vivo) setEstado({ enabled: false }); });
      return () => {
        vivo = false;
        if (timer) clearTimeout(timer);
      };
    }
    // Si viene del mail sin sesión, el login pierde el parámetro: queda guardado en sessionStorage
    // hasta que la ventana se abra con el bot habilitado.
    const campaign = campaniaInicial(location.search, almacen, Date.now());
    // Recargar la página no vuelve a abrir la ventana: el parámetro del mail se usa una sola vez.
    if (parseDnxbotParam(location.search)) history.replaceState(history.state, "", stripDnxbotParam(location.href));
    fetch(estadoUrl(basePath, campaign))
      .then((r) => r.json())
      .then((e) => {
        setEstado(e);
        setGlobito(parseGlobito(e?.globito));
        setIntroProgreso(progresoInicial(e));
        // Único caso en que la ventana se abre sola: la persona tocó el enlace del mail.
        if (campaign && e?.enabled) {
          setGlobitoEnVentana(true);
          setOpen(true);
          olvidarCampaniaPendiente(almacen);
        }
      })
      .catch(() => setEstado({ enabled: false }));
  }, [basePath, audiencia]);
  useEffect(() => { listRef.current?.scrollTo({ top: listRef.current.scrollHeight }); }, [items]);

  const habilitado = estado?.enabled === true;
  useEffect(() => {
    if (!habilitado) return;
    let almacen: AlmacenSimple | null = null;
    let reducir = false;
    try {
      almacen = window.sessionStorage;
    } catch {
      almacen = null;
    }
    try {
      reducir = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    } catch {
      reducir = false;
    }
    const tipo = tipoEntrada(almacen, reducir);
    setSinMovimiento(tipo === "ninguna");
    const timers: ReturnType<typeof setTimeout>[] = [];
    const acomodar = () => {
      setFase("reposo");
      setEntradaLista(true);
      if (tipo === "ninguna") return;
      // Unos pocos llamados suaves en reposo, y después nada más.
      for (let i = 0; i < MAX_LLAMADOS; i++) {
        const t = PRIMER_LLAMADO_MS + i * CADA_LLAMADO_MS;
        timers.push(setTimeout(() => { if (!yaAbrioRef.current) setFase("llamado"); }, t));
        timers.push(setTimeout(() => setFase((f) => (f === "llamado" ? "reposo" : f)), t + DURACION_LLAMADO_MS));
      }
    };
    if (tipo === "ninguna") acomodar();
    else {
      setFase(tipo === "grande" ? "entrada-grande" : "entrada-corta");
      timers.push(setTimeout(acomodar, DURACION_ENTRADA[tipo]));
    }
    return () => timers.forEach(clearTimeout);
  }, [habilitado]);

  // Lo que se ve como saludo antes del primer mensaje; send() lo pasa a la conversación.
  const introRef = useRef<{ texto: string | null; progreso: ProgresoEscolar | null }>({ texto: null, progreso: null });
  useEffect(() => {
    introRef.current = { texto: globitoEnVentana && globito ? globito.texto : null, progreso: introProgreso };
  }, [globitoEnVentana, globito, introProgreso]);

  const send = useCallback(async (text: string, contexto?: Record<string, string>) => {
    if (!text.trim() || busy) return;
    setBusy(true);
    setInput("");
    const intro = introRef.current;
    setItems((x) => [...seedIntro(x, intro), { kind: "user", text }, { kind: "bot", text: "" }]);
    try {
      const res = await fetch(`${basePath}/chat`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ text, pagePath: audiencia === "comprador" ? paginaActual(location.pathname, location.search) : location.pathname, ...(contexto ? { contexto } : {}) }) });
      if (!res.ok || !res.body) throw new Error(String(res.status));
      const reader = res.body.getReader();
      const dec = new TextDecoder();
      let buf = "";
      for (;;) {
        const { value, done } = await reader.read();
        if (done) break;
        const parsed = parseSseBuffer(buf + dec.decode(value, { stream: true }));
        buf = parsed.rest;
        for (const ev of parsed.events) {
          const d = (ev.data ?? {}) as Record<string, unknown>;
          setItems((x) => applySseEvent(x, ev.event, d));
        }
      }
    } catch {
      setItems((x) => [...x, { kind: "notice", text: "No me pude conectar. Probá de nuevo.", offerTicket: true }]);
    } finally {
      setItems(dropEmptyBot);
      setBusy(false);
    }
  }, [basePath, busy, audiencia]);

  // Abrir desde otra parte de la página (`abrirDnxBot`): abre la ventana y manda el primer mensaje con su contexto.
  const sendRef = useRef(send);
  useEffect(() => { sendRef.current = send; }, [send]);
  useEffect(() => {
    if (!habilitado) return;
    const alAbrir = (e: Event) => {
      const pedido = leerPedidoAbrir((e as CustomEvent).detail);
      if (!pedido) return;
      setOpen(true);
      void sendRef.current(pedido.texto, pedido.contexto);
    };
    window.addEventListener(EVENTO_ABRIR, alAbrir);
    return () => window.removeEventListener(EVENTO_ABRIR, alAbrir);
  }, [habilitado]);

  const decide = useCallback(async (actionId: string, decision: "confirmar" | "rechazar" | "deshacer") => {
    if (decidingRef.current.has(actionId)) return;
    decidingRef.current.add(actionId);
    setDeciding(new Set(decidingRef.current));
    try {
      const res = await fetch(`${basePath}/acciones/${actionId}`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ decision }) });
      const r = (await res.json().catch(() => ({ ok: false, message: "Error" }))) as { ok: boolean; message: string; canUndo?: boolean };
      setItems((x) => applyDecision(x, actionId, decision, r));
    } catch {
      setItems((x) => [...x, { kind: "notice", text: "No me pude conectar. Probá de nuevo." }]);
    } finally {
      decidingRef.current.delete(actionId);
      setDeciding(new Set(decidingRef.current));
    }
  }, [basePath]);

  const ticket = useCallback(async () => {
    if (ticketRef.current) return;
    ticketRef.current = true;
    setTicketBusy(true);
    try {
      const res = await fetch(`${basePath}/ticket`, { method: "POST", headers: { "content-type": "application/json" }, body: "{}" });
      const r = (await res.json().catch(() => ({}))) as { ticketId?: number; reused?: boolean; error?: string };
      const text = textoTicket(res.status, r, audiencia);
      setItems((x) => [...x, { kind: "notice", text }]);
    } catch {
      setItems((x) => [...x, { kind: "notice", text: "No me pude conectar. Probá de nuevo." }]);
    } finally {
      ticketRef.current = false;
      setTicketBusy(false);
    }
  }, [basePath, audiencia]);

  const registrarGlobito = useCallback((campaign: string, accion: GlobitoAccion, answer?: string) => {
    // Registrar es un extra: si falla, el globito igual se oculta.
    fetch(`${basePath}/globito`, { method: "POST", headers: { "content-type": "application/json" }, body: globitoBody(campaign, accion, answer) }).catch(() => {});
  }, [basePath]);

  const tocarBoton = useCallback((b: GlobitoBoton) => {
    if (!globito) return;
    const r = botonGlobito(b);
    registrarGlobito(globito.campaign, r.accion, r.mensaje ? b.label : undefined);
    if (r.mensaje) {
      setOpen(true);
      void send(r.mensaje);
    }
    setGlobito(null);
  }, [globito, registrarGlobito, send]);

  const cerrarGlobito = useCallback(() => {
    if (!globito) return;
    registrarGlobito(globito.campaign, "DISMISSED");
    setGlobito(null);
  }, [globito, registrarGlobito]);

  if (!estado?.enabled) return null;

  return (
    <div className="dnxbot-raiz" style={{ position: "fixed", right: 24, bottom: bottomOffsetPx, zIndex: 9990 }}>
      <style>{CSS_MASCOTA}</style>
      {open && (
        <div role="dialog" aria-label="DNX Bot" style={{ width: "min(380px, calc(100vw - 32px))", height: `min(560px, calc(100vh - ${bottomOffsetPx + 148}px))`, marginBottom: 12, background: "#fff", color: "#111", borderRadius: 16, boxShadow: "0 12px 40px rgba(0,0,0,.18)", display: "flex", flexDirection: "column", overflow: "hidden", fontSize: 14 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "10px 12px", borderBottom: "1px solid #eee" }}>
            <span aria-hidden="true" style={{ width: 32, height: 32, flex: "none", borderRadius: 999, background: "#fff3e8", display: "flex", alignItems: "center", justifyContent: "center", overflow: "hidden" }}>
              <img src={mascotSrc} alt="" width={18} height={28} style={{ objectFit: "contain" }} />
            </span>
            <div style={{ flex: 1 }}>
              <strong>DNX Bot</strong>
              <div style={{ fontSize: 11, color: "#666" }}>Soy un asistente automático</div>
            </div>
            <button onClick={() => setOpen(false)} aria-label="Cerrar" style={{ border: 0, background: "none", fontSize: 18, cursor: "pointer" }}>×</button>
          </div>
          <div ref={listRef} style={{ flex: 1, overflowY: "auto", padding: 12, display: "flex", flexDirection: "column", gap: 8 }}>
            {items.length === 0 && (
              globitoEnVentana && globito ? (
                <>
                  <div style={bubble("bot")}><BotText text={globito.texto} rutas={rutasPermitidas} /></div>
                  {globito.botones.map((b) => (
                    <button key={b.label} onClick={() => tocarBoton(b)} disabled={busy} style={chip}>{b.label}</button>
                  ))}
                </>
              ) : (
                <>
                  <div style={bubble("bot")}>{estado.saludo}</div>
                  {estado.sugerencias?.map((s) => (
                    <button key={s} onClick={() => send(s)} style={chip}>{s}</button>
                  ))}
                </>
              )
            )}
            {items.length === 0 && introProgreso && <ProgresoCard progreso={introProgreso} busy={busy} onHacelo={send} />}
            {items.map((it, i) => {
              if (it.kind === "user") return <div key={i} style={bubble("user")}>{it.text}</div>;
              if (it.kind === "bot") return it.text ? <div key={i} style={bubble("bot")}><BotText text={it.text} rutas={rutasPermitidas} /></div> : null;
              if (it.kind === "progreso") return <ProgresoCard key={i} progreso={it.progreso} busy={busy} onHacelo={send} />;
              if (it.kind === "calculo") return <CalculoCard key={i} tarjeta={it.tarjeta} />;
              if (it.kind === "notice") return (
                <div key={i} style={{ ...bubble("bot"), background: "#fff7e6" }}>
                  {it.text}
                  {it.offerTicket && conTickets && <div><button onClick={ticket} disabled={ticketBusy} style={linkBtn}>Hablar con una persona</button></div>}
                </div>
              );
              return (
                <div key={i} style={{ border: "1px solid #cfe3ff", background: "#f3f8ff", borderRadius: 12, padding: 10 }}>
                  <div style={{ fontWeight: 600, marginBottom: 6 }}>¿Lo hago?</div>
                  <div>{it.summary}</div>
                  {it.state === "pending" ? (
                    <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
                      <button onClick={() => decide(it.actionId, "confirmar")} disabled={deciding.has(it.actionId)} style={{ ...btn, background: "#111", color: "#fff" }}>Confirmar</button>
                      <button onClick={() => decide(it.actionId, "rechazar")} disabled={deciding.has(it.actionId)} style={btn}>No</button>
                    </div>
                  ) : (
                    <div style={{ marginTop: 6, color: it.state === "done" ? "#0a7a2f" : "#a33" }}>
                      {it.result}
                      {it.canUndo && <button onClick={() => decide(it.actionId, "deshacer")} disabled={deciding.has(it.actionId)} style={linkBtn}> Deshacer</button>}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
          <form onSubmit={(e) => { e.preventDefault(); void send(input); }} style={{ display: "flex", gap: 8, padding: 10, borderTop: "1px solid #eee" }}>
            <input value={input} onChange={(e) => setInput(e.target.value)} aria-label="Escribí tu consulta" placeholder="Escribí tu consulta…" maxLength={2000} disabled={busy} style={{ flex: 1, border: "1px solid #ddd", borderRadius: 10, padding: "8px 10px", fontSize: 16 }} />
            <button type="submit" aria-label="Enviar mensaje" disabled={busy || !input.trim()} style={{ ...btn, background: "#111", color: "#fff" }}>Enviar</button>
          </form>
          {conTickets && <button onClick={ticket} disabled={ticketBusy} aria-label="Hablar con una persona" style={{ ...linkBtn, padding: "0 0 10px" }}>Hablar con una persona</button>}
        </div>
      )}
      {globito && !open && !globitoEnVentana && entradaLista && (
        <div role="status" aria-label="Mensaje de DNX Bot" className={sinMovimiento ? "dnxbot-globito-pos" : "dnxbot-globito dnxbot-globito-pos"} style={{ position: "absolute", width: "max-content", maxWidth: "min(260px, calc(100vw - 112px))", background: "#fff", color: "#111", borderRadius: 14, boxShadow: "0 6px 20px rgba(0,0,0,.18)", padding: "10px 12px", fontSize: 13, whiteSpace: "pre-wrap" }}>
          <button onClick={cerrarGlobito} aria-label="Cerrar el mensaje de DNX Bot" style={{ position: "absolute", top: 2, right: 4, border: 0, background: "none", fontSize: 16, lineHeight: 1, cursor: "pointer", color: "#666" }}>×</button>
          <div style={{ paddingRight: 14 }}><BotText text={globito.texto} rutas={rutasPermitidas} /></div>
          {globito.botones.length > 0 && (
            <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginTop: 8 }}>
              {globito.botones.map((b) => (
                <button key={b.label} onClick={() => tocarBoton(b)} style={b.mensaje ? { ...btn, padding: "4px 10px", background: "#111", color: "#fff" } : { ...btn, padding: "4px 10px" }}>{b.label}</button>
              ))}
            </div>
          )}
          <span aria-hidden="true" style={{ position: "absolute", right: -6, bottom: 18, width: 12, height: 12, background: "#fff", transform: "rotate(45deg)" }} />
        </div>
      )}
      <button
        onClick={() => setOpen((o) => !o)}
        aria-label={open ? "Cerrar DNX Bot" : "Abrir DNX Bot"}
        className="dnxbot-mascota"
        data-fase={fase ?? undefined}
        // Hasta decidir la entrada no se muestra: evita que se vea un instante quieta antes de entrar.
        style={{ opacity: fase ? 1 : 0 }}
      >
        <span className="dnxbot-sombra" aria-hidden="true" />
        <span className="dnxbot-cuerpo">
          <img src={mascotSrc} alt="" width={57} height={90} />
        </span>
        {estado.alerta && !open && <span aria-label="Hay algo para revisar" style={{ position: "absolute", zIndex: 2, top: 0, right: -4, width: 14, height: 14, borderRadius: 999, background: "#e5484d", border: "2px solid #fff" }} />}
      </button>
    </div>
  );
}

/** Texto del bot con formato mínimo. Todo se arma con elementos de React: nunca innerHTML. */
function BotText({ text, rutas }: { text: string; rutas?: readonly string[] }) {
  return (
    <>
      {formatBotText(text, { rutasPermitidas: rutas }).map((line, li) => (
        <Fragment key={li}>
          {li > 0 && "\n"}
          {line.map((seg, si) =>
            seg.kind === "link" ? (
              <a key={si} href={seg.href} title={seg.href} style={{ color: "#2563eb", textDecoration: "underline", fontWeight: 600 }}>{seg.label}</a>
            ) : seg.bold ? (
              <strong key={si}>{seg.text}</strong>
            ) : (
              <Fragment key={si}>{seg.text}</Fragment>
            ),
          )}
        </Fragment>
      ))}
    </>
  );
}

/** Tarjeta del armado escolar: «Paso k de 11», la lista de pasos y el siguiente con «Abrir» y, si el bot puede hacerlo, «Hacelo por mí». */
function ProgresoCard({ progreso, busy, onHacelo }: { progreso: ProgresoEscolar; busy: boolean; onHacelo: (text: string) => void }) {
  const t = tarjetaProgreso(progreso);
  return (
    <section aria-label="Progreso del álbum escolar" style={{ border: "1px solid #d6e9d8", background: "#f4fbf5", borderRadius: 12, padding: 10 }}>
      <div style={{ fontWeight: 600 }}>{t.encabezado}</div>
      {t.titulo && <div style={{ fontSize: 12, color: "#555", marginBottom: 6 }}>{t.titulo}</div>}
      {t.aviso && <div style={{ fontSize: 12, color: "#a33", marginBottom: 6 }}>{t.aviso}</div>}
      <ol style={{ listStyle: "none", margin: 0, padding: 0, display: "flex", flexDirection: "column", gap: 2 }}>
        {t.filas.map((f) => (
          <li key={f.n} aria-current={f.esSiguiente ? "step" : undefined} style={{ display: "flex", gap: 6, padding: "2px 4px", borderRadius: 6, background: f.esSiguiente ? "#fff" : "transparent", fontWeight: f.esSiguiente ? 600 : 400, color: f.marca === "—" ? "#888" : "#111" }}>
            <span aria-hidden="true" style={{ width: 14, textAlign: "center", color: f.marca === "✓" ? "#0a7a2f" : undefined }}>{f.marca}</span>
            <span>
              <span style={visuallyHidden}>{`${f.estadoTexto}: `}</span>
              {f.titulo}
              {f.opcional && <span style={{ color: "#888", fontWeight: 400 }}> (opcional)</span>}
            </span>
          </li>
        ))}
      </ol>
      {t.siguiente && (
        <div style={{ display: "flex", gap: 8, marginTop: 8, flexWrap: "wrap" }}>
          {t.siguiente.enlace && (
            <a href={t.siguiente.enlace} aria-label={`Abrir el paso: ${t.siguiente.titulo}`} style={{ ...btn, color: "#111", textDecoration: "none", display: "inline-block" }}>Abrir</a>
          )}
          {t.siguiente.mensaje && (
            <button onClick={() => onHacelo(t.siguiente!.mensaje!)} disabled={busy} aria-label={`Hacelo por mí: ${t.siguiente.titulo}`} style={{ ...btn, background: "#111", color: "#fff" }}>Hacelo por mí</button>
          )}
        </div>
      )}
    </section>
  );
}

const visuallyHidden: React.CSSProperties = { position: "absolute", width: 1, height: 1, overflow: "hidden", clip: "rect(0 0 0 0)", whiteSpace: "nowrap" };
const chip: React.CSSProperties = { alignSelf: "flex-start", border: "1px solid #ddd", borderRadius: 999, padding: "4px 10px", background: "#fafafa", cursor: "pointer" };
const btn: React.CSSProperties = { border: "1px solid #ddd", borderRadius: 10, padding: "6px 12px", background: "#fff", cursor: "pointer" };
const linkBtn: React.CSSProperties = { border: 0, background: "none", color: "#2563eb", cursor: "pointer", textDecoration: "underline", fontSize: 13 };
function bubble(who: "user" | "bot"): React.CSSProperties {
  return { alignSelf: who === "user" ? "flex-end" : "flex-start", maxWidth: "85%", whiteSpace: "pre-wrap", background: who === "user" ? "#111" : "#f2f2f2", color: who === "user" ? "#fff" : "#111", borderRadius: 12, padding: "8px 10px" };
}