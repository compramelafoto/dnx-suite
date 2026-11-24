"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

type Props = {
  schoolName: string;
  /** Ruta de la API que borra (DELETE). */
  deleteUrl: string;
  /** Adónde volver una vez eliminada. */
  redirectTo: string;
};

/**
 * Botón para eliminar la escuela completa. Pide escribir el nombre exacto
 * para confirmar. El servidor se niega si la escuela tiene álbumes, pedidos
 * o comisiones, y en ese caso se muestra el motivo.
 */
export default function EliminarEscuelaBoton({ schoolName, deleteUrl, redirectTo }: Props) {
  const router = useRouter();
  const [eliminando, setEliminando] = useState(false);

  async function eliminar() {
    const escrito = window.prompt(
      `Vas a eliminar la escuela "${schoolName}" con todos sus cursos, alumnos y organizadores. ` +
        `No se puede deshacer.\n\nPara confirmar, escribí el nombre de la escuela:`
    );
    if (escrito === null) return;
    if (escrito.trim() !== schoolName.trim()) {
      window.alert("El nombre no coincide. No se eliminó nada.");
      return;
    }

    setEliminando(true);
    try {
      const res = await fetch(deleteUrl, { method: "DELETE", credentials: "include" });
      const data = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) {
        window.alert(data.error || "No se pudo eliminar la escuela.");
        return;
      }
      router.push(redirectTo);
    } catch {
      window.alert("No se pudo eliminar la escuela. Revisá la conexión y probá de nuevo.");
    } finally {
      setEliminando(false);
    }
  }

  return (
    <button
      type="button"
      onClick={() => void eliminar()}
      disabled={eliminando}
      className="inline-flex items-center justify-center rounded-lg border border-red-300 bg-white px-3 py-2 text-sm font-medium text-red-700 transition-colors hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-60"
    >
      {eliminando ? "Eliminando…" : "Eliminar escuela"}
    </button>
  );
}
