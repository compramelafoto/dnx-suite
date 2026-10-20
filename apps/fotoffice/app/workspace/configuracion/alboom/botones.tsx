"use client";

import { useActionState, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  borrarLoExtraidoAction,
  cancelarExtraccionAction,
  desconectarAlboomAction,
  extraerAction,
  probarConexionAction,
} from "./actions";
import { ESTADO_INICIAL } from "./estado";
import { MensajeAlboom } from "./mensaje";

export function ProbarConexion() {
  const [estado, enviar, pendiente] = useActionState(probarConexionAction, ESTADO_INICIAL);
  return (
    <form action={enviar} className="flex flex-wrap items-center gap-3">
      <button type="submit" className="fo-btn fo-btn-secondary text-sm" disabled={pendiente}>
        {pendiente ? "Probando…" : "Probar conexión"}
      </button>
      <MensajeAlboom estado={estado} />
    </form>
  );
}

export function Desconectar() {
  const [confirmando, setConfirmando] = useState(false);
  const [estado, enviar, pendiente] = useActionState(desconectarAlboomAction, ESTADO_INICIAL);
  if (!confirmando) {
    return (
      <div className="flex flex-wrap items-center gap-3">
        <button type="button" onClick={() => setConfirmando(true)} className="text-sm font-medium text-[var(--fo-danger)] underline underline-offset-4">
          Desconectar
        </button>
        <MensajeAlboom estado={estado} />
      </div>
    );
  }
  return (
    <form action={enviar} className="space-y-2">
      <p className="text-sm text-[var(--fo-danger)]">Se borra la credencial y se cancela la extracción en curso. Lo ya extraído queda guardado.</p>
      <div className="flex items-center gap-3">
        <button type="submit" className="fo-btn fo-btn-danger text-sm" disabled={pendiente}>
          Sí, desconectar
        </button>
        <button type="button" onClick={() => setConfirmando(false)} className="text-sm text-[var(--fo-muted)] underline underline-offset-4">
          No
        </button>
      </div>
    </form>
  );
}

export function Extraer({ modo, etiqueta }: { modo: "TODO" | "INCREMENTAL"; etiqueta: string }) {
  const [estado, enviar, pendiente] = useActionState(extraerAction, ESTADO_INICIAL);
  return (
    <form action={enviar} className="flex flex-wrap items-center gap-3">
      <input type="hidden" name="modo" value={modo} />
      <button type="submit" className="fo-btn fo-btn-primary text-sm" disabled={pendiente}>
        {etiqueta}
      </button>
      <MensajeAlboom estado={estado} />
    </form>
  );
}

export function Cancelar() {
  const [estado, enviar, pendiente] = useActionState(cancelarExtraccionAction, ESTADO_INICIAL);
  return (
    <form action={enviar} className="flex flex-wrap items-center gap-3">
      <button type="submit" className="fo-btn fo-btn-secondary text-sm" disabled={pendiente}>
        Cancelar la extracción
      </button>
      <MensajeAlboom estado={estado} />
    </form>
  );
}

export function BorrarLoExtraido() {
  const [abierto, setAbierto] = useState(false);
  const [estado, enviar, pendiente] = useActionState(borrarLoExtraidoAction, ESTADO_INICIAL);
  if (!abierto) {
    return (
      <div className="flex flex-wrap items-center gap-3">
        <button type="button" onClick={() => setAbierto(true)} className="text-sm font-medium text-[var(--fo-danger)] underline underline-offset-4">
          Borrar lo extraído
        </button>
        <MensajeAlboom estado={estado} />
      </div>
    );
  }
  return (
    <form action={enviar} className="space-y-2">
      <p className="text-sm text-[var(--fo-danger)]">
        Se borran todos los datos traídos de Alboom y el historial de extracciones. En Alboom no cambia nada. Escribí BORRAR para confirmar.
      </p>
      <div className="flex flex-wrap items-center gap-3">
        <input name="confirmacion" required className="fo-input w-32" aria-label="Escribí BORRAR para confirmar" autoComplete="off" />
        <button type="submit" className="fo-btn fo-btn-danger text-sm" disabled={pendiente}>
          Borrar
        </button>
        <button type="button" onClick={() => setAbierto(false)} className="text-sm text-[var(--fo-muted)] underline underline-offset-4">
          No
        </button>
        <MensajeAlboom estado={estado} />
      </div>
    </form>
  );
}

/** Mientras hay una extracción en curso, vuelve a pedir la página cada 20 segundos para mostrar el avance. */
export function AutoRefresco() {
  const router = useRouter();
  useEffect(() => {
    const t = setInterval(() => router.refresh(), 20_000);
    return () => clearInterval(t);
  }, [router]);
  return null;
}
