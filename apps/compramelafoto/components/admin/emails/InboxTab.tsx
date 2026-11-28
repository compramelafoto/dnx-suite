"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Button from "@/components/ui/Button";
import Input from "@/components/ui/Input";
import Textarea from "@/components/ui/Textarea";

type Vista = "entrada" | "sin-leer" | "otros" | "archivados";

type ItemLista = {
  id: number;
  fromEmail: string;
  fromName: string | null;
  to: string;
  subject: string;
  preview: string;
  kind: string;
  receivedAt: string;
  readAt: string | null;
  archivedAt: string | null;
  repliedAt: string | null;
  attachmentCount: number;
};

type Respuesta = {
  id: number;
  to: string;
  subject: string;
  body: string;
  status: string;
  error: string | null;
  createdAt: string;
};

type Detalle = {
  id: number;
  fromEmail: string;
  fromName: string | null;
  to: string;
  cc: string | null;
  subject: string;
  text: string;
  html: string | null;
  kind: string;
  receivedAt: string;
  readAt: string | null;
  archivedAt: string | null;
  repliedAt: string | null;
  attachments: Array<{ id: string; filename: string; contentType: string | null; size: number | null }> | null;
  replies: Respuesta[];
};

type Anterior = { id: number; subject: string; receivedAt: string; repliedAt: string | null; archivedAt: string | null };

const VISTAS: Array<{ id: Vista; label: string }> = [
  { id: "entrada", label: "Entrada" },
  { id: "sin-leer", label: "Sin leer" },
  { id: "otros", label: "Spam y automáticos" },
  { id: "archivados", label: "Archivados" },
];

const CLASE: Record<string, string> = { AUTOMATICA: "Automático", REBOTE: "Rebote", SPAM: "Spam" };
const PAGINA = 25;

