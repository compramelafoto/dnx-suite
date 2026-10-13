"use client";

import { useRouter } from "next/navigation";
import { useRef, useState } from "react";
import { confirmarOriginal } from "@/lib/ventas/autor";
import { alerta, botonChico, nota } from "./estilos";

const TIPOS = ["image/jpeg", "image/png", "image/tiff"];
const MAX = 80 * 1024 * 1024;

/** PUT directo al bucket privado con barra de avance (Vercel no acepta cuerpos de más de 4,5 MB). */
function subir(url: string, archivo: File, avance: (n: number) => void): Promise<boolean> {
  return new Promise((resolve) => {
    const xhr = new XMLHttpRequest();
    xhr.open("PUT", url);
    xhr.setRequestHeader("Content-Type", archivo.type);
    xhr.upload.onprogress = (e) => {
      if (e.lengthComputable) avance(Math.round((e.loaded / e.total) * 100));
    };
    xhr.onload = () => resolve(xhr.status >= 200 && xhr.status < 300);
    xhr.onerror = () => resolve(false);
    xhr.send(archivo);
  });
}

/** El archivo original de una obra (D15): JPEG, PNG o TIFF de hasta 80 MB, en el bucket privado. */
export function SubirOriginal({ activityWorkId, hayOriginal, bloqueado }: { activityWorkId: string; hayOriginal: boolean; bloqueado: boolean }) {
  const router = useRouter();
  const input = useRef<HTMLInputElement>(null);
  const [avance, setAvance] = useState<number | null>(null);
  const [estado, setEstado] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  if (bloqueado) return <p className={nota}>Esta obra ya vendió copias: el original no se puede cambiar.</p>;

  const elegir = async (archivo: File | undefined) => {
    if (!archivo) return;
    setError(null);
    if (!TIPOS.includes(archivo.type)) return setError("El original tiene que ser JPEG, PNG o TIFF.");
    if (archivo.size > MAX) return setError("El original puede pesar hasta 80 MB.");
    setAvance(0);
    setEstado("Preparando la subida…");
    const fd = new FormData();
    fd.set("activityWorkId", activityWorkId);
    fd.set("mime", archivo.type);
    fd.set("bytes", String(archivo.size));
    try {
      const r = await fetch("/api/ventas/subida", { method: "POST", body: fd });
      const j = (await r.json()) as { url?: string; clave?: string; error?: string };
      if (!r.ok || !j.url || !j.clave) throw new Error(j.error ?? "No pudimos preparar la subida.");
      setEstado("Subiendo…");
      if (!(await subir(j.url, archivo, setAvance))) throw new Error("Se cortó la subida. Probá de nuevo.");
      setEstado("Revisando el archivo…");
      const c = await confirmarOriginal(activityWorkId, j.clave);
      if (!c.ok) throw new Error(c.errores.join(" "));
      setEstado("Listo.");
      router.refresh();
    } catch (e) {
      setEstado(null);
      setError(e instanceof Error ? e.message : "No pudimos subir el archivo.");
    } finally {
      setAvance(null);
      if (input.current) input.current.value = "";
    }
  };

  return (
    <div className="space-y-2">
      <input ref={input} type="file" accept="image/jpeg,image/png,image/tiff" className="sr-only" onChange={(e) => elegir(e.target.files?.[0])} />
      <button type="button" className={botonChico} disabled={avance != null} onClick={() => input.current?.click()}>
        {hayOriginal ? "Reemplazar el original" : "Subir el original"}
      </button>
      {avance != null ? (
        <div className="h-1 w-full max-w-xs bg-[var(--mf-line)]" role="progressbar" aria-valuenow={avance} aria-valuemin={0} aria-valuemax={100}>
          <div className="h-1 bg-[var(--mf-ink)]" style={{ width: `${avance}%` }} />
        </div>
      ) : null}
      {estado ? <p role="status" className={nota}>{estado}</p> : null}
      {error ? <p role="alert" className={alerta}>{error}</p> : null}
    </div>
  );
}
