"use client";

type OrdersDateRangeBarProps = {
  desde: string;
  hasta: string;
  onDesdeChange: (value: string) => void;
  onHastaChange: (value: string) => void;
  onClear: () => void;
};

const inputClass =
  "rounded-md border border-gray-100 bg-gray-50/80 px-2 py-1.5 text-sm text-gray-900 focus:border-[#c27b3d] focus:bg-white focus:outline-none focus:ring-1 focus:ring-[#c27b3d]/20";

/** Filtro por fecha del pedido (Desde / Hasta, ambos incluidos). Vacío = todos los pedidos. */
export default function OrdersDateRangeBar({
  desde,
  hasta,
  onDesdeChange,
  onHastaChange,
  onClear,
}: OrdersDateRangeBarProps) {
  const active = Boolean(desde || hasta);
  return (
    <div className="flex flex-wrap items-center gap-2 w-full min-w-0 text-sm text-gray-600">
      <label className="flex items-center gap-1.5">
        <span>Desde</span>
        <input
          type="date"
          value={desde}
          max={hasta || undefined}
          onChange={(e) => onDesdeChange(e.target.value)}
          className={inputClass}
          aria-label="Pedidos desde la fecha"
        />
      </label>
      <label className="flex items-center gap-1.5">
        <span>Hasta</span>
        <input
          type="date"
          value={hasta}
          min={desde || undefined}
          onChange={(e) => onHastaChange(e.target.value)}
          className={inputClass}
          aria-label="Pedidos hasta la fecha"
        />
      </label>
      {active ? (
        <button
          type="button"
          onClick={onClear}
          className="text-xs font-semibold text-[#c27b3d] underline underline-offset-2 hover:text-[#a5652f]"
        >
          Ver todas las fechas
        </button>
      ) : (
        <span className="text-xs text-gray-400">Mostrando pedidos de todas las fechas</span>
      )}
    </div>
  );
}
