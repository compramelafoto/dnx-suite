"use client";

import { useEffect, useState } from "react";

type Estado = {
  available: boolean;
  enabled: boolean;
  extraHandles: string[];
  photographerHandle: string | null;
  invalid?: string[];
};

const MAX_EXTRA = 20;

/**
 * Permiso para que el álbum aparezca en las historias de Instagram de CompraMeLaFoto, y
 * cuentas extra a etiquetar (organizador, empresas, sponsors).
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
  const [estado, setEstado] = useState<Estado | null>(null);
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [nueva, setNueva] = useState("");

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
  const activo = aplica && estado.enabled;

  async function guardar(cambios: { enabled?: boolean; extraHandles?: string[] }) {
    if (!estado) return false;
    setGuardando(true);
    setError(null);
    try {
      const r = await fetch(`/api/dashboard/albums/${albumId}/instagram-stories`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ enabled: cambios.enabled ?? estado.enabled, extraHandles: cambios.extraHandles }),
      });
      if (!r.ok) throw new Error();
      const d = (await r.json()) as Estado;
      setEstado(d);
      if (d.invalid?.length) setError(`No es un usuario de Instagram válido: ${d.invalid.join(", ")}`);
      return !d.invalid?.length;
    } catch {
      setError("No se pudo guardar. Probá de nuevo.");
      return false;
    } finally {
      setGuardando(false);
    }
  }

  async function agregar() {
    const valor = nueva.trim();
    if (!valor || !estado) return;
    if (await guardar({ extraHandles: [...estado.extraHandles, valor] })) setNueva("");
  }

  return (
    <div className={`rounded-lg border border-[#e5e7eb] bg-[#fafafa] p-3 ${aplica ? "" : "opacity-70"}`}>
      <label className={`flex items-start gap-3 ${aplica ? "cursor-pointer" : ""}`}>
        <input
          type="checkbox"
          className="mt-1 shrink-0"
          checked={activo}
          onChange={(e) => guardar({ enabled: e.target.checked })}
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
                ? `Si el álbum tiene más de 50 fotos, publicamos 3 historias en días distintos, cada una con 3 o 4 fotos chicas del álbum y la dirección del álbum en compramelafoto.com. ${
                    estado.photographerHandle
                      ? `Te etiquetamos como @${estado.photographerHandle}.`
                      : "Cargá tu Instagram en tu perfil para que te etiquetemos."
                  } Se guarda al instante.`
                : "Este álbum no va a aparecer en las historias de CompraMeLaFoto."}
          </span>
        </span>
      </label>

      {activo ? (
        <div className="mt-3 space-y-2 border-t border-[#e5e7eb] pt-3 pl-7">
          <span className="block text-xs font-medium text-[#1a1a1a]">
            Etiquetar también (organizadores, empresas, sponsors)
          </span>
          {estado.extraHandles.length > 0 ? (
            <div className="flex flex-wrap gap-2">
              {estado.extraHandles.map((h) => (
                <span
                  key={h}
                  className="inline-flex items-center gap-1 rounded-full border border-[#d1d5db] bg-white px-2.5 py-1 text-xs text-[#1a1a1a]"
                >
                  @{h}
                  <button
                    type="button"
                    aria-label={`Quitar @${h}`}
                    className="text-[#6b7280] hover:text-red-600"
                    disabled={guardando}
                    onClick={() => guardar({ extraHandles: estado.extraHandles.filter((x) => x !== h) })}
                  >
                    ×
                  </button>
                </span>
              ))}
            </div>
          ) : null}
          {estado.extraHandles.length < MAX_EXTRA ? (
            <div className="flex flex-wrap items-center gap-2">
              <input
                type="text"
                value={nueva}
                onChange={(e) => setNueva(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    void agregar();
                  }
                }}
                placeholder="@usuario o link del perfil"
                className="w-full max-w-[240px] rounded-md border border-[#d1d5db] bg-white px-2.5 py-1.5 text-sm"
                disabled={guardando}
              />
              <button
                type="button"
                onClick={() => void agregar()}
                disabled={guardando || !nueva.trim()}
                className="rounded-md border border-[#d1d5db] bg-white px-3 py-1.5 text-sm font-medium text-[#1a1a1a] hover:bg-[#f3f4f6] disabled:opacity-50"
              >
                Agregar
              </button>
            </div>
          ) : null}
          <span className="block text-xs text-[#6b7280] leading-relaxed">
            Hasta {MAX_EXTRA} cuentas. Les llega la notificación de Instagram y pueden compartir la historia.
            Si alguna es privada o no existe, se deja afuera solo esa y la historia sale igual con las demás.
          </span>
        </div>
      ) : null}
      {error ? <span className="mt-2 block pl-7 text-xs text-red-600">{error}</span> : null}
    </div>
  );
}
