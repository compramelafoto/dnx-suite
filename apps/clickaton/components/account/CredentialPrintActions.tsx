"use client";

export function CredentialPrintActions() {
  return (
    <div className="flex w-full flex-col gap-3 print:hidden sm:flex-row sm:flex-wrap">
      <a
        href="/mi-cuenta"
        className="inline-flex min-h-11 w-full items-center justify-center rounded-full border border-ck-border px-5 text-sm font-semibold text-ck-text hover:border-ck-yellow sm:w-auto"
      >
        Volver a Mi cuenta
      </a>
      <button
        type="button"
        className="inline-flex min-h-11 w-full items-center justify-center rounded-full bg-ck-yellow px-5 text-sm font-semibold text-ck-bg hover:brightness-105 sm:w-auto"
        onClick={() => window.print()}
      >
        Imprimir credencial
      </button>
    </div>
  );
}
