"use client";

import { EditorLaboratorio, type RenglonTicketLab } from "@/components/copias/editor-laboratorio";

/**
 * El «Pedido para laboratorio» a pantalla completa, sin salir del Mostrador (el ticket vive sólo en
 * esta pantalla). `data-mostrador-modal` apaga los atajos de teclado del Mostrador mientras está
 * abierto: si no, Esc vaciaría el ticket y los números cambiarían cantidades.
 */
export function DialogoLaboratorio({
  preparacionId,
  onListo,
  onCerrar,
}: {
  preparacionId: string;
  /** Los renglones del grupo, armados por el servidor desde lo guardado. */
  onListo: (renglones: RenglonTicketLab[]) => void;
  /** Cerrar sin «Listo»: el ticket queda como estaba (lo subido queda guardado para la próxima). */
  onCerrar: () => void;
}) {
  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Pedido para laboratorio"
      data-mostrador-modal
      className="fixed inset-0 z-50 overflow-y-auto bg-[var(--fo-bg)] p-4 sm:p-8"
    >
      <div className="mx-auto max-w-6xl space-y-4">
        <div className="flex items-center justify-between gap-2">
          <h2 className="text-lg font-semibold">Pedido para laboratorio</h2>
          <button type="button" className="fo-btn fo-btn-secondary" onClick={onCerrar}>
            Volver al ticket
          </button>
        </div>
        <EditorLaboratorio key={preparacionId} preparacionId={preparacionId} onListo={onListo} onCerrar={onCerrar} />
      </div>
    </div>
  );
}
