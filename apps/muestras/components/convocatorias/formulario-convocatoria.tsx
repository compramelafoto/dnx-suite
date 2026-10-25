"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { MAX_WORKS_PER_PERSON_LIMIT, editableCallFields } from "@repo/muestras";
import { guardarConvocatoria } from "@/lib/convocatorias/acciones";
import { botonLleno, campo } from "./estilos";

export type ConvocatoriaInicial = {
  id: string; status: string; title: string; basesText: string; requirementsText: string; rightsText: string;
  opensDay: string; closesDay: string; maxWorksPerPerson: number;
};

/** Los campos que el estado no deja cambiar se ven, pero deshabilitados (el servidor igual los ignora). */
export function FormularioConvocatoria({ inicial }: { inicial: ConvocatoriaInicial }) {
  const router = useRouter();
  const [pendiente, start] = useTransition();
  const [errores, setErrores] = useState<string[]>([]);
  const [guardado, setGuardado] = useState(false);
  const editables = new Set<string>(editableCallFields(inicial.status));
  const no = (k: string) => !editables.has(k);
  if (editables.size === 0) return null;

  return (
    <form
      className="space-y-5"
      onSubmit={(e) => {
        e.preventDefault();
        const fd = new FormData(e.currentTarget);
        fd.set("id", inicial.id);
        setGuardado(false);
        start(async () => {
          const r = await guardarConvocatoria(fd);
          if (!r.ok) return setErrores(r.errores);
          setErrores([]);
          setGuardado(true);
          router.refresh();
        });
      }}
    >
      <label className="block space-y-1">
        <span>Título de la convocatoria</span>
        <input name="title" defaultValue={inicial.title} disabled={no("title")} className={campo} />
      </label>
      <label className="block space-y-1">
        <span>Bases</span>
        <span className="block text-sm text-[var(--mf-muted)]">Tema, quién puede participar, cómo se elige y qué pasa con las obras elegidas.</span>
        <textarea name="basesText" rows={10} defaultValue={inicial.basesText} disabled={no("basesText")} className={campo} />
      </label>
      <label className="block space-y-1">
        <span>Requisitos de las imágenes</span>
        <textarea name="requirementsText" rows={3} defaultValue={inicial.requirementsText} disabled={no("requirementsText")} className={campo} />
      </label>
      <label className="block space-y-1">
        <span>Autorización de derechos que acepta cada participante</span>
        <textarea name="rightsText" rows={5} defaultValue={inicial.rightsText} disabled={no("rightsText")} className={campo} />
      </label>
      <div className="grid gap-4 sm:grid-cols-3">
        <label className="block space-y-1">
          <span>Recibe obras desde</span>
          <input type="date" name="opensDay" defaultValue={inicial.opensDay} disabled={no("opensDay")} className={campo} />
        </label>
        <label className="block space-y-1">
          <span>Hasta (inclusive)</span>
          <input type="date" name="closesDay" defaultValue={inicial.closesDay} disabled={no("closesDay")} min={inicial.status === "OPEN" ? inicial.closesDay : undefined} className={campo} />
        </label>
        <label className="block space-y-1">
          <span>Obras por persona</span>
          <input type="number" name="maxWorksPerPerson" min={1} max={MAX_WORKS_PER_PERSON_LIMIT} defaultValue={inicial.maxWorksPerPerson} disabled={no("maxWorksPerPerson")} className={campo} />
        </label>
      </div>
      <p className="text-sm text-[var(--mf-muted)]">Fechas en hora argentina. {inicial.status === "OPEN" ? "Con la convocatoria abierta, el cierre sólo se puede estirar." : ""}</p>
      {errores.length ? <ul className="space-y-1 text-[var(--mf-alerta)]">{errores.map((e) => <li key={e}>{e}</li>)}</ul> : null}
      {guardado ? <p className="text-[var(--mf-teal)]">Guardado.</p> : null}
      <button type="submit" disabled={pendiente} className={botonLleno}>{pendiente ? "Guardando…" : "Guardar"}</button>
    </form>
  );
}
