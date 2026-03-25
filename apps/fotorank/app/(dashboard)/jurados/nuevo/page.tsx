import { NewJudgePageClient } from "./NewJudgePageClient";

export default function NewJudgePage() {
  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-semibold text-fr-primary">Nuevo jurado</h1>
      <NewJudgePageClient />
    </div>
  );
}
