"use client";

import { useRouter } from "next/navigation";
import { useEffect, useId, useState, useTransition } from "react";
import { buscarProyectosGaleriaAction, crearGaleriaAction } from "@/app/actions/galerias";
import type { ProyectoEncontrado } from "@/lib/galerias/galerias";

const ERROR_CONEXION = "No pudimos conectar con el servidor. Probá de nuevo.";

/**
 * "Nueva galería" desde el listado: se elige el proyecto (buscando por número, nombre o cliente) y la galería
 * nace en borrador con los valores por omisión de Configuración → Galería.
 */
export function NuevaGaleria() {
  const router = useRouter();
  const id = useId();
  const [abierto, setAbierto] = useState(false);
  const [texto, setTexto] = useState("");
  const [resultados, setResultados] = useState<ProyectoEncontrado[]>([]);
  const [elegido, setElegido] = useState<ProyectoEncontrado | null>(null);
  const [nombre, setNombre] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [buscando, setBuscando] = useState(false);
  const [pendiente, iniciar] = useTransition();
  const t = texto.trim();

  useEffect(() => {
    if (!abierto || elegido || t.length < 2) return;
    let vigente = true;
    const espera = setTimeout(async () => {
      setBuscando(true);
      const r = await buscarProyectosGaleriaAction(t).catch(() => ({ ok: false as const, error: ERROR_CONEXION }));
      if (!vigente) return;
      setBuscando(false);
      if (!r.ok) {
        setError(r.error);
        setResultados([]);
      } else {
        setError(null);
        setResultados(r.proyectos);
      }
    }, 250);
    return () => {
      vigente = false;
      clearTimeout(espera);
    };
  }, [abierto, elegido, t]);

  function crear() {
    if (!elegido) return;
    setError(null);
    iniciar(async () => {
      const r = await crearGaleriaAction({ proyectoId: elegido.id, nombre }).catch(() => ({ ok: false as const, error: ERROR_CONEXION }));
      if (!r.ok) return setError(r.error);
      router.push(`/galerias/${encodeURIComponent(r.id)}`);
    });
  }

  if (!abierto) {
    return (
      <div>
        <button type="button" className="fo-btn fo-btn-primary text-sm" onClick={() => setAbierto(true)}>
          Nueva galería
        </button>
      </div>
    );
  }

  return (
    <section aria-labelledby={`${id}-titulo`} className="fo-card space-y-3 p-4">
      <h2 id={`${id}-titulo`} className="text-sm font-semibold uppercase tracking-wide text-[var(--fo-muted-soft)]">
        Nueva galería
      </h2>
      {elegido ? (
        <div className="space-y-3">
          <div className="flex items-center justify-between gap-2 rounded-lg bg-[var(--fo-surface-muted)] px-3 py-2 text-sm">
            <span className="min-w-0">
              <span className="font-medium">Proyecto N° {elegido.numero} · {elegido.nombre}</span>
              <span className="ml-1 text-xs text-[var(--fo-muted)]">{elegido.contacto}</span>
            </span>
            <button type="button" className="fo-btn fo-btn-secondary text-xs" disabled={pendiente} onClick={() => { setElegido(null); setNombre(""); }}>
              Cambiar
            </button>
          </div>
          <div className="fo-field-stack">
            <label className="fo-label" htmlFor={`${id}-nombre`}>Nombre de la galería</label>
            <input id={`${id}-nombre`} className="fo-input" maxLength={120} placeholder={elegido.nombre} value={nombre} onChange={(e) => setNombre(e.target.value)} disabled={pendiente} />
            <p className="text-xs text-[var(--fo-muted)]">Si lo dejás vacío, usa el nombre del proyecto.</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <button type="button" className="fo-btn fo-btn-primary text-sm" disabled={pendiente} onClick={crear}>
              {pendiente ? "Creando…" : "Crear galería"}
            </button>
            <button type="button" className="fo-btn fo-btn-secondary text-sm" disabled={pendiente} onClick={() => setAbierto(false)}>
              Cancelar
            </button>
          </div>
        </div>
      ) : (
        <div className="space-y-2">
          <div className="fo-field-stack">
            <label className="fo-label" htmlFor={`${id}-buscar`}>Proyecto</label>
            <input id={`${id}-buscar`} className="fo-input" maxLength={100} autoComplete="off" placeholder="Buscá por número, nombre o cliente" value={texto} onChange={(e) => setTexto(e.target.value)} />
          </div>
          {t.length >= 2 ? (
            resultados.length > 0 ? (
              <ul className="max-h-60 divide-y divide-[var(--fo-border)] overflow-y-auto rounded-lg border border-[var(--fo-border)]" aria-label="Proyectos encontrados">
                {resultados.map((p) => (
                  <li key={p.id}>
                    <button type="button" className="w-full px-3 py-2 text-left text-sm hover:bg-[var(--fo-surface-muted)]" onClick={() => setElegido(p)}>
                      <span className="font-medium">N° {p.numero} · {p.nombre}</span>
                      <span className="ml-1 text-xs text-[var(--fo-muted)]">{p.contacto}</span>
                    </button>
                  </li>
                ))}
              </ul>
            ) : buscando ? (
              <p className="text-xs text-[var(--fo-muted)]">Buscando…</p>
            ) : (
              <p className="text-xs text-[var(--fo-muted)]">No encontramos proyectos con ese texto.</p>
            )
          ) : (
            <p className="text-xs text-[var(--fo-muted)]">Escribí al menos 2 letras.</p>
          )}
          <button type="button" className="fo-btn fo-btn-secondary text-sm" onClick={() => setAbierto(false)}>
            Cancelar
          </button>
        </div>
      )}
      <div aria-live="polite">
        {error ? (
          <p role="alert" className="text-sm text-[var(--fo-danger)]">
            {error}
          </p>
        ) : null}
      </div>
    </section>
  );
}
