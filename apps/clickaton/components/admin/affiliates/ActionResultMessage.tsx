import { Card } from "@/components/ui/Card";

type Props = {
  ok?: string | null;
  error?: string | null;
};

/** Resultado de la última acción, que la acción deja en `?ok=` / `?error=`. */
export function ActionResultMessage({ ok, error }: Props) {
  if (error) {
    return (
      <Card
        variant="outlined"
        className="border-[var(--ck-danger)]/40 bg-[var(--ck-danger-soft)] p-4 text-sm text-ck-text"
        role="alert"
      >
        {error.slice(0, 300)}
      </Card>
    );
  }
  if (ok) {
    return (
      <Card
        variant="outlined"
        className="border-[var(--ck-success)]/40 bg-[var(--ck-success-soft)] p-4 text-sm text-ck-text"
        role="status"
      >
        {ok.slice(0, 300)}
      </Card>
    );
  }
  return null;
}
