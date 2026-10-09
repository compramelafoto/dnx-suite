import { leerConexion } from "@/lib/bandeja/conexion";
import { requireBandeja } from "@/lib/bandeja/pagina";

/** Guarda de toda la sección: módulo `whatsapp-inbox` encendido y "Ver". Cada pantalla la vuelve a pedir. */
export default async function BandejaLayout({ children }: { children: React.ReactNode }) {
  const { ctx } = await requireBandeja();
  const conexion = await leerConexion(ctx.workspaceId);
  return (
    <div className="space-y-4">
      {conexion.modo === "SIMULADO" ? (
        <p
          role="status"
          className="rounded-[var(--fo-radius-sm)] border border-[var(--fo-warning-border)] bg-[var(--fo-warning-soft)] px-4 py-2 text-sm font-medium text-[var(--fo-warning)]"
        >
          Modo de prueba: los mensajes no salen a WhatsApp.
        </p>
      ) : null}
      {children}
    </div>
  );
}
