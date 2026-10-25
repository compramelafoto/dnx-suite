import type { EstadoCatalogo } from "./actions";

/** El resultado de la última acción de un formulario del catálogo. */
export function Mensaje({ estado }: { estado: EstadoCatalogo | undefined }) {
  if (estado?.error) {
    return (
      <p role="alert" className="text-sm text-[var(--fo-danger)]">
        {estado.error}
      </p>
    );
  }
  if (estado?.ok) {
    return (
      <p role="status" className="text-sm text-[var(--fo-success)]">
        {estado.ok}
      </p>
    );
  }
  return null;
}
