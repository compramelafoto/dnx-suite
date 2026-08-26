import type { SpacerBlockConfig } from "@/lib/website/blocks";

const HEIGHT: Record<SpacerBlockConfig["sizePreset"], string> = {
  sm: "h-8",
  md: "h-16",
  lg: "h-32",
};

export function SpacerBlockView({ config }: { config: SpacerBlockConfig }) {
  return <div className={HEIGHT[config.sizePreset]} aria-hidden="true" />;
}
