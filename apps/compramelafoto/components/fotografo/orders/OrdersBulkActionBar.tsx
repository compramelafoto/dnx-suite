"use client";

import { cn } from "@/lib/utils";
import {
  IconCheck,
  IconClear,
  IconDownload,
  IconWhatsApp,
} from "./orders-ui-primitives";

type BulkActionItem = {
  id: string;
  label: string;
  shortLabel?: string;
  icon: React.ReactNode;
  onClick?: () => void;
  disabled?: boolean;
  disabledHint?: string;
  loading?: boolean;
};

type OrdersBulkActionBarProps = {
  selectedCount: number;
  onClear: () => void;
  actions: BulkActionItem[];
};

function IconExport({ className }: { className?: string }) {
  return (
    <svg className={className} width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M12 16V4m0 0l4 4m-4-4l-4 4M4 20h16"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function IconStatus({ className }: { className?: string }) {
  return (
    <svg className={className} width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M4 7h16M4 12h10M4 17h6"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
      />
    </svg>
  );
}

export function buildDefaultBulkActions(input: {
  canDownload: boolean;
  canExport: boolean;
  canMarkDelivered: boolean;
  canWhatsApp: boolean;
  onDownload: () => void;
  onExport: () => void;
  onMarkDelivered: () => void;
  onWhatsApp: () => void;
  loading?: Partial<Record<"download" | "export" | "delivered", boolean>>;
}): BulkActionItem[] {
  return [
    {
      id: "download",
      label: "Descargar",
      icon: <IconDownload className="!w-4 !h-4" />,
      onClick: input.onDownload,
      disabled: !input.canDownload,
      disabledHint: input.canDownload ? undefined : "Ningún pedido seleccionado tiene descarga disponible",
      loading: input.loading?.download,
    },
    {
      id: "export",
      label: "Exportar",
      icon: <IconExport className="shrink-0" />,
      onClick: input.onExport,
      disabled: !input.canExport,
      disabledHint: input.canExport ? undefined : "Ningún pedido seleccionado tiene exportación",
      loading: input.loading?.export,
    },
    {
      id: "delivered",
      label: "Marcar entregados",
      shortLabel: "Entregados",
      icon: <IconCheck className="!w-4 !h-4" />,
      onClick: input.onMarkDelivered,
      disabled: !input.canMarkDelivered,
      disabledHint: input.canMarkDelivered
        ? undefined
        : "Solo pedidos de impresión pagados pendientes de entrega",
      loading: input.loading?.delivered,
    },
    {
      id: "whatsapp",
      label: "WhatsApp",
      icon: <IconWhatsApp className="!w-4 !h-4" />,
      onClick: input.onWhatsApp,
      disabled: !input.canWhatsApp,
      disabledHint: input.canWhatsApp
        ? undefined
        : "Seleccioná un solo pedido con teléfono disponible",
    },
    {
      id: "status",
      label: "Cambiar estado",
      shortLabel: "Estado",
      icon: <IconStatus className="shrink-0" />,
      disabled: true,
      disabledHint: "Próximamente — acción masiva de estado",
    },
  ];
}

export default function OrdersBulkActionBar({
  selectedCount,
  onClear,
  actions,
}: OrdersBulkActionBarProps) {
  if (selectedCount === 0) return null;

  return (
    <div
      className="fixed inset-x-0 bottom-0 z-40 px-3 pb-3 sm:px-4 sm:pb-4 pointer-events-none"
      role="region"
      aria-label="Acciones masivas de pedidos"
    >
      <div
        className={cn(
          "pointer-events-auto mx-auto flex w-full max-w-5xl flex-col gap-2",
          "rounded-xl border border-gray-200/70 bg-white/95 p-2.5",
          "sm:flex-row sm:items-center sm:gap-2.5 sm:p-3"
        )}
      >
        <div className="flex min-w-0 items-center justify-between gap-3 sm:justify-start sm:shrink-0">
          <p className="text-xs font-semibold text-gray-900 tabular-nums whitespace-nowrap">
            {selectedCount} seleccionado{selectedCount === 1 ? "" : "s"}
          </p>
          <button
            type="button"
            onClick={onClear}
            className="inline-flex items-center gap-1 rounded-lg px-2 py-1 text-xs font-medium text-gray-600 hover:bg-gray-100 hover:text-gray-900 transition-colors sm:hidden"
          >
            <IconClear className="!w-3.5 !h-3.5" />
            Limpiar
          </button>
        </div>

        <div className="min-w-0 flex-1 overflow-x-auto [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          <div className="flex w-max items-center gap-1.5 sm:gap-2">
            {actions.map((action) => (
              <button
                key={action.id}
                type="button"
                title={action.disabled ? action.disabledHint : action.label}
                aria-label={action.label}
                disabled={action.disabled || action.loading}
                onClick={action.onClick}
                className={cn(
                  "inline-flex shrink-0 items-center gap-1 rounded-lg border px-2 py-1.5 text-[11px] font-medium transition-colors",
                  "disabled:cursor-not-allowed disabled:opacity-45",
                  action.disabled
                    ? "border-gray-100 bg-gray-50 text-gray-400"
                    : "border-gray-100 bg-white text-gray-700 hover:border-gray-200 hover:bg-gray-50"
                )}
              >
                {action.loading ? (
                  <span className="inline-flex h-4 w-4 items-center justify-center text-[10px]">…</span>
                ) : (
                  action.icon
                )}
                <span className="whitespace-nowrap hidden sm:inline">
                  {action.shortLabel ?? action.label}
                </span>
              </button>
            ))}
          </div>
        </div>

        <button
          type="button"
          onClick={onClear}
          title="Limpiar selección"
          aria-label="Limpiar selección"
          className="hidden sm:inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-gray-100 bg-white text-gray-500 hover:bg-gray-50 hover:text-gray-700 transition-colors"
        >
          <IconClear />
        </button>
      </div>
    </div>
  );
}
