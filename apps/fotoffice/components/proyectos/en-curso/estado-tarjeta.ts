import { formatMinorArs } from "@/lib/membership/money";
import { etapaAnterior, etapaSiguiente, retenido, urgenciaDeEntrega, type EtapaVista, type Urgencia } from "@/lib/proyectos/en-curso-puro";
import type { TarjetaTrabajo } from "@/lib/proyectos/en-curso";

/**
 * Lo que la tarjeta del tablero y su ficha flotante calculan igual: en qué paso está, qué sigue y
 * qué acciones corresponden. Sin estado ni efectos: lo usan los dos componentes.
 */

export const ESTILO_URGENCIA: Record<Urgencia, string> = {
  VENCIDO: "bg-[var(--fo-danger-soft)] text-[var(--fo-danger)] font-semibold",
  HOY: "bg-amber-400/20 text-amber-800 font-semibold",
  PRONTO: "bg-amber-400/10 text-amber-800",
  OK: "bg-[var(--fo-surface-hover)] text-[var(--fo-text-secondary)]",
  SIN_FECHA: "bg-[var(--fo-surface-hover)] text-[var(--fo-muted)]",
};

export function fechaCorta(ymd: string): string {
  const [, m, d] = ymd.split("-");
  return `${d}/${m}`;
}

export function textoEntrega(entrega: string | null, u: Urgencia): string {
  if (!entrega) return "Sin fecha";
  if (u === "VENCIDO") return `Vencido ${fechaCorta(entrega)}`;
  if (u === "HOY") return "Hoy";
  return `Entrega ${fechaCorta(entrega)}`;
}

/** wa.me con el número argentino normalizado (10 dígitos → 549…). null si no se entiende. */
export function enlaceWhatsApp(telefono: string | null, texto: string): string | null {
  if (!telefono) return null;
  let d = telefono.replace(/\D/g, "");
  if (d.startsWith("0")) d = d.slice(1);
  if (d.length === 10) d = `549${d}`;
  else if (d.length === 12 && d.startsWith("54") && !d.startsWith("549")) d = `549${d.slice(2)}`;
  if (d.length < 11) return null;
  return `https://wa.me/${d}?text=${encodeURIComponent(texto)}`;
}

export type EstadoTarjeta = {
  /** Etapas en orden. */
  orden: EtapaVista[];
  /** Posición de la etapa actual; si está cerrado, `orden.length`. */
  indice: number;
  actual: EtapaVista | null;
  siguiente: EtapaVista | null;
  anterior: EtapaVista | null;
  urgencia: Urgencia;
  /** Saldo del pedido en centavos (0 si no debe o no hay pedido). */
  debe: number;
  /** Listo para retirar con saldo: no se puede entregar. */
  retiene: boolean;
  /** Tiene laboratorio y todavía no se le mandó. */
  porEnviar: boolean;
  /** Enlace de WhatsApp con el aviso de "listo para retirar" (sólo en esa columna). */
  whatsapp: string | null;
};

export function estadoDeTarjeta(t: TarjetaTrabajo, hoy: string, estudio: string): EstadoTarjeta {
  const orden = [...t.etapas].sort((a, b) => a.order - b.order);
  const indice = t.cerrado ? orden.length : Math.max(0, orden.findIndex((e) => e.id === t.etapaActualId));
  const actual = t.cerrado ? null : (orden[indice] ?? null);
  const debe = t.pedido && t.pedido.saldoMinor > 0 ? t.pedido.saldoMinor : 0;
  return {
    orden,
    indice,
    actual,
    siguiente: actual ? etapaSiguiente(orden, actual.id) : null,
    anterior: etapaAnterior(orden, t.etapaActualId),
    urgencia: t.cerrado ? "OK" : urgenciaDeEntrega(t.entrega, hoy),
    debe,
    retiene: retenido(t),
    porEnviar: (t.fase === "RECIBIDO" || t.fase === "EN_PROCESO") && t.proveedorId !== null && t.enviadoAt === null,
    whatsapp:
      t.fase === "LISTO"
        ? enlaceWhatsApp(
            t.telefono,
            `Hola ${t.cliente.split(" ")[0]}! Tu pedido de ${estudio} (${t.producto ?? t.nombre}) ya está listo para retirar.${
              debe > 0 ? ` Queda un saldo de ${formatMinorArs(debe)}.` : ""
            } ¡Te esperamos!`,
          )
        : null,
  };
}
