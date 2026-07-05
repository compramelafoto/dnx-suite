"use client";

import { PARAM_RESET_TOOLTIP } from "@/components/simulator/CameraParamTimeline";
import type { ReactNode } from "react";

export interface CameraParamOptionRowProps {
  label?: string;
  variant?: "display";
  focused?: boolean;
  resettable?: boolean;
  onReset?: () => void;
  children: ReactNode;
}

/** Fila de opciones con botones (modo, visor, guías, etc.). */
export function CameraParamOptionRow({
  label,
  variant,
  focused = false,
  resettable = false,
  onReset,
  children,
}: CameraParamOptionRowProps) {
  const onDoubleClick = () => {
    if (resettable && onReset) onReset();
  };

  return (
    <div
      className={`cod-param-option${focused ? " cod-param-option--focused" : ""}${variant === "display" ? " cod-param-option--display" : ""}`}
      title={resettable ? PARAM_RESET_TOOLTIP : undefined}
      onDoubleClick={onDoubleClick}
    >
      {label ? <span className="cod-param-option__label">{label}</span> : null}
      <div className="cod-param-option__controls">{children}</div>
    </div>
  );
}

export interface CameraOptionBtnProps {
  active?: boolean;
  onClick: () => void;
  children: ReactNode;
  "aria-label"?: string;
  title?: string;
}

export function CameraOptionBtn({
  active = false,
  onClick,
  children,
  "aria-label": ariaLabel,
  title,
}: CameraOptionBtnProps) {
  return (
    <button
      type="button"
      className={`cod-option-btn${active ? " cod-option-btn--active" : ""}`}
      onClick={onClick}
      aria-pressed={active}
      aria-label={ariaLabel}
      title={title}
    >
      {children}
    </button>
  );
}

export function CameraOptionStepper({
  value,
  onDecrease,
  onIncrease,
  decreaseDisabled,
  increaseDisabled,
}: {
  value: string;
  onDecrease: () => void;
  onIncrease: () => void;
  decreaseDisabled?: boolean;
  increaseDisabled?: boolean;
}) {
  return (
    <div className="cod-option-stepper" role="group">
      <button
        type="button"
        className="cod-option-btn cod-option-btn--step"
        onClick={onDecrease}
        disabled={decreaseDisabled}
        aria-label="Reducir valor"
      >
        −
      </button>
      <span className="cod-option-stepper__value">{value}</span>
      <button
        type="button"
        className="cod-option-btn cod-option-btn--step"
        onClick={onIncrease}
        disabled={increaseDisabled}
        aria-label="Aumentar valor"
      >
        +
      </button>
    </div>
  );
}
