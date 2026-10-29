"use client";

import { useState, useTransition, type FormEvent } from "react";
import { Download, FileText, Film, FolderOpen, Hash, ImageIcon, Printer } from "lucide-react";
import { anotarNumeroDelLaboratorioAction } from "@/app/w/[workspaceSlug]/archivos/[token]/actions";
import { tamanoLegible } from "@/lib/carpetas/reglas";
import type { VistaCarpeta } from "@/lib/carpetas/tipos";

function fecha(iso: string): string {
  return new Date(iso).toLocaleDateString("es-AR", { timeZone: "America/Argentina/Buenos_Aires", day: "numeric", month: "long" });
}

function Icono({ tipo }: { tipo: string }) {
  if (tipo.startsWith("video/")) return <Film className="size-5" aria-hidden />;
  if (tipo.startsWith("image/")) return <ImageIcon className="size-5" aria-hidden />;
  return <FileText className="size-5" aria-hidden />;
}

/**
 * Lo que ve quien abre el enlace de la carpeta. El laboratorio: la lista para descargar todo. El
 * cliente: además, los videos para mirar ahí mismo y hasta cuándo puede descargarlos. El laboratorio
 * también puede anotar su número de pedido interno.
 */
export function CarpetaPublica({
  vista,
  enlaceImprimir,
  slug,
  token,
}: {
  vista: VistaCarpeta;
  enlaceImprimir?: string;
  slug: string;
  token: string;
}) {
  const [bajando, setBajando] = useState(false);
  const total = vista.archivos.reduce((a, f) => a + f.bytes, 0);
  const esCliente = vista.audiencia === "CLIENTE";

  /** Descarga uno por uno (el navegador puede pedir permiso para descargas múltiples). */
  async function descargarTodo() {
    setBajando(true);
    for (const a of vista.archivos) {
      const link = document.createElement("a");
      link.href = a.descargar;
      link.rel = "noreferrer";
      document.body.appendChild(link);
      link.click();
      link.remove();
      await new Promise((r) => setTimeout(r, 900));
    }
    setBajando(false);
  }

  return (
    <main className="min-h-screen bg-[var(--fo-bg)] px-4 py-10">
      <div className="mx-auto max-w-3xl space-y-6">
        <header className="space-y-1">
          <p className="text-sm text-[var(--fo-muted)]">{vista.estudio}</p>
          <h1 className="flex items-center gap-2 text-2xl font-bold">
            <FolderOpen className="size-6 text-[var(--fo-accent)]" aria-hidden />
            {esCliente ? "Tus archivos" : "Archivos del pedido"}
          </h1>
          <p className="text-sm text-[var(--fo-text-secondary)]">
            {vista.trabajo}
            {vista.cliente ? ` · ${vista.cliente}` : ""}
          </p>
          {vista.vence ? (
            <p className="text-sm font-medium text-amber-800">
              {esCliente ? "Descargalos antes del " : "Disponible hasta el "}
              {fecha(vista.vence)}: después se borran.
            </p>
          ) : null}
        </header>

        {!esCliente ? <NumeroDelLaboratorio slug={slug} token={token} inicial={vista.numeroLaboratorio} /> : null}

        {enlaceImprimir ? (
          <a href={enlaceImprimir} className="fo-card flex items-center gap-3 border-2 border-[var(--fo-accent)] p-4 hover:bg-[var(--fo-surface-hover)]">
            <Printer className="size-6 shrink-0 text-[var(--fo-accent)]" aria-hidden />
            <span className="min-w-0 flex-1">
              <span className="block font-semibold">Pedir copias impresas</span>
              <span className="block text-sm text-[var(--fo-text-secondary)]">Elegí tus fotos, el tamaño y cuántas copias querés. Las retirás en el local.</span>
            </span>
          </a>
        ) : null}

        {vista.archivos.length === 0 ? (
          <p className="fo-card p-8 text-center text-sm text-[var(--fo-muted)]">Todavía no hay archivos cargados.</p>
        ) : (
          <>
            <div className="flex flex-wrap items-center justify-between gap-3">
              <p className="text-sm text-[var(--fo-muted)]">
                {vista.archivos.length} {vista.archivos.length === 1 ? "archivo" : "archivos"} · {tamanoLegible(total)}
              </p>
              <button type="button" onClick={descargarTodo} disabled={bajando} className="fo-btn fo-btn-primary gap-2 text-sm">
                <Download className="size-4" aria-hidden />
                {bajando ? "Descargando…" : "Descargar todo"}
              </button>
            </div>
            <ul className="space-y-3">
              {vista.archivos.map((a) => (
                <li key={a.id} className="fo-card space-y-3 p-4">
                  {esCliente && a.ver ? (
                    <video src={a.ver} controls preload="metadata" className="w-full rounded-[var(--fo-radius-sm)] bg-black" />
                  ) : null}
                  <div className="flex items-center gap-3">
                    <span className="flex size-10 shrink-0 items-center justify-center rounded-[var(--fo-radius-sm)] bg-[var(--fo-surface-hover)] text-[var(--fo-muted)]">
                      <Icono tipo={a.tipo} />
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium">{a.nombre}</p>
                      <p className="text-xs text-[var(--fo-muted)]">{tamanoLegible(a.bytes)}</p>
                    </div>
                    <a href={a.descargar} rel="noreferrer" className="fo-btn fo-btn-secondary gap-1.5 text-sm">
                      <Download className="size-4" aria-hidden />
                      Descargar
                    </a>
                  </div>
                </li>
              ))}
            </ul>
          </>
        )}
      </div>
    </main>
  );
}

