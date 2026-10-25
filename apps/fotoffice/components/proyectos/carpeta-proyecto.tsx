"use client";

import { useRouter } from "next/navigation";
import { useRef, useState } from "react";
import { Copy, FileText, Film, FolderOpen, ImageIcon, Trash2, Upload } from "lucide-react";
import { archivosSubidosAction, borrarArchivoAction, confirmarSubidaAction, enlaceDeCarpetaAction, pedirSubidaAction } from "@/app/actions/carpetas";
import { tamanoLegible } from "@/lib/carpetas/reglas";
import type { ArchivoVista } from "@/lib/carpetas/tipos";

type Subida = { nombre: string; progreso: number; error: string | null };

function Icono({ tipo }: { tipo: string }) {
  if (tipo.startsWith("video/")) return <Film className="size-4" aria-hidden />;
  if (tipo.startsWith("image/")) return <ImageIcon className="size-4" aria-hidden />;
  return <FileText className="size-4" aria-hidden />;
}

/** PUT directo a R2 con progreso (fetch no informa el avance de la subida). */
function subirConProgreso(url: string, archivo: File, tipo: string, alAvanzar: (p: number) => void): Promise<boolean> {
  return new Promise((resolve) => {
    const xhr = new XMLHttpRequest();
    xhr.open("PUT", url);
    xhr.setRequestHeader("Content-Type", tipo);
    xhr.upload.onprogress = (e) => {
      if (e.lengthComputable) alAvanzar(Math.round((e.loaded / e.total) * 100));
    };
    xhr.onload = () => resolve(xhr.status >= 200 && xhr.status < 300);
    xhr.onerror = () => resolve(false);
    xhr.send(archivo);
  });
}

/**
 * La carpeta del trabajo: lo que antes iba a un link de Drive. Se arrastran los archivos (hasta
 * 5 GB cada uno), suben directo al almacenamiento y quedan dos enlaces: para el laboratorio y para
 * el cliente. Se borran solos 30 días después de subir el primero; compartir lo extiende.
 */
