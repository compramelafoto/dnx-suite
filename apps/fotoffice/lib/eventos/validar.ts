/** Validación a mano de lo que llega de los formularios del panel (sin zod, como el resto). */
import { esEstadoPago, type EstadoPago } from "./constants";

type Getter = (k: string) => string;

export function getterDe(fd: FormData): Getter {
  return (k) => {
    const v = fd.get(k);
    return typeof v === "string" ? v.trim() : "";
  };
}

function texto(v: string, max: number): string | null {
  const t = v.trim().slice(0, max);
  return t === "" ? null : t;
}

/** `aaaa-mm-dd` → mediodía de ese día en Argentina (no se corre de día con la zona horaria). */
export function fechaDeInput(v: string): Date | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(v)) return null;
  const d = new Date(`${v}T12:00:00-03:00`);
  return Number.isNaN(d.getTime()) ? null : d;
}

export type DatosEvento = {
  nombre: string;
  fechaInicio: Date | null;
  fechaFin: Date | null;
  lugar: string | null;
  cupo: number | null;
};

export function validarEvento(get: Getter): DatosEvento | null {
  const nombre = texto(get("nombre"), 120);
  if (!nombre) return null;
  const fechaInicio = fechaDeInput(get("fechaInicio"));
  let fechaFin = fechaDeInput(get("fechaFin"));
  if (fechaInicio && fechaFin && fechaFin < fechaInicio) fechaFin = fechaInicio;
  const cupoTxt = get("cupo");
  const cupo = /^\d{1,6}$/.test(cupoTxt) && Number(cupoTxt) > 0 ? Number(cupoTxt) : null;
  return { nombre, fechaInicio, fechaFin, lugar: texto(get("lugar"), 200), cupo };
}

export type DatosInscripto = {
  nombre: string;
  email: string | null;
  telefono: string | null;
  dni: string | null;
  tipo: string | null;
  estadoPago: EstadoPago;
  montoArs: string | null;
  notas: string | null;
};

export function validarInscripto(get: Getter): DatosInscripto | null {
  const nombre = texto(get("nombre"), 160);
  if (!nombre) return null;
  const emailTxt = texto(get("email"), 200);
  const email = emailTxt && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(emailTxt) ? emailTxt.toLowerCase() : null;
  if (emailTxt && !email) return null;
  const estado = get("estadoPago");
  const montoTxt = get("montoArs").replace(/\./g, "").replace(",", ".");
  const montoArs = /^\d{1,10}(\.\d{1,2})?$/.test(montoTxt) ? montoTxt : null;
  return {
    nombre,
    email,
    telefono: texto(get("telefono"), 40),
    dni: texto(get("dni").replace(/\D/g, ""), 12),
    tipo: texto(get("tipo"), 80),
    estadoPago: esEstadoPago(estado) && estado !== "ANULADO" ? estado : "PENDIENTE",
    montoArs,
    notas: texto(get("notas"), 1000),
  };
}
