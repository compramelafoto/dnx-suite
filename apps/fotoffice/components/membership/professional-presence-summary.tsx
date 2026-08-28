import { etiquetaEspecialidad } from "@/lib/membership/specialties";
import { urlDeUsuario } from "@/lib/membership/social";

export type PresenciaProfesional = {
  businessName: string | null;
  bio: string | null;
  specialties: string[];
  website: string | null;
  instagram: string | null;
  tiktok: string | null;
  facebook: string | null;
  youtube: string | null;
  linkedin: string | null;
  directoryOptIn: boolean;
};

/**
 * Vista de solo lectura de la presencia profesional. La usa la Secretaría al revisar una
 * solicitud y la ficha del socio.
 *
 * Devuelve `null` cuando no hay nada que mostrar: una ficha con seis rótulos vacíos es peor
 * que una ficha sin la sección.
 */
export function ProfessionalPresenceSummary({
  data,
  showConsent = false,
}: {
  data: PresenciaProfesional;
  /** Mostrar si autorizó la publicación. Relevante al revisar y al administrar; no al lucirse. */
  showConsent?: boolean;
}) {
  const enlaces = [
    data.instagram ? { label: `@${data.instagram}`, href: urlDeUsuario("instagram", data.instagram), red: "Instagram" } : null,
    data.tiktok ? { label: `@${data.tiktok}`, href: urlDeUsuario("tiktok", data.tiktok), red: "TikTok" } : null,
    data.facebook ? { label: "Perfil", href: data.facebook, red: "Facebook" } : null,
    data.youtube ? { label: "Canal", href: data.youtube, red: "YouTube" } : null,
    data.linkedin ? { label: "Perfil", href: data.linkedin, red: "LinkedIn" } : null,
    data.website ? { label: hostVisible(data.website), href: data.website, red: "Sitio" } : null,
  ].filter((x): x is { label: string; href: string; red: string } => x !== null);

  const vacio =
    !data.businessName && !data.bio && data.specialties.length === 0 && enlaces.length === 0;
  if (vacio) return null;

  return (
    <div className="space-y-2 border-t border-[var(--fo-border)] pt-3 text-xs">
      {data.businessName ? (
        <p>
          <span className="text-[var(--fo-muted-soft)]">Estudio: </span>
          <strong>{data.businessName}</strong>
        </p>
      ) : null}

      {data.specialties.length > 0 ? (
        <div className="flex flex-wrap gap-1.5">
          {data.specialties.map((id) => (
            <span
              key={id}
              className="rounded-full border border-[var(--fo-border)] px-2 py-0.5 text-[11px] text-[var(--fo-muted)]"
            >
              {etiquetaEspecialidad(id)}
            </span>
          ))}
        </div>
      ) : null}

      {data.bio ? (
        <p className="text-[var(--fo-muted)] leading-relaxed">{data.bio}</p>
      ) : null}

      {enlaces.length > 0 ? (
        <div className="flex flex-wrap gap-x-3 gap-y-1">
          {enlaces.map((e) => (
            <a
              key={e.red}
              href={e.href}
              target="_blank"
              // noreferrer además de noopener: son enlaces cargados por terceros.
              rel="noopener noreferrer"
              className="text-[var(--fo-accent)] hover:underline"
            >
              {e.red}: {e.label}
            </a>
          ))}
        </div>
      ) : null}

      {showConsent ? (
        <p className="text-[11px] text-[var(--fo-muted-soft)]">
          {data.directoryOptIn
            ? "✓ Autorizó publicar estos datos en el directorio."
            : "No autorizó publicarlos: son de uso interno."}
        </p>
      ) : null}
    </div>
  );
}

function hostVisible(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return url;
  }
}
