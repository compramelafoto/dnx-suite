"use client";

import { Fragment, useCallback, useEffect, useRef, useState } from "react";
import { formatBotText } from "./format";
import { parseSseBuffer } from "../sse";
import { applyDecision, applySseEvent, dropEmptyBot, type Item } from "./items";

export type DnxBotBubbleProps = { basePath: string; mascotSrc: string; bottomOffsetPx?: number };

export function DnxBotBubble({ basePath, mascotSrc, bottomOffsetPx = 24 }: DnxBotBubbleProps) {
  const [estado, setEstado] = useState<{ enabled: boolean; alerta?: boolean; saludo?: string; sugerencias?: string[] } | null>(null);
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState<Item[]>([]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [deciding, setDeciding] = useState<Set<string>>(new Set());
  const decidingRef = useRef<Set<string>>(new Set());
  const [ticketBusy, setTicketBusy] = useState(false);
  const ticketRef = useRef(false);
  const listRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    fetch(`${basePath}/estado`).then((r) => r.json()).then(setEstado).catch(() => setEstado({ enabled: false }));
  }, [basePath]);
  useEffect(() => { listRef.current?.scrollTo({ top: listRef.current.scrollHeight }); }, [items]);

  const send = useCallback(async (text: string) => {
    if (!text.trim() || busy) return;
    setBusy(true);
    setInput("");
    setItems((x) => [...x, { kind: "user", text }, { kind: "bot", text: "" }]);
    try {
      const res = await fetch(`${basePath}/chat`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ text, pagePath: location.pathname }) });
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
  }, [basePath, busy]);

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
      const text = r.ticketId
        ? r.reused
          ? `Ya tenés abierto el pedido de soporte #${r.ticketId}. La respuesta te aparece en Soporte y te llega por mail.`
          : `Abrí el pedido de soporte #${r.ticketId}. La respuesta te aparece en Soporte y te llega por mail.`
        : res.status === 429 && r.error
          ? r.error
          : "No pude abrir el pedido. Escribinos desde Soporte.";
      setItems((x) => [...x, { kind: "notice", text }]);
    } catch {
      setItems((x) => [...x, { kind: "notice", text: "No me pude conectar. Probá de nuevo." }]);
    } finally {
      ticketRef.current = false;
      setTicketBusy(false);
    }
  }, [basePath]);

  if (!estado?.enabled) return null;

  return (
    <div style={{ position: "fixed", right: 24, bottom: bottomOffsetPx, zIndex: 9990 }}>
      {open && (
        <div role="dialog" aria-label="DNX Bot" style={{ width: "min(380px, calc(100vw - 32px))", height: `min(560px, calc(100vh - ${bottomOffsetPx + 116}px))`, marginBottom: 12, background: "#fff", color: "#111", borderRadius: 16, boxShadow: "0 12px 40px rgba(0,0,0,.18)", display: "flex", flexDirection: "column", overflow: "hidden", fontSize: 14 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "10px 12px", borderBottom: "1px solid #eee" }}>
            <img src={mascotSrc} alt="" width={32} height={32} />
            <div style={{ flex: 1 }}>
              <strong>DNX Bot</strong>
              <div style={{ fontSize: 11, color: "#666" }}>Soy un asistente automático</div>
            </div>
            <button onClick={() => setOpen(false)} aria-label="Cerrar" style={{ border: 0, background: "none", fontSize: 18, cursor: "pointer" }}>×</button>
          </div>
          <div ref={listRef} style={{ flex: 1, overflowY: "auto", padding: 12, display: "flex", flexDirection: "column", gap: 8 }}>
            {items.length === 0 && (
              <>
                <div style={bubble("bot")}>{estado.saludo}</div>
                {estado.sugerencias?.map((s) => (
                  <button key={s} onClick={() => send(s)} style={{ alignSelf: "flex-start", border: "1px solid #ddd", borderRadius: 999, padding: "4px 10px", background: "#fafafa", cursor: "pointer" }}>{s}</button>
                ))}
              </>
            )}
            {items.map((it, i) => {
              if (it.kind === "user") return <div key={i} style={bubble("user")}>{it.text}</div>;
              if (it.kind === "bot") return it.text ? <div key={i} style={bubble("bot")}><BotText text={it.text} /></div> : null;
              if (it.kind === "notice") return (
                <div key={i} style={{ ...bubble("bot"), background: "#fff7e6" }}>
                  {it.text}
                  {it.offerTicket && <div><button onClick={ticket} disabled={ticketBusy} style={linkBtn}>Hablar con una persona</button></div>}
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
          <button onClick={ticket} disabled={ticketBusy} aria-label="Hablar con una persona" style={{ ...linkBtn, padding: "0 0 10px" }}>Hablar con una persona</button>
        </div>
      )}
      <button onClick={() => setOpen((o) => !o)} aria-label={open ? "Cerrar DNX Bot" : "Abrir DNX Bot"} style={{ position: "relative", marginLeft: "auto", display: "block", width: 64, height: 64, borderRadius: 999, border: 0, background: "#fff", boxShadow: "0 6px 20px rgba(0,0,0,.2)", cursor: "pointer", padding: 4 }}>
        <img src={mascotSrc} alt="" width={56} height={56} style={{ objectFit: "contain" }} />
        {estado.alerta && !open && <span aria-label="Hay algo para revisar" style={{ position: "absolute", top: 4, right: 4, width: 14, height: 14, borderRadius: 999, background: "#e5484d", border: "2px solid #fff" }} />}
      </button>
    </div>
  );
}

/** Texto del bot con formato mínimo. Todo se arma con elementos de React: nunca innerHTML. */
function BotText({ text }: { text: string }) {
  return (
    <>
      {formatBotText(text).map((line, li) => (
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

const btn: React.CSSProperties = { border: "1px solid #ddd", borderRadius: 10, padding: "6px 12px", background: "#fff", cursor: "pointer" };
const linkBtn: React.CSSProperties = { border: 0, background: "none", color: "#2563eb", cursor: "pointer", textDecoration: "underline", fontSize: 13 };
function bubble(who: "user" | "bot"): React.CSSProperties {
  return { alignSelf: who === "user" ? "flex-end" : "flex-start", maxWidth: "85%", whiteSpace: "pre-wrap", background: who === "user" ? "#111" : "#f2f2f2", color: who === "user" ? "#fff" : "#111", borderRadius: 12, padding: "8px 10px" };
}