"use client";

import { useActionState, useState } from "react";
import { useRouter } from "next/navigation";
import {
  borrarDocumentoAction,
  cambiarDocumentoAction,
  confirmarDocumentoAction,
  prepararSubidaDocumentoAction,
  type DocumentoState,
} from "@/app/actions/website-documentos";
import { MAX_BYTES_DOCUMENTO, MB, pesoLegible, slugDeDocumento, validarPesoDocumento, validarSlugDocumento } from "@/lib/website/documentos";

/** Las partes con estado de Sitio web → Documentos (la página es de servidor). */

const inicial: DocumentoState = { error: null };

/** El enlace del documento. Relativo sólo si no hay dirección de FOTOFFICE configurada (local). */
function enlaceCompleto(base: string | null, slug: string): string | null {
  return base ? `${base}${slug}` : null;
}

export function SubirDocumento({ slugsUsados, base }: { slugsUsados: string[]; base: string | null }) {
  const router = useRouter();
  const [archivo, setArchivo] = useState<File | null>(null);
  const [titulo, setTitulo] = useState("");
  const [slug, setSlug] = useState("");
  const [slugEditado, setSlugEditado] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [estado, setEstado] = useState<"quieto" | "subiendo" | "listo">("quieto");

  const errorSlug = slug ? (validarSlugDocumento(slug) ?? (slugsUsados.includes(slug) ? "Ya hay otro documento con esa dirección." : null)) : null;
  const puedeSubir = archivo !== null && titulo.trim() !== "" && slug !== "" && errorSlug === null && estado !== "subiendo";

  const elegir = (f: File | null) => {
    setError(null);
    setEstado("quieto");
    if (!f) return setArchivo(null);
    const peso = validarPesoDocumento(f.size);
    if (peso) {
      setArchivo(null);
      return setError(peso);
    }
    if (f.type && f.type !== "application/pdf") {
      setArchivo(null);
      return setError("Elegí un archivo PDF.");
    }
    setArchivo(f);
    if (!titulo.trim()) {
      const nombre = f.name.replace(/\.pdf$/i, "").replace(/[_]+/g, " ").trim();
      setTitulo(nombre);
      if (!slugEditado) setSlug(slugDeDocumento(nombre));
    }
  };

  const subir = async () => {
    if (!archivo || !puedeSubir) return;
    setError(null);
    setEstado("subiendo");
    try {
      const prep = await prepararSubidaDocumentoAction(archivo.size);
      if ("error" in prep) throw new Error(prep.error);
      const put = await fetch(prep.uploadUrl, { method: "PUT", body: archivo, headers: { "Content-Type": "application/pdf" } });
      if (!put.ok) throw new Error("No se pudo subir el archivo. Probá de nuevo.");
      const r = await confirmarDocumentoAction({ key: prep.key, titulo, slug });
      if (r.error) throw new Error(r.error);
      setArchivo(null);
      setTitulo("");
      setSlug("");
      setSlugEditado(false);
      setEstado("listo");
      router.refresh();
    } catch (err) {
      setEstado("quieto");
      setError(err instanceof Error ? err.message : "No se pudo subir el archivo. Probá de nuevo.");
    }
  };

  const vistaPrevia = slug ? enlaceCompleto(base, slug) : null;

  return (
    <div className="fo-card space-y-3">
      <h3 className="text-sm font-semibold text-[var(--fo-text)]">Subir un PDF</h3>
      <label className="block space-y-1">
        <span className="fo-label text-xs">Archivo (PDF, hasta {MAX_BYTES_DOCUMENTO / MB} MB)</span>
        <input
          type="file"
          accept="application/pdf,.pdf"
          className="block text-sm"
          disabled={estado === "subiendo"}
          onChange={(e) => elegir(e.target.files?.[0] ?? null)}
        />
      </label>
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="block space-y-1">
          <span className="fo-label text-xs">Título</span>
          <input
            className="fo-input text-sm"
            value={titulo}
            maxLength={160}
            placeholder="Propuesta de casamiento 2027"
            onChange={(e) => {
              setTitulo(e.target.value);
              if (!slugEditado) setSlug(slugDeDocumento(e.target.value));
            }}
          />
        </label>
        <label className="block space-y-1">
          <span className="fo-label text-xs">Dirección</span>
          <input
            className="fo-input text-sm"
            value={slug}
            maxLength={80}
            placeholder="propuesta-casamiento"
            onChange={(e) => {
              setSlug(e.target.value.toLowerCase());
              setSlugEditado(true);
            }}
          />
          {errorSlug ? <span className="block text-xs text-[var(--fo-danger)]">{errorSlug}</span> : null}
          {vistaPrevia && !errorSlug ? <span className="block truncate text-xs text-[var(--fo-muted)]">{vistaPrevia}</span> : null}
        </label>
      </div>
      <div className="flex flex-wrap items-center gap-3">
        <button type="button" className="fo-btn fo-btn-primary text-sm disabled:opacity-50" disabled={!puedeSubir} onClick={() => void subir()}>
          {estado === "subiendo" ? "Subiendo…" : "Subir documento"}
        </button>
        {archivo ? <span className="text-xs text-[var(--fo-muted)]">{pesoLegible(archivo.size)}</span> : null}
        {estado === "listo" ? <span className="text-sm text-[var(--fo-success,var(--fo-text))]">Listo: el documento ya está en el sitio.</span> : null}
        {error ? (
          <span className="text-sm text-[var(--fo-danger)]" role="alert">
            {error}
          </span>
        ) : null}
      </div>
    </div>
  );
}

