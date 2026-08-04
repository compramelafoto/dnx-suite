import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { routes } from "@/config/navigation";

/** Cierre editorial de las notas: llevar al lector a las maratones abiertas. */
export function BlogMarathonCta() {
  return (
    <Card variant="yellow" className="space-y-6">
      <div className="space-y-4">
        <p className="text-xs font-semibold uppercase tracking-[0.14em] text-ck-yellow">
          Salí a buscar el instante
        </p>
        <h2 className="text-2xl text-ck-text">Participá de la próxima Clickatón</h2>
        <p className="max-w-prose text-sm leading-relaxed text-ck-text-secondary">
          Una jornada, consignas sorpresa y una ciudad para recorrer con la cámara. Mirá las
          maratones con inscripción abierta y elegí tu sede.
        </p>
      </div>
      <div className="flex flex-wrap gap-3">
        <Button href={routes.marathons} variant="primary">
          Ver maratones
        </Button>
        <Button href={routes.howItWorks} variant="secondary">
          Cómo funciona
        </Button>
      </div>
    </Card>
  );
}
