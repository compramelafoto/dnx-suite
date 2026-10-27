import { buildTrackingScripts, type WebsiteSiteSettings } from "@/lib/website/site-settings";
import { whatsappHref } from "@/lib/website/contact";
import { SiteTracking } from "./site-tracking";
import { WhatsappFloat } from "./whatsapp-float";
import { PhotoProtection } from "./photo-protection";
import { ContadorVisitas } from "./contador-visitas";

/**
 * Lo que agregan los Ajustes del sitio al sitio PÚBLICO: medición (GA4 y píxel), botón flotante de
 * WhatsApp y protección de fotos. Se monta sólo en el layout de `/w/[workspaceSlug]`, nunca en el
 * panel ni en sus vistas previas. Con los ajustes por omisión sólo queda el contador de visitas,
 * que no dibuja nada.
 */
export function PublicSiteExtras({ settings, workspaceSlug }: { settings: WebsiteSiteSettings; workspaceSlug: string }) {
  const scripts = buildTrackingScripts(settings.analytics);
  const wa = settings.whatsappButton;
  const waHref = wa.enabled ? whatsappHref(wa.number, wa.chatText) : null;

  return (
    <>
      {scripts.length > 0 ? <SiteTracking scripts={scripts} /> : null}
      {waHref ? <WhatsappFloat href={waHref} welcomeMessage={wa.welcomeMessage} side={wa.side} size={wa.size} /> : null}
      {settings.photoProtection.enabled ? <PhotoProtection /> : null}
      {/* Contador de visitas por página (sin cookies ni datos personales): siempre encendido. */}
      <ContadorVisitas workspaceSlug={workspaceSlug} />
    </>
  );
}
