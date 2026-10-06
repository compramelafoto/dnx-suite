"use client";

/** Abre el diálogo de impresión del navegador; ahí se elige "Guardar como PDF". */
export function PrintButton({ label = "Descargar PDF" }: { label?: string }) {
  return (
    <button type="button" className="fo-btn fo-btn-primary text-sm print:hidden" onClick={() => window.print()}>
      {label}
    </button>
  );
}
