"use client";

import { useCallback, useRef, useState } from "react";
import type { Tema } from "@/lib/tema";
import { resumenDeCarga } from "@/lib/resumen-de-carga";
import { ErrorDefinitivo, conReintentos, esDefinitivo } from "@/lib/reintentos";

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
        if (!r.ok) {
          const mensaje = datos.error ?? "No pudimos preparar la subida.";
          // "El evento ya terminó" o "llegaste al tope" no mejoran esperando.
          throw esDefinitivo(r.status) ? new ErrorDefinitivo(mensaje) : new Error(mensaje);
        }
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
        if (!r.ok) {
          // R2 rechaza con 403 cuando la firma venció: pedir una nueva es volver a
          // empezar, no reintentar el mismo PUT.
          const mensaje =
            r.status === 403
              ? "La subida tardó demasiado. Probá de nuevo con esa foto."
              : "La subida se cortó.";
          throw esDefinitivo(r.status) ? new ErrorDefinitivo(mensaje) : new Error(mensaje);
        }
      });

      await conReintentos(async () => {
        const r = await fetch(`/api/e/${codigo}/subir/confirmar`, {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ mediaId: permiso.mediaId }),
        });
        const datos = await r.json();
        if (!r.ok) {
          const mensaje = datos.error ?? "No pudimos confirmar la foto.";
          throw esDefinitivo(r.status) ? new ErrorDefinitivo(mensaje) : new Error(mensaje);
        }
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

  // Una repetida ya estaba subida: para el invitado es una foto que está.
  const listas = items.filter((i) => i.estado === "listo" || i.estado === "repetida").length;
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
          {/*
            La única región viva de la pantalla. La lista de abajo no lo es a propósito:
            con veinte fotos subiendo, anunciar cada cambio sería imposible de seguir.
            Por eso el resumen tiene que contar también las que fallaron.
          */}
          <p className="mt-6 text-center text-sm" aria-live="polite">
            {resumenDeCarga(items)}
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
