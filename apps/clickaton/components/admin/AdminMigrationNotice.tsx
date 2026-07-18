import { Card } from "@/components/ui/Card";

type Props = {
  message: string;
};

export function AdminMigrationNotice({ message }: Props) {
  return (
    <Card variant="yellow" className="space-y-2 p-4">
      <p className="text-xs font-semibold uppercase tracking-[0.14em] text-ck-yellow">
        Migración pendiente
      </p>
      <p className="text-sm text-ck-text-secondary">{message}</p>
      <p className="text-xs text-ck-text-muted">
        Migración: <code>20260718120000_clickaton_editions_and_venues</code>. No aplicada a Neon shared
        en esta etapa.
      </p>
    </Card>
  );
}
