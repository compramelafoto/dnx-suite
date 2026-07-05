"use client";

import { IconClear } from "./orders-ui-primitives";

type OrdersSearchBarProps = {
  q: string;
  onSearchChange: (value: string) => void;
  onClear: () => void;
  hasActiveSearch: boolean;
};

export default function OrdersSearchBar({
  q,
  onSearchChange,
  onClear,
  hasActiveSearch,
}: OrdersSearchBarProps) {
  return (
    <div className="ds-action-bar flex items-center gap-2 w-full min-w-0">
      <div className="relative min-w-0 flex-1 lg:max-w-xl">
        <span className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden>
            <path
              d="M21 21l-4.35-4.35M11 18a7 7 0 100-14 7 7 0 000 14z"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
            />
          </svg>
        </span>
        <input
          value={q}
          onChange={(e) => onSearchChange(e.target.value)}
          placeholder="Buscar por cliente, email, WhatsApp o # pedido…"
          className="w-full min-w-[140px] rounded-md border border-gray-100 bg-gray-50/80 py-1.5 pl-8 pr-3 text-sm text-gray-900 placeholder:text-gray-400 focus:border-[#c27b3d] focus:bg-white focus:outline-none focus:ring-1 focus:ring-[#c27b3d]/20"
        />
      </div>

      {hasActiveSearch ? (
        <button
          type="button"
          onClick={onClear}
          title="Limpiar búsqueda"
          aria-label="Limpiar búsqueda"
          className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-gray-200 bg-white text-gray-500 hover:bg-gray-50 hover:text-gray-800 transition-colors"
        >
          <IconClear />
        </button>
      ) : null}
    </div>
  );
}
