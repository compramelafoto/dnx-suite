"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import { addTaskProgressAction } from "@/app/(shell)/gobierno/actions";
import { uploadGovernanceFile } from "./upload";

/**
 * Contar un avance de una tarea: qué se hizo, con archivos si hace falta (la foto del flyer, el
 * presupuesto que mandó la imprenta). Primero suben los archivos y después se guarda todo junto.
 */
type ProgressSubmit = (input: {
  projectId: string;
  taskId: string;
  body: string;
  files: { key: string; filename: string }[];
}) => Promise<{ ok: true } | { ok: false; error: string }>;

export function TaskProgressForm({
  projectId,
  taskId,
  submit = addTaskProgressAction,
  uploadEndpoint,
}: {
  projectId: string;
  taskId: string;
  /** Desde el portal se pasa la acción del socio; en el panel, la del equipo. */
  submit?: ProgressSubmit;
  uploadEndpoint?: string;
}) {
  const form = useRef<HTMLFormElement>(null);
  const [texto, setTexto] = useState("");
  const [archivos, setArchivos] = useState<File[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [detalle, setDetalle] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);
  const [, empezar] = useTransition();
  const router = useRouter();

  async function enviar(e: React.FormEvent) {
    e.preventDefault();
    if (texto.trim() === "") {
      setError("Escribí qué se hizo.");
      return;
    }
    setEnviando(true);
    setError(null);
    const subidos: { key: string; filename: string }[] = [];
    for (const [i, file] of archivos.entries()) {
      setDetalle(`Subiendo ${i + 1} de ${archivos.length}: ${file.name}`);
      const r = await uploadGovernanceFile(file, { projectId, taskId }, uploadEndpoint);
      if (!r.ok) {
        setError(`${file.name}: ${r.error}`);
        setEnviando(false);
        setDetalle(null);
        return;
      }
      subidos.push({ key: r.key, filename: r.filename });
    }
    setDetalle(null);
    const r = await submit({ projectId, taskId, body: texto, files: subidos });
    setEnviando(false);
    if (!r.ok) {
      setError(r.error);
      return;
    }
    setTexto("");
    setArchivos([]);
    form.current?.reset();
    empezar(() => router.refresh());
  }

  return (
    <form ref={form} onSubmit={enviar} className="space-y-3">
      <div className="fo-field-stack">
        <label className="fo-label" htmlFor="progress-body">
          Contar un avance
        </label>
        <textarea
          id="progress-body"
          className="fo-input"
          rows={3}
          value={texto}
          onChange={(e) => setTexto(e.target.value)}
          placeholder="Ej.: Pedí presupuesto a dos imprentas, quedan en contestar el jueves."
        />
      </div>
      <div className="fo-field-stack">
        <label className="fo-label" htmlFor="progress-files">
          Archivos (opcional)
        </label>
        <input
          id="progress-files"
          type="file"
          multiple
          className="fo-input"
          onChange={(e) => setArchivos(Array.from(e.target.files ?? []))}
        />
        <p className="fo-helper">Cualquier tipo, hasta 25 MB cada uno.</p>
      </div>
      {detalle ? <p className="fo-helper">{detalle}</p> : null}
      {error ? (
        <p className="fo-alert-error p-3 text-sm" role="alert">
          {error}
        </p>
      ) : null}
      <button type="submit" className="fo-btn fo-btn-primary text-sm" disabled={enviando}>
        {enviando ? <Loader2 className="size-4 animate-spin" aria-hidden /> : null}
        {enviando ? "Guardando…" : "Guardar avance"}
      </button>
    </form>
  );
}
