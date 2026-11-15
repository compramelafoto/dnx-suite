"use client";

import { useState } from "react";
import Button from "@/components/ui/Button";
import { isAlbumTermsAccepted } from "@/lib/albums/album-sales-readiness";
import { TERMS_TEXT, TERMS_VERSION } from "@/lib/terms/photographerTerms";

/**
 * Aviso arriba del álbum, en todas las pestañas, mientras falten los términos. Sin términos el
 * álbum no puede vender, y la única forma de aceptarlos era la pestaña «Ventas»: quien entra
 * sólo a subir fotos (por ejemplo, el álbum que se crea solo al sumarse a un evento) nunca la ve.
 */
export default function AlbumTerminosAviso(props: {
  albumId: number;
  termsAcceptedAt: string | null | undefined;
  termsVersion: string | null | undefined;
  onAceptados: (patch: { termsAcceptedAt: string; termsVersion: string }) => void;
}) {
  const [acepto, setAcepto] = useState(false);
  const [verTexto, setVerTexto] = useState(false);
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (isAlbumTermsAccepted({ termsAcceptedAt: props.termsAcceptedAt ?? null, termsVersion: props.termsVersion ?? null })) {
    return null;
  }

  async function aceptar() {
    setGuardando(true);
    setError(null);
    try {
      const res = await fetch(`/api/dashboard/albums/${props.albumId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ termsAccepted: true }),
      });
      if (!res.ok) {
        const data = (await res.json().catch(() => ({}))) as { error?: unknown };
        setError(typeof data.error === "string" ? data.error : "No se pudieron guardar los términos. Probá de nuevo.");
        return;
      }
      props.onAceptados({ termsAcceptedAt: new Date().toISOString(), termsVersion: TERMS_VERSION });
    } catch {
      setError("No se pudieron guardar los términos. Revisá tu conexión y probá de nuevo.");
    } finally {
      setGuardando(false);
    }
  }

  return (
    <div className="mb-4 rounded-xl border border-amber-300 bg-amber-50 p-4 text-sm text-amber-950" data-testid="album-terminos-aviso">
      <p className="font-semibold">Aceptá los términos para que tus fotos se puedan vender</p>
      <p className="mt-1">
        Mientras no los aceptes, los clientes ven las fotos de este álbum pero no las pueden comprar.
      </p>
      <button type="button" onClick={() => setVerTexto((v) => !v)} className="mt-2 text-[#2563eb] underline">
        {verTexto ? "Ocultar los términos" : "Leer los términos"}
      </button>
      {verTexto ? (
        <pre className="mt-2 max-h-64 overflow-y-auto whitespace-pre-wrap rounded-lg border border-amber-200 bg-white p-3 font-sans text-xs text-[#374151]">
          {TERMS_TEXT}
        </pre>
      ) : null}
      <div className="mt-3 flex flex-col gap-3 sm:flex-row sm:items-center">
        <label className="flex items-start gap-2">
          <input type="checkbox" checked={acepto} onChange={(e) => setAcepto(e.target.checked)} className="mt-0.5" />
          Leí y acepto los Términos y Condiciones para fotógrafos.
        </label>
        <Button onClick={aceptar} disabled={!acepto || guardando} className="text-sm sm:ml-auto">
          {guardando ? "Guardando…" : "Aceptar"}
        </Button>
      </div>
      {error ? <p className="mt-2 text-red-700">{error}</p> : null}
    </div>
  );
}
