import type { EstadoMonotributo } from "@/lib/informes/monotributo";

const TEXTOS: Record<EstadoMonotributo, { texto: string; clase: string }> = {
  SIN_CONFIGURAR: { texto: "Sin configurar", clase: "border-[var(--fo-border)] bg-[var(--fo-surface-muted)] text-[var(--fo-muted)]" },
  VERDE: { texto: "En orden", clase: "border-[var(--fo-success-border)] bg-[var(--fo-success-soft)] text-[var(--fo-success)]" },
  AMARILLO: { texto: "Cerca del tope", clase: "border-[var(--fo-warning-border)] bg-[var(--fo-warning-soft)] text-[var(--fo-warning)]" },
  ROJO: { texto: "Tope alcanzado", clase: "border-[var(--fo-danger-border)] bg-[var(--fo-danger-soft)] text-[var(--fo-danger)]" },
};

/** Semáforo del monotributo: el color acompaña con texto (no depende sólo del color). */
export function Semaforo({ estado }: { estado: EstadoMonotributo }) {
  const t = TEXTOS[estado];
  return (
    <span className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold ${t.clase}`} data-estado={estado}>
      {t.texto}
    </span>
  );
}
