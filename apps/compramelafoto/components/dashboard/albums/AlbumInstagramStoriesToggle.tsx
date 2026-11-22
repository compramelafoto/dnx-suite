"use client";

import { useEffect, useState } from "react";

/**
 * Permiso para que el álbum aparezca en las historias de Instagram de CompraMeLaFoto.
 *
 * Viene activado por defecto y se guarda al instante (no depende del botón «Guardar
 * configuración»). Solo aplica a álbumes públicos sin selfie: en los demás se explica
 * por qué no entra, sin casilla.
 */
export default function AlbumInstagramStoriesToggle({
  albumId,
  isPublic,
  hiddenPhotosEnabled,
}: {
  albumId: number;
  isPublic: boolean;
  hiddenPhotosEnabled: boolean;
}) {
  const [estado, setEstado] = useState<{ available: boolean; enabled: boolean } | null>(null);
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let vivo = true;
    fetch(`/api/dashboard/albums/${albumId}/instagram-stories`)
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => vivo && d && setEstado(d))
      .catch(() => undefined);
    return () => {
      vivo = false;
    };
  }, [albumId]);

  if (!estado?.available) return null;

  const aplica = isPublic && !hiddenPhotosEnabled;

  async function cambiar(enabled: boolean) {
    setGuardando(true);
    setError(null);
    try {
      const r = await fetch(`/api/dashboard/albums/${albumId}/instagram-stories`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ enabled }),
      });
      if (!r.ok) throw new Error();
      setEstado(await r.json());
    } catch {
      setError("No se pudo guardar. Probá de nuevo.");
    } finally {
      setGuardando(false);
    }
  }

  return (
    <label
      className={`flex items-start gap-3 rounded-lg border border-[#e5e7eb] bg-[#fafafa] p-3 ${aplica ? "cursor-pointer" : "opacity-70"}`}
    >
      <input
        type="checkbox"
        className="mt-1 shrink-0"
        checked={aplica && estado.enabled}
        onChange={(e) => cambiar(e.target.checked)}
        disabled={!aplica || guardando}
      />
      <span className="min-w-0">
        <span className="block text-sm font-medium text-[#1a1a1a]">
          Difundir en las historias de Instagram de CompraMeLaFoto
        </span>
        <span className="mt-0.5 block text-xs text-[#6b7280] leading-relaxed">
          {!aplica
            ? "Solo los álbumes públicos y sin selfie pueden aparecer en las historias."
            : estado.enabled
              ? "Si el álbum tiene más de 50 fotos, armamos una historia con 3 o 4 fotos (con marca de agua), te etiquetamos y ponemos la dirección del álbum. Se guarda al instante."
              : "Este álbum no va a aparecer en las historias de CompraMeLaFoto."}
        </span>
        {error ? <span className="mt-1 block text-xs text-red-600">{error}</span> : null}
      </span>
    </label>
  );
}
