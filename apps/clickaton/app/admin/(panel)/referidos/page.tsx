import { prisma } from "@repo/db";

import { AdminPageHeader } from "@/components/admin/AdminPageHeader";
import { EnviarInvitacionesForm } from "@/components/admin/referrals/EnviarInvitacionesForm";
import { Card } from "@/components/ui/Card";
import { requireClickatonAdmin } from "@/lib/admin/auth";
import { listarDestinatariosDeInvitacion } from "@/lib/referrals/application/enviar-invitaciones";
import { ESCALERA_REFERIDOS } from "@/lib/referrals/domain/escalera";

export const dynamic = "force-dynamic";

function Metric({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <Card className="space-y-1">
      <p className="text-xs uppercase tracking-[0.08em] text-ck-text-muted">{label}</p>
      <p className="font-[family-name:var(--font-ck-display)] text-3xl text-ck-text">
        {value}
      </p>
      {hint ? <p className="text-sm text-ck-text-secondary">{hint}</p> : null}
    </Card>
  );
}

/** `lanzamiento-2026-09`: mes incluido, para no repetir campaña sin querer. */
function campaniaSugerida(): string {
  const ahora = new Date();
  const mes = String(ahora.getMonth() + 1).padStart(2, "0");
  return `invitaciones-${ahora.getFullYear()}-${mes}`;
}

export default async function AdminReferidosPage() {
  await requireClickatonAdmin();

  const [
    destinatarios,
    destinatariosTodos,
    codigos,
    ganados,
    consumidos,
    revocados,
    intentosFallidos,
  ] = await Promise.all([
      listarDestinatariosDeInvitacion(),
      listarDestinatariosDeInvitacion({ incluirNoParticipantes: true }),
      prisma.clickatonReferralCode.count(),
      prisma.clickatonReferralAttribution.count({ where: { status: "EARNED" } }),
      prisma.clickatonReferralAttribution.count({ where: { status: "CONSUMED" } }),
      prisma.clickatonReferralAttribution.count({ where: { status: "REVOKED" } }),
      prisma.clickatonReferralAttributionAttempt.count({
        where: { outcome: { not: "CREATED" } },
      }),
    ]);

  const traidos = ganados + consumidos;

  return (
    <div className="space-y-8">
      <AdminPageHeader
        title="Invitá a tus amigos"
        description="Cada participante tiene un link. Cuando alguien entra por ahí y paga, le descuenta la próxima Clickatón a quien lo invitó."
      />

      <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Metric
          label="Pueden invitar"
          value={String(destinatariosTodos.length)}
          hint={`${destinatarios.length} ya participaron`}
        />
        <Metric
          label="Links generados"
          value={String(codigos)}
          hint="Se crean al entrar a Mi cuenta"
        />
        <Metric
          label="Amigos que se sumaron"
          value={String(traidos)}
          hint={consumidos > 0 ? `${consumidos} ya canjeados` : "Ninguno canjeado aún"}
        />
        <Metric
          label="Intentos rechazados"
          value={String(intentosFallidos)}
          hint={revocados > 0 ? `${revocados} caídos por pago` : "Códigos inválidos o repetidos"}
        />
      </section>

      <section className="space-y-4">
        <h2 className="ck-heading-md">Mandarles el link por correo</h2>
        <Card variant="outlined" className="p-6">
          <EnviarInvitacionesForm
            destinatarios={destinatarios.length}
            destinatariosConNoParticipantes={destinatariosTodos.length}
            campaniaSugerida={campaniaSugerida()}
          />
        </Card>
      </section>

      <section className="space-y-4">
        <h2 className="ck-heading-md">La escalera</h2>
        <Card variant="outlined" className="p-6">
          <ul className="grid grid-cols-5 gap-2 text-center">
            {ESCALERA_REFERIDOS.map((escalon) => (
              <li
                key={escalon.colegas}
                className="rounded-[var(--ck-radius-card)] border border-ck-border p-3"
              >
                <p className="text-xs text-ck-text-muted">
                  {escalon.colegas} {escalon.colegas === 1 ? "amigo" : "amigos"}
                </p>
                <p className="text-lg font-semibold text-ck-text">
                  {escalon.descuento === 100 ? "Gratis" : `${escalon.descuento}%`}
                </p>
              </li>
            ))}
          </ul>
          <p className="mt-4 text-sm leading-relaxed text-ck-text-secondary">
            El invitado entra con 10% de descuento. Lo que se acumula no vence, y no se
            suma con los códigos promocionales: se aplica el descuento más alto de los
            dos, y en empate gana el código para que los amigos queden para la próxima.
          </p>
          <p className="mt-2 text-sm text-ck-text-muted">
            Para cambiar los escalones hay que tocar el código
            (<code>lib/referrals/domain/escalera.ts</code>): es una decisión comercial que
            no queremos que se toque por accidente desde una pantalla.
          </p>
        </Card>
      </section>
    </div>
  );
}
