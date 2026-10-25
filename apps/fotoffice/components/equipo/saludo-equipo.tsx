import { contextoPersonal } from "@/lib/equipo/acceso";
import { mensajeDelMomento } from "@/lib/equipo/mensajes-servidor";
import type { Momento } from "@/lib/equipo/mensajes";

/**
 * El saludo de Equipo al abrir o al cerrar la caja. Si el módulo está apagado, la persona no
 * tiene ficha activa o algo falla, no dibuja nada: nunca muestra un error.
 */
export async function SaludoEquipo({ momento }: { momento: Extract<Momento, "APERTURA" | "CIERRE"> }) {
  let texto: string | null = null;
  try {
    const ctx = await contextoPersonal();
    if (ctx) texto = (await mensajeDelMomento({ ...ctx, momento }))?.texto ?? null;
  } catch {
    texto = null;
  }
  if (!texto) return null;
  return (
    <p className="fo-card border-l-4 border-l-[var(--fo-accent)] p-4 text-base" role="status">
      {texto}
    </p>
  );
}
