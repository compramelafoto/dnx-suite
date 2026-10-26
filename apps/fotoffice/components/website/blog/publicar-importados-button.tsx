"use client";

import { useActionState } from "react";
import { publicarImportadosAction, type PublicarImportadosState } from "@/app/actions/blog-importados";

const inicial: PublicarImportadosState = { error: null };

/** Aviso + botón para publicar de una vez los artículos que trajo el importador de la web anterior. */
export function PublicarImportadosButton({ pendientes }: { pendientes: number }) {
  const [state, action, pending] = useActionState(publicarImportadosAction, inicial);
  const listo = state.publicados !== undefined;
  return (
    <form action={action} className="fo-card flex flex-wrap items-center justify-between gap-3 border-[var(--fo-accent)] bg-[var(--fo-accent-soft)] p-4 text-sm">
      <p className="min-w-0 flex-1">
        {listo
          ? `Listo: se publicaron ${state.publicados} ${state.publicados === 1 ? "artículo" : "artículos"} con su fecha original.`
          : `${pendientes} ${pendientes === 1 ? "artículo importado de tu web anterior sigue" : "artículos importados de tu web anterior siguen"} en borrador. Publicalos cuando publiques el sitio.`}
        {state.error ? <span className="block text-[var(--fo-danger)]" role="alert">{state.error}</span> : null}
      </p>
      {!listo ? (
        <button type="submit" className="fo-btn fo-btn-primary" disabled={pending}>
          {pending ? "Publicando…" : "Publicar contenido importado"}
        </button>
      ) : null}
    </form>
  );
}
