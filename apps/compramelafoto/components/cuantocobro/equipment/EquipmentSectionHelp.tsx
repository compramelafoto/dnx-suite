"use client";

import { handleCuantoCobroDetailsToggle } from "@/lib/cuantocobro/scroll-section-into-view";

type Props = {
  summary: string;
  children: string;
};

/** Ayuda opcional colapsable — evita bloques de texto largos antes del formulario. */
export default function EquipmentSectionHelp({ summary, children }: Props) {
  return (
    <details className="cc-equipment-help" onToggle={handleCuantoCobroDetailsToggle}>
      <summary className="cc-equipment-help__summary">{summary}</summary>
      <p className="cc-equipment-help__body m-0 ds-readable-text">{children}</p>
    </details>
  );
}
