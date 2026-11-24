import { esperaDe, textoDeEspera } from "@/lib/bandeja/espera";

const CLASE = {
  normal: "border-[var(--fo-border)] bg-[var(--fo-surface-hover)] text-[var(--fo-muted)]",
  atencion: "border-[var(--fo-warning-border)] bg-[var(--fo-warning-soft)] text-[var(--fo-warning)]",
  urgente: "border-[var(--fo-danger-border)] bg-[var(--fo-danger-soft)] text-[var(--fo-danger)]",
} as const;

/** «espera hace 12 min»: gris hasta 15 min, ámbar hasta 60 y rojo después. Nada si no espera. */
export function ChipEspera({ chat, ahora }: { chat: { estado: string; atiendeElBot: boolean; ultimoEntranteEn: Date | null; ultimoMensajeEn: Date }; ahora: Date }) {
  const e = esperaDe(chat, ahora);
  if (!e) return null;
  return <span className={`inline-block rounded-full border px-2 py-0.5 text-[11px] font-medium ${CLASE[e.nivel]}`}>⏱ {textoDeEspera(e.minutos)}</span>;
}
