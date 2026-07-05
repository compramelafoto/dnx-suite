/**
 * Clases compartidas del Design System para controles nativos.
 * Usar en `<textarea>` / `<select>` cuando no convenga el componente React.
 */

export const dsInputClassName =
  "ds-form-control ds-input block w-full max-w-full min-w-0 rounded-2xl border border-[#111827]/10 bg-white px-4 py-3 text-base text-[#111827] placeholder:text-[#6b7280] focus:outline-none focus:ring-2 focus:ring-[#c27b3d] focus:border-transparent transition-all duration-200";

export const dsSelectClassName =
  "ds-form-control ds-select block w-full max-w-full rounded-2xl border border-[#111827]/10 bg-white px-4 py-3 text-base text-[#111827] focus:border-transparent focus:outline-none focus:ring-2 focus:ring-[#c27b3d] transition-all duration-200";

export const dsTextareaClassName =
  "ds-form-control ds-textarea block w-full max-w-full min-w-0 resize-y rounded-2xl border border-[#111827]/10 bg-white px-4 py-3 text-base text-[#111827] placeholder:text-[#6b7280] focus:border-transparent focus:outline-none focus:ring-2 focus:ring-[#c27b3d] transition-all duration-200";

/** Chat / hilos — altura mínima de una línea, mantiene ancho DS. */
export const dsTextareaCompactClassName =
  "ds-form-control ds-textarea ds-textarea-compact block w-full max-w-full min-w-0 resize-y rounded-2xl border border-[#111827]/10 bg-white px-4 py-3 text-sm text-[#111827] placeholder:text-[#6b7280] focus:border-transparent focus:outline-none focus:ring-2 focus:ring-[#c27b3d] transition-all duration-200";
