import SimulatorFeatures from "@/components/simulator/SimulatorFeatures";
import SimulatorHero from "@/components/simulator/SimulatorHero";
import SimulatorPreview from "@/components/simulator/SimulatorPreview";
import SimulatorShell from "@/components/simulator/SimulatorShell";

export default function CamOfDutyPage() {
  return (
    <SimulatorShell variant="landing">
      <main>
        <SimulatorHero />
        <SimulatorFeatures />
        <SimulatorPreview />
      </main>
    </SimulatorShell>
  );
}
