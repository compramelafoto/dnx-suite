/**
 * Respuestas rápidas de la Bandeja (§6.1 del diseño 2026-11-24). Módulo PURO: validar, filtrar y
 * completar `{nombre}`. Lo usan el servidor, la caja de respuesta y la configuración.
 */

export type RespuestaRapida = { id: string; atajo: string; titulo: string; texto: string };
export type DatosRespuesta = { atajo: string; titulo: string; texto: string };

const ATAJO = /^[a-z0-9_-]{1,30}$/;

export function validarRespuesta(d: { atajo?: unknown; titulo?: unknown; texto?: unknown }): { ok: true; valor: DatosRespuesta } | { ok: false; error: string } {
  const atajo = typeof d.atajo === "string" ? d.atajo.trim().toLowerCase().replace(/^\//, "") : "";
  const titulo = typeof d.titulo === "string" ? d.titulo.trim() : "";
  const texto = typeof d.texto === "string" ? d.texto.trim() : "";
  if (!ATAJO.test(atajo)) return { ok: false, error: "El atajo va en minúsculas, sin espacios ni tildes, hasta 30 caracteres (ej. carnet)." };
  if (!titulo || titulo.length > 60) return { ok: false, error: "El título es obligatorio y puede tener hasta 60 caracteres." };
  if (!texto || texto.length > 4096) return { ok: false, error: "El texto es obligatorio y puede tener hasta 4096 caracteres." };
  return { ok: true, valor: { atajo, titulo, texto } };
}

/** Reemplaza `{nombre}` por el primer nombre del cliente. Sin nombre queda vacío (sin dejar ", " colgando). */
export function aplicarVariables(texto: string, datos: { nombre: string | null }): string {
  // Una ficha se muestra «Apellido, Nombre»: el nombre es lo que va después de la coma.
  const completo = datos.nombre?.includes(",") ? datos.nombre.split(",").slice(1).join(",") : datos.nombre;
  const primero = completo?.trim().split(/\s+/)[0]?.replace(/^@/, "") ?? "";
  if (primero) return texto.replaceAll("{nombre}", primero);
  return texto.replace(/\s*\{nombre\}/g, "");
}

export function filtrarRespuestas<T extends { atajo: string; titulo: string }>(lista: readonly T[], consulta: string): T[] {
  const q = consulta.trim().toLowerCase().replace(/^\//, "");
  if (!q) return [...lista];
  return lista.filter((r) => r.atajo.includes(q) || r.titulo.toLowerCase().includes(q));
}