export type FilaDocumento = {
  id: string;
  slug: string;
  titulo: string;
  tamanoBytes: number;
  publicado: boolean;
  descargas: number;
  fecha: string;
};

export function ListaDocumentos({ documentos, canEdit, base }: { documentos: FilaDocumento[]; canEdit: boolean; base: string | null }) {
  if (documentos.length === 0) {
    return <p className="fo-card text-sm text-[var(--fo-muted)]">Todavía no hay documentos.</p>;
  }
  return (
    <ul className="fo-card divide-y divide-[var(--fo-border)] p-0">
      {documentos.map((d) => (
        <FilaDeDocumento key={d.id} doc={d} canEdit={canEdit} base={base} />
      ))}
    </ul>
  );
}

function FilaDeDocumento({ doc, canEdit, base }: { doc: FilaDocumento; canEdit: boolean; base: string | null }) {
  const [editando, setEditando] = useState(false);
  const [copiado, setCopiado] = useState(false);
  const [estadoCambio, cambiar, cambiando] = useActionState(cambiarDocumentoAction, inicial);
  const [estadoBorrado, borrar, borrando] = useActionState(borrarDocumentoAction, inicial);
  const enlace = enlaceCompleto(base, doc.slug);
  const error = estadoCambio.error ?? estadoBorrado.error;

  const copiar = async () => {
    if (!enlace) return;
    const completo = enlace.startsWith("/") ? `${window.location.origin}${enlace}` : enlace;
    try {
      await navigator.clipboard.writeText(completo);
      setCopiado(true);
      setTimeout(() => setCopiado(false), 2000);
    } catch {
      window.prompt("Copiá el enlace:", completo);
    }
  };

  return (
    <li className="space-y-2 p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0 space-y-0.5">
          <p className="truncate text-sm font-medium text-[var(--fo-text)]">
            {doc.titulo}
            {!doc.publicado ? <span className="ml-2 rounded-full bg-[var(--fo-surface-muted)] px-2 py-0.5 text-xs text-[var(--fo-muted)]">Despublicado</span> : null}
          </p>
          <p className="truncate text-xs text-[var(--fo-muted)]">{enlace ?? `/d/${doc.slug}`}</p>
          <p className="text-xs text-[var(--fo-muted)]">
            {doc.descargas === 1 ? "1 apertura" : `${doc.descargas.toLocaleString("es-AR")} aperturas`} · {pesoLegible(doc.tamanoBytes)} · subido el {doc.fecha}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {enlace && doc.publicado ? (
            <>
              <button type="button" className="fo-btn fo-btn-secondary text-xs" onClick={() => void copiar()}>
                {copiado ? "¡Copiado!" : "Copiar enlace"}
              </button>
              <a className="fo-btn fo-btn-ghost text-xs" href={enlace} target="_blank" rel="noopener noreferrer">
                Abrir
              </a>
            </>
          ) : null}
          {canEdit ? (
            <>
              <form action={cambiar}>
                <input type="hidden" name="id" value={doc.id} />
                <input type="hidden" name="publicado" value={doc.publicado ? "false" : "true"} />
                <button type="submit" className="fo-btn fo-btn-ghost text-xs" disabled={cambiando}>
                  {doc.publicado ? "Despublicar" : "Publicar"}
                </button>
              </form>
              <button type="button" className="fo-btn fo-btn-ghost text-xs" onClick={() => setEditando((v) => !v)}>
                {editando ? "Cerrar" : "Editar"}
              </button>
              <form
                action={borrar}
                onSubmit={(e) => {
                  if (!window.confirm(`¿Borrar «${doc.titulo}»? El enlace deja de funcionar y el archivo se borra.`)) e.preventDefault();
                }}
              >
                <input type="hidden" name="id" value={doc.id} />
                <button type="submit" className="fo-btn fo-btn-ghost text-xs text-[var(--fo-danger)]" disabled={borrando}>
                  Borrar
                </button>
              </form>
            </>
          ) : null}
        </div>
      </div>
      {editando && canEdit ? <EditarDocumento doc={doc} onListo={() => setEditando(false)} /> : null}
      {error ? (
        <p className="text-xs text-[var(--fo-danger)]" role="alert">
          {error}
        </p>
      ) : null}
    </li>
  );
}

