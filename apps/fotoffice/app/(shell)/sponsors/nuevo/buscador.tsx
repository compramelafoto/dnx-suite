"use client";

import Link from "next/link";
import { useEffect, useState, useTransition } from "react";
import { SponsorLogo } from "@/components/sponsors/sponsor-logo";
import { buscarEnCatalogoAction } from "../actions-buscar";
import { vincularSponsorAction } from "../actions";

type Opcion = { id: string; name: string; logoSrc: string | null; linked: boolean };

/**
 * Buscador de la base común. Muestra sólo nombre y logo: los datos de contacto de un sponsor
 * que trabaja con otra plataforma no son de esta institución.
 */
export function BuscadorDeSponsors() {
  const [texto, setTexto] = useState("");
  const [resultados, setResultados] = useState<Opcion[] | null>(null);
  const [buscando, empezar] = useTransition();

  useEffect(() => {
    const q = texto.trim();
    if (q.length < 2) return;
    const espera = setTimeout(() => {
      empezar(async () => setResultados(await buscarEnCatalogoAction(q)));
    }, 250);
    return () => clearTimeout(espera);
  }, [texto]);

  // Con menos de dos letras no se busca, y lo que quedó de la búsqueda anterior no se muestra.
  const visibles = texto.trim().length >= 2 ? resultados : null;

  return (
    <div className="space-y-3">
      <input
        type="search"
        value={texto}
        onChange={(e) => setTexto(e.target.value)}
        placeholder="Nombre de la marca"
        aria-label="Buscar sponsor por nombre"
        className="fo-input"
        autoFocus
      />
      {buscando ? <p className="text-sm text-[var(--fo-muted)]">Buscando…</p> : null}
      {visibles && visibles.length === 0 && !buscando ? (
        <p className="text-sm text-[var(--fo-muted)]">No hay ningún sponsor con ese nombre. Crealo abajo.</p>
      ) : null}
      {visibles && visibles.length > 0 ? (
        <ul className="divide-y divide-[var(--fo-border-muted)] rounded-[var(--fo-radius)] border border-[var(--fo-border)]">
          {visibles.map((r) => (
            <li key={r.id} className="flex items-center gap-3 px-3 py-2.5">
              <SponsorLogo name={r.name} src={r.logoSrc} className="size-10" />
              <span className="min-w-0 flex-1 truncate text-sm font-medium">{r.name}</span>
              {r.linked ? (
                <Link href={`/sponsors/${r.id}`} className="fo-btn fo-btn-ghost text-sm">
                  Ya es sponsor · Ver
                </Link>
              ) : (
                <form action={vincularSponsorAction}>
                  <input type="hidden" name="partnerId" value={r.id} />
                  <button type="submit" className="fo-btn fo-btn-secondary text-sm">
                    Vincular
                  </button>
                </form>
              )}
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}
