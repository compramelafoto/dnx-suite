import { switchToAdminAction, switchToPortalAction } from "@/app/actions/profile-choice";
import type { RoleSelector as RoleSelectorData } from "@/lib/portal/profiles";

/**
 * El selector de rol, arriba del menú lateral (como el de FotoRank).
 *
 * Sólo aparece si la persona tiene los dos perfiles —socio y equipo— en la institución que
 * está viendo; eso lo decide `roleSelector`, acá sólo se dibuja. El activo sale de la pantalla
 * en la que está (portal → socio; panel → Comisión/Administración), así que no hay estado que
 * se pueda desfasar. El otro botón usa las acciones de cambio, que rearman los perfiles en el
 * servidor: el `workspaceId` oculto no se cree.
 */
export function RoleSelector({
  selector,
  className = "",
}: {
  selector: RoleSelectorData | null;
  className?: string;
}) {
  if (!selector) return null;

  return (
    <nav aria-label="Rol" className={className}>
      <p className="mb-2 text-[11px] font-medium uppercase tracking-[0.12em] text-[var(--fo-muted-soft)]">
        Rol
      </p>
      <div className="flex gap-1 rounded-[var(--fo-radius-sm)] border border-[var(--fo-border)] bg-[var(--fo-bg)] p-1">
        {selector.options.map((option) => {
          // Angosto (cajón de 288 px, panel del portal de 240 px): "Administración" o una palabra
          // larga del vocabulario parte en dos líneas en vez de cortarse o desbordar.
          const base =
            "flex min-h-11 w-full min-w-0 items-center justify-center rounded-[var(--fo-radius-sm)] px-2 py-1 text-center text-xs font-semibold leading-tight break-words transition-colors";
          if (option.active) {
            return (
              <span
                key={option.kind}
                aria-current="page"
                className={`${base} flex-1 bg-[var(--fo-accent-soft)] text-[var(--fo-accent-hover)]`}
              >
                {option.label}
              </span>
            );
          }
          return (
            <form
              key={option.kind}
              action={option.kind === "TEAM" ? switchToAdminAction : switchToPortalAction}
              className="flex min-w-0 flex-1"
            >
              <input type="hidden" name="workspaceId" value={selector.workspaceId} />
              <button
                type="submit"
                className={`${base} text-[var(--fo-muted)] hover:bg-[var(--fo-surface-hover)] hover:text-[var(--fo-text)]`}
              >
                {option.label}
              </button>
            </form>
          );
        })}
      </div>
    </nav>
  );
}
