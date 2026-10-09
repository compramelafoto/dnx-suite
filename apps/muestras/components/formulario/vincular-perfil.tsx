"use client";

import { useEffect, useState } from "react";
import { buscarPerfiles, type PerfilEncontrado } from "@/lib/perfiles/acciones";

/**
 * Vincular el autor de una obra a un perfil existente, buscándolo por nombre. Si no aparece,
 * la obra queda con el nombre en texto libre, como siempre.
 */
export function VincularPerfil({ nombre, onVincular }: {
  nombre: string | null;
  onVincular: (p: { id: string; displayName: string } | null) => void;
}) {
  const [abierto, setAbierto] = useState(false);
  const [q, setQ] = useState("");
  const [resultados, setResultados] = useState<PerfilEncontrado[] | null>(null);

  useEffect(() => {
    if (!abierto || q.trim().length < 2) return;
    let vigente = true;
    const t = setTimeout(() => {
      buscarPerfiles(q).then((r) => { if (vigente) setResultados(r); }).catch(() => { if (vigente) setResultados([]); });
    }, 300);
    return () => { vigente = false; clearTimeout(t); };
  }, [q, abierto]);

  if (nombre) {
    return (
      <p className="text-xs text-[var(--mf-muted)]">
        Perfil: <strong className="font-medium text-[var(--mf-ink)]">{nombre}</strong>{" "}
        <button type="button" className="underline" onClick={() => onVincular(null)}>Desvincular</button>
      </p>
    );
  }
  if (!abierto) {
    return <button type="button" className="text-xs text-[var(--mf-muted)] underline" onClick={() => setAbierto(true)}>Vincular a un perfil</button>;
  }
  const buscando = q.trim().length >= 2;
  return (
    <div className="space-y-1 text-xs">
      <input autoFocus value={q} onChange={(e) => { setQ(e.target.value); setResultados(null); }} placeholder="Buscar fotógrafo por nombre" className="w-full border-b" />
      {buscando && resultados === null ? <p className="text-[var(--mf-muted)]">Buscando…</p> : null}
      {buscando && resultados?.length === 0 ? <p className="text-[var(--mf-muted)]">Sin resultados. Queda con el nombre como texto.</p> : null}
      {buscando && resultados?.length ? (
        <ul className="space-y-0.5">
          {resultados.map((p) => (
            <li key={p.id}>
              <button type="button" className="underline" onClick={() => { onVincular({ id: p.id, displayName: p.displayName }); setAbierto(false); setQ(""); }}>
                {p.displayName}{p.city ? `, ${p.city}` : ""}
              </button>
            </li>
          ))}
        </ul>
      ) : null}
      <button type="button" className="underline" onClick={() => { setAbierto(false); setQ(""); }}>Cancelar</button>
    </div>
  );
}
