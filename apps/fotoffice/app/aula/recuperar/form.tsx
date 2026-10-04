// app/aula/recuperar/form.tsx
"use client";

import { useActionState } from "react";
import { pedirEnlaceDelAula } from "@/app/actions/course-classroom";

export function RecuperarForm() {
  const [estado, accion, enviando] = useActionState(pedirEnlaceDelAula, { mensaje: null });
  return (
    <form action={accion} className="space-y-3">
      <div className="fo-field-stack">
        <label className="fo-label" htmlFor="email">
          El correo con el que compraste
        </label>
        <input id="email" name="email" type="email" required className="fo-input" />
      </div>
      <button type="submit" disabled={enviando} className="fo-btn fo-btn-primary text-sm">
        {enviando ? "Enviando…" : "Mandarme el enlace"}
      </button>
      {estado.mensaje ? <p className="text-sm text-[var(--fo-muted)]">{estado.mensaje}</p> : null}
    </form>
  );
}
