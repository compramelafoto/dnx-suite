"use client";

import { PantallaDeError } from "@/components/errores/pantalla-de-error";

/** Fallas de cualquier pantalla fuera del panel (login, portal, sitio público). */
export default function Error({ error, unstable_retry }: { error: Error & { digest?: string }; unstable_retry: () => void }) {
  return <PantallaDeError error={error} reintentar={unstable_retry} alcance="PAGINA" />;
}
