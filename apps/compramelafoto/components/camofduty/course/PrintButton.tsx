"use client";

/** Imprimir o guardar como PDF (el diálogo del navegador ofrece las dos cosas). */
export default function PrintButton() {
  return (
    <button type="button" className="cod-btn cod-btn--primary" onClick={() => window.print()}>
      Imprimir o guardar en PDF
    </button>
  );
}
