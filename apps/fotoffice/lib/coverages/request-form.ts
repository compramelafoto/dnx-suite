/**
 * Parseo y validación del formulario público.
 *
 * Todo se valida en el servidor. El `required` del HTML es una comodidad para quien completa,
 * no un control: el navegador puede mandar lo que quiera.
 *
 * Función pura, sin Prisma: así el caso que importa —qué pasa con una fecha dada vuelta o un
 * enlace `javascript:`— se prueba sin levantar nada.
 */

export type ParsedRequest = {
  orgName: string;
  orgKind: string | null;
  orgTaxId: string | null;
  orgWebsite: string | null;
  contactName: string;
  contactRole: string | null;
  contactEmail: string;
  contactPhone: string | null;
  eventTitle: string;
  eventDescription: string | null;
  startsAt: Date;
  endsAt: Date;
  /** Lo que alimenta la regla del refuerzo. Se calcula acá para no repetirlo en cada pantalla. */
  durationMinutes: number;
  addressLine: string | null;
  city: string | null;
  activityKind: string | null;
  expectedAttendees: number | null;
  venueKind: string | null;
  onSiteContactName: string | null;
  onSitePhone: string | null;
  mediaKinds: string;
  coverageKind: string | null;
  purpose: string | null;
  keyMoments: string | null;
  requestedPhotographers: number | null;
  equipmentNotes: string | null;
  needsLighting: boolean;
  expectedDeliveryAt: Date | null;
  deliveryChannel: string | null;
  notes: string | null;
  documentationLinks: string[];
};

export type RequestParseResult =
  | { ok: true; data: ParsedRequest }
  | { ok: false; error: string };

/** Deliberadamente más estricta que la especificación: alcanza con aceptar lo que se escribe. */
const EMAIL_RE = /^[^\s@,;]+@[^\s@,;.]+(?:\.[^\s@,;.]+)+$/;

function texto(v: string | undefined): string | null {
  const t = v?.trim();
  return t ? t : null;
}

function entero(v: string | undefined): { ok: true; value: number | null } | { ok: false } {
  const t = v?.trim();
  if (!t) return { ok: true, value: null };
  if (!/^\d+$/.test(t)) return { ok: false };
  const n = Number(t);
  if (n < 1) return { ok: false };
  return { ok: true, value: n };
}

function fecha(v: string | undefined): Date | null {
  const t = v?.trim();
  if (!t) return null;
  const d = new Date(t);
  return Number.isNaN(d.getTime()) ? null : d;
}

/**
 * Solo `http` y `https`.
 *
 * Un `javascript:` guardado y después pintado como enlace en el panel de la coordinación sería
 * un agujero abierto por un formulario público. Lo que no pasa el filtro se descarta en
 * silencio: es documentación de apoyo, no vale frenar un pedido por un enlace mal pegado.
 */
function enlaces(v: string | undefined): string[] {
  if (!v) return [];
  return v
    .split(/[\n,]+/)
    .map((s) => s.trim())
    .filter(Boolean)
    .filter((s) => /^https?:\/\//i.test(s));
}

export function parseCoverageRequest(form: Record<string, string>): RequestParseResult {
  const orgName = texto(form.orgName);
  if (!orgName) return { ok: false, error: "Escribí el nombre de la organización." };

  const contactName = texto(form.contactName);
  if (!contactName) return { ok: false, error: "Escribí el nombre de quien podemos contactar." };

  const contactEmail = texto(form.contactEmail)?.toLowerCase() ?? null;
  if (!contactEmail) return { ok: false, error: "Escribí un correo de contacto." };
  if (!EMAIL_RE.test(contactEmail)) {
    return { ok: false, error: "Ese correo no parece válido. Revisalo, por ahí quedó un error." };
  }

  const eventTitle = texto(form.eventTitle);
  if (!eventTitle) return { ok: false, error: "Contanos cómo se llama la actividad." };

  const startsAt = fecha(form.startsAt);
  const endsAt = fecha(form.endsAt);
  if (!startsAt) return { ok: false, error: "Falta cuándo empieza la actividad." };
  if (!endsAt) return { ok: false, error: "Falta cuándo termina la actividad." };
  if (endsAt.getTime() <= startsAt.getTime()) {
    return { ok: false, error: "La actividad termina antes de empezar. Revisá los horarios." };
  }

  const fotografos = entero(form.requestedPhotographers);
  if (!fotografos.ok) {
    return { ok: false, error: "La cantidad de fotógrafos tiene que ser un número mayor a cero." };
  }

  const asistentes = entero(form.expectedAttendees);
  if (!asistentes.ok) {
    return { ok: false, error: "La cantidad de asistentes tiene que ser un número." };
  }

  return {
    ok: true,
    data: {
      orgName,
      orgKind: texto(form.orgKind),
      orgTaxId: texto(form.orgTaxId),
      orgWebsite: texto(form.orgWebsite),
      contactName,
      contactRole: texto(form.contactRole),
      contactEmail,
      contactPhone: texto(form.contactPhone),
      eventTitle,
      eventDescription: texto(form.eventDescription),
      startsAt,
      endsAt,
      durationMinutes: Math.round((endsAt.getTime() - startsAt.getTime()) / 60000),
      addressLine: texto(form.addressLine),
      city: texto(form.city),
      activityKind: texto(form.activityKind),
      expectedAttendees: asistentes.value,
      venueKind: texto(form.venueKind),
      onSiteContactName: texto(form.onSiteContactName),
      onSitePhone: texto(form.onSitePhone),
      mediaKinds: texto(form.mediaKinds) ?? "FOTO",
      coverageKind: texto(form.coverageKind),
      purpose: texto(form.purpose),
      keyMoments: texto(form.keyMoments),
      requestedPhotographers: fotografos.value,
      equipmentNotes: texto(form.equipmentNotes),
      needsLighting: form.needsLighting === "on",
      expectedDeliveryAt: fecha(form.expectedDeliveryAt),
      deliveryChannel: texto(form.deliveryChannel),
      notes: texto(form.notes),
      documentationLinks: enlaces(form.documentationLinks),
    },
  };
}
