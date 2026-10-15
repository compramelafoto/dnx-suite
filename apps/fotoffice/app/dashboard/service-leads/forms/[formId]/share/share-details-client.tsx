"use client";

import { useEffect, useState } from "react";

type CodigoInsertar = {
  /** Dirección absoluta del formulario en modo insertado. */
  url: string;
  /** (a) El marco solo, con alto fijo. */
  simple: string;
  /** (b) El marco y el script que le ajusta el alto. */
  conAltoAutomatico: string;
};

type ShareDetailsClientProps = {
  formName: string;
  formSlug: string;
  formMode: string;
  publicUrl: string;
  /** null = este formulario todavía no tiene versión para insertar. */
  insertar: CodigoInsertar | null;
};

const COPY_FEEDBACK_MS = 2000;

function useCopiado() {
  const [copiado, setCopiado] = useState(false);
  useEffect(() => {
    if (!copiado) return;
    const timeout = window.setTimeout(() => setCopiado(false), COPY_FEEDBACK_MS);
    return () => window.clearTimeout(timeout);
  }, [copiado]);
  return [copiado, setCopiado] as const;
}

function BloqueCodigo({ id, titulo, ayuda, codigo }: { id: string; titulo: string; ayuda: string; codigo: string }) {
  const [copiado, setCopiado] = useCopiado();
  return (
    <div className="space-y-2">
      <label className="text-sm font-semibold text-[var(--fo-text)]" htmlFor={id}>
        {titulo}
      </label>
      <p className="text-sm text-[var(--fo-muted)] leading-relaxed">{ayuda}</p>
      <textarea
        id={id}
        rows={codigo.split("\n").length + 2}
        className="fo-input resize-none font-mono text-xs"
        value={codigo}
        readOnly
        onFocus={(e) => e.currentTarget.select()}
      />
      <div className="flex justify-start">
        <button
          type="button"
          className="fo-btn fo-btn-secondary"
          onClick={async () => {
            await navigator.clipboard.writeText(codigo);
            setCopiado(true);
          }}
        >
          {copiado ? "Copiado" : "Copiar código"}
        </button>
      </div>
    </div>
  );
}

export function ShareDetailsClient({ formName, formSlug, formMode, publicUrl, insertar }: ShareDetailsClientProps) {
  const [linkCopied, setLinkCopied] = useCopiado();

  async function handleCopyLink() {
    await navigator.clipboard.writeText(publicUrl);
    setLinkCopied(true);
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

      <section id="insertar" className="fo-card space-y-6 scroll-mt-24">
        <div className="space-y-2">
          <h2 className="text-lg font-semibold tracking-tight text-[var(--fo-text)]">Insertar en mi web</h2>
          {insertar ? (
            <p className="text-sm text-[var(--fo-muted)] leading-relaxed">
              Pegalo en tu web donde quieras que aparezca el formulario. Sirve para WordPress, Wix y cualquier
              sitio que acepte HTML. Las consultas que lleguen por ahí entran igual que las de tu sitio de FOTOFFICE.
            </p>
          ) : (
            <p className="text-sm text-[var(--fo-muted)] leading-relaxed">
              Por ahora se pueden insertar el formulario general y el de XV. Este formulario se comparte con su enlace.
            </p>
          )}
        </div>

        {insertar ? (
          <>
            <BloqueCodigo
              id="codigo-alto-automatico"
              titulo="Con alto automático (recomendado)"
              ayuda="El formulario se estira solo a su tamaño, sin barras de desplazamiento. Necesita que tu web acepte el código completo, con el script."
              codigo={insertar.conAltoAutomatico}
            />
            <BloqueCodigo
              id="codigo-simple"
              titulo="Simple"
              ayuda="Si tu web no deja pegar scripts, usá este: el formulario queda con un alto fijo."
              codigo={insertar.simple}
            />
            <p className="text-xs text-[var(--fo-muted)] leading-relaxed">
              Vista del formulario solo:{" "}
              <a href={insertar.url} target="_blank" rel="noreferrer" className="text-[var(--fo-accent)] underline underline-offset-2 break-all">
                {insertar.url}
              </a>
            </p>
          </>
        ) : null}
      </section>
    </>
  );
}
