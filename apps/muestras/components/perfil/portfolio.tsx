"use client";

import { useRouter } from "next/navigation";
import { useRef, useState, useTransition } from "react";
import { PORTFOLIO_MAX_PHOTOS, PORTFOLIO_TEXT_LIMITS } from "@repo/muestras";
import { subirImagen } from "@/components/formulario/subir-imagen";
import { borrarFotoDePortfolio, guardarFotoDePortfolio, ordenarPortfolio } from "@/lib/portfolio/acciones";
import { botonChico, botonFino, botonLleno, campo, nota } from "./estilos";

export type FotoPropia = { id: string; imageUrl: string; title: string; year: number | null; technique: string | null; caption: string | null };
type Borrador = { id: string | null; imageUrl: string | null; title: string; year: string; technique: string; caption: string };

const vacio: Borrador = { id: null, imageUrl: null, title: "", year: "", technique: "", caption: "" };
const aBorrador = (f: FotoPropia): Borrador => ({ id: f.id, imageUrl: f.imageUrl, title: f.title, year: f.year ? String(f.year) : "", technique: f.technique ?? "", caption: f.caption ?? "" });

/**
 * El portfolio del artista (spec D13–D15): fotos que no se exponen, con sus datos. Sumar, corregir,
 * borrar y mover. Cada cambio lo valida el servidor (imagen propia, que no sea una obra expuesta,
 * tope de 60).
 */
