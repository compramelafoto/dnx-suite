"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import { registerProposalFilesAction, submitProposalAction } from "@/app/portal/proyectos/actions";
import { uploadGovernanceFile } from "./upload";

const PORTAL_UPLOAD = "/api/portal/gobierno/upload-url";

/**
 * Proponer un proyecto a la comisión. Primero se crea la propuesta y después se suben los
 * archivos contra ella: así un archivo nunca queda suelto sin propuesta.
 */
export function ProposalForm() {
  const router = useRouter();
  const [archivos, setArchivos] = useState<File[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [detalle, setDetalle] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);

  async function enviar(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    setEnviando(true);
    setError(null);
    setDetalle("Enviando la propuesta…");
    const r = await submitProposalAction({
      title: String(fd.get("title") ?? ""),
      description: String(fd.get("description") ?? ""),
      approxCost: String(fd.get("approxCost") ?? ""),
      deadline: String(fd.get("deadline") ?? ""),
      fundingIdea: String(fd.get("fundingIdea") ?? ""),
      commitment: String(fd.get("commitment") ?? ""),
    });
    if (!r.ok) {
      setError(r.error);
      setEnviando(false);
      setDetalle(null);
      return;
    }
    const subidos: { key: string; filename: string }[] = [];
    for (const [i, file] of archivos.entries()) {
      setDetalle(`Subiendo ${i + 1} de ${archivos.length}: ${file.name}`);
      const u = await uploadGovernanceFile(file, { projectId: r.projectId }, PORTAL_UPLOAD);
      if (!u.ok) {
        // La propuesta ya llegó: se avisa y se sigue al detalle, donde puede reintentar.
        setError(`Tu propuesta llegó, pero «${file.name}» no se pudo subir: ${u.error}`);
        break;
      }
      subidos.push({ key: u.key, filename: u.filename });
    }
    if (subidos.length > 0) {
      const reg = await registerProposalFilesAction({ projectId: r.projectId, files: subidos });
      if (!reg.ok) setError(`Tu propuesta llegó, pero los archivos no: ${reg.error}`);
    }
    router.push(`/portal/proyectos/${r.projectId}?ok=propuesta`);
  }

  return (
    <form onSubmit={enviar} className="fo-card space-y-5 p-6">
      <div className="fo-field-stack">
        <label className="fo-label" htmlFor="title">
          ¿Qué proponés?
        </label>
        <input id="title" name="title" className="fo-input" required maxLength={160} placeholder="Ej.: Salida fotográfica a la isla" />
      </div>
      <div className="fo-field-stack">
        <label className="fo-label" htmlFor="description">
          Contalo
        </label>
        <textarea
          id="description"
          name="description"
          className="fo-input"
          rows={6}
          required
          minLength={20}
          placeholder="Qué es, para qué le sirve a la institución y qué haría falta."
        />
      </div>
      <div className="grid gap-5 sm:grid-cols-2">
        <div className="fo-field-stack">
          <label className="fo-label" htmlFor="approxCost">
            Costo aproximado (opcional)
          </label>
          <input id="approxCost" name="approxCost" className="fo-input" inputMode="decimal" placeholder="Ej.: 150.000" />
        </div>
        <div className="fo-field-stack">
          <label className="fo-label" htmlFor="deadline">
            ¿Para cuándo? (opcional)
          </label>
          <input id="deadline" name="deadline" type="date" className="fo-input" />
        </div>
      </div>
      <div className="fo-field-stack">
        <label className="fo-label" htmlFor="fundingIdea">
          ¿Cómo se podría conseguir el dinero para cumplir este proyecto? (opcional)
        </label>
        <textarea
          id="fundingIdea"
          name="fundingIdea"
          className="fo-input"
          rows={2}
          maxLength={2000}
          placeholder="Ej.: una rifa entre los socios, un sponsor de la zona, un taller a beneficio."
        />
      </div>
      <div className="fo-field-stack">
        <label className="fo-label" htmlFor="commitment">
          ¿Cómo podrías colaborar? ¿Qué tarea te comprometés a hacer?
        </label>
        <textarea
          id="commitment"
          name="commitment"
          className="fo-input"
          rows={2}
          required
          maxLength={2000}
          placeholder="Ej.: pido tres presupuestos de carpintería y coordino a los que ayuden el fin de semana."
        />
        <p className="fo-helper">Los proyectos salen cuando alguien se pone al frente. Contale a la comisión con qué podés ayudar.</p>
      </div>
      <div className="fo-field-stack">
        <label className="fo-label" htmlFor="files">
          Archivos (opcional)
        </label>
        <input id="files" type="file" multiple className="fo-input" onChange={(e) => setArchivos(Array.from(e.target.files ?? []))} />
        <p className="fo-helper">Presupuestos, fotos, un PDF: lo que ayude a entender la idea. Hasta 25 MB cada uno.</p>
      </div>
      {detalle ? <p className="fo-helper">{detalle}</p> : null}
      {error ? (
        <p className="fo-alert-error p-3 text-sm" role="alert">
          {error}
        </p>
      ) : null}
      <button type="submit" className="fo-btn fo-btn-primary text-sm" disabled={enviando}>
        {enviando ? <Loader2 className="size-4 animate-spin" aria-hidden /> : null}
        {enviando ? "Enviando…" : "Enviar a la comisión"}
      </button>
    </form>
  );
}
