"use client";

import CuantoCobroIconButton from "@/components/cuantocobro/CuantoCobroIconButton";
import { MoreVertical } from "lucide-react";
import { useEffect, useId, useRef, useState } from "react";
import type { LucideIcon } from "lucide-react";

export type PresupuestoMoreMenuItem = {
  id: string;
  label: string;
  icon: LucideIcon;
  onClick: () => void;
  disabled?: boolean;
  danger?: boolean;
};

type Props = {
  items: PresupuestoMoreMenuItem[];
  accentColor?: string;
  disabled?: boolean;
};

export default function PresupuestoMoreMenu({ items, accentColor, disabled = false }: Props) {
  const [open, setOpen] = useState(false);
  const menuId = useId();
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;

    function handlePointer(event: MouseEvent) {
      if (!rootRef.current?.contains(event.target as Node)) {
        setOpen(false);
      }
    }

    function handleEscape(event: KeyboardEvent) {
      if (event.key === "Escape") setOpen(false);
    }

    document.addEventListener("mousedown", handlePointer);
    document.addEventListener("keydown", handleEscape);
    return () => {
      document.removeEventListener("mousedown", handlePointer);
      document.removeEventListener("keydown", handleEscape);
    };
  }, [open]);

  if (items.length === 0) return null;

  return (
    <div className="cc-presupuesto-more-menu" ref={rootRef}>
      <CuantoCobroIconButton
        icon={MoreVertical}
        label="Más opciones"
        title="Más opciones"
        variant="ghost"
        accentColor={accentColor}
        disabled={disabled}
        aria-expanded={open}
        aria-controls={menuId}
        onClick={() => setOpen((value) => !value)}
      />

      {open ? (
        <div id={menuId} className="cc-presupuesto-more-menu__panel" role="menu">
          {items.map((item) => {
            const Icon = item.icon;
            return (
              <button
                key={item.id}
                type="button"
                role="menuitem"
                className={`cc-presupuesto-more-menu__item${item.danger ? " cc-presupuesto-more-menu__item--danger" : ""}`}
                disabled={item.disabled}
                onClick={() => {
                  setOpen(false);
                  item.onClick();
                }}
              >
                <Icon className="cc-presupuesto-more-menu__item-icon" aria-hidden />
                <span>{item.label}</span>
              </button>
            );
          })}
        </div>
      ) : null}
    </div>
  );
}
