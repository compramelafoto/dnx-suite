import type { AdminIntegrationInfo } from "@/config/admin/integrations";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";

type Props = {
  integration: AdminIntegrationInfo;
};

export function AdminIntegrationCard({ integration }: Props) {
  return (
    <Card variant="default" className="flex h-full flex-col gap-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="font-[family-name:var(--font-ck-display)] text-2xl tracking-wide text-ck-text">
            {integration.name}
          </h2>
          <p className="mt-2 text-sm leading-relaxed text-ck-text-secondary">
            {integration.purpose}
          </p>
        </div>
        <Badge variant={integration.status === "pending" ? "brand" : "neutral"}>
          {integration.statusLabel}
        </Badge>
      </div>

      <div>
        <p className="text-xs font-semibold uppercase tracking-[0.12em] text-ck-text-muted">
          Responsabilidades
        </p>
        <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-ck-text-secondary">
          {integration.owns.map((item) => (
            <li key={item}>{item}</li>
          ))}
        </ul>
      </div>

      <div className="mt-auto border-t border-ck-border pt-4">
        {integration.href ? (
          <Button href={integration.href} variant="secondary" size="sm" target="_blank" rel="noreferrer">
            {integration.hrefLabel}
          </Button>
        ) : (
          <p className="text-sm text-ck-text-muted">
            Sin URL operativa configurada. Definí la variable de entorno correspondiente para
            habilitar el enlace.
          </p>
        )}
      </div>
    </Card>
  );
}
