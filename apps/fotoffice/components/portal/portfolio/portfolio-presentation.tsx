import Link from "next/link";
import { MemberPhotoUpload } from "@/components/portal/member-photo-upload";
import { BusinessLogoUpload } from "@/components/portal/business-logo-upload";
import { ProfessionalProfileForm } from "@/components/portal/professional-profile-form";
import type { PresenciaDefaults } from "@/components/membership/professional-presence-fields";
import type { PersonVocabulary } from "@/lib/vocabulario/personas";

/**
 * Cómo se presenta el socio arriba de su portfolio público: su foto, el logo del estudio, su
 * nombre, su presentación, los rubros y las redes.
 *
 * ── Por qué está acá si ya está en "Mi perfil" ──
 *
 * Todo esto se ve en el portfolio público, pero hasta ahora sólo se editaba en otra pantalla. El
 * socio entraba a "Mi portfolio", veía la vista previa con su presentación vieja y no tenía dónde
 * cambiarla: tenía que adivinar que vivía en "Mi perfil". **Son los mismos campos, la misma acción
 * y los mismos componentes en los dos lugares** —no una copia—, así que da igual desde dónde se
 * edite y no hay dos verdades posibles.
 *
 * ── Qué NO se edita acá, y por qué ──
 *
 * El nombre y el teléfono también salen en la página pública, pero son datos personales: viven en
 * el mismo formulario que el documento, la fecha de nacimiento y el domicilio. Traer ese formulario
 * entero a una pantalla sobre obra publicada sería meter el DNI donde no corresponde. Se muestran
 * en modo lectura, diciendo dónde se cambian, que es lo que hacía falta para no quedar perdido.
 *
 * ── Abierta o cerrada ──
 *
 * La pantalla ya es larga y su primer trabajo es cargar fotos. Así que la sección nace **abierta
 * cuando falta algo** —sin presentación o sin foto, que es cuando el portfolio se ve pobre— y
 * cerrada cuando ya está completa, para no estorbar a quien vuelve sólo a subir una foto más.
 */
export function PortfolioPresentation({
  institutionName,
  vocabulary,
  displayName,
  profilePhotoUrl,
  carnetPhotoUrl,
  businessLogoUrl,
  whatsappListo,
  defaults,
}: {
  institutionName: string;
  vocabulary: PersonVocabulary;
  displayName: string;
  profilePhotoUrl: string | null;
  carnetPhotoUrl: string | null;
  businessLogoUrl: string | null;
  /** Si el teléfono cargado sirve para el botón de contacto. El número no hace falta acá. */
  whatsappListo: boolean;
  defaults: PresenciaDefaults;
}) {
  const faltaAlgo = !defaults.bio?.trim() || !profilePhotoUrl;

  return (
    <details open={faltaAlgo} className="fo-card p-0">
      <summary className="cursor-pointer list-none px-5 py-4">
        <span className="flex flex-wrap items-center justify-between gap-2">
          <span className="space-y-0.5">
            <span className="block text-sm font-semibold">Cómo te presentás</span>
            <span className="block text-xs text-[var(--fo-muted)]">
              Tu foto, el logo de tu estudio, tu presentación y tus redes: todo lo que se ve arriba
              de tus fotos.
            </span>
          </span>
          {faltaAlgo ? (
            <span className="shrink-0 text-xs text-[var(--fo-warning)]">Falta completar</span>
          ) : null}
        </span>
      </summary>

      <div className="space-y-4 border-t border-[var(--fo-border)] px-5 py-5">
        <div className="grid gap-4 sm:grid-cols-2">
          <MemberPhotoUpload tipo="PERFIL" currentUrl={profilePhotoUrl} carnetUrl={carnetPhotoUrl} />
          <BusinessLogoUpload
            currentUrl={businessLogoUrl}
            businessName={defaults.businessName?.trim() || null}
          />
        </div>

        {/*
          Lectura, no edición: el nombre y el teléfono viven con los datos personales. Igual tienen
          que estar, porque los dos se ven en la página y alguien que no los encuentre acá va a
          pensar que no se pueden cambiar.
        */}
        <section className="fo-card space-y-3 p-5">
          <div className="space-y-1">
            <h2 className="text-sm font-semibold">Tu nombre y tu contacto</h2>
            <p className="fo-helper">
              Esto sale de tus datos personales, así que se cambia en{" "}
              <Link href="/portal/perfil" className="text-[var(--fo-accent)] hover:underline">
                Mi perfil
              </Link>
              .
            </p>
          </div>
          <dl className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-0.5">
              <dt className="text-xs uppercase tracking-wide text-[var(--fo-muted-soft)]">
                Nombre que se publica
              </dt>
              <dd className="text-sm font-medium">{displayName}</dd>
            </div>
            <div className="space-y-0.5">
              <dt className="text-xs uppercase tracking-wide text-[var(--fo-muted-soft)]">
                Botón de WhatsApp
              </dt>
              <dd className="text-sm font-medium">
                {whatsappListo ? (
                  "Aparece en tu portfolio"
                ) : (
                  <span className="text-[var(--fo-warning)]">
                    No aparece: falta cargar un celular
                  </span>
                )}
              </dd>
            </div>
          </dl>
        </section>

        <ProfessionalProfileForm
          institutionName={institutionName}
          vocabulary={vocabulary}
          defaults={defaults}
          intro="Esto es lo que se lee arriba de tus fotos, en tu portfolio público."
          // Dentro de esta pantalla, "Volver" llevaría a cualquier lado menos a donde está parado.
          backHref={null}
        />
      </div>
    </details>
  );
}
