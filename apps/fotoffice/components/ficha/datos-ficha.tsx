import type { ReactNode } from "react";

export type FilaDato = { etiqueta: string; valor: ReactNode };

/**
 * Una tarjeta de datos de la columna lateral: título y pares "etiqueta — valor" (un valor
 * vacío se ve "—"), o cualquier contenido propio (por ejemplo, un formulario de edición).
 * Reemplaza los `Dato` que cada página armaba por su cuenta.
 */
export function DatosFicha({
  titulo,
  filas,
  acciones,
  children,
}: {
  titulo: string;
  filas?: FilaDato[];
  acciones?: ReactNode;
  children?: ReactNode;
}) {
  return (
    <section className="fo-card space-y-3 p-4">
      <div className="flex items-center justify-between gap-2">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-[var(--fo-muted-soft)]">{titulo}</h2>
        {acciones}
      </div>
      {filas && filas.length > 0 ? (
        <dl className="space-y-2 text-sm">
          {filas.map((f) => (
            <div key={f.etiqueta} className="flex justify-between gap-4">
              <dt className="text-[var(--fo-muted)]">{f.etiqueta}</dt>
              <dd className="break-words text-right text-[var(--fo-text)]">
                {f.valor === null || f.valor === undefined || f.valor === "" ? "—" : f.valor}
              </dd>
            </div>
          ))}
        </dl>
      ) : null}
      {children}
    </section>
  );
}
