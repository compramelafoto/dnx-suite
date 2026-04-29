import { requireEvaluacionesContext } from "@/lib/workspace";

export default async function EvaluacionesLayout({ children }: { children: React.ReactNode }) {
  await requireEvaluacionesContext();
  return <div className="space-y-8">{children}</div>;
}
