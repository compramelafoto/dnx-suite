"use client";

import { useEffect, useRef, useState } from "react";
import { descargarOriginalAction } from "@/app/w/[workspaceSlug]/galeria/[token]/acciones";
import { MENSAJES_PUBLICO, esDispositivoIOS } from "@/lib/galerias/publico-tipos";
import { IconoDescarga } from "./iconos";

/** Pausa entre una descarga y la siguiente: el navegador las encola y no se pisan. */
const PAUSA_MS = 1200;

function bajar(url: string): void {
  const a = document.createElement("a");
  a.href = url;
  a.download = "";
  a.rel = "noreferrer noopener";
  document.body.appendChild(a);
  a.click();
  a.remove();
}

const pausa = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

/**
 * «Descargar todas las mías (N)»: baja los originales de a uno, en orden, con una pausa y el avance a la vista.
 * En iPhone y iPad el navegador bloquea las descargas en cadena, así que se baja una por toque en «Siguiente».
 */
export function DescargarTodas({ slug, token, ids }: { slug: string; token: string; ids: string[] }) {
  const [ios, setIos] = useState(false);
  const [bajando, setBajando] = useState(false);
  const [hechas, setHechas] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const cancelar = useRef(false);

  useEffect(() => {
    setIos(esDispositivoIOS(navigator.userAgent, navigator.maxTouchPoints ?? 0));
    return () => {
      cancelar.current = true;
    };
  }, []);

  async function pedir(id: string): Promise<string | null> {
    try {
      const r = await descargarOriginalAction(slug, token, id);
      if (r.ok) return r.url;
      setError(r.error);
    } catch {
      setError(MENSAJES_PUBLICO.generico);
    }
    return null;
  }

  async function todas() {
    if (bajando) return;
    cancelar.current = false;
    setBajando(true);
    setError(null);
    setHechas(0);
    for (let i = 0; i < ids.length; i++) {
      if (cancelar.current) break;
      const url = await pedir(ids[i]!);
      if (!url) break;
      bajar(url);
      setHechas(i + 1);
      if (i < ids.length - 1) await pausa(PAUSA_MS);
    }
    setBajando(false);
  }

  async function siguiente() {
    if (bajando || hechas >= ids.length) return;
    setBajando(true);
    setError(null);
    const url = await pedir(ids[hechas]!);
    if (url) {
      setHechas((h) => h + 1);
      // En iOS el enlace es un adjunto: el navegador ofrece guardarlo y la página queda donde está.
      window.location.assign(url);
    }
    setBajando(false);
  }

  const total = ids.length;
  const terminada = hechas >= total;

  return (
    <section className="fo-card space-y-2 p-4 text-sm" aria-live="polite">
      <h2 className="text-base font-semibold">Tus fotos en alta calidad</h2>
      <p className="opacity-80">
        {ios
          ? "Tocá «Siguiente» para bajar tus fotos de a una; tu teléfono te va a preguntar dónde guardarlas."
          : "Las fotos se bajan de a una. Tu navegador puede pedirte permiso para descargar varios archivos: aceptalo para que lleguen todas."}
      </p>
      <div className="flex flex-wrap items-center gap-3">
        {ios ? (
          <button type="button" className="fo-btn fo-btn-primary" onClick={() => void siguiente()} disabled={bajando || terminada}>
            <IconoDescarga />
            {hechas === 0 ? `Descargar mis fotos (${total})` : terminada ? "Listo" : `Siguiente (${hechas + 1} de ${total})`}
          </button>
        ) : (
          <button type="button" className="fo-btn fo-btn-primary" onClick={() => void todas()} disabled={bajando}>
            <IconoDescarga />
            Descargar todas las mías ({total})
          </button>
        )}
        {bajando && !ios ? (
          <button type="button" className="fo-btn fo-btn-secondary" onClick={() => (cancelar.current = true)}>
            Parar
          </button>
        ) : null}
        {hechas > 0 ? (
          <span>
            {terminada ? `Se bajaron las ${total} fotos.` : `Descargando ${Math.min(hechas + (bajando && !ios ? 1 : 0), total)} de ${total}…`}
          </span>
        ) : null}
      </div>
      {error ? (
        <p role="alert" className="text-red-700">
          {error}
        </p>
      ) : null}
    </section>
  );
}
