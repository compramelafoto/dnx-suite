import { loadWebsiteCmsContext } from "@/lib/website/page-context";
import { WebsiteShell } from "@/components/website/website-shell";

/**
 * Etapa mínima: Home es la única página del sitio y siempre existe — todavía no se pueden crear
 * páginas internas (ver Parte 15 del pedido), así que no hay nada editable acá por ahora. La
 * estructura de `navJson` (`{ items: [{ id, label, type }] }`, ver `ensureWebsiteDraft`) ya está
 * preparada para agregar páginas nuevas más adelante sin migrar lo existente.
 */
export default async function WebsiteNavigationPage() {
  const { canEdit, status, draftUpdatedAtIso } = await loadWebsiteCmsContext();

  return (
    <WebsiteShell status={status} canEdit={canEdit} draftUpdatedAt={draftUpdatedAtIso}>
      <div className="fo-card space-y-4">
        <div>
          <h2 className="text-sm font-semibold text-[var(--fo-text)]">Páginas del sitio</h2>
          <p className="fo-helper mt-1">Todavía no se pueden crear páginas adicionales — por ahora tu sitio tiene una sola página.</p>
        </div>
        <div className="flex items-center justify-between rounded-xl border border-[var(--fo-border)] bg-[var(--fo-bg)] px-4 py-3">
          <div>
            <p className="text-sm font-medium text-[var(--fo-text)]">Home</p>
            <p className="text-xs text-[var(--fo-muted)]">Página principal · siempre visible</p>
          </div>
          <span className="text-xs text-[var(--fo-muted)] bg-[var(--fo-border-muted)] rounded-full px-2.5 py-1">Fija</span>
        </div>
        <button type="button" disabled className="fo-btn fo-btn-secondary text-sm opacity-50 cursor-not-allowed">
          + Agregar página (próximamente)
        </button>
      </div>
    </WebsiteShell>
  );
}
