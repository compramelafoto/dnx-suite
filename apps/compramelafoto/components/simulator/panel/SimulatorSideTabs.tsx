"use client";

export type SimulatorSideTabId = "camera" | "lenses" | "scene" | "sun";

const TABS: { id: SimulatorSideTabId; label: string }[] = [
  { id: "camera", label: "Cámara" },
  { id: "lenses", label: "Objetivos" },
  { id: "scene", label: "Escena" },
  { id: "sun", label: "Luz natural" },
];

export interface SimulatorSideTabsProps {
  value: SimulatorSideTabId;
  onChange: (tab: SimulatorSideTabId) => void;
}

export default function SimulatorSideTabs({ value, onChange }: SimulatorSideTabsProps) {
  return (
    <div className="cod-side-tabs" role="tablist" aria-label="Panel lateral del simulador">
      {TABS.map((tab) => (
        <button
          key={tab.id}
          type="button"
          role="tab"
          id={`cod-side-tab-${tab.id}`}
          aria-selected={value === tab.id}
          aria-controls={`cod-side-panel-${tab.id}`}
          className={`cod-side-tabs__btn${value === tab.id ? " cod-side-tabs__btn--active" : ""}`}
          onClick={() => onChange(tab.id)}
        >
          {tab.label}
        </button>
      ))}
    </div>
  );
}
