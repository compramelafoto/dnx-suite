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
        La base de Production de Clickatón es Neon <code>clickaton-production</code> (
        <code>ep-silent-haze…</code>). Las migraciones se aplican con{" "}
        <code>prisma migrate deploy</code> contra esa DB.
      </p>
    </Card>
  );
}
