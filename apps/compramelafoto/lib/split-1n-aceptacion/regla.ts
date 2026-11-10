import type { EstadoConsentimiento } from "../split-1n-consentimiento/servicio";
import type { AceptacionConfig } from "./config";

/** Quienes cobran una parte de una venta y por eso tienen que aceptar. */
export const ROLES_ACEPTACION = ["PHOTOGRAPHER", "LAB_PHOTOGRAPHER", "ORGANIZER", "SCHOOL_ORGANIZER"] as const;

export type DecisionAceptacion =
  | { mostrar: false }
  | {
      mostrar: true;
      /** Pasada la fecha límite: sin botón «Ahora no». */
      obligatorio: boolean;
      limite: string;
      faltaTerminos: boolean;
      faltaMercadoPago: boolean;
    };

/**
 * ¿Hay que mostrarle el cartel del cobro dividido a quien entra al panel? Tiene que aceptar el
 * anexo de los términos y autorizar el cobro dividido en Mercado Pago. Ante la duda (estado de
 * Mercado Pago desconocido), no se muestra: un problema nuestro no puede dejar a nadie afuera.
 */
export function decidirAceptacion(input: {
  config: AceptacionConfig;
  ahora: Date;
  rol: string;
  terminosAceptados: boolean;
  /** null: no se pudo consultar. */
  estadoMp: EstadoConsentimiento | null;
}): DecisionAceptacion {
  const { config } = input;
  if (!config.enabled || !config.limite) return { mostrar: false };
  if (!(ROLES_ACEPTACION as readonly string[]).includes(input.rol)) return { mostrar: false };
  if (input.estadoMp == null) return { mostrar: false };
  const faltaTerminos = !input.terminosAceptados;
  const faltaMercadoPago = input.estadoMp !== "ACTIVE";
  if (!faltaTerminos && !faltaMercadoPago) return { mostrar: false };
  return {
    mostrar: true,
    obligatorio: input.ahora.getTime() >= config.limite.getTime(),
    limite: config.limite.toISOString(),
    faltaTerminos,
    faltaMercadoPago,
  };
}

const EXENTAS = ["/fotografo/soporte", "/organizador/soporte"];

/** Páginas que el cartel nunca tapa: la salida a soporte. */
export function rutaExenta(pathname: string | null): boolean {
  if (!pathname) return false;
  return EXENTAS.some((r) => pathname === r || pathname.startsWith(`${r}/`));
}
