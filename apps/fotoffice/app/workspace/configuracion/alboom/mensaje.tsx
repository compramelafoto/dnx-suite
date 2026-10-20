import type { EstadoAlboom } from "./estado";

/** El resultado de la última acción. */
export function MensajeAlboom({ estado }: { estado: EstadoAlboom | undefined }) {
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
