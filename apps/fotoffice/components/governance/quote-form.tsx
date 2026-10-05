"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import { createQuoteAction, registerQuoteFilesAction } from "@/app/(shell)/gobierno/dinero-actions";
import { uploadGovernanceFile } from "./upload";

/**
 * Cargar una cotización recibida, con el archivo que mandó el proveedor. Primero se crea la
 * cotización y después se sube el archivo contra ella.
 */
export function QuoteForm({ projectId, stages }: { projectId: string; stages: { id: string; title: string }[] }) {
  const form = useRef<HTMLFormElement>(null);
  const [archivos, setArchivos] = useState<File[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);
  const [, empezar] = useTransition();
  const router = useRouter();

  async function enviar(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    setEnviando(true);
    setError(null);
    const r = await createQuoteAction({
      projectId,
      stageId: String(fd.get("stageId") ?? ""),
      supplier: String(fd.get("supplier") ?? ""),
      amount: String(fd.get("amount") ?? ""),
      quotedAt: String(fd.get("quotedAt") ?? ""),
      validUntil: String(fd.get("validUntil") ?? ""),
      note: String(fd.get("note") ?? ""),
    });
    if (!r.ok) {
      setError(r.error);
      setEnviando(false);
      return;
    }
    const subidos: { key: string; filename: string }[] = [];
    for (const file of archivos) {
      const u = await uploadGovernanceFile(file, { projectId });
      if (!u.ok) {
        setError(`La cotización quedó cargada, pero «${file.name}» no se subió: ${u.error}`);
        break;
      }
      subidos.push({ key: u.key, filename: u.filename });
    }
    if (subidos.length > 0) {
      const reg = await registerQuoteFilesAction({ projectId, quoteId: r.quoteId, files: subidos });
      if (!reg.ok) setError(`La cotización quedó cargada, pero el archivo no: ${reg.error}`);
    }
    setEnviando(false);
    setArchivos([]);
    form.current?.reset();
    empezar(() => router.refresh());
  }

  return (
    <form ref={form} onSubmit={enviar} className="grid gap-3 sm:grid-cols-2">
      <div className="fo-field-stack">
        <label className="fo-label" htmlFor="q-stage">
          Etapa
        </label>
        <select id="q-stage" name="stageId" className="fo-input" required>
          {stages.map((s) => (
            <option key={s.id} value={s.id}>
              {s.title}
            </option>
          ))}
        </select>
      </div>
      <div className="fo-field-stack">
        <label className="fo-label" htmlFor="q-supplier">
          Proveedor
        </label>
        <input id="q-supplier" name="supplier" className="fo-input" required maxLength={160} />
      </div>
      <div className="fo-field-stack">
        <label className="fo-label" htmlFor="q-amount">
          Monto
        </label>
        <input id="q-amount" name="amount" className="fo-input" required inputMode="decimal" placeholder="300.000" />
      </div>
      <div className="fo-field-stack">
        <label className="fo-label" htmlFor="q-date">
          Fecha
        </label>
        <input id="q-date" name="quotedAt" type="date" className="fo-input" />
      </div>
      <div className="fo-field-stack">
        <label className="fo-label" htmlFor="q-valid">
          Válida hasta (opcional)
        </label>
        <input id="q-valid" name="validUntil" type="date" className="fo-input" />
      </div>
      <div className="fo-field-stack">
        <label className="fo-label" htmlFor="q-file">
          Archivo (opcional)
        </label>
        <input id="q-file" type="file" className="fo-input" onChange={(e) => setArchivos(Array.from(e.target.files ?? []))} />
      </div>
      <div className="fo-field-stack sm:col-span-2">
        <label className="fo-label" htmlFor="q-note">
          Nota (opcional)
        </label>
        <input id="q-note" name="note" className="fo-input" maxLength={2000} />
      </div>
      {error ? (
        <p className="fo-alert-error p-3 text-sm sm:col-span-2" role="alert">
          {error}
        </p>
      ) : null}
      <div className="sm:col-span-2">
        <button type="submit" className="fo-btn fo-btn-primary text-sm" disabled={enviando}>
          {enviando ? <Loader2 className="size-4 animate-spin" aria-hidden /> : null}
          {enviando ? "Guardando…" : "Cargar cotización"}
        </button>
      </div>
    </form>
  );
}