/** Donde el laboratorio anota su número de pedido: le llega al estudio en la ficha del trabajo. */
function NumeroDelLaboratorio({ slug, token, inicial }: { slug: string; token: string; inicial: string | null }) {
  const [numero, setNumero] = useState(inicial ?? "");
  const [guardado, setGuardado] = useState(inicial ?? "");
  const [mensaje, setMensaje] = useState<{ ok: boolean; texto: string } | null>(null);
  const [ocupado, start] = useTransition();

  function guardar(e: FormEvent) {
    e.preventDefault();
    start(async () => {
      const r = await anotarNumeroDelLaboratorioAction(slug, token, numero);
      if (r.ok) {
        setGuardado(r.numero ?? "");
        setMensaje({ ok: true, texto: r.numero ? "Listo: el estudio ya ve su número de pedido." : "Número borrado." });
      } else setMensaje({ ok: false, texto: r.error });
    });
  }

  return (
    <form onSubmit={guardar} className="fo-card space-y-2 p-4">
      <label htmlFor="numero-laboratorio" className="flex items-center gap-2 text-sm font-semibold">
        <Hash className="size-4 text-[var(--fo-accent)]" aria-hidden />
        Tu número de pedido
      </label>
      <p className="text-xs text-[var(--fo-muted)]">Si le dan un número interno a este pedido, anotalo acá: al estudio le queda en el trabajo.</p>
      <div className="flex gap-2">
        <input
          id="numero-laboratorio"
          className="fo-input min-w-0 flex-1"
          value={numero}
          maxLength={80}
          onChange={(e) => setNumero(e.target.value)}
          placeholder="Ej.: 8384"
          autoComplete="off"
        />
        <button type="submit" className="fo-btn fo-btn-primary text-sm" disabled={ocupado || numero.trim() === guardado}>
          {ocupado ? "Guardando…" : "Guardar"}
        </button>
      </div>
      {mensaje ? (
        <p className={`text-sm ${mensaje.ok ? "text-[var(--fo-success)]" : "text-[var(--fo-warning)]"}`} role="status">
          {mensaje.texto}
        </p>
      ) : null}
    </form>
  );
}
