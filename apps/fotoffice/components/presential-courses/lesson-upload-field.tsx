"use client";

import { useState } from "react";
import { refrescarEstadoDeVideo } from "@/app/actions/course-lessons";

type Estado = "PENDING" | "UPLOADING" | "PROCESSING" | "READY" | "ERROR";

const ETIQUETA: Record<Estado, string> = {
  PENDING: "Sin video",
  UPLOADING: "Subiendo…",
  PROCESSING: "Procesando…",
  READY: "Lista",
  ERROR: "Error al procesar",
};

/**
 * Sube el video de una clase.
 *
 * El archivo va **directo del navegador al proveedor**: primero se pide una URL de un solo
 * uso y después se sube contra ella. Si pasara por nuestro servidor, las funciones de Vercel
 * lo rechazarían con 413 — el tope son 4,5 MB y una clase pesa cientos de megas.
 *
 * Se usa `XMLHttpRequest` y no `fetch` por una sola razón: es la única forma de mostrar el
 * progreso de la subida. En un archivo de esta escala, una barra quieta parece una pantalla
 * colgada.
 */
export function LessonUploadField({
  lessonId,
  estadoInicial,
  duracionSegundos,
}: {
  lessonId: string;
  estadoInicial: Estado;
  duracionSegundos: number | null;
}) {
  const [estado, setEstado] = useState<Estado>(estadoInicial);
  const [progreso, setProgreso] = useState(0);
  const [error, setError] = useState<string | null>(null);

  async function subir(archivo: File) {
    setError(null);
    setProgreso(0);
    setEstado("UPLOADING");

    try {
      const respuesta = await fetch("/api/cursos/clases/upload-url", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ lessonId }),
      });
      const json = (await respuesta.json().catch(() => ({}))) as {
        uploadUrl?: string;
        error?: string;
      };
      if (!respuesta.ok || !json.uploadUrl) {
        throw new Error(json.error || "No se pudo preparar la subida.");
      }

      await new Promise<void>((resolver, rechazar) => {
        const pedido = new XMLHttpRequest();
        pedido.open("POST", json.uploadUrl!);
        pedido.upload.onprogress = (e) => {
          if (e.lengthComputable) setProgreso(Math.round((e.loaded / e.total) * 100));
        };
        pedido.onload = () =>
          pedido.status >= 200 && pedido.status < 300
            ? resolver()
            : rechazar(new Error(`La subida falló (${pedido.status}).`));
        pedido.onerror = () => rechazar(new Error("Se cortó la conexión durante la subida."));
        const cuerpo = new FormData();
        cuerpo.append("file", archivo);
        pedido.send(cuerpo);
      });

      // El proveedor todavía tiene que procesarlo: recién ahí la clase se puede ver.
      setEstado("PROCESSING");
      await refrescarEstadoDeVideo(lessonId);
    } catch (e) {
      setEstado("ERROR");
      setError(e instanceof Error ? e.message : "No se pudo subir el video.");
    }
  }

  const minutos = duracionSegundos ? Math.round(duracionSegundos / 60) : null;

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center gap-3">
        <span
          className={`text-sm font-medium ${
            estado === "READY"
              ? "text-[var(--fo-success)]"
              : estado === "ERROR"
                ? "text-[var(--fo-danger)]"
                : "text-[var(--fo-muted)]"
          }`}
        >
          {ETIQUETA[estado]}
          {estado === "READY" && minutos ? ` · ${minutos} min` : ""}
        </span>

        <label className="fo-btn fo-btn-secondary text-sm cursor-pointer">
          {estado === "PENDING" ? "Subir video" : "Reemplazar video"}
          <input
            type="file"
            accept="video/*"
            className="hidden"
            onChange={(e) => {
              const archivo = e.target.files?.[0];
              if (archivo) void subir(archivo);
            }}
          />
        </label>
      </div>

      {estado === "UPLOADING" ? (
        <div className="space-y-1">
          <div className="h-2 w-full overflow-hidden rounded-full bg-[var(--fo-border)]">
            <div
              className="h-full rounded-full bg-[var(--fo-accent)] transition-[width]"
              style={{ width: `${progreso}%` }}
            />
          </div>
          <p className="text-xs text-[var(--fo-muted)]">{progreso}% subido</p>
        </div>
      ) : null}

      {estado === "PROCESSING" ? (
        <p className="text-xs text-[var(--fo-muted)]">
          El video se está preparando. Podés seguir cargando el curso: cuando termine, la clase
          queda lista.
        </p>
      ) : null}

      {error ? (
        <p className="text-sm text-[var(--fo-danger)]" role="alert">
          {error}
        </p>
      ) : null}
    </div>
  );
}
