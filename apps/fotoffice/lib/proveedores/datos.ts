/**
 * Proveedores de trabajos (laboratorios: La Isla, Román, Fotolag…). Módulo PURO: validación de lo
 * que llega del formulario.
 */

export const MAX_NOMBRE_PROVEEDOR = 80;
export const MAX_NOTAS_PROVEEDOR = 500;

export type DatosProveedor = {
  name: string;
  email: string | null;
  phone: string | null;
  notes: string | null;
};

function texto(v: unknown): string | null {
  if (typeof v !== "string") return null;
  const t = v.trim();
  return t === "" ? null : t;
}

export function validarProveedor(raw: { name?: unknown; email?: unknown; phone?: unknown; notes?: unknown }):
  | { ok: true; valor: DatosProveedor }
  | { ok: false; error: string } {
  const name = texto(raw.name);
  if (!name) return { ok: false, error: "Poné el nombre del proveedor." };
  if (name.length > MAX_NOMBRE_PROVEEDOR) return { ok: false, error: "El nombre es demasiado largo." };
  const email = texto(raw.email)?.toLowerCase() ?? null;
  if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return { ok: false, error: "Ese correo no se entiende." };
  const phone = texto(raw.phone);
  const notes = texto(raw.notes);
  if (notes && notes.length > MAX_NOTAS_PROVEEDOR) return { ok: false, error: "Las notas son demasiado largas." };
  return { ok: true, valor: { name, email, phone, notes } };
}

/** Los que tiene DNX hoy (Daniel, 18/10/2026). Se cargan una vez; después se editan a mano. */
export const PROVEEDORES_INICIALES_DNX = ["La Isla", "Román", "Estudio del Bajo", "Fotolag"] as const;
