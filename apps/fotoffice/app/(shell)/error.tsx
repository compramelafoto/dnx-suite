"use client";

import { PantallaDeError } from "@/components/errores/pantalla-de-error";

/** Fallas dentro del panel: el menú sigue a la vista y se puede ir a otra sección. */
export default function Error({ error, unstable_retry }: { error: Error & { digest?: string }; unstable_retry: () => void }) {
  return <PantallaDeError error={error} reintentar={unstable_retry} alcance="PAGINA" />;
}
