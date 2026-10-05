"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Paperclip } from "lucide-react";
import { registerProjectFilesAction } from "@/app/(shell)/gobierno/actions";
import { uploadGovernanceFile } from "./upload";

/**
 * Adjuntar archivos al proyecto: presupuestos, planos, fotos, planillas. Cualquier tipo, hasta
 * 25 MB cada uno. Quedan internos; la comisión decide después cuáles ven los socios.
 */
export function ProjectFileUploader({ projectId }: { projectId: string }) {
  const input = useRef<HTMLInputElement>(null);
  const [estado, setEstado] = useState<{ subiendo: boolean; error: string | null; detalle: string | null }>({
    subiendo: false,
    error: null,
    detalle: null,
  });
  const [, empezar] = useTransition();
  const router = useRouter();

  async function elegir(lista: FileList | null) {
    if (!lista || lista.length === 0) return;
    const archivos = Array.from(lista);
    setEstado({ subiendo: true, error: null, detalle: null });
    const subidos: { key: string; filename: string }[] = [];
    for (const [i, file] of archivos.entries()) {
      setEstado({ subiendo: true, error: null, detalle: `Subiendo ${i + 1} de ${archivos.length}: ${file.name}` });
      const r = await uploadGovernanceFile(file, { projectId });
      if (!r.ok) {
        setEstado({ subiendo: false, error: `${file.name}: ${r.error}`, detalle: null });
        if (input.current) input.current.value = "";
        return;
      }
      subidos.push({ key: r.key, filename: r.filename });
    }
    const registro = await registerProjectFilesAction({ projectId, files: subidos });
    if (input.current) input.current.value = "";
    if (!registro.ok) {
      setEstado({ subiendo: false, error: registro.error, detalle: null });
      return;
    }
    setEstado({ subiendo: false, error: null, detalle: null });
    empezar(() => router.refresh());
  }

  return (
    <div className="space-y-2">
      <input
        ref={input}
        type="file"
        multiple
        className="sr-only"
        id="gov-project-files"
        onChange={(e) => void elegir(e.target.files)}
        disabled={estado.subiendo}
      />
      <label
        htmlFor="gov-project-files"
        className={`fo-btn fo-btn-secondary text-sm ${estado.subiendo ? "pointer-events-none opacity-60" : "cursor-pointer"}`}
      >
        {estado.subiendo ? <Loader2 className="size-4 animate-spin" aria-hidden /> : <Paperclip className="size-4" aria-hidden />}
        {estado.subiendo ? "Subiendo…" : "Adjuntar archivos"}
      </label>
      {estado.detalle ? <p className="fo-helper">{estado.detalle}</p> : null}
      {estado.error ? (
        <p className="fo-alert-error p-3 text-sm" role="alert">
          {estado.error}
        </p>
      ) : null}
    </div>
  );
}
