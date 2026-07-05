"use client";

import { useRouter, usePathname, useSearchParams } from "next/navigation";

export const ORGANIZER_EVENT_EDIT_TAB_IDS = [
  "resumen",
  "datos",
  "convocatoria",
  "venta-digital",
  "comision",
  "carpetas",
  "avanzado",
] as const;

export type OrganizerEventEditTabId = (typeof ORGANIZER_EVENT_EDIT_TAB_IDS)[number];

/** Solapas con formulario oficial (PATCH evento): el botón guardar se muestra en estas vistas. */
export const ORGANIZER_EVENT_EDIT_FORM_TAB_IDS = new Set<OrganizerEventEditTabId>([
  "datos",
  "convocatoria",
  "venta-digital",
  "comision",
]);

export function organizerEventEditTabFromSearchParams(
  tab: string | null | undefined
): OrganizerEventEditTabId {
  // Solapa "albumes" oculta temporalmente: redirigir bookmarks antiguos a resumen.
  if (tab === "albumes") return "resumen";
  if (
    tab &&
    (ORGANIZER_EVENT_EDIT_TAB_IDS as readonly string[]).includes(tab)
  ) {
    return tab as OrganizerEventEditTabId;
  }
  return "resumen";
}

const TAB_LABELS: Record<OrganizerEventEditTabId, string> = {
  resumen: "Resumen",
  datos: "Datos",
  convocatoria: "Convocatoria",
  "venta-digital": "Venta digital",
  comision: "Comisión",
  carpetas: "Carpetas",
  avanzado: "Avanzado",
};

export function OrganizerEventEditTabBar({ active }: { active: OrganizerEventEditTabId }) {
  const router = useRouter();
  const pathname = usePathname();

  function go(tab: OrganizerEventEditTabId) {
    router.replace(`${pathname}?tab=${encodeURIComponent(tab)}`, { scroll: false });
  }

  return (
    <div className="rounded-2xl border border-[#111827]/10 bg-white px-3 py-2 sm:p-4 min-w-0 shadow-sm ds-organizer-panel">
      <p className="text-xs font-semibold text-[#64748b] uppercase tracking-wide mb-2 m-0 sr-only sm:not-sr-only sm:mb-3">
        Sección
      </p>
      <div className="sm:hidden min-w-0">
        <label htmlFor="org-event-edit-tab" className="block text-xs font-semibold text-gray-700 mb-1">
          Sección
        </label>
        <select
          id="org-event-edit-tab"
          className="block w-full min-w-0 rounded-xl border border-[#111827]/15 bg-[#fafafa] px-3 py-2.5 text-sm text-[#111827] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#c27b3d]"
          value={active}
          onChange={(e) => go(e.target.value as OrganizerEventEditTabId)}
        >
          {ORGANIZER_EVENT_EDIT_TAB_IDS.map((id) => (
            <option key={id} value={id}>
              {TAB_LABELS[id]}
            </option>
          ))}
        </select>
      </div>
      <nav
        aria-label="Secciones del evento"
        className="hidden sm:block min-w-0 ds-overflow-x-soft overflow-x-auto pb-px"
      >
        <ul role="tablist" className="flex flex-nowrap gap-1.5 m-0 p-0 list-none">
          {ORGANIZER_EVENT_EDIT_TAB_IDS.map((id) => {
            const isActive = active === id;
            return (
              <li key={id} role="presentation" className="shrink-0">
                <button
                  type="button"
                  role="tab"
                  aria-selected={isActive}
                  className={`px-3 py-2 rounded-xl text-sm font-semibold whitespace-nowrap transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-[#c27b3d] focus-visible:ring-offset-2 ${
                    isActive
                      ? "bg-[#c27b3d] text-white shadow-sm"
                      : "bg-[#f4f4f5] text-gray-700 hover:bg-amber-50/90"
                  }`}
                  onClick={() => go(id)}
                >
                  {TAB_LABELS[id]}
                </button>
              </li>
            );
          })}
        </ul>
      </nav>
    </div>
  );
}

/** Lee la solapa activa evitando importar helpers en servidor. */
export function useOrganizerEventEditTabId(): OrganizerEventEditTabId {
  const sp = useSearchParams();
  return organizerEventEditTabFromSearchParams(sp.get("tab"));
}
