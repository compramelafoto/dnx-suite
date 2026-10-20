"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { Search } from "lucide-react";

export type GuiaDelIndice = {
  slug: string;
  titulo: string;
  resumen: string;
  pasos: number;
  minutos: number;
  /** Títulos de los pasos: el buscador también los mira. */
  textoBuscable: string;
};

type Grupo = { seccion: string; guias: GuiaDelIndice[] };

const ancla = (seccion: string) =>
  `tema-${seccion
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")}`;

const normalizar = (t: string) =>
  t
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase();

/** Menú de temas, buscador y tarjetas de las guías. La búsqueda es local: son pocas guías. */
export function IndiceInstructivos({ grupos }: { grupos: Grupo[] }) {
  const [busqueda, setBusqueda] = useState("");
  const q = normalizar(busqueda.trim());

  const filtrados = useMemo(() => {
    if (!q) return grupos;
    return grupos
      .map((g) => ({
        ...g,
        guias: g.guias.filter((guia) =>
          normalizar(`${guia.titulo} ${guia.resumen} ${guia.textoBuscable}`).includes(q),
        ),
      }))
      .filter((g) => g.guias.length > 0);
  }, [grupos, q]);

  return (
    <div className="space-y-8">
      <div className="space-y-3 print:hidden">
        <label className="relative block max-w-md">
          <span className="sr-only">Buscar en los instructivos</span>
          <Search
            className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-[var(--fo-muted)]"
            aria-hidden
          />
          <input
            type="search"
            value={busqueda}
            onChange={(e) => setBusqueda(e.target.value)}
            placeholder="¿Qué necesitás hacer? Ej.: cerrar la caja, seña, laboratorio"
            className="fo-input w-full pl-9"
          />
        </label>
        {!q ? (
          <nav aria-label="Temas" className="flex flex-wrap gap-2">
            {grupos.map((g) => (
              <a
                key={g.seccion}
                href={`#${ancla(g.seccion)}`}
                className="rounded-full border border-[var(--fo-border)] px-3 py-1 text-xs text-[var(--fo-text)] hover:border-[var(--fo-accent)]"
              >
                {g.seccion} <span className="text-[var(--fo-muted)]">· {g.guias.length}</span>
              </a>
            ))}
          </nav>
        ) : null}
      </div>

      {filtrados.length === 0 ? (
        <p className="text-sm text-[var(--fo-muted)]">
          Ninguna guía habla de «{busqueda.trim()}». Probá con otra palabra.
        </p>
      ) : null}

      {filtrados.map(({ seccion, guias }) => (
        <section key={seccion} id={ancla(seccion)} className="scroll-mt-6 space-y-3">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-[var(--fo-muted)]">{seccion}</h2>
          <ol className="grid gap-3 sm:grid-cols-2">
            {guias.map((g) => (
              <li key={g.slug}>
                <Link
                  href={`/instructivos/${g.slug}`}
                  className="fo-card block h-full p-4 transition-colors hover:border-[var(--fo-accent)]"
                >
                  <p className="text-sm font-medium text-[var(--fo-text)]">{g.titulo}</p>
                  <p className="mt-1 text-xs leading-relaxed text-[var(--fo-muted)]">{g.resumen}</p>
                  <p className="mt-2 text-[11px] text-[var(--fo-muted-soft)]">
                    {g.pasos} pasos · {g.minutos} min
                  </p>
                </Link>
              </li>
            ))}
          </ol>
        </section>
      ))}
    </div>
  );
}
