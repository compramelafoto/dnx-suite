"use client";

import CuantoCobroIconButton from "@/components/cuantocobro/CuantoCobroIconButton";
import { Archive, Copy, FilePlus2 } from "lucide-react";
import type { CSSProperties } from "react";

type Props = {
  accentColor?: string;
  disabled?: boolean;
  archived?: boolean;
  onNewVersion?: () => void;
  onDuplicate?: () => void;
  onArchive?: () => void;
};

export default function PresupuestoSecondaryActions({
  accentColor,
  disabled = false,
  archived = false,
  onNewVersion,
  onDuplicate,
  onArchive,
}: Props) {
  const style = accentColor ? ({ "--cc-accent": accentColor } as CSSProperties) : undefined;

  return (
    <div className="cc-presupuesto-secondary-actions" style={style}>
      <p className="cc-presupuesto-secondary-actions__label m-0">Más acciones</p>
      <div className="cc-presupuesto-secondary-actions__row">
        <button
          type="button"
          className="cc-presupuesto-secondary-tile"
          disabled={disabled || archived}
          onClick={onNewVersion}
          title="Crear una nueva revisión conservando esta versión"
        >
          <FilePlus2 className="cc-presupuesto-secondary-tile__icon" aria-hidden />
          <span className="cc-presupuesto-secondary-tile__title">Nueva versión</span>
        </button>

        <button
          type="button"
          className="cc-presupuesto-secondary-tile"
          disabled={disabled}
          onClick={onDuplicate}
          title="Crear una copia como nuevo expediente"
        >
          <Copy className="cc-presupuesto-secondary-tile__icon" aria-hidden />
          <span className="cc-presupuesto-secondary-tile__title">Duplicar</span>
        </button>

        {!archived ? (
          <button
            type="button"
            className="cc-presupuesto-secondary-tile cc-presupuesto-secondary-tile--danger"
            disabled={disabled}
            onClick={onArchive}
            title="Mover a archivados"
          >
            <Archive className="cc-presupuesto-secondary-tile__icon" aria-hidden />
            <span className="cc-presupuesto-secondary-tile__title">Archivar</span>
          </button>
        ) : null}
      </div>
    </div>
  );
}
