import Link from "next/link";
import { ETIQUETA_CANAL, ETIQUETA_FILTRO, FILTROS_BANDEJA, FILTROS_CANAL, type FiltroBandeja, type FiltroCanal } from "@/lib/bandeja/lecturas";

function enlace(filtro: FiltroBandeja, q: string, canal: FiltroCanal): string {
  const p = new URLSearchParams();
  if (filtro !== "todos") p.set("filtro", filtro);
  if (canal !== "todos") p.set("canal", canal);
  if (q) p.set("q", q);
  const s = p.toString();
  return s ? `/bandeja?${s}` : "/bandeja";
}

/** Filtros (enlaces, funcionan sin JavaScript): canal y estado; y búsqueda por nombre o número (formulario GET). */
export function FiltrosYBusqueda({ filtro, q, canal = "todos" }: { filtro: FiltroBandeja; q: string; canal?: FiltroCanal }) {
  return (
    <div className="space-y-3">
      <nav aria-label="Filtrar por canal" className="flex flex-wrap gap-2">
        {FILTROS_CANAL.map((c) => {
          const activo = c === canal;
          return (
            <Link
              key={c}
              href={enlace(filtro, q, c)}
              aria-current={activo ? "page" : undefined}
              className={`fo-btn text-sm ${activo ? "fo-btn-primary" : "fo-btn-secondary"}`}
            >
              {ETIQUETA_CANAL[c]}
            </Link>
          );
        })}
      </nav>
      <nav aria-label="Filtrar chats" className="flex flex-wrap gap-2">
        {FILTROS_BANDEJA.map((f) => {
          const activo = f === filtro;
          return (
            <Link
              key={f}
              href={enlace(f, q, canal)}
              aria-current={activo ? "page" : undefined}
              className={`fo-btn text-sm ${activo ? "fo-btn-primary" : "fo-btn-secondary"}`}
            >
              {ETIQUETA_FILTRO[f]}
            </Link>
          );
        })}
      </nav>
      <form action="/bandeja" method="get" role="search" className="flex flex-col gap-2 sm:flex-row sm:items-end">
        {filtro !== "todos" ? <input type="hidden" name="filtro" value={filtro} /> : null}
        {canal !== "todos" ? <input type="hidden" name="canal" value={canal} /> : null}
        <div className="min-w-0 flex-1">
          <label htmlFor="bandeja-buscar" className="fo-label">
            Buscar por nombre, número o @usuario
          </label>
          <input id="bandeja-buscar" name="q" type="search" defaultValue={q} maxLength={80} className="fo-input mt-1" autoComplete="off" />
        </div>
        <button type="submit" className="fo-btn fo-btn-secondary text-sm">
          Buscar
        </button>
      </form>
    </div>
  );
}