function fecha(iso: string, corta = false) {
  const d = new Date(iso);
  return d.toLocaleString("es-AR", {
    timeZone: "America/Argentina/Buenos_Aires",
    ...(corta ? { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" } : { dateStyle: "long", timeStyle: "short" }),
  });
}

function tamano(b: number | null) {
  if (!b) return "";
  return b > 1024 * 1024 ? `${(b / 1024 / 1024).toFixed(1)} MB` : `${Math.max(1, Math.round(b / 1024))} KB`;
}

/** Envuelve el HTML del correo: sin scripts, con enlaces en pestaña nueva y sin pedir nada fuera de imágenes. */
function documentoSeguro(html: string) {
  const csp =
    "default-src 'none'; img-src https: http: data: cid:; style-src 'unsafe-inline' https:; font-src https: data:;";
  return `<!doctype html><html><head><meta charset="utf-8"><meta http-equiv="Content-Security-Policy" content="${csp}"><base target="_blank"><style>body{margin:0;font-family:Arial,sans-serif;font-size:14px;color:#111827;word-break:break-word}img{max-width:100%;height:auto}</style></head><body>${html}</body></html>`;
}

function CuerpoHtml({ html }: { html: string }) {
  const ref = useRef<HTMLIFrameElement>(null);
  const [alto, setAlto] = useState(300);
  const medir = () => {
    const doc = ref.current?.contentDocument;
    if (doc?.body) setAlto(Math.min(4000, Math.max(120, doc.documentElement.scrollHeight + 8)));
  };
  return (
    <iframe
      ref={ref}
      title="Contenido del correo"
      // Sin allow-scripts: el HTML del correo no puede ejecutar nada.
      sandbox="allow-same-origin allow-popups allow-popups-to-escape-sandbox"
      srcDoc={documentoSeguro(html)}
      onLoad={() => {
        medir();
        setTimeout(medir, 600);
      }}
      className="w-full border-0"
      style={{ height: alto }}
    />
  );
}

export default function InboxTab({ onSinLeer }: { onSinLeer?: (n: number) => void }) {
  const [vista, setVista] = useState<Vista>("entrada");
  const [q, setQ] = useState("");
  const [busqueda, setBusqueda] = useState("");
  const [pagina, setPagina] = useState(1);
  const [items, setItems] = useState<ItemLista[]>([]);
  const [total, setTotal] = useState(0);
  const [cargando, setCargando] = useState(false);
  const [aviso, setAviso] = useState<string | null>(null);
  const [sincronizando, setSincronizando] = useState(false);

  const [abiertoId, setAbiertoId] = useState<number | null>(null);
  const [detalle, setDetalle] = useState<Detalle | null>(null);
  const [anteriores, setAnteriores] = useState<Anterior[]>([]);
  const [cargandoDetalle, setCargandoDetalle] = useState(false);
  const [verTexto, setVerTexto] = useState(false);

  const [respuesta, setRespuesta] = useState("");
  const [enviando, setEnviando] = useState(false);
  const [estadoEnvio, setEstadoEnvio] = useState<{ ok: boolean; texto: string } | null>(null);

  const cargarLista = useCallback(async () => {
    setCargando(true);
    try {
      const p = new URLSearchParams({ vista, page: String(pagina), pageSize: String(PAGINA) });
      if (busqueda) p.set("q", busqueda);
      const res = await fetch(`/api/admin/emails/inbox?${p}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || "No se pudo cargar la bandeja");
      setItems(data.items || []);
      setTotal(data.total || 0);
      onSinLeer?.(data.sinLeer || 0);
    } catch (e) {
      setAviso(e instanceof Error ? e.message : "No se pudo cargar la bandeja");
    } finally {
      setCargando(false);
    }
  }, [vista, pagina, busqueda, onSinLeer]);

  useEffect(() => {
    cargarLista();
  }, [cargarLista]);

  async function cargarContador() {
    const res = await fetch(`/api/admin/emails/inbox?vista=sin-leer&pageSize=10`).catch(() => null);
    const data = await res?.json().catch(() => null);
    if (data && typeof data.sinLeer === "number") onSinLeer?.(data.sinLeer);
  }

  async function abrir(id: number) {
    setAbiertoId(id);
    setCargandoDetalle(true);
    setEstadoEnvio(null);
    setRespuesta("");
    setVerTexto(false);
    try {
      const res = await fetch(`/api/admin/emails/inbox/${id}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || "No se pudo abrir el correo");
      setDetalle(data.item);
      setAnteriores(data.anteriores || []);
      setItems((xs) => xs.map((x) => (x.id === id ? { ...x, readAt: x.readAt ?? new Date().toISOString() } : x)));
      if (!items.find((x) => x.id === id)?.readAt) cargarContador();
    } catch (e) {
      setAviso(e instanceof Error ? e.message : "No se pudo abrir el correo");
      setDetalle(null);
    } finally {
      setCargandoDetalle(false);
    }
  }

  async function cambiar(id: number, cambio: { leido?: boolean; archivado?: boolean }) {
    const res = await fetch(`/api/admin/emails/inbox/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(cambio),
    });
    if (!res.ok) {
      setAviso("No se pudo actualizar el correo");
      return;
    }
    if (cambio.archivado !== undefined || cambio.leido === false) {
      setAbiertoId(null);
      setDetalle(null);
    }
    cargarLista();
  }

  async function sincronizar() {
    setSincronizando(true);
    setAviso(null);
    try {
      const res = await fetch("/api/admin/emails/inbox/sync", { method: "POST" });
      const data = await res.json();
      const partes = [`${data.nuevos ?? 0} correo(s) nuevo(s)`];
      if (data.errores?.length) partes.push(`Problemas: ${data.errores.join(" · ")}`);
      setAviso(partes.join(". "));
      cargarLista();
    } catch {
      setAviso("No se pudo traer los correos de Resend");
    } finally {
      setSincronizando(false);
    }
  }

  async function enviar(e: React.FormEvent) {
    e.preventDefault();
    if (!detalle || !respuesta.trim()) return;
    setEnviando(true);
    setEstadoEnvio(null);
    try {
      const res = await fetch(`/api/admin/emails/inbox/${detalle.id}/reply`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ cuerpo: respuesta }),
      });
      const data = await res.json();
      if (data.respuesta) setDetalle((d) => (d ? { ...d, replies: [...d.replies, data.respuesta], repliedAt: res.ok ? new Date().toISOString() : d.repliedAt } : d));
      if (!res.ok) {
        setEstadoEnvio({ ok: false, texto: `${data.error || "No se pudo enviar"}${data.detalle ? ` (${data.detalle})` : ""}` });
        return;
      }
      setRespuesta("");
      setEstadoEnvio({ ok: true, texto: `Respuesta enviada a ${detalle.fromEmail}` });
      setItems((xs) => xs.map((x) => (x.id === detalle.id ? { ...x, repliedAt: new Date().toISOString() } : x)));
    } catch {
      setEstadoEnvio({ ok: false, texto: "No se pudo enviar la respuesta" });
    } finally {
      setEnviando(false);
    }
  }

  const casilla = (to: string) => to.split(",").map((s) => s.trim()).find((s) => s.toLowerCase().includes("@compramelafoto.com")) ?? to;

  return (
    <div className="space-y-4">
      <div className="bg-white border border-[#e5e7eb] rounded-xl p-4 flex flex-wrap items-center gap-3">
        <div className="flex flex-wrap gap-2">
          {VISTAS.map((v) => (
            <button
              key={v.id}
              type="button"
              onClick={() => {
                setVista(v.id);
                setPagina(1);
                setAbiertoId(null);
                setDetalle(null);
              }}
              className={`px-3 py-1.5 rounded-full text-sm border ${
                vista === v.id ? "bg-[#111827] text-white border-[#111827]" : "bg-white text-[#374151] border-[#e5e7eb] hover:bg-[#f9fafb]"
              }`}
            >
              {v.label}
            </button>
          ))}
        </div>
        <form
          className="flex gap-2 flex-1 min-w-[220px]"
          onSubmit={(e) => {
            e.preventDefault();
            setPagina(1);
            setBusqueda(q.trim());
          }}
        >
          <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Buscar por remitente, asunto o texto" />
          <Button type="submit" variant="secondary" className="text-sm">
            Buscar
          </Button>
        </form>
        <Button variant="secondary" className="text-sm" onClick={sincronizar} disabled={sincronizando}>
          {sincronizando ? "Trayendo…" : "Traer de Resend"}
        </Button>
      </div>

      {aviso && (
        <div className="text-sm text-[#374151] bg-[#f9fafb] border border-[#e5e7eb] rounded-lg px-3 py-2 flex justify-between gap-3">
          <span>{aviso}</span>
          <button type="button" className="text-[#6b7280]" onClick={() => setAviso(null)} aria-label="Cerrar aviso">
            ✕
          </button>
        </div>
      )}

      <div className="grid gap-4 lg:grid-cols-[minmax(320px,420px)_1fr]">
        {/* Lista */}
        <div className={`bg-white border border-[#e5e7eb] rounded-xl overflow-hidden ${abiertoId ? "hidden lg:block" : ""}`}>
          {cargando && items.length === 0 ? (
            <p className="p-4 text-sm text-[#6b7280]">Cargando…</p>
          ) : items.length === 0 ? (
            <div className="p-4 text-sm text-[#6b7280] space-y-2">
              <p>No hay correos en esta vista.</p>
              {vista === "entrada" && !busqueda && <p>Si recién se activa la bandeja, tocá «Traer de Resend» para cargar los que ya llegaron.</p>}
            </div>
          ) : (
            <ul className="divide-y divide-[#f3f4f6]">
              {items.map((m) => {
                const noLeido = !m.readAt;
                return (
                  <li key={m.id}>
                    <button
                      type="button"
                      onClick={() => abrir(m.id)}
                      className={`w-full text-left px-4 py-3 hover:bg-[#f9fafb] ${abiertoId === m.id ? "bg-[#f3f4f6]" : ""}`}
                    >
                      <div className="flex justify-between gap-2">
                        <span className={`truncate text-sm ${noLeido ? "font-semibold text-[#111827]" : "text-[#374151]"}`}>
                          {noLeido && <span className="inline-block w-2 h-2 rounded-full bg-[#2563eb] mr-2 align-middle" />}
                          {m.fromName || m.fromEmail}
                        </span>
                        <span className="text-xs text-[#6b7280] shrink-0">{fecha(m.receivedAt, true)}</span>
                      </div>
                      <div className={`truncate text-sm ${noLeido ? "font-medium text-[#111827]" : "text-[#4b5563]"}`}>
                        {m.subject || "(sin asunto)"}
                      </div>
                      <div className="truncate text-xs text-[#6b7280]">{m.preview}</div>
                      <div className="flex flex-wrap gap-1 mt-1">
                        {m.repliedAt && <span className="text-[11px] px-1.5 py-0.5 rounded bg-[#ecfdf5] text-[#047857]">Respondido</span>}
                        {CLASE[m.kind] && <span className="text-[11px] px-1.5 py-0.5 rounded bg-[#fef3c7] text-[#92400e]">{CLASE[m.kind]}</span>}
                        {m.attachmentCount > 0 && (
                          <span className="text-[11px] px-1.5 py-0.5 rounded bg-[#f3f4f6] text-[#4b5563]">📎 {m.attachmentCount}</span>
                        )}
                        <span className="text-[11px] text-[#9ca3af]">a {casilla(m.to)}</span>
                      </div>
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
          <div className="flex justify-between items-center px-4 py-3 border-t border-[#f3f4f6]">
            <Button variant="secondary" className="text-sm" disabled={pagina <= 1} onClick={() => setPagina((p) => Math.max(1, p - 1))}>
              Anterior
            </Button>
            <span className="text-xs text-[#6b7280]">
              Página {pagina} · {total} correos
            </span>
            <Button variant="secondary" className="text-sm" disabled={pagina * PAGINA >= total} onClick={() => setPagina((p) => p + 1)}>
              Siguiente
            </Button>
          </div>
        </div>

        {/* Correo abierto */}
        <div className={`bg-white border border-[#e5e7eb] rounded-xl p-4 min-h-[300px] ${abiertoId ? "" : "hidden lg:block"}`}>
          {!abiertoId ? (
            <p className="text-sm text-[#6b7280]">Elegí un correo para leerlo y responderlo.</p>
          ) : cargandoDetalle || !detalle ? (
            <p className="text-sm text-[#6b7280]">Cargando…</p>
          ) : (
            <div className="space-y-4">
              <div className="flex flex-wrap justify-between gap-2">
                <button type="button" className="text-sm text-[#2563eb] lg:hidden" onClick={() => { setAbiertoId(null); setDetalle(null); }}>
                  ← Volver
                </button>
                <div className="flex flex-wrap gap-2 ml-auto">
                  <Button variant="secondary" className="text-sm" onClick={() => cambiar(detalle.id, { leido: false })}>
                    Marcar sin leer
                  </Button>
                  <Button variant="secondary" className="text-sm" onClick={() => cambiar(detalle.id, { archivado: !detalle.archivedAt })}>
                    {detalle.archivedAt ? "Volver a la entrada" : "Archivar"}
                  </Button>
                </div>
              </div>

              <div>
                <h2 className="text-lg font-semibold text-[#111827]">{detalle.subject || "(sin asunto)"}</h2>
                <div className="text-sm text-[#374151] mt-1">
                  <span className="font-medium">{detalle.fromName || detalle.fromEmail}</span>
                  {detalle.fromName && <span className="text-[#6b7280]"> &lt;{detalle.fromEmail}&gt;</span>}
                </div>
                <div className="text-xs text-[#6b7280]">
                  Para {detalle.to}
                  {detalle.cc ? ` · CC ${detalle.cc}` : ""} · {fecha(detalle.receivedAt)}
                </div>
                {CLASE[detalle.kind] && (
                  <div className="mt-2 text-xs text-[#92400e] bg-[#fef3c7] rounded px-2 py-1 inline-block">
                    Marcado como {CLASE[detalle.kind].toLowerCase()}. Revisá antes de responder.
                  </div>
                )}
              </div>

              <div className="border-t border-[#f3f4f6] pt-3">
                {detalle.html && !verTexto ? (
                  <CuerpoHtml html={detalle.html} />
                ) : (
                  <pre className="whitespace-pre-wrap break-words font-sans text-sm text-[#111827]">{detalle.text || "(sin texto)"}</pre>
                )}
                {detalle.html && (
                  <button type="button" className="mt-2 text-xs text-[#6b7280] underline" onClick={() => setVerTexto((v) => !v)}>
                    {verTexto ? "Ver con formato" : "Ver como texto"}
                  </button>
                )}
              </div>

              {detalle.attachments && detalle.attachments.length > 0 && (
                <div className="flex flex-wrap gap-2">
                  {detalle.attachments.map((a) => (
                    <a
                      key={a.id}
                      href={`/api/admin/emails/inbox/${detalle.id}/attachments/${encodeURIComponent(a.id)}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-xs border border-[#e5e7eb] rounded-lg px-2 py-1 hover:bg-[#f9fafb] text-[#374151]"
                    >
                      📎 {a.filename} {tamano(a.size)}
                    </a>
                  ))}
                </div>
              )}

              {detalle.replies.length > 0 && (
                <div className="space-y-2">
                  <div className="text-xs font-semibold text-[#6b7280] uppercase">Respuestas enviadas</div>
                  {detalle.replies.map((r) => (
                    <div
                      key={r.id}
                      className={`rounded-lg p-3 text-sm border ${r.status === "SENT" ? "border-[#d1fae5] bg-[#f0fdf4]" : "border-[#fecaca] bg-[#fef2f2]"}`}
                    >
                      <div className="text-xs text-[#6b7280] mb-1">
                        {fecha(r.createdAt)} · {r.status === "SENT" ? "Enviada" : `No se envió${r.error ? `: ${r.error}` : ""}`}
                      </div>
                      <div className="whitespace-pre-wrap text-[#111827]">{r.body}</div>
                    </div>
                  ))}
                </div>
              )}

              <form onSubmit={enviar} className="space-y-2 border-t border-[#f3f4f6] pt-3">
                <label className="block text-sm font-medium text-[#374151]">
                  Responder a {detalle.fromEmail}
                  <span className="font-normal text-[#6b7280]"> · sale desde {casilla(detalle.to)}</span>
                </label>
                <Textarea value={respuesta} onChange={(e) => setRespuesta(e.target.value)} rows={6} placeholder="Escribí tu respuesta…" />
                <div className="flex items-center gap-3">
                  <Button type="submit" disabled={enviando || !respuesta.trim()}>
                    {enviando ? "Enviando…" : "Enviar respuesta"}
                  </Button>
                  {estadoEnvio && (
                    <span className={`text-sm ${estadoEnvio.ok ? "text-[#047857]" : "text-[#b91c1c]"}`}>{estadoEnvio.texto}</span>
                  )}
                </div>
                <p className="text-xs text-[#9ca3af]">Debajo de tu texto va la cita del correo original, como en cualquier programa de correo.</p>
              </form>

              {anteriores.length > 0 && (
                <div className="border-t border-[#f3f4f6] pt-3">
                  <div className="text-xs font-semibold text-[#6b7280] uppercase mb-2">Otros correos de esta persona</div>
                  <ul className="space-y-1">
                    {anteriores.map((a) => (
                      <li key={a.id}>
                        <button type="button" className="text-sm text-[#2563eb] hover:underline text-left" onClick={() => abrir(a.id)}>
                          {fecha(a.receivedAt, true)} · {a.subject || "(sin asunto)"}
                          {a.repliedAt ? " · respondido" : ""}
                        </button>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
