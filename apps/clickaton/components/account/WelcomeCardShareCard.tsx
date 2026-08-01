import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { presentWelcomeCardStatus, publicToneToBadgeVariant } from "@/lib/public-ux/status-presentation";
import { WelcomeCardShareActions } from "./WelcomeCardShareActions";

type Props = {
  registrationId: string;
  status: string | null;
  visibleCode: string | null;
  instagramHandle: string | null;
  participantName: string;
  city: string | null;
  categoryLabel: string | null;
};

export function WelcomeCardShareCard({
  registrationId,
  status,
  visibleCode,
  instagramHandle,
  participantName,
  city,
  categoryLabel,
}: Props) {
  const ready = status === "GENERATED";
  const presentation = presentWelcomeCardStatus(status);
  const previewUrl = ready
    ? `/api/public/registrations/${registrationId}/welcome-card?format=png&disposition=inline`
    : null;
  const downloadUrl = ready
    ? `/api/public/registrations/${registrationId}/welcome-card?format=png&disposition=attachment`
    : null;

  return (
    <Card
      id="placa"
      variant="outlined"
      className="space-y-6 border-ck-yellow/40 p-6"
    >
      <header className="space-y-2">
        <p className="ck-label text-ck-yellow">Placa de bienvenida</p>
        <div className="flex flex-wrap items-center gap-3">
          <h2 className="font-semibold text-ck-text">Tu placa Clickatón</h2>
          <Badge variant={publicToneToBadgeVariant(presentation.tone)}>
            {presentation.label}
          </Badge>
        </div>
        <p className="text-sm text-ck-text-secondary leading-relaxed">
          Visualizá, descargá y compartí tu placa en historias. No hay publicación automática
          desde Clickatón.
        </p>
      </header>

      {ready && previewUrl ? (
        <div className="flex flex-col gap-6 sm:flex-row sm:items-start">
          <div className="mx-auto w-full max-w-[220px] shrink-0 overflow-hidden rounded-xl border border-ck-border bg-ck-bg sm:mx-0">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={previewUrl}
              alt={`Placa de bienvenida de ${participantName}`}
              className="aspect-[9/16] h-auto w-full object-cover"
            />
          </div>
          <div className="min-w-0 flex-1 space-y-4">
            <dl className="grid gap-3 text-sm sm:grid-cols-2">
              <div>
                <dt className="text-ck-text-muted">Nombre</dt>
                <dd className="font-medium">{participantName}</dd>
              </div>
              <div>
                <dt className="text-ck-text-muted">Usuario de Instagram</dt>
                <dd>
                  {instagramHandle
                    ? `@${instagramHandle.replace(/^@/, "")}`
                    : "Instagram no informado"}
                </dd>
              </div>
              <div>
                <dt className="text-ck-text-muted">Ciudad</dt>
                <dd>{city ?? "—"}</dd>
              </div>
              <div>
                <dt className="text-ck-text-muted">Número</dt>
                <dd className="font-mono">{visibleCode ?? "—"}</dd>
              </div>
              {categoryLabel ? (
                <div className="sm:col-span-2">
                  <dt className="text-ck-text-muted">Categoría / entrada</dt>
                  <dd>{categoryLabel}</dd>
                </div>
              ) : null}
            </dl>
            <WelcomeCardShareActions
              downloadUrl={downloadUrl!}
              previewUrl={previewUrl}
              filenameHint={visibleCode ?? registrationId.slice(0, 8)}
            />
            <p className="text-xs text-ck-text-muted leading-relaxed">
              Descargá la placa y compartila en tus historias si querés. Clickatón no publica
              automáticamente desde esta pantalla. Etiquetarnos es opcional.
            </p>
          </div>
        </div>
      ) : (
        <div className="space-y-2 text-sm text-ck-text-secondary" role="status" aria-live="polite">
          <p className="font-semibold text-ck-text">{presentation.label}</p>
          <p className="leading-relaxed">{presentation.description}</p>
          {presentation.nextAction ? (
            <p className="font-medium text-ck-text">Próximo paso: {presentation.nextAction}</p>
          ) : null}
        </div>
      )}
    </Card>
  );
}
