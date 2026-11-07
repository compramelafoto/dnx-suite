/** Validación de los datos que el cliente escribe al reservar. Módulo PURO. */
import { MAX_MENSAJE, MENSAJES_TURNOS } from "./constantes";

export type DatosDeReserva = { nombre: string; correo: string; telefono: string; mensaje: string | null };

const CORREO = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function texto(v: unknown): string {
  return typeof v === "string" ? v.trim().replace(/\s+/g, " ") : "";
}

export function validarDatosDeReserva(v: Record<string, unknown>): { ok: true; datos: DatosDeReserva } | { ok: false; error: string } {
  const nombre = texto(v.nombre);
  if (nombre.length < 2 || nombre.length > 120) return { ok: false, error: MENSAJES_TURNOS.nombre };
  const correo = texto(v.correo).toLowerCase();
  if (!CORREO.test(correo) || correo.length > 200) return { ok: false, error: MENSAJES_TURNOS.correo };
  const telefono = texto(v.telefono);
  if (telefono.replace(/\D/g, "").length < 6 || telefono.length > 40) return { ok: false, error: MENSAJES_TURNOS.telefono };
  const crudo = typeof v.mensaje === "string" ? v.mensaje.trim() : "";
  if (crudo.length > MAX_MENSAJE) return { ok: false, error: MENSAJES_TURNOS.mensaje };
  return { ok: true, datos: { nombre, correo, telefono, mensaje: crudo || null } };
}

/** Separa "Ana María Pérez" en nombre y apellido para la ficha del cliente. */
export function partirNombre(nombre: string): { firstName: string; lastName: string | null } {
  const partes = nombre.trim().split(/\s+/);
  if (partes.length === 1) return { firstName: partes[0], lastName: null };
  return { firstName: partes.slice(0, -1).join(" "), lastName: partes[partes.length - 1] };
}
