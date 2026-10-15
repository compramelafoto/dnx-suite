"use client";

/** Abre el diálogo de impresión del navegador, que también permite "Guardar como PDF". */
export function BotonImprimir() {
  return (
    <button type="button" onClick={() => window.print()} className="fo-btn fo-btn-secondary print:hidden">
      Imprimir o guardar PDF
    </button>
  );
}
