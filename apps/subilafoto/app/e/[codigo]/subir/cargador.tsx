"use client";

import { useCallback, useRef, useState } from "react";
import type { Tema } from "@/lib/tema";

type Estado = "esperando" | "subiendo" | "listo" | "error" | "repetida";
type Item = { id: string; nombre: string; estado: Estado; error?: string };

/** SHA-256 en el navegador: sirve para no volver a subir la misma foto dos veces. */
async function checksumDe(archivo: File): Promise<string | null> {
  try {
    const buffer = await archivo.arrayBuffer();
    const hash = await crypto.subtle.digest("SHA-256", buffer);
    return [...new Uint8Array(hash)].map((b) => b.toString(16).padStart(2, "0")).join("");
  } catch {
    // Sin checksum se sube igual: perder la deduplicación es mejor que no poder subir.
    return null;
  }
}

async function conReintentos<T>(tarea: () => Promise<T>, intentos = 3): Promise<T> {
  let ultimo: unknown;
  for (let i = 0; i < intentos; i++) {
    try {
      return await tarea();
    } catch (e) {
      ultimo = e;
      // Espera creciente: en un salón el wifi se satura de a ráfagas y vuelve solo.
      if (i < intentos - 1) await new Promise((r) => setTimeout(r, 800 * (i + 1)));
    }
  }
  throw ultimo;
}

export function Cargador({ codigo, tema }: { codigo: string; tema: Tema }) {
  const [items, setItems] = useState<Item[]>([]);
  const entrada = useRef<HTMLInputElement>(null);

  const actualizar = useCallback((id: string, cambios: Partial<Item>) => {
    setItems((previos) => previos.map((i) => (i.id === id ? { ...i, ...cambios } : i)));
  }, []);

  const subirUna = useCallback(
    async (archivo: File, id: string) => {
      actualizar(id, { estado: "subiendo" });

      const checksum = await checksumDe(archivo);

      const permiso = await conReintentos(async () => {
        const r = await fetch(`/api/e/${codigo}/subir`, {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ tipo: archivo.type, bytes: archivo.size, checksum }),
        });
        const datos = await r.json();
        if (!r.ok) throw new Error(datos.error ?? "No pudimos preparar la subida.");
        return datos as { mediaId: string; url?: string; duplicada?: boolean };
      });

      if (permiso.duplicada) {
        actualizar(id, { estado: "repetida" });
        return;
      }

      await conReintentos(async () => {
        const r = await fetch(permiso.url!, {
          method: "PUT",
          headers: { "content-type": archivo.type },
          body: archivo,
        });
        if (!r.ok) throw new Error("La subida se cortó.");
      });

      await conReintentos(async () => {
        const r = await fetch(`/api/e/${codigo}/subir/confirmar`, {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ mediaId: permiso.mediaId }),
        });
        const datos = await r.json();
        if (!r.ok) throw new Error(datos.error ?? "No pudimos confirmar la foto.");
      });

      actualizar(id, { estado: "listo" });
    },
    [codigo, actualizar],
  );

  const alElegir = useCallback(
    async (lista: FileList | null) => {
      if (!lista?.length) return;
      const archivos = [...lista];

      const nuevos = archivos.map((a, i) => ({
        id: `${Date.now()}-${i}`,
        nombre: a.name,
        estado: "esperando" as Estado,
      }));
      setItems((previos) => [...previos, ...nuevos]);

      // De a una: cien fotos en paralelo saturan el wifi del salón y fallan todas juntas.
      for (let i = 0; i < archivos.length; i++) {
        try {
          await subirUna(archivos[i], nuevos[i].id);
        } catch (e) {
          actualizar(nuevos[i].id, {
            estado: "error",
            error: e instanceof Error ? e.message : "No pudimos subirla.",
          });
        }
      }

      if (entrada.current) entrada.current.value = "";
    },
    [subirUna, actualizar],
  );

  const listas = items.filter((i) => i.estado === "listo").length;
  const enCurso = items.some((i) => i.estado === "subiendo" || i.estado === "esperando");

  return (
    <div className="w-full max-w-sm">
      <input
        ref={entrada}
        id="fotos"
        type="file"
        accept="image/*"
        multiple
        className="sr-only"
        onChange={(e) => void alElegir(e.target.files)}
      />

      <label
        htmlFor="fotos"
        className="block w-full cursor-pointer rounded-2xl px-8 py-5 text-center text-lg font-extrabold"
        style={{ background: tema.acento, color: tema.textoSobreAcento }}
      >
        {items.length === 0 ? "Elegir mis fotos" : "Agregar más"}
      </label>

      {items.length > 0 ? (
        <>
          <p className="mt-6 text-center text-sm" aria-live="polite">
            {enCurso
              ? `Subiendo… ${listas} de ${items.length} listas`
              : `${listas} ${listas === 1 ? "foto subida" : "fotos subidas"}`}
          </p>

          <ul className="mt-5 space-y-2 text-left text-sm">
            {items.map((i) => (
              <li key={i.id} className="flex items-start gap-3">
                <span aria-hidden="true" className="mt-[2px]">
                  {i.estado === "listo"
                    ? "✓"
                    : i.estado === "repetida"
                      ? "="
                      : i.estado === "error"
                        ? "!"
                        : "…"}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate">{i.nombre}</span>
                  {i.estado === "repetida" ? (
                    <span className="opacity-70">Esta foto ya estaba subida.</span>
                  ) : null}
                  {i.estado === "error" ? (
                    <span className="opacity-90">{i.error}</span>
                  ) : null}
                </span>
              </li>
            ))}
          </ul>
        </>
      ) : null}

      {listas > 0 && !enCurso ? (
        <p className="mt-8 text-center text-sm opacity-80">
          Van a aparecer en la pantalla apenas las revisemos. Puede tardar un minuto.
        </p>
      ) : null}
    </div>
  );
}
