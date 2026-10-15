"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { CheckCircle2, ImagePlus, Loader2, XCircle } from "lucide-react";
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
 * ── Por qué el `<input type="file">` está escondido ──
 *
 * El control nativo se dibuja distinto en cada navegador y no acepta estilos: en Chrome queda un
 * botón gris con un "Ningún archivo seleccionado" al lado que no se entiende y no se ve. Acá el
 * input real queda invisible pero accesible, y lo que se ve y recibe el foco es el área de abajo
 * —que además acepta arrastrar y soltar, que es como la gente trae fotos de verdad—.
 *
 * Los errores se muestran **por archivo**, no en un cartel único: cuando fallan tres de diez, un
 * solo mensaje no dice cuáles, y la persona tiene que adivinar qué volver a intentar.
 */
export function PortfolioUploader({ photoCount }: { photoCount: number }) {
  const [archivos, setArchivos] = useState<EstadoDeArchivo[]>([]);
  const [arrastrando, setArrastrando] = useState(false);
  const [pendiente, empezar] = useTransition();
  const input = useRef<HTMLInputElement>(null);
  const router = useRouter();

  const disponibles = Math.max(0, PORTFOLIO_MAX_PHOTOS - photoCount);
  const lleno = disponibles === 0;
  const subiendo = archivos.some((a) => a.estado === "subiendo");

  function marcar(nombre: string, cambio: Partial<EstadoDeArchivo>) {
    setArchivos((previos) => previos.map((a) => (a.nombre === nombre ? { ...a, ...cambio } : a)));
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

    const inicial: EstadoDeArchivo[] = aSubir.map((f) => ({ nombre: f.name, estado: "subiendo" }));
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

  const listas = archivos.filter((a) => a.estado === "listo").length;

  return (
    <section className="fo-card space-y-4">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="font-medium">Subir fotos</h2>
        <p className="text-sm tabular-nums text-[var(--fo-muted)]">
          {photoCount} de {PORTFOLIO_MAX_PHOTOS}
        </p>
      </div>

      {lleno ? (
        <p className="rounded-lg border border-dashed border-[var(--fo-border)] px-4 py-6 text-center text-sm text-[var(--fo-muted)]">
          Llegaste al máximo de {PORTFOLIO_MAX_PHOTOS} fotos. Borrá alguna para subir otra.
        </p>
      ) : (
        <>
          {/*
            El label ES el área: hace que el click y el Enter desde el teclado abran el selector sin
            un `onClick` manual, y que el foco se vea donde corresponde.
          */}
          <label
            onDragOver={(e) => {
              e.preventDefault();
              setArrastrando(true);
            }}
            onDragLeave={() => setArrastrando(false)}
            onDrop={(e) => {
              e.preventDefault();
              setArrastrando(false);
              void elegir(e.dataTransfer.files);
            }}
            className={`flex cursor-pointer flex-col items-center gap-3 rounded-xl border-2 border-dashed px-6 py-10 text-center transition-colors duration-200 focus-within:ring-2 focus-within:ring-[var(--fo-accent)] ${
              arrastrando
                ? "border-[var(--fo-accent)] bg-[var(--fo-accent-soft)]"
                : "border-[var(--fo-border)] hover:border-[var(--fo-accent)] hover:bg-[var(--fo-bg-elevated)]"
            }`}
          >
            <input
              ref={input}
              type="file"
              multiple
              accept={PRESET.acceptedFormats.join(",")}
              onChange={(e) => void elegir(e.target.files)}
              disabled={subiendo}
              className="sr-only"
            />

            <span className="flex h-12 w-12 items-center justify-center rounded-full bg-[var(--fo-accent-soft)] text-[var(--fo-accent)]">
              {subiendo ? (
                <Loader2 size={22} className="animate-spin" aria-hidden />
              ) : (
                <ImagePlus size={22} aria-hidden />
              )}
            </span>

            <span className="space-y-1">
              <span className="block font-medium">
                {subiendo ? "Subiendo tus fotos…" : "Elegí tus fotos o arrastralas acá"}
              </span>
              <span className="block text-xs text-[var(--fo-muted)]">
                JPG, PNG o WebP · hasta {Math.round(PRESET.maxFileSizeBytes / (1024 * 1024))} MB cada
                una · desde {PRESET.minWidth} px en su lado más largo
              </span>
              <span className="block text-xs text-[var(--fo-muted)]">
                Te quedan {disponibles} {disponibles === 1 ? "lugar" : "lugares"}. Podés subir
                varias juntas.
              </span>
            </span>

            <span className="fo-btn fo-btn-primary pointer-events-none text-sm">
              Elegir fotos
            </span>
          </label>
        </>
      )}

      {archivos.length > 0 ? (
        <div className="space-y-2">
          {subiendo ? (
            <p className="text-xs text-[var(--fo-muted)]">
              {listas} de {archivos.length} listas. No cierres esta pantalla.
            </p>
          ) : null}

          <ul className="space-y-1 text-sm">
            {archivos.map((a) => (
              <li
                key={a.nombre}
                className="flex items-start justify-between gap-3 rounded border border-[var(--fo-border-muted)] px-3 py-2"
              >
                <span className="min-w-0 truncate">{a.nombre}</span>
                <span className="flex shrink-0 items-center gap-1.5 text-xs">
                  {a.estado === "subiendo" ? (
                    <>
                      <Loader2 size={14} className="animate-spin" aria-hidden />
                      <span className="text-[var(--fo-muted)]">Subiendo…</span>
                    </>
                  ) : null}
                  {a.estado === "listo" ? (
                    <>
                      <CheckCircle2 size={14} className="text-[var(--fo-accent)]" aria-hidden />
                      <span className="text-[var(--fo-muted)]">Listo</span>
                    </>
                  ) : null}
                  {a.estado === "error" ? (
                    <>
                      <XCircle size={14} className="text-[var(--fo-danger)]" aria-hidden />
                      <span className="text-[var(--fo-danger)]">{a.error}</span>
                    </>
                  ) : null}
                </span>
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      {pendiente ? <p className="text-sm text-[var(--fo-muted)]">Actualizando…</p> : null}
    </section>
  );
}
