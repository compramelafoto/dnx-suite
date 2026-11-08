import { Download, FileWarning, MailCheck, MailOpen, Send } from "lucide-react";
import type { EstadoEnvio } from "@/lib/proyectos/estado-envio";

const ESTILO: Record<EstadoEnvio["tono"], string> = {
  peligro: "border-[var(--fo-danger-border)] bg-[var(--fo-danger-soft)] text-[var(--fo-danger)]",
  aviso: "border-[var(--fo-warning-border)] bg-[var(--fo-warning-soft)] text-[var(--fo-warning)]",
  info: "border-[var(--fo-border)] bg-[var(--fo-accent-soft)] text-[var(--fo-accent)]",
  exito: "border-[var(--fo-success-border)] bg-[var(--fo-success-soft)] text-[var(--fo-success)]",
};

const ICONO: Record<EstadoEnvio["clave"], typeof Send> = {
  FALTAN_ARCHIVOS: FileWarning,
  SALE_SOLO: Send,
  POR_ENVIAR: Send,
  ENVIADO: MailCheck,
  ABIERTO: MailOpen,
  DESCARGADO: Download,
};

/** En qué punto está el pedido con el proveedor: faltan archivos, enviado, abierto, descargado. */
export function EtiquetaEnvio({ envio, className = "" }: { envio: EstadoEnvio | null; className?: string }) {
  if (!envio) return null;
  const Icono = ICONO[envio.clave];
  return (
    <span className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs font-medium ${ESTILO[envio.tono]} ${className}`}>
      <Icono className="size-3.5 shrink-0" aria-hidden />
      {envio.texto}
    </span>
  );
}
