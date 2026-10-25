"use client";

import "./globals.css";
import { PantallaDeError } from "@/components/errores/pantalla-de-error";

/** Fallas del armazón entero (el layout raíz): reemplaza la página completa, con su propio html. */
export default function GlobalError({ error, unstable_retry }: { error: Error & { digest?: string }; unstable_retry: () => void }) {
  return (
    <html lang="es" data-theme="light" className="h-full antialiased bg-[var(--fo-bg)]">
      <body className="min-h-full flex flex-col bg-[var(--fo-bg)] text-[var(--fo-text)]">
        <title>Fotoffice — DNX Suite</title>
        <PantallaDeError error={error} reintentar={unstable_retry} alcance="GLOBAL" />
      </body>
    </html>
  );
}
