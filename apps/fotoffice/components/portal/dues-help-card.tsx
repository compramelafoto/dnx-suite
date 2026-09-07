import { buildWhatsappUrl } from "@/lib/contact/whatsapp";
import { buildDuesHelpMessage, DUES_HELP_INVITE } from "@/lib/portal/dues-help";

/**
 * Salida visible para el socio que no reconoce lo que se le cobra.
 *
 * Se muestra SIEMPRE, esté al día o deba: el que ya pagó también puede ver un importe que no
 * es el suyo, y sin este bloque el reclamo llega por donde puede.
 *
 * Sin WhatsApp cargado cae al email institucional. Nunca se dibuja un botón que no lleva a
 * ninguna parte: eso es peor que no ofrecer el canal.
 */
export function DuesHelpCard({
  memberNumber,
  whatsapp,
  contactEmail,
}: {
  memberNumber: string | null;
  whatsapp: string | null;
  contactEmail: string | null;
}) {
  const message = buildDuesHelpMessage({ memberNumber });
  const whatsappUrl = buildWhatsappUrl(whatsapp, message);

  if (!whatsappUrl && !contactEmail) return null;

  return (
    <section className="fo-card space-y-3 p-5">
      <h2 className="text-sm font-semibold">¿Ves algo que no corresponde?</h2>
      <p className="text-sm text-[var(--fo-muted)] leading-relaxed">
        {whatsappUrl
          ? DUES_HELP_INVITE
          : "Si creés que hay un error en el cobro de tu cuota, escribinos y lo ajustamos."}
      </p>
      {whatsappUrl ? (
        <a
          href={whatsappUrl}
          target="_blank"
          rel="noreferrer"
          className="fo-btn fo-btn-secondary text-sm"
        >
          Escribirnos por WhatsApp
        </a>
      ) : (
        <a href={`mailto:${contactEmail}`} className="fo-btn fo-btn-secondary text-sm">
          Escribirnos por email
        </a>
      )}
    </section>
  );
}
