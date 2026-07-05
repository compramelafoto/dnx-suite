"use client";

import CameraTab from "@/components/simulator/panel/CameraTab";
import LensesTab from "@/components/simulator/panel/LensesTab";
import NaturalLightTab from "@/components/simulator/panel/NaturalLightTab";
import SceneTab from "@/components/simulator/panel/SceneTab";
import SimulatorSideTabs, {
  type SimulatorSideTabId,
} from "@/components/simulator/panel/SimulatorSideTabs";

export interface SimulatorParamPanelProps {
  activeIndex: number;
  sideTab: SimulatorSideTabId;
  onSideTabChange: (tab: SimulatorSideTabId) => void;
}

export default function SimulatorParamPanel({
  activeIndex,
  sideTab,
  onSideTabChange,
}: SimulatorParamPanelProps) {
  return (
    <div className="cod-panel cod-panel--compact cod-side-panel-wrap">
      <SimulatorSideTabs value={sideTab} onChange={onSideTabChange} />

      {sideTab === "camera" ? <CameraTab activeIndex={activeIndex} /> : null}
      {sideTab === "lenses" ? <LensesTab /> : null}
      {sideTab === "scene" ? <SceneTab /> : null}
      {sideTab === "sun" ? <NaturalLightTab /> : null}
    </div>
  );
}

export type { SimulatorSideTabId };
