import { Badge } from "@/components/ui/Badge";

type MarathonDemoBannerProps = {
  message?: string;
};

export function MarathonDemoBanner({
  message = "Vista técnica de demostración. No es una maratón anunciada ni abierta a inscripción.",
}: MarathonDemoBannerProps) {
  return (
    <div
      role="status"
      className="border-b-2 border-ck-border-strong bg-ck-black px-4 py-3 text-center text-ck-yellow"
    >
      <div className="mx-auto flex max-w-[var(--ck-content-standard)] flex-wrap items-center justify-center gap-3">
        <Badge variant="brand">Demo técnica</Badge>
        <p className="ck-body-sm text-ck-yellow/95">{message}</p>
      </div>
    </div>
  );
}
