"use client";

import { useEffect, useState } from "react";

type ShareDetailsClientProps = {
  formName: string;
  formSlug: string;
  formMode: string;
  publicUrl: string;
};

const COPY_FEEDBACK_MS = 2000;

export function ShareDetailsClient({ formName, formSlug, formMode, publicUrl }: ShareDetailsClientProps) {
  const [linkCopied, setLinkCopied] = useState(false);
  const [iframeCopied, setIframeCopied] = useState(false);

  const iframeCode = `<iframe src="${publicUrl}" width="100%" height="700"></iframe>`;

  useEffect(() => {
    if (!linkCopied) return;
    const timeout = window.setTimeout(() => setLinkCopied(false), COPY_FEEDBACK_MS);
    return () => window.clearTimeout(timeout);
  }, [linkCopied]);

  useEffect(() => {
    if (!iframeCopied) return;
    const timeout = window.setTimeout(() => setIframeCopied(false), COPY_FEEDBACK_MS);
    return () => window.clearTimeout(timeout);
  }, [iframeCopied]);

  async function handleCopyLink() {
    await navigator.clipboard.writeText(publicUrl);
    setLinkCopied(true);
  }

  async function handleCopyIframe() {
    await navigator.clipboard.writeText(iframeCode);
    setIframeCopied(true);
  }

  return (
    <>
      <section className="fo-card space-y-6">
        <h2 className="text-lg font-semibold tracking-tight text-[var(--fo-text)]">Datos para compartir</h2>

        <dl className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-1">
            <dt className="text-xs font-semibold uppercase tracking-wide text-[var(--fo-muted)]">
              Nombre del formulario
            </dt>
            <dd className="text-sm text-[var(--fo-text)]">{formName}</dd>
          </div>
          <div className="space-y-1">
            <dt className="text-xs font-semibold uppercase tracking-wide text-[var(--fo-muted)]">Slug</dt>
            <dd className="text-sm font-mono text-[var(--fo-text)]">{formSlug}</dd>
          </div>
          <div className="space-y-1">
            <dt className="text-xs font-semibold uppercase tracking-wide text-[var(--fo-muted)]">Modo</dt>
            <dd className="text-sm text-[var(--fo-text)]">{formMode}</dd>
          </div>
        </dl>

        <div className="space-y-2">
          <label className="text-xs font-semibold uppercase tracking-wide text-[var(--fo-muted)]" htmlFor="public-url">
            URL pública
          </label>
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
            <input id="public-url" value={publicUrl} readOnly className="fo-input" />
            <button type="button" className="fo-btn fo-btn-secondary whitespace-nowrap" onClick={handleCopyLink}>
              {linkCopied ? "Copiado" : "Copiar link"}
            </button>
          </div>
        </div>
      </section>

      <section className="fo-card space-y-4">
        <h2 className="text-lg font-semibold tracking-tight text-[var(--fo-text)]">Código HTML embebible</h2>
        <p className="text-sm text-[var(--fo-muted)] leading-relaxed">
          Próximamente vas a poder insertar este formulario en cualquier sitio web copiando un código HTML.
        </p>
        <textarea rows={4} className="fo-input resize-none" defaultValue={iframeCode} />
        <div className="flex justify-start">
          <button type="button" className="fo-btn fo-btn-secondary" onClick={handleCopyIframe}>
            {iframeCopied ? "Copiado" : "Copiar código"}
          </button>
        </div>
      </section>
    </>
  );
}
