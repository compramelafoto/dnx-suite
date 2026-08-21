/**
 * Datos de una firma de email.
 *
 * Es una FIRMA DE EMAIL —el bloque de cierre de un correo—, no una firma digital:
 * no hay claves, ni sellado de tiempo, ni validez legal.
 *
 * Objeto plano y agnóstico de aplicación, igual que `CommunicationBrand`: sin Prisma y
 * sin tipos de ninguna app. Quien lo consume arma este objeto desde su propio modelo.
 *
 * Todos los campos son opcionales salvo `organizationName`, para que la etapa del
 * firmante personal pueda completarlos sin romper esta API.
 */
export type EmailSignatureData = {
  /** Único obligatorio: una firma sin nombre no identifica a nadie. */
  organizationName: string;
  organizationLogoUrl?: string;

  /** Etapa siguiente: firmante personal. Hoy ningún mapper los completa. */
  signerName?: string;
  signerRole?: string;
  signerPhotoUrl?: string;

  phone?: string;
  email?: string;
  /**
   * CABECERA del email, no contenido del cuerpo. `renderEmailSignature` lo ignora
   * deliberadamente: existe acá para que quien envía lo lea y arme el header Reply-To.
   */
  replyToEmail?: string;
  website?: string;
  instagram?: string;
  city?: string;

  /** Cierre ("Saludos"). Se deja vacío si el template ya cierra, para no duplicar. */
  closingText?: string;
  /** Texto libre institucional (razón social, CUIT, aviso legal). Texto plano. */
  institutionalNote?: string;
  accentColor?: string;
};

/** Salida del renderer: los emails llevan ambas variantes. */
export type RenderedEmailSignature = {
  html: string;
  text: string;
};
