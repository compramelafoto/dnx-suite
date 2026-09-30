"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { registerPortfolioPhotoAction } from "@/app/actions/portfolio";
import { IMAGE_PRESETS } from "@/lib/images/presets";
import { PORTFOLIO_MAX_PHOTOS } from "@/lib/portfolio/constants";

const PRESET = IMAGE_PRESETS.memberPortfolioPhoto;

type EstadoDeArchivo = {
  nombre: string;
  estado: "subiendo" | "listo" | "error";
  error?: string;
};

/**
 * Sube fotos al portfolio, en tres pasos por archivo:
 *
 * 1. pedirle al servidor una URL firmada,
 * 2. escribir el archivo **directo en R2** (por eso puede pesar más de 4,5 MB),
 * 3. avisarle al servidor que ya está, para que verifique el objeto y lo registre.
 *
 * Los errores se muestran **por archivo**, no en un cartel único: cuando fallan tres de diez, un
 * solo mensaje no dice cuáles, y la persona tiene que adivinar qué volver a intentar.
 */
export function PortfolioUploader({ photoCount }: { photoCount: number }) {
  const [archivos, setArchivos] = useState<EstadoDeArchivo[]>([]);
  const [pendiente, empezar] = useTransition();
  const input = useRef<HTMLInputElement>(null);
  const router = useRouter();

  const disponibles = Math.max(0, PORTFOLIO_MAX_PHOTOS - photoCount);
  const lleno = disponibles === 0;

  function marcar(nombre: string, cambio: Partial<EstadoDeArchivo>) {
    setArchivos((previos) =>
      previos.map((a) => (a.nombre === nombre ? { ...a, ...cambio } : a)),
    );
  }

  /** Alto y ancho, para que la galería no salte mientras carga. */
  async function leerDimensiones(file: File): Promise<{ width: number; height: number }> {
    const bitmap = await createImageBitmap(file);
    try {
      return { width: bitmap.width, height: bitmap.height };
    } finally {
      bitmap.close();
    }
  }

  async function subirUno(file: File) {
    marcar(file.name, { estado: "subiendo" });

    let dimensiones: { width: number; height: number };
    try {
      dimensiones = await leerDimensiones(file);
    } catch {
      marcar(file.name, { estado: "error", error: "No pudimos leer esa imagen." });
      return;
    }

    const permiso = await fetch("/api/portal/portfolio/upload-url", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ filename: file.name, contentType: file.type }),
    });
    const datos = (await permiso.json().catch(() => null)) as {
      uploadUrl?: string;
      key?: string;
      error?: string;
    } | null;

    if (!permiso.ok || !datos?.uploadUrl || !datos.key) {
      marcar(file.name, {
        estado: "error",
        error: datos?.error ?? "No pudimos preparar la subida.",
      });
      return;
    }

    // El archivo va directo a R2. El servidor no lo ve pasar.
    const subida = await fetch(datos.uploadUrl, {
      method: "PUT",
      headers: { "Content-Type": file.type },
      body: file,
    }).catch(() => null);

    if (!subida?.ok) {
      marcar(file.name, {
        estado: "error",
        error: "La subida se cortó. Revisá tu conexión y probá de nuevo.",
      });
      return;
    }

    const registro = await registerPortfolioPhotoAction({
      key: datos.key,
      width: dimensiones.width,
      height: dimensiones.height,
    });

    if (!registro.ok) {
      marcar(file.name, { estado: "error", error: registro.error });
      return;
    }

    marcar(file.name, { estado: "listo" });
  }

  async function elegir(lista: FileList | null) {
    if (!lista || lista.length === 0) return;

    // De más no entran: mejor decirlo antes de subir que rechazarlas de a una.
    const aSubir = Array.from(lista).slice(0, disponibles);
    const sobrantes = lista.length - aSubir.length;

    const inicial: EstadoDeArchivo[] = aSubir.map((f) => ({
      nombre: f.name,
      estado: "subiendo",
    }));
    if (sobrantes > 0) {
      inicial.push({
        nombre: `${sobrantes} foto${sobrantes > 1 ? "s" : ""} de más`,
        estado: "error",
        error: `Sólo te quedan ${disponibles} lugares.`,
      });
    }
    setArchivos(inicial);

    // De a una, en orden: así el `order` de cada foto queda como la persona las eligió.
    for (const file of aSubir) await subirUno(file);

    if (input.current) input.current.value = "";
    empezar(() => router.refresh());
  }

  return (
    <section className="fo-card space-y-3">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="font-medium">Subir fotos</h2>
        <p className="text-sm text-[var(--fo-muted)]">
          {photoCount} de {PORTFOLIO_MAX_PHOTOS}
        </p>
      </div>

      {lleno ? (
        <p className="text-sm text-[var(--fo-muted)]">
          Llegaste al máximo de {PORTFOLIO_MAX_PHOTOS} fotos. Borrá alguna para subir otra.
        </p>
      ) : (
        <>
          <input
            ref={input}
            type="file"
            multiple
            accept={PRESET.acceptedFormats.join(",")}
            onChange={(e) => void elegir(e.target.files)}
            className="block w-full text-sm"
          />
          <p className="text-xs text-[var(--fo-muted)]">
            JPG, PNG o WebP · hasta {Math.round(PRESET.maxFileSizeBytes / (1024 * 1024))} MB cada
            una · desde {PRESET.minWidth} px en su lado más largo. Podés subir varias juntas.
          </p>
        </>
      )}

      {archivos.length > 0 ? (
        <ul className="space-y-1 text-sm">
          {archivos.map((a) => (
            <li key={a.nombre} className="flex items-start justify-between gap-3">
              <span className="truncate">{a.nombre}</span>
              <span
                className={
                  a.estado === "error"
                    ? "text-[var(--fo-danger)] shrink-0"
                    : "text-[var(--fo-muted)] shrink-0"
                }
              >
                {a.estado === "subiendo" ? "Subiendo…" : null}
                {a.estado === "listo" ? "Listo" : null}
                {a.estado === "error" ? a.error : null}
              </span>
            </li>
          ))}
        </ul>
      ) : null}

      {pendiente ? <p className="text-sm text-[var(--fo-muted)]">Actualizando…</p> : null}
    </section>
  );
}
