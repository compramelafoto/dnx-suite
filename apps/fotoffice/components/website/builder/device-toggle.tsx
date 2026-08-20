"use client";

import { Laptop, Smartphone, Tablet } from "lucide-react";

export type DeviceWidth = "desktop" | "tablet" | "mobile";

export const DEVICE_WIDTHS: Record<DeviceWidth, string> = {
  desktop: "100%",
  tablet: "768px",
  mobile: "390px",
};

const OPTIONS: { id: DeviceWidth; label: string; Icon: typeof Laptop }[] = [
  { id: "desktop", label: "Escritorio", Icon: Laptop },
  { id: "tablet", label: "Tablet", Icon: Tablet },
  { id: "mobile", label: "Móvil", Icon: Smartphone },
];

export function DeviceToggle({ value, onChange }: { value: DeviceWidth; onChange: (v: DeviceWidth) => void }) {
  return (
    <div className="inline-flex items-center gap-0.5 rounded-lg border border-[var(--fo-border)] bg-[var(--fo-bg)] p-0.5">
      {OPTIONS.map(({ id, label, Icon }) => (
        <button
          key={id}
          type="button"
          aria-label={label}
          title={label}
          className={[
            "flex items-center justify-center rounded-md p-1.5 transition-colors",
            value === id ? "bg-[var(--fo-bg-elevated)] text-[var(--fo-accent)] shadow-sm" : "text-[var(--fo-muted)] hover:text-[var(--fo-text)]",
          ].join(" ")}
          onClick={() => onChange(id)}
        >
          <Icon className="h-4 w-4" />
        </button>
      ))}
    </div>
  );
}
