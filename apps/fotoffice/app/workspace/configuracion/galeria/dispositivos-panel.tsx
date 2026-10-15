"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { anularDispositivoAction, crearDispositivoAction } from "@/app/actions/dispositivos";
import type { DispositivoVisible } from "@/lib/galerias/dispositivos";

function fecha(iso: string | null): string {
  if (!iso) return "Nunca";
  return new Date(iso).toLocaleString("es-AR", { timeZone: "America/Argentina/Buenos_Aires", dateStyle: "short", timeStyle: "short" });
}

/** Dispositivos: las claves con las que DNX FLUX publica las entregas. La clave completa se ve una sola vez. */
export function DispositivosPanel({ dispositivos }: { dispositivos: DispositivoVisible[] }) {
  const router = useRouter();
  const [pendiente, iniciar] = useTransition();
  const [nombre, setNombre] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [clave, setClave] = useState<string | null>(null);
  const [copiada, setCopiada] = useState(false);

  function conectar(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setClave(null);
    setCopiada(false);
    iniciar(async () => {
      try {
        const r = await crearDispositivoAction(nombre);
        if (!r.ok) return setError(r.error);
        setClave(r.clave);
        setNombre("");
        router.refresh();
      } catch {
        setError("No pudimos conectar el dispositivo. Probá de nuevo en un rato.");
      }
    });
  }

  function anular(id: string, nombreDispositivo: string) {
    if (!window.confirm(`¿Anular «${nombreDispositivo}»? DNX FLUX deja de poder publicar con esa clave.`)) return;
    setError(null);
    iniciar(async () => {
      try {
        const r = await anularDispositivoAction(id);
        if (!r.ok) setError(r.error);
        router.refresh();
      } catch {
        setError("No pudimos anular el dispositivo. Probá de nuevo en un rato.");
      }
    });
  }

  async function copiar() {
    if (!clave) return;
    try {
      await navigator.clipboard.writeText(clave);
      setCopiada(true);
    } catch {
      setCopiada(false);
    }
  }

  return (
    <section className="fo-card space-y-4 p-5" aria-labelledby="gal-dispositivos">
      <div className="space-y-1">
        <h2 id="gal-dispositivos" className="text-base font-semibold">Dispositivos</h2>
        <p className="text-sm leading-relaxed text-[var(--fo-muted)]">
          Cada computadora con DNX FLUX usa su propia clave para publicar las entregas en una galería. Pegá la clave en DNX FLUX. Si una computadora se pierde o ya no se usa, anulá su clave.
        </p>
      </div>

      {clave ? (
        <div role="status" className="space-y-2 rounded-md border border-[var(--fo-border)] p-3 text-sm">
          <p className="font-medium">Copiá la clave ahora: no la vas a poder ver de nuevo.</p>
          <code className="block break-all rounded bg-[var(--fo-surface-2,transparent)] p-2 text-xs" data-testid="clave-nueva">{clave}</code>
          <button type="button" className="fo-btn fo-btn-secondary" onClick={copiar}>{copiada ? "Copiada" : "Copiar clave"}</button>
        </div>
      ) : null}

      <form onSubmit={conectar} className="flex flex-wrap items-end gap-3" aria-label="Conectar un dispositivo">
        <div className="fo-field-stack">
          <label className="fo-label" htmlFor="gal-dispositivo-nombre">Nombre del dispositivo</label>
          <input id="gal-dispositivo-nombre" className="fo-input" maxLength={60} placeholder="Por ejemplo, Mac del estudio" value={nombre} onChange={(e) => setNombre(e.target.value)} />
        </div>
        <button type="submit" className="fo-btn fo-btn-primary" disabled={pendiente || nombre.trim().length === 0}>Conectar dispositivo</button>
      </form>
      {error ? <p role="alert" className="text-sm text-[var(--fo-danger,#b00020)]">{error}</p> : null}

      {dispositivos.length === 0 ? (
        <p className="text-sm text-[var(--fo-muted)]">Todavía no conectaste ningún dispositivo.</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-[var(--fo-muted)]">
                <th className="py-2 pr-4 font-medium">Nombre</th>
                <th className="py-2 pr-4 font-medium">Clave</th>
                <th className="py-2 pr-4 font-medium">Creado</th>
                <th className="py-2 pr-4 font-medium">Último uso</th>
                <th className="py-2 font-medium"><span className="sr-only">Acciones</span></th>
              </tr>
            </thead>
            <tbody>
              {dispositivos.map((d) => (
                <tr key={d.id} className="border-t border-[var(--fo-border)]">
                  <td className="py-2 pr-4">{d.nombre}</td>
                  <td className="py-2 pr-4 font-mono text-xs">fo_dev_{d.prefijo}…</td>
                  <td className="py-2 pr-4">{fecha(d.creado)}</td>
                  <td className="py-2 pr-4">{fecha(d.ultimoUso)}</td>
                  <td className="py-2 text-right">
                    {d.anulado ? <span className="text-[var(--fo-muted)]">Anulado</span> : <button type="button" className="fo-btn fo-btn-secondary" disabled={pendiente} onClick={() => anular(d.id, d.nombre)}>Anular</button>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
