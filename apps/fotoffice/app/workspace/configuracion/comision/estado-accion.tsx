import { startTransition, useState } from "react";
import type { CommissionActionState } from "./actions";

/** Error, aviso de duplicados o "Guardado." de una acción de la comisión. */
export function EstadoAccion({ state, okText = "Guardado." }: { state: CommissionActionState | undefined; okText?: string }) {
  if (!state) return null;
  if (state.error) {
    return (
      <p role="alert" className="text-sm text-[var(--fo-danger)]">
        {state.error}
      </p>
    );
  }
  if (!state.ok) return null;
  return (
    <p role="status" className="text-sm text-[var(--fo-success)]">
      {okText}
      {state.message ? <span className="block text-[var(--fo-muted)]">{state.message}</span> : null}
    </p>
  );
}

/** El error de archivar que pide confirmación ("… Confirmá para archivarlo …"). */
export function pideConfirmacion(state: CommissionActionState | undefined): boolean {
  return Boolean(state?.error && state.error.includes("Confirmá"));
}

/**
 * `onSubmit` que manda el formulario a la acción SIN que React lo vacíe.
 *
 * Con `<form action={…}>`, React 19 reinicia los campos no controlados al terminar la acción,
 * también cuando vuelve con error: quien escribió mal una fecha tendría que cargar todo de nuevo.
 * Acá se arma el FormData a mano (con el botón que se apretó, para `confirm=yes`) y se despacha
 * dentro de una transición, que es lo que `useActionState` espera.
 */
export function enviarSinBorrar(dispatch: (fd: FormData) => void) {
  return (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const submitter = (e.nativeEvent as SubmitEvent).submitter as HTMLElement | null;
    const fd = new FormData(e.currentTarget, submitter);
    startTransition(() => dispatch(fd));
  };
}

/**
 * Reacciona cuando la acción devuelve un resultado nuevo (cerrar el formulario, pedir
 * confirmación). Se ajusta durante el render, como recomienda React, en vez de con un efecto que
 * dispararía un segundo render en cascada.
 */
export function useAlCambiar<T>(valor: T, alCambiar: (v: T) => void): void {
  const [visto, setVisto] = useState(valor);
  if (valor !== visto) {
    setVisto(valor);
    alCambiar(valor);
  }
}