export function CarpetaProyecto({
  proyectoId,
  archivos,
  vence,
  puedeEditar,
}: {
  proyectoId: string;
  archivos: ArchivoVista[];
  vence: string | null;
  puedeEditar: boolean;
}) {
  const router = useRouter();
  const input = useRef<HTMLInputElement>(null);
  const [subidas, setSubidas] = useState<Subida[]>([]);
  const [encima, setEncima] = useState(false);
  const [aviso, setAviso] = useState<{ ok: boolean; texto: string } | null>(null);
  const total = archivos.reduce((a, f) => a + f.bytes, 0);

  async function subir(lista: FileList | File[]) {
    const nuevos = [...lista];
    if (nuevos.length === 0) return;
    setAviso(null);
    setSubidas(nuevos.map((f) => ({ nombre: f.name, progreso: 0, error: null })));
    let ok = 0;
    for (const [i, f] of nuevos.entries()) {
      const cambiar = (c: Partial<Subida>) => setSubidas((s) => s.map((x, j) => (j === i ? { ...x, ...c } : x)));
      const p = await pedirSubidaAction(proyectoId, f.name, f.type, f.size);
      if (!p.ok) {
        cambiar({ error: p.error });
        continue;
      }
      const subio = await subirConProgreso(p.url, f, p.tipo, (n) => cambiar({ progreso: n }));
      if (!subio) {
        cambiar({ error: "No se pudo subir. Revisá la conexión y probá de nuevo." });
        continue;
      }
      const c = await confirmarSubidaAction(proyectoId, p.archivoId);
      if (!c.ok) cambiar({ error: c.error });
      else {
        cambiar({ progreso: 100 });
        ok++;
      }
    }
    setSubidas((s) => s.filter((x) => x.error !== null));
    if (ok > 0) {
      const subidos = `${ok} ${ok === 1 ? "archivo subido" : "archivos subidos"}.`;
      // Digitalizaciones y rollos: con los archivos arriba, el trabajo queda listo y el cliente recibe el aviso.
      const l = await archivosSubidosAction(proyectoId);
      if (l.ok && l.etapa) {
        const correo = l.correo ? ` Se le avisó por correo a ${l.correo}.` : ` ${l.avisoError ?? ""}`;
        setAviso({ ok: l.correo !== null, texto: `${subidos} Pasó a «${l.etapa}».${correo}` });
      } else setAviso({ ok: true, texto: subidos });
    }
    router.refresh();
  }

  async function borrar(a: ArchivoVista) {
    if (!window.confirm(`¿Borrar «${a.nombre}»?`)) return;
    const r = await borrarArchivoAction(proyectoId, a.id);
    setAviso(r.ok ? { ok: true, texto: "Archivo borrado." } : { ok: false, texto: r.error });
    router.refresh();
  }

  async function copiar(audiencia: "CLIENTE" | "LABORATORIO") {
    setAviso(null);
    const r = await enlaceDeCarpetaAction(proyectoId, audiencia);
    if (!r.ok) {
      setAviso({ ok: false, texto: r.error });
      return;
    }
    try {
      await navigator.clipboard.writeText(r.url);
      setAviso({ ok: true, texto: `Enlace ${audiencia === "CLIENTE" ? "para el cliente" : "para el laboratorio"} copiado.` });
    } catch {
      setAviso({ ok: true, texto: r.url });
    }
    router.refresh();
  }

  return (
    <section aria-labelledby="carpeta-titulo" className="fo-card space-y-3 p-4">
      <div className="flex items-center justify-between gap-2">
        <h2 id="carpeta-titulo" className="flex items-center gap-2 text-sm font-semibold uppercase tracking-wide text-[var(--fo-muted-soft)]">
          <FolderOpen className="size-4" aria-hidden />
          Archivos del trabajo
        </h2>
        {archivos.length > 0 ? (
          <span className="text-xs text-[var(--fo-muted)]">
            {archivos.length} · {tamanoLegible(total)}
          </span>
        ) : null}
      </div>

      {puedeEditar ? (
        <div
          onDragOver={(e) => {
            e.preventDefault();
            setEncima(true);
          }}
          onDragLeave={() => setEncima(false)}
          onDrop={(e) => {
            e.preventDefault();
            setEncima(false);
            void subir(e.dataTransfer.files);
          }}
          onClick={() => input.current?.click()}
          className={`flex cursor-pointer flex-col items-center gap-1 rounded-[var(--fo-radius-sm)] border-2 border-dashed px-3 py-5 text-center text-sm transition ${
            encima ? "border-[var(--fo-accent)] bg-[var(--fo-accent-soft)]" : "border-[var(--fo-border)] hover:border-[var(--fo-accent)]"
          }`}
        >
          <Upload className="size-5 text-[var(--fo-muted)]" aria-hidden />
          <span className="font-medium">Arrastrá los archivos o tocá para elegirlos</span>
          <span className="text-xs text-[var(--fo-muted)]">Fotos, videos, PDF o lo que sea · hasta 5 GB cada uno</span>
          <input
            ref={input}
            type="file"
            multiple
            className="hidden"
            onChange={(e) => {
              if (e.target.files) void subir(e.target.files);
              e.target.value = "";
            }}
          />
        </div>
      ) : null}

      {subidas.length > 0 ? (
        <ul className="space-y-1.5">
          {subidas.map((s, i) => (
            <li key={i} className="text-xs">
              <div className="flex justify-between gap-2">
                <span className="truncate">{s.nombre}</span>
                <span className={s.error ? "text-[var(--fo-danger)]" : "tabular-nums text-[var(--fo-muted)]"}>{s.error ?? `${s.progreso}%`}</span>
              </div>
              {!s.error ? (
                <div className="mt-1 h-1 overflow-hidden rounded-full bg-[var(--fo-border)]">
                  <div className="h-full bg-[var(--fo-accent)] transition-all" style={{ width: `${s.progreso}%` }} />
                </div>
              ) : null}
            </li>
          ))}
        </ul>
      ) : null}

      {archivos.length > 0 ? (
        <ul className="max-h-64 divide-y divide-[var(--fo-border)] overflow-y-auto">
          {archivos.map((a) => (
            <li key={a.id} className="flex items-center gap-2 py-1.5 text-sm">
              <span className="text-[var(--fo-muted)]">
                <Icono tipo={a.tipo} />
              </span>
              <span className="min-w-0 flex-1 truncate">{a.nombre}</span>
              <span className="shrink-0 text-xs tabular-nums text-[var(--fo-muted)]">{tamanoLegible(a.bytes)}</span>
              {puedeEditar ? (
                <button
                  type="button"
                  onClick={() => void borrar(a)}
                  className="flex size-7 items-center justify-center rounded-full text-[var(--fo-muted)] hover:bg-[var(--fo-surface-hover)] hover:text-[var(--fo-danger)]"
                  aria-label={`Borrar ${a.nombre}`}
                >
                  <Trash2 className="size-3.5" aria-hidden />
                </button>
              ) : null}
            </li>
          ))}
        </ul>
      ) : null}

      {puedeEditar && archivos.length > 0 ? (
        <div className="grid grid-cols-2 gap-2">
          <button type="button" onClick={() => void copiar("LABORATORIO")} className="fo-btn fo-btn-secondary gap-1.5 text-xs">
            <Copy className="size-3.5" aria-hidden />
            Enlace laboratorio
          </button>
          <button type="button" onClick={() => void copiar("CLIENTE")} className="fo-btn fo-btn-secondary gap-1.5 text-xs">
            <Copy className="size-3.5" aria-hidden />
            Enlace cliente
          </button>
        </div>
      ) : null}
      {vence ? (
        <p className="text-xs text-[var(--fo-muted)]">
          Se borra sola el {new Date(vence).toLocaleDateString("es-AR", { timeZone: "America/Argentina/Buenos_Aires" })} (30 días desde que se subió el primer archivo; compartir los enlaces lo extiende).
        </p>
      ) : null}
      {aviso ? (
        <p className={`break-all text-xs ${aviso.ok ? "text-[var(--fo-success)]" : "text-[var(--fo-danger)]"}`} role="status">
          {aviso.texto}
        </p>
      ) : null}
    </section>
  );
}
