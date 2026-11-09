import type { TecladoTelegram } from "@/lib/telegram/api";

/**
 * Los botones de Telegram del Vendedor. Módulo PURO.
 *
 * `callback_data` es "ve:<letra>:<id>" (un cuid entra holgado en los 64 bytes de Telegram). El
 * prefijo `ve:` lo distingue de los botones del Periodista (`pe:`).
 */

export type AccionVendedor = "APROBAR" | "CORREGIR" | "DESCARTAR" | "ENVIAR" | "YO";

const LETRA: Record<AccionVendedor, string> = { APROBAR: "a", CORREGIR: "c", DESCARTAR: "d", ENVIAR: "e", YO: "y" };
const ACCION: Record<string, AccionVendedor> = { a: "APROBAR", c: "CORREGIR", d: "DESCARTAR", e: "ENVIAR", y: "YO" };

export function datoDeBotonVendedor(accion: AccionVendedor, id: string): string {
  return `ve:${LETRA[accion]}:${id}`;
}

export function leerBotonVendedor(data: string): { accion: AccionVendedor; id: string } | null {
  const m = /^ve:([acdey]):([a-z0-9]{8,40})$/i.exec(data);
  if (!m) return null;
  const accion = ACCION[m[1]!.toLowerCase()];
  return accion ? { accion, id: m[2]! } : null;
}

/** Botones del modelo de un grupo: Aprobar / Corregir / Descartar. */
export function tecladoModelo(modeloId: string): TecladoTelegram {
  return {
    inline_keyboard: [
      [{ text: "✅ Aprobar", callback_data: datoDeBotonVendedor("APROBAR", modeloId) }],
      [
        { text: "✏️ Corregir", callback_data: datoDeBotonVendedor("CORREGIR", modeloId) },
        { text: "❌ Descartar", callback_data: datoDeBotonVendedor("DESCARTAR", modeloId) },
      ],
    ],
  };
}

/** Botones de una respuesta que espera a Daniel. Sin propuesta, sólo «Lo contesto yo». */
export function tecladoRespuesta(hiloId: string, o: { conPropuesta: boolean }): TecladoTelegram {
  const yo = { text: "🙋 Lo contesto yo", callback_data: datoDeBotonVendedor("YO", hiloId) };
  if (!o.conPropuesta) return { inline_keyboard: [[yo]] };
  return {
    inline_keyboard: [
      [{ text: "✅ Enviar", callback_data: datoDeBotonVendedor("ENVIAR", hiloId) }],
      [{ text: "✏️ Corregir", callback_data: datoDeBotonVendedor("CORREGIR", hiloId) }, yo],
    ],
  };
}