function EditarDocumento({ doc, onListo }: { doc: FilaDocumento; onListo: () => void }) {
  const [titulo, setTitulo] = useState(doc.titulo);
  const [slug, setSlug] = useState(doc.slug);
  const [estado, accion, pendiente] = useActionState(async (prev: DocumentoState | undefined, fd: FormData) => {
    const r = await cambiarDocumentoAction(prev, fd);
    if (!r.error) onListo();
    return r;
  }, inicial);
  const errorSlug = validarSlugDocumento(slug);

  return (
    <form action={accion} className="grid gap-3 rounded-lg border border-[var(--fo-border)] p-3 sm:grid-cols-[1fr_1fr_auto] sm:items-end">
      <input type="hidden" name="id" value={doc.id} />
      <label className="block space-y-1">
        <span className="fo-label text-xs">Título</span>
        <input name="titulo" className="fo-input text-sm" value={titulo} maxLength={160} onChange={(e) => setTitulo(e.target.value)} />
      </label>
      <label className="block space-y-1">
        <span className="fo-label text-xs">Dirección</span>
        <input name="slug" className="fo-input text-sm" value={slug} maxLength={80} onChange={(e) => setSlug(e.target.value.toLowerCase())} />
        {slug !== doc.slug ? <span className="block text-xs text-[var(--fo-muted)]">El enlace anterior deja de funcionar.</span> : null}
        {errorSlug ? <span className="block text-xs text-[var(--fo-danger)]">{errorSlug}</span> : null}
      </label>
      <button type="submit" className="fo-btn fo-btn-primary text-xs disabled:opacity-50" disabled={pendiente || !!errorSlug || !titulo.trim()}>
        Guardar
      </button>
      {estado.error ? (
        <p className="text-xs text-[var(--fo-danger)] sm:col-span-3" role="alert">
          {estado.error}
        </p>
      ) : null}
    </form>
  );
}
