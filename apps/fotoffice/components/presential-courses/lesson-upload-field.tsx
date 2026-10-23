"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { refrescarEstadoDeVideo, traerVideoDesdeEnlace } from "@/app/actions/course-lessons";

/** Cada cuánto se pregunta si el proveedor terminó de preparar el video. */
const ESPERA_ENTRE_CONSULTAS_MS = 15_000;

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
  const [enlace, setEnlace] = useState("");
  const [trayendo, setTrayendo] = useState(false);
  const router = useRouter();

  // Preparar un video lleva minutos: mientras tanto se pregunta solo, y al terminar se
  // refresca la pantalla para mostrar la duración. Sin esto la clase quedaba "Procesando…"
  // para siempre y nunca le aparecía al alumno.
  useEffect(() => {
    if (estado !== "PROCESSING") return;
    let vigente = true;
    const intervalo = setInterval(async () => {
      const r = await refrescarEstadoDeVideo(lessonId);
      if (!vigente || !r.videoStatus || r.videoStatus === "PROCESSING") return;
      setEstado(r.videoStatus);
      router.refresh();
    }, ESPERA_ENTRE_CONSULTAS_MS);
    return () => {
      vigente = false;
      clearInterval(intervalo);
    };
  }, [estado, lessonId, router]);

  async function traer() {
    setError(null);
    setTrayendo(true);
    const r = await traerVideoDesdeEnlace(lessonId, enlace);
    setTrayendo(false);
    if (r.error) {
      setError(r.error);
      return;
    }
    setEnlace("");
    setEstado("PROCESSING");
  }

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

      <div className="flex flex-wrap items-center gap-2">
        <input
          type="url"
          className="fo-input min-w-0 flex-1 text-sm"
          placeholder="…o pegá el enlace del video en Google Drive"
          aria-label="Enlace del video"
          value={enlace}
          onChange={(e) => setEnlace(e.target.value)}
          disabled={trayendo || estado === "UPLOADING"}
        />
        <button
          type="button"
          className="fo-btn fo-btn-secondary text-sm"
          onClick={() => void traer()}
          disabled={!enlace.trim() || trayendo || estado === "UPLOADING"}
        >
          {trayendo ? "Pidiendo…" : "Traer video"}
        </button>
      </div>
      <p className="text-xs text-[var(--fo-muted)]">
        Desde Drive, el video tiene que estar compartido con &quot;Cualquier persona con el
        enlace&quot;. Sirve para videos de cualquier tamaño.
      </p>

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
          El video se está preparando (si viene de un enlace, primero se descarga). Podés seguir
          cargando el curso: cuando termine, la clase queda lista.
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
