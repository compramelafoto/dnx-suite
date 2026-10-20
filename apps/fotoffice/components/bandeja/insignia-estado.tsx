import type { EstadoDelChat } from "@/lib/bandeja/constantes";

const CLASE: Record<EstadoDelChat, string> = {
  BOT: "border-[var(--fo-accent-muted)] bg-[var(--fo-accent-soft)] text-[var(--fo-accent-hover)]",
  HUMANO: "border-[var(--fo-warning-border)] bg-[var(--fo-warning-soft)] text-[var(--fo-warning)]",
  RESUELTO: "border-[var(--fo-success-border)] bg-[var(--fo-success-soft)] text-[var(--fo-success)]",
};

/** Etiqueta del estado de un chat: Bot, una persona (con su nombre) o Resuelto. */
export function InsigniaEstado({
  estado,
  atiendeElBot,
  asignadoNombre,
}: {
  estado: EstadoDelChat;
  atiendeElBot: boolean;
  asignadoNombre: string | null;
}) {
  const visible: EstadoDelChat = estado === "RESUELTO" ? "RESUELTO" : atiendeElBot ? "BOT" : "HUMANO";
  const texto = visible === "BOT" ? "Bot" : visible === "RESUELTO" ? "Resuelto" : asignadoNombre ? `Atiende ${asignadoNombre}` : "Persona (sin asignar)";
  return (
    <span className={`inline-block max-w-full truncate rounded-full border px-2 py-0.5 text-xs font-medium ${CLASE[visible]}`}>{texto}</span>
  );
}
