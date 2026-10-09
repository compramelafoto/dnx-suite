"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { CALL_TEXT_LIMITS } from "@repo/muestras";
import { botonFino, botonLleno, campo } from "@/components/convocatorias/estilos";
import { subirImagen } from "@/components/formulario/subir-imagen";
import { guardarEnvio, retirarEnvio } from "@/lib/envios/acciones";

type Obra = { imageUrl: string; title: string; year: number | null; technique: string; statement: string };

export function FormularioEnvio({ callId, maxObras, bases, derechos, retirable, inicial }: {
  callId: string; maxObras: number; bases: string; derechos: string; retirable: boolean;
  inicial: { authorName: string; works: Obra[] };
}) {
  const router = useRouter();
  const [pendiente, start] = useTransition();
  const [obras, setObras] = useState<Obra[]>(inicial.works);
  const [subiendo, setSubiendo] = useState(false);
  const [errores, setErrores] = useState<string[]>([]);
  const [listo, setListo] = useState<string | null>(null);
  const cambiar = (i: number, p: Partial<Obra>) => setObras((xs) => xs.map((o, j) => (j === i ? { ...o, ...p } : o)));

  async function agregar(files: FileList | null) {
    if (!files?.length) return;
    setSubiendo(true);
    setErrores([]);
    try {
      for (const f of Array.from(files).slice(0, maxObras - obras.length)) {
        const url = await subirImagen(f, "obra");
        setObras((xs) => [...xs, { imageUrl: url, title: "", year: null, technique: "", statement: "" }]);
      }
    } catch (e) {
      setErrores([e instanceof Error ? e.message : "No pudimos subir la imagen."]);
    } finally {
      setSubiendo(false);
    }
  }

  return (
    <form
      className="space-y-8"
      onSubmit={(e) => {
        e.preventDefault();
        const fd = new FormData(e.currentTarget);
        fd.set("callId", callId);
        fd.set("works", JSON.stringify(obras));
        setListo(null);
        start(async () => {
          const r = await guardarEnvio(fd);
          if (!r.ok) return setErrores(r.errores);
          setErrores([]);
          setListo("¡Listo! Recibimos tu envío. Te mandamos un mail de confirmación.");
          router.refresh();
        });
      }}
    >
      <ol className="space-y-6 border-t border-[var(--mf-line)] pt-6">
        {obras.map((o, i) => (
          <li key={o.imageUrl} className="grid gap-4 border-b border-[var(--mf-line)] pb-6 sm:grid-cols-[10rem_minmax(0,1fr)]">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={o.imageUrl} alt="" className="aspect-square w-40 bg-[var(--mf-surface)] object-contain" />
            <div className="space-y-3">
              <label className="block space-y-1"><span>Título</span><input required value={o.title} maxLength={CALL_TEXT_LIMITS.workTitle} onChange={(e) => cambiar(i, { title: e.target.value })} className={campo} /></label>
              <div className="grid gap-3 sm:grid-cols-2">
                <label className="block space-y-1"><span>Año</span><input type="number" min={1826} value={o.year ?? ""} onChange={(e) => cambiar(i, { year: e.target.value === "" ? null : Number(e.target.value) })} className={campo} /></label>
                <label className="block space-y-1"><span>Técnica</span><input value={o.technique} maxLength={CALL_TEXT_LIMITS.technique} onChange={(e) => cambiar(i, { technique: e.target.value })} placeholder="Digital, analógica, copia en gelatina…" className={campo} /></label>
              </div>
              <label className="block space-y-1">
                <span>Texto breve sobre la obra (optativo)</span>
                <textarea rows={3} value={o.statement} maxLength={CALL_TEXT_LIMITS.statement} onChange={(e) => cambiar(i, { statement: e.target.value })} className={campo} />
                <span className="block text-sm text-[var(--mf-muted)]">Lo lee el equipo curatorial. Sin tu nombre.</span>
              </label>
              <button type="button" className="text-sm underline" onClick={() => setObras((xs) => xs.filter((_, j) => j !== i))}>Quitar esta obra</button>
            </div>
          </li>
        ))}
      </ol>
      {obras.length < maxObras ? (
        <label className={`${botonFino} cursor-pointer`}>
          {subiendo ? "Subiendo…" : obras.length ? "Agregar otra obra" : "Elegir las fotos"}
          <input type="file" accept="image/*" multiple className="sr-only" disabled={subiendo} onChange={(e) => agregar(e.target.files)} />
        </label>
      ) : <p className="text-[15px] text-[var(--mf-muted)]">Llegaste al tope de {maxObras} {maxObras === 1 ? "obra" : "obras"}.</p>}

      <label className="block space-y-1">
        <span>Tu nombre como querés que figure si una obra queda seleccionada</span>
        <input name="authorName" required defaultValue={inicial.authorName} maxLength={CALL_TEXT_LIMITS.authorName} className={campo} />
        <span className="block text-sm text-[var(--mf-muted)]">El equipo curatorial no lo ve.</span>
      </label>

      <div className="space-y-4">
        <details className="text-[15px]"><summary className="cursor-pointer underline underline-offset-4">Leer las bases</summary><div className="mt-2 whitespace-pre-line">{bases}</div></details>
        <label className="flex gap-3"><input type="checkbox" name="basesAccepted" required className="mt-1" /><span>Leí y acepto las bases.</span></label>
        <div className="whitespace-pre-line border-l-2 border-[var(--mf-line)] pl-4 text-[15px] text-[var(--mf-muted)]">{derechos}</div>
        <label className="flex gap-3"><input type="checkbox" name="rightsAccepted" required className="mt-1" /><span>Acepto la autorización de derechos.</span></label>
      </div>

      {errores.length ? <ul className="space-y-1 text-[var(--mf-alerta)]">{errores.map((e) => <li key={e}>{e}</li>)}</ul> : null}
      {listo ? <p className="text-[var(--mf-teal)]">{listo}</p> : null}
      <div className="flex flex-wrap gap-3">
        <button type="submit" disabled={pendiente || subiendo || obras.length === 0} className={botonLleno}>{pendiente ? "Enviando…" : retirable ? "Guardar los cambios" : "Enviar"}</button>
        {retirable ? (
          <button
            type="button"
            disabled={pendiente}
            className={botonFino}
            onClick={() => {
              if (!window.confirm("¿Retirar tu envío? Podés volver a enviar mientras la convocatoria esté abierta.")) return;
              start(async () => {
                const r = await retirarEnvio(callId);
                if (!r.ok) return setErrores(r.errores);
                setObras([]);
                setListo("Retiraste tu envío.");
                router.refresh();
              });
            }}
          >
            Retirar mi envío
          </button>
        ) : null}
      </div>
    </form>
  );
}
