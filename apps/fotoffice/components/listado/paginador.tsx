import Link from "next/link";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { FILAS_PERMITIDAS, type FilasPorPagina } from "@/lib/listado/tipos";
import { numero } from "./util";

/** "Mostrando 51 a 100 de 1.240 socios", anterior/siguiente y cuántas filas por página. */
export function Paginador({
  pagina,
  paginas,
  desde,
  hasta,
  total,
  sustantivo,
  filas,
  hrefPagina,
  hrefFilas,
}: {
  pagina: number;
  paginas: number;
  desde: number;
  hasta: number;
  total: number;
  sustantivo: { singular: string; plural: string };
  filas: FilasPorPagina;
  hrefPagina: (n: number) => string;
  hrefFilas: (n: FilasPorPagina) => string;
}) {
  if (total === 0) return null;
  const flecha = "fo-icon-btn border border-[var(--fo-border)]";
  const apagada = `${flecha} pointer-events-none opacity-40`;
  return (
    <nav aria-label="Paginación" className="flex flex-col gap-3 text-sm text-[var(--fo-muted)] sm:flex-row sm:items-center sm:justify-between">
      <p>
        Mostrando {numero(desde)} a {numero(hasta)} de {numero(total)} {total === 1 ? sustantivo.singular : sustantivo.plural}
      </p>
      <div className="flex flex-wrap items-center gap-4">
        <div className="flex items-center gap-1" aria-label="Filas por página" role="group">
          <span className="mr-1">Filas:</span>
          {FILAS_PERMITIDAS.map((n) =>
            n === filas ? (
              <span key={n} aria-current="true" className="rounded px-2 py-1 font-semibold text-[var(--fo-text)] bg-[var(--fo-surface-muted)]">
                {n}
              </span>
            ) : (
              <Link key={n} href={hrefFilas(n)} scroll={false} className="rounded px-2 py-1 hover:bg-[var(--fo-surface-hover)] hover:text-[var(--fo-text)]">
                {n}
              </Link>
            ),
          )}
        </div>
        <div className="flex items-center gap-2">
          {pagina > 1 ? (
            <Link href={hrefPagina(pagina - 1)} scroll={false} className={flecha} aria-label="Página anterior">
              <ChevronLeft className="size-4" />
            </Link>
          ) : (
            <span className={apagada} aria-hidden>
              <ChevronLeft className="size-4" />
            </span>
          )}
          <span aria-current="page">
            Página {numero(pagina)} de {numero(paginas)}
          </span>
          {pagina < paginas ? (
            <Link href={hrefPagina(pagina + 1)} scroll={false} className={flecha} aria-label="Página siguiente">
              <ChevronRight className="size-4" />
            </Link>
          ) : (
            <span className={apagada} aria-hidden>
              <ChevronRight className="size-4" />
            </span>
          )}
        </div>
      </div>
    </nav>
  );
}
