import { PageHeader } from "@/components/page-header";
import { PestanasEnVivo } from "@/components/en-vivo/pestanas";
import { requireLive } from "@/lib/en-vivo/acceso";
import { readLiveConfig } from "@/lib/en-vivo/config";
import { AVISO_NO_HABILITADA } from "@/lib/en-vivo/constantes";

/**
 * Transmisión en vivo: el vivo de ahora, las grabaciones y la configuración del canal.
 * Módulo `live` encendido y dueño o admin (`requireLive`).
 */
export default async function EnVivoLayout({ children }: { children: React.ReactNode }) {
  await requireLive();
  const config = readLiveConfig();
  return (
    <div className="space-y-8">
      <PageHeader
        title="Transmisión en vivo"
        description="Transmití desde OBS: queda grabado en la plataforma y, si es público, sale a la vez por YouTube, Instagram y TikTok."
      />
      <PestanasEnVivo />
      {!config.ok ? (
        <p className="fo-card p-4 text-sm text-[var(--fo-muted)]" role="status">
          {AVISO_NO_HABILITADA}
        </p>
      ) : null}
      {children}
    </div>
  );
}
