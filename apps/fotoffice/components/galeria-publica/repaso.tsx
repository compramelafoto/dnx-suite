"use client";

import { useEffect, useRef, useState } from "react";
import { type ConfigSeleccion, validarEnvio } from "@/lib/galerias/seleccion";
import { MAX_MENSAJE_CLIENTE, type FotoPublica } from "@/lib/galerias/publico-tipos";
import { IconoCheck } from "./iconos";

const sinMenu = (e: React.SyntheticEvent) => e.preventDefault();
const MAX_MINIATURAS = 60;

/**
 * Pantalla de repaso antes de enviar: cuántas fotos, una tira para revisarlas, un mensaje opcional para el
 * estudio y la confirmación. Valida mínimo y máximo (el servidor lo vuelve a hacer). Al enviar muestra el
 * agradecimiento.
 */
export function Repaso({
  config,
  fotos,
  nombre,
  onVolver,
  onEnviar,
  onTerminar,
}: {
  config: ConfigSeleccion;
  /** Las fotos elegidas, en el orden de la galería. */
  fotos: FotoPublica[];
  nombre: string;
  onVolver: () => void;
  onEnviar: (mensaje: string) => Promise<{ ok: true; cantidad: number; enviadaEn: string } | { ok: false; error: string }>;
  /** Cuando ya envió y cierra el agradecimiento. */
  onTerminar: () => void;
}) {
  const [mensaje, setMensaje] = useState("");
  const [enviando, setEnviando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hecho, setHecho] = useState<{ cantidad: number; enviadaEn: string } | null>(null);
  const principal = useRef<HTMLButtonElement>(null);
  const validacion = validarEnvio(config, fotos.length);

  useEffect(() => {
    const antes = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = antes;
    };
  }, []);
  useEffect(() => {
    principal.current?.focus();
  }, [hecho]);

  async function confirmar() {
    if (enviando || !validacion.ok) return;
    setEnviando(true);
    setError(null);
    const r = await onEnviar(mensaje);
    setEnviando(false);
    if (r.ok) setHecho({ cantidad: r.cantidad, enviadaEn: r.enviadaEn });
    else setError(r.error);
  }

  const cantidadTexto = (n: number) => (n === 1 ? "1 foto" : `${n} fotos`);

  return (
    <div role="dialog" aria-modal="true" aria-label="Enviar mi selección" className="fixed inset-0 z-50 overflow-y-auto bg-white text-[var(--fo-text)]" onContextMenu={sinMenu}>
      <div className="mx-auto max-w-2xl space-y-5 px-4 py-6 pb-12 md:py-10">
        {hecho ? (
          <section className="space-y-4 text-center" aria-live="polite">
            <span className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-[var(--fo-accent)] text-white"><IconoCheck width={30} height={30} /></span>
            <h2 className="text-2xl font-semibold">¡Listo{nombre ? `, ${nombre.split(" ")[0]}` : ""}!</h2>
            <p>Recibimos tu selección de {cantidadTexto(hecho.cantidad)}. Ya la estamos mirando.</p>
            <p className="text-sm opacity-70">La enviaste el {hecho.enviadaEn}. Si querés cambiar algo, escribinos y lo vemos.</p>
            <button ref={principal} type="button" onClick={onTerminar} className="fo-btn fo-btn-primary">Ver mi selección</button>
          </section>
        ) : (
          <>
            <h2 className="text-2xl font-semibold">Repasá tu selección</h2>
            <p className="text-lg">
              Elegiste <strong>{cantidadTexto(fotos.length)}</strong>.
            </p>
            {!validacion.ok ? <p role="alert" className="fo-alert-warning">{validacion.error}</p> : null}
            {fotos.length > 0 ? (
              <ul className="grid grid-cols-5 gap-1 sm:grid-cols-8" aria-label="Fotos elegidas">
                {fotos.slice(0, MAX_MINIATURAS).map((f) => (
                  <li key={f.id} className="aspect-square overflow-hidden rounded bg-neutral-200">
                    {f.thumbUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={f.thumbUrl} alt="" loading="lazy" draggable={false} onContextMenu={sinMenu} onDragStart={sinMenu} referrerPolicy="no-referrer" className="h-full w-full select-none object-cover" />
                    ) : null}
                  </li>
                ))}
                {fotos.length > MAX_MINIATURAS ? <li className="flex aspect-square items-center justify-center text-xs">y {fotos.length - MAX_MINIATURAS} más</li> : null}
              </ul>
            ) : null}
            <div className="space-y-1">
              <label htmlFor="galeria-mensaje" className="fo-label">¿Querés dejarnos un mensaje? (opcional)</label>
              <textarea
                id="galeria-mensaje"
                value={mensaje}
                onChange={(e) => setMensaje(e.target.value)}
                maxLength={MAX_MENSAJE_CLIENTE}
                rows={4}
                className="fo-input w-full"
                placeholder="Por ejemplo: la foto 12 la queremos en tamaño grande."
              />
              <p className="text-right text-xs opacity-60">{mensaje.length}/{MAX_MENSAJE_CLIENTE}</p>
            </div>
            <p className="text-sm opacity-80">Cuando la envíes, no vas a poder cambiarla. Si más adelante querés modificar algo, escribinos.</p>
            {error ? <p role="alert" className="fo-alert-error">{error}</p> : null}
            <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
              <button type="button" onClick={onVolver} disabled={enviando} className="fo-btn fo-btn-secondary">Volver a la galería</button>
              <button ref={principal} type="button" onClick={confirmar} disabled={enviando || !validacion.ok} className="fo-btn fo-btn-primary">
                {enviando ? "Enviando…" : "Sí, enviar mi selección"}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
