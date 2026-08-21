import type { EmailSignatureData } from "@repo/communications/signature";

/**
 * Traduce el branding del workspace a los datos de firma de email.
 *
 * Es la ÚNICA pieza que conoce los dos mundos: `@repo/communications` no sabe nada de
 * FotoOffice ni de Prisma, y el resto de FotoOffice no arma firmas a mano.
 */

/** Solo los campos del branding que la firma necesita. No pide el registro completo. */
export type SignatureBrandingInput = {
  commercialName: string | null;
  logoUrl: string | null;
  contactEmail: string | null;
  phone: string | null;
  whatsapp: string | null;
  instagram: string | null;
  website: string | null;
  city: string | null;
  accentColor: string | null;
  emailSignatureNote: string | null;
};

function present(value: string | null | undefined): string | undefined {
  const trimmed = value?.trim();
  return trimmed ? trimmed : undefined;
}

/**
 * Logo utilizable en un email: solo `https:` absoluto.
 *
 * FotoOffice tiene un fallback local (`/uploads/...`) cuando R2 no está configurado. Esas
 * rutas se ven bien en el panel pero NO cargan nunca en un cliente de correo, así que se
 * descartan acá y no llegan al renderer.
 */
function emailSafeLogo(value: string | null): string | undefined {
  const raw = present(value);
  if (!raw) return undefined;
  try {
    return new URL(raw).protocol === "https:" ? raw : undefined;
  } catch {
    return undefined; // relativa o malformada
  }
}

/**
 * `organizationName` es el único campo obligatorio: una firma sin nombre no identifica a
 * nadie. Se resuelve por prioridad y nunca queda vacío.
 *
 * El tercer nivel no debería alcanzarse con datos reales; existe para que un branding a
 * medio cargar no produzca una firma rota.
 */
function resolveOrganizationName(commercialName: string | null, workspaceName: string): string {
  return present(commercialName) ?? present(workspaceName) ?? "FotoOffice";
}

export function toEmailSignatureData(
  branding: SignatureBrandingInput,
  workspaceName: string,
): EmailSignatureData {
  return {
    organizationName: resolveOrganizationName(branding.commercialName, workspaceName),
    organizationLogoUrl: emailSafeLogo(branding.logoUrl),
    phone: present(branding.phone),
    email: present(branding.contactEmail),
    website: present(branding.website),
    instagram: present(branding.instagram),
    city: present(branding.city),
    accentColor: present(branding.accentColor),
    institutionalNote: present(branding.emailSignatureNote),

    // `closingText` se deja SIN completar a propósito: el email de cursos ya cierra con
    // "Gracias por elegirnos." y agregar otro cierre lo duplicaría.

    // `signerName` / `signerRole` / `signerPhotoUrl` pertenecen a la etapa del firmante
    // personal. No hay firmante persistido todavía y no se elige ningún OWNER solo.

    // `replyToEmail` es una cabecera del email: no se completa desde el branding.
  };
}
