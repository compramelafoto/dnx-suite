import type { EstadoConsentimiento } from "../split-1n-consentimiento/servicio";
import type { AceptacionConfig } from "./config";

/** Quienes cobran una parte de una venta y por eso tienen que aceptar. */
/** (Los álbumes escolares no entran al cobro dividido: SCHOOL_ORGANIZER no lo necesita.) */
export const ROLES_ACEPTACION = ["PHOTOGRAPHER", "LAB_PHOTOGRAPHER", "ORGANIZER"] as const;

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
  /** null: no se pudo leer el estado. */
  estadoMp: EstadoConsentimiento | null;
  /** false: Mercado Pago no respondió; el cartel se puede posponer aunque haya vencido el plazo. */
  mpRespondio: boolean;
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
    obligatorio: input.mpRespondio && input.ahora.getTime() >= config.limite.getTime(),
    limite: config.limite.toISOString(),
    faltaTerminos,
    faltaMercadoPago,
  };
}

const EXENTAS = ["/fotografo/soporte", "/organizador/soporte", "/fotografo/login", "/fotografo/registro"];

/** Páginas que el cartel nunca tapa: la salida a soporte y la de entrar con otra cuenta. */
export function rutaExenta(pathname: string | null): boolean {
  if (!pathname) return false;
  return EXENTAS.some((r) => pathname === r || pathname.startsWith(`${r}/`));
}
