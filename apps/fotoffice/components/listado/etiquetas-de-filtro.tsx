import Link from "next/link";
import { X } from "lucide-react";
import { escribirConsulta } from "@/lib/listado/consulta";
import { etiquetasDeFiltro } from "@/lib/listado/etiquetas";
import type { ConsultaResuelta, DefinicionListado } from "@/lib/listado/tipos";
import { hrefListado } from "./util";

/** Un chip por filtro aplicado; la cruz lo quita. "Limpiar todo" vuelve a la lista sin filtros. */
export function EtiquetasDeFiltro<F>({ def, consulta, ruta }: { def: DefinicionListado<F>; consulta: ConsultaResuelta; ruta: string }) {
  const chips = etiquetasDeFiltro(def, consulta);
  if (chips.length === 0 && !consulta.q) return null;
  return (
    <ul className="flex flex-wrap items-center gap-2" aria-label="Filtros aplicados">
      {chips.map((c) => (
        <li key={c.clave}>
          <Link
            href={hrefListado(ruta, escribirConsulta(def, consulta, { filtros: { [c.clave]: null }, ver: null }))}
            scroll={false}
            aria-label={`Quitar filtro ${c.texto}`}
            className="inline-flex items-center gap-1.5 rounded-full border border-[var(--fo-accent-muted)] bg-[var(--fo-accent-soft)] py-1 pl-3 pr-2 text-sm text-[var(--fo-text)] hover:border-[var(--fo-accent)]"
          >
            {c.texto}
            <X className="size-3.5 text-[var(--fo-muted)]" aria-hidden />
          </Link>
        </li>
      ))}
      <li>
        <Link href={`${ruta}?limpio=1`} scroll={false} className="text-sm font-medium text-[var(--fo-accent)] underline-offset-2 hover:underline">
          Limpiar todo
        </Link>
      </li>
    </ul>
  );
}
