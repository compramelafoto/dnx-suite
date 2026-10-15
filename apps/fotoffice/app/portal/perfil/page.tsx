import { redirect } from "next/navigation";
import { prisma } from "@repo/db";
import { requireAuth } from "@/lib/auth";
import { loadPersonVocabulary } from "@/lib/vocabulario/load";
import { describeSeniority } from "@/lib/portal/identity";
import { MEMBER_STATUS_LABELS, isMemberStatus } from "@/lib/members/status-labels";
import { ProfessionalProfileForm } from "@/components/portal/professional-profile-form";
import { MemberPhotoUpload } from "@/components/portal/member-photo-upload";
import { BusinessLogoUpload } from "@/components/portal/business-logo-upload";
import { PersonalDataForm } from "@/components/portal/personal-data-form";
import { ProfileTabs } from "@/components/portal/profile-tabs";

export const metadata = { title: "Mi perfil" };

/**
 * Todo lo que la persona sabe y decide sobre sí misma, en una sola pantalla.
 *
 * Cuatro bloques, en el orden en que importan:
 *
 * 1. **Su ficha en la institución**, en modo lectura. Número, categoría, estado y antigüedad.
 *    No los edita ella, pero tiene que verlos: no aparecían en ninguna pantalla del portal, y
 *    la única forma de saber el propio número era preguntarlo.
 * 2. **Sus imágenes**: la foto del portal, la de la credencial y el logo de su empresa.
 * 3. **Sus datos personales**, editables por ella. Es su información, y corregir un teléfono
 *    mal cargado no puede depender de que alguien de la Secretaría tenga tiempo.
 * 4. **Su presencia profesional**, que es lo único que puede llegar a publicarse.
 *
 * Se resuelve la misma ficha que muestra el portal (la más antigua): quien pertenezca a dos
 * instituciones edita la que está viendo, no todas a la vez.
 */
export default async function PerfilPage() {
  const user = await requireAuth();

  const socio = await prisma.member.findFirst({
    where: { userId: user.id, status: "ACTIVE" },
    orderBy: { createdAt: "asc" },
    select: {
      memberNumber: true,
      status: true,
      joinedAt: true,
      firstName: true,
      lastName: true,
      documentType: true,
      documentNumber: true,
      email: true,
      phone: true,
      birthDate: true,
      address: true,
      city: true,
      province: true,
      postalCode: true,
      businessName: true,
      businessLogoUrl: true,
      bio: true,
      specialties: true,
      website: true,
      instagram: true,
      tiktok: true,
      facebook: true,
      youtube: true,
      linkedin: true,
      directoryOptIn: true,
      studioStreet: true,
      studioCity: true,
      studioProvince: true,
      studioPostalCode: true,
      studioLat: true,
      studioLng: true,
      avatarUrl: true,
      profilePhotoUrl: true,
      category: { select: { name: true } },
      workspace: { select: { id: true, name: true } },
    },
  });
  if (!socio) redirect("/portal");

  const vocabulary = await loadPersonVocabulary(socio.workspace.id);
  const antiguedad = describeSeniority(socio.joinedAt, new Date());

  return (
    <div className="space-y-6">
      <header className="space-y-1">
        <h1 className="text-xl font-semibold">Mi perfil</h1>
        <p className="text-sm text-[var(--fo-muted)]">
          Estos datos son tuyos. Se publican solo si lo autorizás.
        </p>
      </header>
      <ProfileTabs active="datos" />

      {/*
        Modo lectura y separado a propósito. Mezclar el número o el estado entre los campos
        editables invitaría a intentar cambiarlos; dejarlos afuera de la pantalla, como
        estaban, obliga a preguntarlos por teléfono.
      */}
      <section className="fo-card space-y-4 p-5">
        <div className="space-y-1">
          <h2 className="text-sm font-semibold">Tu ficha en {socio.workspace.name}</h2>
          <p className="fo-helper">
            Esto lo administra la institución. Si ves algo que no corresponde, escribinos.
          </p>
        </div>
        <dl className="grid gap-4 sm:grid-cols-2">
          <Dato etiqueta={`Número de ${vocabulary.singular}`}>
            <span className="tabular-nums">{socio.memberNumber}</span>
          </Dato>
          <Dato etiqueta="Categoría">{socio.category?.name ?? "Sin categoría asignada"}</Dato>
          <Dato etiqueta="Estado">
            {isMemberStatus(socio.status) ? MEMBER_STATUS_LABELS[socio.status] : socio.status}
          </Dato>
          <Dato etiqueta={`${vocabulary.Singular} desde`}>
            {antiguedad.desde ?? "Sin fecha registrada"}
            {antiguedad.anios ? (
              <span className="text-[var(--fo-muted)]">
                {` · ${antiguedad.anios} ${antiguedad.anios === 1 ? "año" : "años"}`}
              </span>
            ) : null}
          </Dato>
        </dl>
      </section>

      {/*
        Las dos fotos viven acá, que es donde la persona configura cómo se muestra. La de la
        credencial estaba en la pantalla del carnet: se llegaba solo por ahí, y quien nunca
        entraba a su carnet no encontraba dónde cargarla.
      */}
      <div className="grid gap-4 sm:grid-cols-2">
        <MemberPhotoUpload
          tipo="PERFIL"
          currentUrl={socio.profilePhotoUrl}
          carnetUrl={socio.avatarUrl}
        />
        <MemberPhotoUpload tipo="CARNET" currentUrl={socio.avatarUrl} />
        <BusinessLogoUpload
          currentUrl={socio.businessLogoUrl}
          businessName={socio.businessName?.trim() || null}
        />
      </div>

      <PersonalDataForm
        defaults={{
          firstName: socio.firstName,
          lastName: socio.lastName,
          documentType: socio.documentType,
          documentNumber: socio.documentNumber,
          email: socio.email,
          phone: socio.phone,
          birthDate: socio.birthDate,
          address: socio.address,
          city: socio.city,
          province: socio.province,
          postalCode: socio.postalCode,
        }}
      />

      <ProfessionalProfileForm
        institutionName={socio.workspace.name}
        vocabulary={vocabulary}
        defaults={{
          businessName: socio.businessName,
          bio: socio.bio,
          specialties: socio.specialties,
          website: socio.website,
          instagram: socio.instagram,
          tiktok: socio.tiktok,
          facebook: socio.facebook,
          youtube: socio.youtube,
          linkedin: socio.linkedin,
          directoryOptIn: socio.directoryOptIn,
          studioStreet: socio.studioStreet,
          studioCity: socio.studioCity,
          studioProvince: socio.studioProvince,
          studioPostalCode: socio.studioPostalCode,
          // Se devuelven las coordenadas guardadas, no el enlace original: el enlace no se guarda
          // (es larguísimo y efímero) y "lat, lng" vuelve a entrar por el mismo campo.
          studioMapsUrl: coordenadasComoTexto(socio.studioLat, socio.studioLng),
        }}
      />
    </div>
  );
}

/** Lo que se le muestra al socio de vuelta en el campo de ubicación. */
function coordenadasComoTexto(lat: number | null, lng: number | null): string {
  return lat !== null && lng !== null ? `${lat}, ${lng}` : "";
}

function Dato({ etiqueta, children }: { etiqueta: string; children: React.ReactNode }) {
  return (
    <div className="space-y-0.5">
      <dt className="text-xs uppercase tracking-wide text-[var(--fo-muted-soft)]">{etiqueta}</dt>
      <dd className="text-sm font-medium">{children}</dd>
    </div>
  );
}
