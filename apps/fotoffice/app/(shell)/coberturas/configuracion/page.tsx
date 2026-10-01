import { PageHeader } from "@/components/page-header";
import { requireCoveragesCoordinator } from "@/lib/coverages/access";
import { loadSettings } from "@/lib/coverages/repository";
import { SettingsForm } from "./settings-form";

export const dynamic = "force-dynamic";

export default async function ConfiguracionCoberturasPage() {
  const { workspace } = await requireCoveragesCoordinator();
  const settings = await loadSettings(workspace.id);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Cómo funciona el módulo acá"
        description="Las palabras, los plazos y quién decide. Son de esta organización, no del sistema."
      />
      <SettingsForm settings={settings} />
    </div>
  );
}
