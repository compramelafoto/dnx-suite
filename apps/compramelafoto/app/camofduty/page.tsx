import SimulatorFeatures from "@/components/simulator/SimulatorFeatures";
import SimulatorHero from "@/components/simulator/SimulatorHero";
import DailyQuestionSection from "@/components/simulator/DailyQuestionSection";
import SimulatorShell from "@/components/simulator/SimulatorShell";

export default function CamOfDutyPage() {
  return (
    <SimulatorShell variant="landing">
      <main>
        <SimulatorHero />
        <SimulatorFeatures />
        <DailyQuestionSection />
      </main>
    </SimulatorShell>
  );
}
