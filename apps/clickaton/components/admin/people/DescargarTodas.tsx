"use client";

/**
 * Baja todas las fotos de una persona, una detrás de otra.
 *
 * Cada una sale de una URL firmada directo del bucket, porque los originales
 * no entran por una función de Vercel; por eso no se arma un ZIP en el
 * servidor. El navegador puede preguntar una vez si se permiten varias
 * descargas: hay que aceptar.
 */
import { useState } from "react";

import { Button } from "@/components/ui/Button";

export function DescargarTodas({ submissionIds }: { submissionIds: string[] }) {
  const [hechas, setHechas] = useState<number | null>(null);

  async function descargar() {
    setHechas(0);
    for (const [i, id] of submissionIds.entries()) {
      const a = document.createElement("a");
      a.href = `/api/admin/submissions/${id}/download`;
      a.rel = "noopener";
      document.body.appendChild(a);
      a.click();
      a.remove();
      setHechas(i + 1);
      // Una pausa corta: sin ella el navegador descarta descargas seguidas.
      await new Promise((r) => setTimeout(r, 900));
    }
  }

  if (submissionIds.length === 0) return null;
  const enCurso = hechas != null && hechas < submissionIds.length;
  return (
    <Button type="button" size="sm" onClick={descargar} disabled={enCurso}>
      {enCurso
        ? `Descargando ${hechas} de ${submissionIds.length}…`
        : `Descargar las ${submissionIds.length} fotos`}
    </Button>
  );
}
