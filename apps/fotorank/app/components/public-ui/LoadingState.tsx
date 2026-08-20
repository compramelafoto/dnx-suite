import { cn } from "../../lib/cn";

type Props = {
  label?: string;
  className?: string;
};

export function LoadingState({ label = "Cargando…", className }: Props) {
  return (
    <div
      className={cn("flex min-h-[12rem] items-center justify-center", className)}
      role="status"
      aria-live="polite"
      data-testid="public-loading-state"
    >
      <p className="fr-public-body">{label}</p>
    </div>
  );
}
