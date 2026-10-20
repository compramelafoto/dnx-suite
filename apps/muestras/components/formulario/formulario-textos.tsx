"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { guardarTextos } from "@/lib/actividades/textos";

const campo = "w-full rounded-[2px] border border-[var(--mf-line)] bg-white px-3 py-2";
const MAX_CURATORIAL = 6000;

export type ObraDeTextos = { id: string; imageUrl: string; title: string; authorName: string; year: number | null; technique: string | null };

/**
 * Formulario del rol "Textos y curaduría" (etapa 5, D9): texto curatorial, créditos y título, año
 * y técnica de cada obra. No hay imagen, autor, orden ni destacadas para editar: la miniatura y el
 * autor están sólo para reconocer cada obra.
 */
export function FormularioTextos({ inicial }: {
  inicial: { id: string; editVersion: number; curatorialText: string | null; curatorCredits: string | null; obras: ObraDeTextos[] };
}) {
  const router = useRouter();
  const [pendiente, start] = useTransition();
  const [errores, setErrores] = useState<string[]>([]);
  const [guardado, setGuardado] = useState(false);
  const [curatorial, setCuratorial] = useState(inicial.curatorialText ?? "");
  const [obras, setObras] = useState(inicial.obras.map((o) => ({ id: o.id, title: o.title, year: o.year == null ? "" : String(o.year), technique: o.technique ?? "" })));

  const cambiar = (i: number, k: "title" | "year" | "technique", v: string) =>
    setObras((prev) => prev.map((o, j) => (j === i ? { ...o, [k]: v } : o)));

  return (
    <form
      className="space-y-6"
      onSubmit={(e) => {
        e.preventDefault();
        const fd = new FormData(e.currentTarget);
        fd.set("id", inicial.id);
        fd.set("editVersion", String(inicial.editVersion));
        fd.set("obras", JSON.stringify(obras.map((o) => ({ id: o.id, title: o.title, year: o.year.trim(), technique: o.technique }))));
        setGuardado(false);
        start(async () => {
          const r = await guardarTextos(fd);
          if (!r.ok) return setErrores(r.errores);
          setErrores([]);
          setGuardado(true);
          router.refresh();
        });
      }}
    >
      <fieldset className="space-y-4">
        <legend className="text-lg">Curaduría</legend>
        <label className="block">
          Texto curatorial
          <textarea name="curatorialText" rows={10} maxLength={MAX_CURATORIAL} className={campo} value={curatorial} onChange={(e) => setCuratorial(e.target.value)} />
          <span className="text-sm text-[var(--mf-muted)]">{curatorial.length} de {MAX_CURATORIAL} caracteres</span>
        </label>
        <label className="block">
          Créditos
          <input name="curatorCredits" maxLength={300} className={campo} defaultValue={inicial.curatorCredits ?? ""} placeholder="Curaduría: Ana Pérez" />
        </label>
      </fieldset>

      {inicial.obras.length ? (
        <fieldset className="space-y-3">
          <legend className="text-lg">Textos de cada obra</legend>
          <ul className="border-t border-[var(--mf-line)]">
            {inicial.obras.map((o, i) => (
              <li key={o.id} className="grid gap-3 border-b border-[var(--mf-line)] py-4 sm:grid-cols-[5rem_minmax(0,1fr)]">
                {/* eslint-disable-next-line @next/next/no-img-element -- miniatura sólo para reconocer la obra */}
                <img src={o.imageUrl} alt="" className="h-20 w-20 bg-[var(--mf-surface)] object-contain" loading="lazy" />
                <div className="grid gap-2 sm:grid-cols-[minmax(0,2fr)_6rem_minmax(0,1.5fr)]">
                  <p className="text-sm text-[var(--mf-muted)] sm:col-span-3">De {o.authorName || "autor sin nombre"}</p>
                  <label className="text-sm">Título<input required maxLength={200} className={campo} value={obras[i]!.title} onChange={(e) => cambiar(i, "title", e.target.value)} /></label>
                  <label className="text-sm">Año<input inputMode="numeric" pattern="\d{4}" maxLength={4} className={campo} value={obras[i]!.year} onChange={(e) => cambiar(i, "year", e.target.value)} /></label>
                  <label className="text-sm">Técnica<input maxLength={200} className={campo} value={obras[i]!.technique} onChange={(e) => cambiar(i, "technique", e.target.value)} /></label>
                </div>
              </li>
            ))}
          </ul>
        </fieldset>
      ) : null}

      {errores.length ? <ul role="alert" className="text-[var(--mf-alerta)]">{errores.map((e) => <li key={e}>{e}</li>)}</ul> : null}
      {guardado ? <p role="status" className="text-[var(--mf-teal)]">Guardado.</p> : null}
      <button type="submit" disabled={pendiente} className="h-11 rounded-[2px] border border-[var(--mf-ink)] px-5 disabled:opacity-50">
        {pendiente ? "Guardando…" : "Guardar textos"}
      </button>
    </form>
  );
}
