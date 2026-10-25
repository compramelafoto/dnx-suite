"use client";

import { EditorFotoCarnet } from "@/components/foto-carnet/editor-foto-carnet";
import { EditorCopias } from "@/components/copias/editor-copias";
import { cantidadParaElTicket } from "@/lib/impresion/lote";
import { estadoCopiasAction } from "./impresion/actions";
import type { ClienteBuscado } from "./mostrador-actions";

/**
 * Al cerrar el editor de copias sin "Listo": el total de copias según lo guardado en el servidor,
 * si la preparación quedó completa (cada foto con su hoja); null si quedó sin terminar o no se pudo leer.
 */
export async function copiasTerminadas(preparacionId: string): Promise<number | null> {
  try {
    const e = await estadoCopiasAction(preparacionId);
    if (!e) return null;
    const r = cantidadParaElTicket(e.fotos);
    return r.ok ? r.cantidad : null;
  } catch {
    return null;
  }
}

/**
 * El editor de la línea (foto carnet o copias) a pantalla completa, sin salir del Mostrador (el
 * ticket vive sólo en esta pantalla). `data-mostrador-modal` apaga los atajos de teclado del
 * Mostrador mientras está abierto: si no, Esc vaciaría el ticket y los números cambiarían cantidades.
 */
export function DialogoPreparar({
  preparacionId,
  tipoPieza,
  cliente,
  produccion,
  permisos,
  onListo,
  onCerrar,
}: {
  preparacionId: string;
  tipoPieza: "CARNET" | "COPIA";
  cliente: ClienteBuscado | null;
  produccion: { salida: string; hoja: string; digital: boolean };
  permisos: { puedeBuscarClientes: boolean; puedeAltaCliente: boolean };
  /** `cantidad`: lo que pasa a la línea del ticket (planchas en carnet, total de copias en copias). */
  onListo: (r: { cantidad: number; preparacionId: string }) => void;
  /** Cerrar sin "Listo" ("Volver al ticket"). En copias, quien abrió vuelve a leer el servidor (`copiasTerminadas`). */
  onCerrar: () => void;
}) {
  const copias = tipoPieza === "COPIA";
  const titulo = copias ? `Preparar copias ${produccion.hoja}`.trim() : produccion.digital ? "Preparar foto carnet digital" : "Preparar foto carnet";
  return (
    <div role="dialog" aria-modal="true" aria-label={titulo} data-mostrador-modal className="fixed inset-0 z-50 overflow-y-auto bg-[var(--fo-bg)] p-4 sm:p-8">
      <div className={`mx-auto space-y-4 ${copias ? "max-w-6xl" : "max-w-5xl"}`}>
        <div className="flex items-center justify-between gap-2">
          <h2 className="text-lg font-semibold">{titulo}</h2>
          <button type="button" className="fo-btn fo-btn-secondary" onClick={onCerrar}>
            Volver al ticket
          </button>
        </div>
        {copias ? (
          <EditorCopias key={preparacionId} preparacionId={preparacionId} onListo={({ cantidad }) => onListo({ cantidad, preparacionId })} />
        ) : (
          <EditorFotoCarnet
            key={preparacionId}
            {...permisos}
            modo={{
              tipo: "mostrador",
              preparacionId,
              clienteInicial: cliente,
              produccion,
              onListo: ({ hojas }) => onListo({ cantidad: hojas, preparacionId }),
              onCancelar: onCerrar,
            }}
          />
        )}
      </div>
    </div>
  );
}
