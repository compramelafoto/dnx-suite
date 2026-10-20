"use client";

import { EditorFotoCarnet } from "@/components/foto-carnet/editor-foto-carnet";
import type { ClienteBuscado } from "./mostrador-actions";

/**
 * El editor de foto carnet a pantalla completa, sin salir del Mostrador (el ticket vive sólo en
 * esta pantalla). `data-mostrador-modal` apaga los atajos de teclado del Mostrador mientras está
 * abierto: si no, Esc vaciaría el ticket y los números cambiarían cantidades.
 */
export function DialogoPreparar({
  preparacionId,
  cliente,
  produccion,
  permisos,
  onListo,
  onCerrar,
}: {
  preparacionId: string;
  cliente: ClienteBuscado | null;
  produccion: { salida: string; hoja: string };
  permisos: { puedeBuscarClientes: boolean; puedeAltaCliente: boolean };
  onListo: (r: { hojas: number; preparacionId: string }) => void;
  onCerrar: () => void;
}) {
  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Preparar foto carnet"
      data-mostrador-modal
      className="fixed inset-0 z-50 overflow-y-auto bg-[var(--fo-bg)] p-4 sm:p-8"
    >
      <div className="mx-auto max-w-5xl space-y-4">
        <div className="flex items-center justify-between gap-2">
          <h2 className="text-lg font-semibold">Preparar foto carnet</h2>
          <button type="button" className="fo-btn fo-btn-secondary" onClick={onCerrar}>
            Volver al ticket
          </button>
        </div>
        <EditorFotoCarnet
          key={preparacionId}
          {...permisos}
          modo={{ tipo: "mostrador", preparacionId, clienteInicial: cliente, produccion, onListo, onCancelar: onCerrar }}
        />
      </div>
    </div>
  );
}
