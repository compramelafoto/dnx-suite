"use client";

export function CredentialPrintActions() {
  return (
    <div className="flex flex-wrap gap-3 print:hidden">
      <a
        href="/mi-cuenta"
        className="inline-flex min-h-11 items-center justify-center rounded-full border border-ck-border px-5 text-sm font-semibold text-ck-text hover:border-ck-yellow"
      >
        Volver a Mi cuenta
      </a>
      <button
        type="button"
        className="inline-flex min-h-11 items-center justify-center rounded-full bg-ck-yellow px-5 text-sm font-semibold text-ck-bg hover:brightness-105"
        onClick={() => window.print()}
      >
        Imprimir / guardar PDF
      </button>
    </div>
  );
}
