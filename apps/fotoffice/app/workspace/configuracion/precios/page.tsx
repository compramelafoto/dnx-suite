import { INITIAL_CUANTO_COBRO_PROFILE } from "@repo/cuanto-cobro-core";
import { PageHeader } from "@/components/page-header";
import { requireActiveWorkspaceRole } from "@/lib/access/active-context";
import { puede } from "@/lib/access/policy";
import { etiquetaDeUsuario } from "@/lib/listado/acceso";
import { leerPerfilPrecios } from "@/lib/precios/perfil";
import { botEnPanel } from "@/lib/dnx-bot/panel";
import { PreguntaleAlBot } from "@/components/dnx-bot/preguntale-al-bot";
import { PerfilForm } from "./perfil-form";

export const dynamic = "force-dynamic";

/**
 * Configuración → Precios: el perfil de ¿Cuánto Cobro? del workspace (costos, horas y valor de la
 * hora). Permiso: `configurar`, antes de cualquier lectura.
 */
export default async function ConfiguracionPreciosPage() {
  const { user, workspace, role } = await requireActiveWorkspaceRole();

  if (!puede(role, "configurar")) {
    return (
      <div className="max-w-xl space-y-6">
        <PageHeader title="Precios" />
        <p className="text-sm text-[var(--fo-muted)]">Sólo el dueño o un administrador pueden configurar los precios.</p>
      </div>
    );
  }

  const [guardado, bot] = await Promise.all([
    leerPerfilPrecios({
      workspaceId: workspace.id,
      userId: user.id,
      userLabel: etiquetaDeUsuario(user),
      role,
    }),
    // DNX Bot (etapa 1): el botón sólo aparece si el bot está encendido para este workspace.
    botEnPanel(),
  ]);

  return (
    <div className="max-w-5xl space-y-6">
      <PageHeader
        title="Precios"
        description="Tus costos, tus horas y tu forma de trabajar. Con esto ¿Cuánto Cobro? calcula tus presupuestos."
      />
      {guardado?.source === "clf-import" ? (
        <p role="status" className="fo-card p-4 text-sm text-[var(--fo-muted)]">
          Importado de ¿Cuánto Cobro? de CompraMeLaFoto.
        </p>
      ) : null}
      {guardado?.source === "dnx-bot" ? (
        <p role="status" className="fo-card p-4 text-sm text-[var(--fo-muted)]">
          Armado con DNX Bot.
        </p>
      ) : null}
      {bot ? (
        <div className="fo-card flex flex-wrap items-center justify-between gap-3 p-4">
          <div className="space-y-1">
            <p className="text-sm font-medium text-[var(--fo-text)]">¿Preferís contarlo con tus palabras?</p>
            <p className="text-xs text-[var(--fo-muted)]">
              DNX Bot te pregunta de a una cosa y te muestra tu valor hora. No guarda nada hasta que confirmes. Lo que le
              cuentes queda en la conversación y lo procesa Anthropic.
            </p>
          </div>
          <PreguntaleAlBot
            etiqueta="Armalo conversando"
            mensaje="Quiero armar mi perfil de precios conversando."
            contexto={{ pantalla: "precios" }}
          />
        </div>
      ) : null}
      <PerfilForm inicial={guardado?.perfil ?? INITIAL_CUANTO_COBRO_PROFILE} />
    </div>
  );
}
