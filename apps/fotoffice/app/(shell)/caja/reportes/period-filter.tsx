import type { CashAccountRow } from "@/lib/cash/repository";
import { PERIOD_SHORTCUTS, type PeriodShortcut } from "@/lib/cash/period";

const ETIQUETA_SHORTCUT: Record<PeriodShortcut, string> = {
  "este-mes": "Este mes",
  "mes-pasado": "El mes pasado",
  "ultimos-30": "Últimos 30 días",
};

/**
 * El selector de período de Reportes. No lleva ninguna acción de servidor: los atajos son
 * links que escriben `shortcut` (y conservan la cuenta elegida) en la URL, y las fechas
 * libres son un formulario GET, igual que el filtro de `/caja/movimientos`. La pantalla lee
 * esos parámetros y decide el rango — este componente no calcula nada.
 */
export function PeriodFilter({
  accounts,
  accountId,
  from,
  to,
  activeShortcut,
}: {
  accounts: CashAccountRow[];
  accountId?: string;
  from: string;
  to: string;
  activeShortcut: PeriodShortcut | null;
}) {
  return (
    <div className="fo-card space-y-4 !p-4">
      <div className="flex flex-wrap gap-2">
        {PERIOD_SHORTCUTS.map((shortcut) => {
          const params = new URLSearchParams({ shortcut });
          if (accountId) params.set("accountId", accountId);
          const activo = activeShortcut === shortcut;
          return (
            <a
              key={shortcut}
              href={`/caja/reportes?${params.toString()}`}
              className={`fo-btn min-h-9 text-sm ${activo ? "fo-btn-primary" : "fo-btn-ghost"}`}
              aria-current={activo ? "true" : undefined}
            >
              {ETIQUETA_SHORTCUT[shortcut]}
            </a>
          );
        })}
      </div>

      <form method="GET" className="grid gap-4 sm:grid-cols-3 lg:grid-cols-4">
        <div className="fo-field-stack">
          <label className="fo-label" htmlFor="from">
            Desde
          </label>
          <input id="from" name="from" type="date" className="fo-input" defaultValue={from} required />
        </div>
        <div className="fo-field-stack">
          <label className="fo-label" htmlFor="to">
            Hasta
          </label>
          <input id="to" name="to" type="date" className="fo-input" defaultValue={to} required />
        </div>
        <div className="fo-field-stack">
          <label className="fo-label" htmlFor="accountId">
            Cuenta
          </label>
          <select id="accountId" name="accountId" className="fo-input" defaultValue={accountId ?? ""}>
            <option value="">Todas</option>
            {accounts.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </div>
        <div className="flex items-end">
          <button type="submit" className="fo-btn fo-btn-primary min-h-10 text-sm">
            Ver este rango
          </button>
        </div>
      </form>
    </div>
  );
}
