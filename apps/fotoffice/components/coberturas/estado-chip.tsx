import {
  callStatusLabel,
  coverageStatusLabel,
  requestStatusLabel,
} from "@/lib/coverages/states";

/**
 * El estado de algo, leíble de un vistazo.
 *
 * La bandeja tiene sesenta y seis pedidos del histórico y uno vivo, y el estado se leía como un
 * renglón gris más, del mismo tamaño y del mismo color que la fecha y la localidad. Encontrar el
 * que importa entre sesenta y cinco cerrados era leerlos todos.
 *
 * Los tonos son cuatro y no uno por estado: **quieto** para lo que ya terminó y no pide nada,
 * **abierto** para lo que está en curso, **espera** para lo que está trabado esperando a alguien,
 * y **listo** para lo que salió bien. Un color por estado sería un semáforo de ocho luces que no
 * dice nada; estos cuatro contestan la única pregunta que se hace quien mira la lista: ¿esto me
 * está esperando a mí?
 */
export type TonoDeEstado = "quieto" | "abierto" | "espera" | "listo";

const TONOS: Record<TonoDeEstado, string> = {
  quieto: "border-[var(--fo-border)] bg-[var(--fo-surface-muted)] text-[var(--fo-muted)]",
  abierto: "border-[var(--fo-accent)]/35 bg-[var(--fo-accent-muted)] text-[var(--fo-accent)]",
  espera: "border-[var(--fo-warning-border)] bg-[var(--fo-warning-soft)] text-[var(--fo-warning)]",
  listo: "border-[var(--fo-success-border)] bg-[var(--fo-success-soft)] text-[var(--fo-success)]",
};

export function EstadoChip({
  tono,
  children,
}: {
  tono: TonoDeEstado;
  children: React.ReactNode;
}) {
  return (
    <span
      className={`inline-flex shrink-0 items-center rounded-full border px-2.5 py-0.5 text-xs font-medium ${TONOS[tono]}`}
    >
      {children}
    </span>
  );
}

const TONO_SOLICITUD: Record<string, TonoDeEstado> = {
  RECIBIDA: "abierto",
  EN_EVALUACION: "abierto",
  REQUIERE_INFO: "espera",
  APROBADA: "listo",
  RECHAZADA: "quieto",
  CANCELADA_SOLICITANTE: "quieto",
  CANCELADA_ORGANIZACION: "quieto",
  CERRADA: "quieto",
};

export function EstadoSolicitudChip({ status }: { status: string }) {
  return (
    <EstadoChip tono={TONO_SOLICITUD[status] ?? "quieto"}>{requestStatusLabel(status)}</EstadoChip>
  );
}

const TONO_COBERTURA: Record<string, TonoDeEstado> = {
  PLANIFICADA: "abierto",
  BUSCANDO_EQUIPO: "espera",
  EQUIPO_CONFIRMADO: "listo",
  REALIZADA: "listo",
  ENTREGADA: "listo",
  CERRADA: "quieto",
  // Quedarse sin equipo no es "terminó bien" ni "está en curso": es justo el momento en que
  // alguien tiene que hacer algo.
  SIN_EQUIPO: "espera",
  CANCELADA: "quieto",
};

export function EstadoCoberturaChip({ status }: { status: string }) {
  return (
    <EstadoChip tono={TONO_COBERTURA[status] ?? "quieto"}>{coverageStatusLabel(status)}</EstadoChip>
  );
}

const TONO_CONVOCATORIA: Record<string, TonoDeEstado> = {
  BORRADOR: "espera",
  PUBLICADA: "abierto",
  COMPLETA: "listo",
  CERRADA: "quieto",
  VENCIDA: "espera",
  CANCELADA: "quieto",
};

export function EstadoConvocatoriaChip({ status }: { status: string }) {
  return (
    <EstadoChip tono={TONO_CONVOCATORIA[status] ?? "quieto"}>{callStatusLabel(status)}</EstadoChip>
  );
}