export function Portfolio({ fotos }: { fotos: FotoPropia[] }) {
  const router = useRouter();
  const [pendiente, empezar] = useTransition();
  const [editando, setEditando] = useState<Borrador | null>(null);
  const [subiendo, setSubiendo] = useState(false);
  const [errores, setErrores] = useState<string[]>([]);
  const archivo = useRef<HTMLInputElement>(null);
  const lleno = fotos.length >= PORTFOLIO_MAX_PHOTOS;

  const correr = (f: () => Promise<{ ok: boolean; errores?: string[] }>, alTerminar?: () => void) =>
    empezar(async () => {
      const r = await f();
      if (!r.ok) setErrores(r.errores ?? ["No pudimos guardar. Probá de nuevo."]);
      else {
        setErrores([]);
        alTerminar?.();
        router.refresh();
      }
    });

  async function elegirFoto(files: FileList | null) {
    const f = files?.[0];
    if (!f || !editando) return;
    setSubiendo(true);
    try {
      const url = await subirImagen(f, "obra");
      setEditando((b) => (b ? { ...b, imageUrl: url, title: b.title || f.name.replace(/\.[^.]+$/, "").slice(0, PORTFOLIO_TEXT_LIMITS.title) } : b));
    } catch (e) {
      setErrores([e instanceof Error ? e.message : "No pudimos subir la imagen."]);
    } finally {
      setSubiendo(false);
    }
  }

  const guardar = () => {
    if (!editando) return;
    const fd = new FormData();
    if (editando.id) fd.set("id", editando.id);
    fd.set("imageUrl", editando.imageUrl ?? "");
    fd.set("title", editando.title);
    fd.set("year", editando.year);
    fd.set("technique", editando.technique);
    fd.set("caption", editando.caption);
    correr(() => guardarFotoDePortfolio(fd), () => setEditando(null));
  };
  const mover = (i: number, d: -1 | 1) => {
    const j = i + d;
    if (j < 0 || j >= fotos.length) return;
    const ids = fotos.map((f) => f.id);
    [ids[i], ids[j]] = [ids[j]!, ids[i]!];
    correr(() => ordenarPortfolio(ids));
  };

  return (
    <section id="portfolio" aria-labelledby="t-portfolio" className="space-y-4 border-t border-[var(--mf-line)] pt-6">
      <h2 id="t-portfolio" className="text-lg">Portfolio</h2>
      <p className="text-[15px] leading-relaxed">
        Fotos tuyas que no se exponen: el público las ve en tu perfil y, si la organización lo elige, en las muestras donde expongas.
        No subas acá las obras que vas a colgar: son la sorpresa de la sala.
      </p>
      <p className={nota}>{fotos.length} de {PORTFOLIO_MAX_PHOTOS}</p>

      {fotos.length ? (
        <ul className="grid gap-3 sm:grid-cols-2">
          {fotos.map((f, i) => (
            <li key={f.id} className="flex gap-3 rounded-[2px] border border-[var(--mf-line)] bg-white p-2">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={f.imageUrl} alt="" className="size-24 shrink-0 bg-[var(--mf-surface)] object-cover" />
              <div className="min-w-0 flex-1 space-y-1">
                <p className="truncate font-medium">{f.title}</p>
                <p className={nota}>{[f.year, f.technique].filter(Boolean).join(". ")}</p>
                {f.caption ? <p className="line-clamp-2 text-sm">{f.caption}</p> : null}
                <p className="flex flex-wrap gap-2 pt-1">
                  <button type="button" className={botonChico} disabled={pendiente || i === 0} onClick={() => mover(i, -1)} aria-label={`Subir ${f.title}`}>↑</button>
                  <button type="button" className={botonChico} disabled={pendiente || i === fotos.length - 1} onClick={() => mover(i, 1)} aria-label={`Bajar ${f.title}`}>↓</button>
                  <button type="button" className={botonChico} disabled={pendiente} onClick={() => setEditando(aBorrador(f))}>Editar</button>
                  <button
                    type="button" className={botonChico} disabled={pendiente}
                    onClick={() => { if (window.confirm(`¿Borrar "${f.title}" de tu portfolio?`)) correr(() => borrarFotoDePortfolio(f.id)); }}
                  >
                    Borrar
                  </button>
                </p>
              </div>
            </li>
          ))}
        </ul>
      ) : null}

      {editando ? (
        <div className="space-y-3 rounded-[2px] border border-[var(--mf-line)] p-4">
          <p className="font-medium">{editando.id ? "Editar foto" : "Agregar foto"}</p>
          {editando.imageUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={editando.imageUrl} alt="" className="max-h-60 w-auto bg-[var(--mf-surface)]" />
          ) : null}
          <p>
            <input ref={archivo} type="file" accept="image/*" className="sr-only" onChange={(e) => elegirFoto(e.target.files)} />
            <button type="button" className={botonFino} disabled={subiendo} onClick={() => archivo.current?.click()}>
              {subiendo ? "Subiendo…" : editando.imageUrl ? "Cambiar la foto" : "Elegir la foto"}
            </button>
          </p>
          <label className="block space-y-1">
            <span className={nota}>Título</span>
            <input className={campo} value={editando.title} maxLength={PORTFOLIO_TEXT_LIMITS.title} onChange={(e) => setEditando({ ...editando, title: e.target.value })} />
          </label>
          <div className="grid gap-3 sm:grid-cols-[8rem_1fr]">
            <label className="block space-y-1">
              <span className={nota}>Año</span>
              <input className={campo} inputMode="numeric" value={editando.year} maxLength={4} onChange={(e) => setEditando({ ...editando, year: e.target.value.replace(/\D/g, "") })} />
            </label>
            <label className="block space-y-1">
              <span className={nota}>Técnica</span>
              <input className={campo} value={editando.technique} maxLength={PORTFOLIO_TEXT_LIMITS.technique} onChange={(e) => setEditando({ ...editando, technique: e.target.value })} />
            </label>
          </div>
          <label className="block space-y-1">
            <span className={nota}>Texto breve (optativo)</span>
            <textarea className={campo} rows={3} value={editando.caption} maxLength={PORTFOLIO_TEXT_LIMITS.caption} onChange={(e) => setEditando({ ...editando, caption: e.target.value })} />
          </label>
          <p className="flex flex-wrap gap-3">
            <button type="button" className={botonLleno} disabled={pendiente || subiendo || !editando.imageUrl} onClick={guardar}>{pendiente ? "Guardando…" : "Guardar"}</button>
            <button type="button" className={botonFino} disabled={pendiente} onClick={() => { setEditando(null); setErrores([]); }}>Cancelar</button>
          </p>
        </div>
      ) : (
        <p>
          <button type="button" className={botonFino} disabled={lleno || pendiente} onClick={() => setEditando(vacio)}>Agregar foto</button>
          {lleno ? <span className={`ml-3 ${nota}`}>Llegaste al tope de {PORTFOLIO_MAX_PHOTOS} fotos.</span> : null}
        </p>
      )}

      {errores.length ? <ul role="alert" className="text-[var(--mf-alerta)]">{errores.map((e) => <li key={e}>{e}</li>)}</ul> : null}
    </section>
  );
}
