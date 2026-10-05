import { CLIENT_DATA_KEY } from "./constants";

/**
 * La traducción entre una persona de FOTOFFICE y un contacto de Google. Módulo PURO.
 *
 * Todo lo que se compara viaja como texto, incluida la fecha ("1985-04-12"). Comparar
 * `Date` contra el string que devuelve Google sería comparar peras con manzanas, y la
 * comparación es justamente lo que decide si se escribe o no.
 */

export type SyncableField =
  | "firstName"
  | "lastName"
  | "email"
  | "phone"
  | "address"
  | "city"
  | "province"
  | "postalCode"
  | "birthDate";

export const SYNCABLE_FIELDS: readonly SyncableField[] = [
  "firstName",
  "lastName",
  "email",
  "phone",
  "address",
  "city",
  "province",
  "postalCode",
  "birthDate",
] as const;

export type FieldValues = Record<SyncableField, string | null>;

export type SyncablePerson = {
  sourceId: string;
  values: FieldValues;
  /** Nombre del estudio o marca. Va de ida y no vuelve. */
  organization: string | null;
  /** Lo que se ve en la pantalla del contacto: Nº de socio, Categoría, Estado. Va de ida. */
  labels: Record<string, string>;
  /**
   * Lo que va en las Notas del contacto al CREARLO, y nunca más.
   *
   * Existe porque el iPhone no muestra los campos personalizados (`labels`) de un contacto de
   * Google, y las Notas se ven en todos los teléfonos. Se escribe una sola vez porque las Notas
   * son el campo donde la gente anota lo suyo ("llamar después de las 18"): reescribirlas en
   * cada corrida borraría esos apuntes. Por eso sólo lleva datos que no cambian.
   */
  note?: string | null;
  updatedAt: Date;
};

type GoogleDate = { year?: number; month?: number; day?: number };

export type GooglePerson = {
  resourceName?: string;
  etag?: string;
  names?: { givenName?: string; familyName?: string }[];
  emailAddresses?: { value?: string; type?: string }[];
  phoneNumbers?: { value?: string; type?: string }[];
  addresses?: {
    streetAddress?: string;
    city?: string;
    region?: string;
    postalCode?: string;
    type?: string;
  }[];
  birthdays?: { date?: GoogleDate }[];
  organizations?: { name?: string }[];
  clientData?: { key?: string; value?: string }[];
  userDefined?: { key?: string; value?: string }[];
  memberships?: { contactGroupMembership?: { contactGroupResourceName?: string } }[];
  metadata?: { sources?: { updateTime?: string }[]; deleted?: boolean };
};

/** Lo que se pide al leer. Cambiarlo INVALIDA el syncToken: ver `client.ts`. */
export const PERSON_FIELDS =
  "names,emailAddresses,phoneNumbers,addresses,birthdays,organizations,clientData,userDefined,memberships,metadata";

/** Lo que se reemplaza al actualizar. Solo lo que la plataforma administra. */
export const UPDATE_PERSON_FIELDS =
  "names,emailAddresses,phoneNumbers,addresses,birthdays,organizations,clientData,userDefined";

function vacio(v: string | null | undefined): boolean {
  return v === null || v === undefined || v.trim() === "";
}

/** "1985-04-12" o "--04-12" (sin año) → la forma que entiende Google. */
function toGoogleDate(iso: string): GoogleDate | null {
  const conAnio = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso);
  if (conAnio) {
    return { year: Number(conAnio[1]), month: Number(conAnio[2]), day: Number(conAnio[3]) };
  }
  const sinAnio = /^--(\d{2})-(\d{2})$/.exec(iso);
  if (sinAnio) return { month: Number(sinAnio[1]), day: Number(sinAnio[2]) };
  return null;
}

function fromGoogleDate(date: GoogleDate | undefined): string | null {
  if (!date?.month || !date?.day) return null;
  const mm = String(date.month).padStart(2, "0");
  const dd = String(date.day).padStart(2, "0");
  return date.year ? `${date.year}-${mm}-${dd}` : `--${mm}-${dd}`;
}

/**
 * El cuerpo que se le manda a Google, para crear o para actualizar.
 *
 * Un campo vacío se OMITE en vez de mandarse en blanco: mandar `{ value: "" }` deja un mail
 * vacío visible en la agenda de la institución.
 */
export function toGooglePersonBody(
  person: SyncablePerson,
  opts: {
    moduleKey: string;
    groupResourceName: string | null;
    /** Sólo al crear: ver `SyncablePerson.note`. */
    includeNote?: boolean;
  },
): Record<string, unknown> {
  const v = person.values;
  const body: Record<string, unknown> = {
    clientData: [{ key: CLIENT_DATA_KEY, value: `${opts.moduleKey}:${person.sourceId}` }],
  };

  if (!vacio(v.firstName) || !vacio(v.lastName)) {
    body.names = [{ givenName: v.firstName ?? "", familyName: v.lastName ?? "" }];
  }
  if (!vacio(v.email)) body.emailAddresses = [{ value: v.email, type: "work" }];
  if (!vacio(v.phone)) body.phoneNumbers = [{ value: v.phone, type: "mobile" }];

  if (!vacio(v.address) || !vacio(v.city) || !vacio(v.province) || !vacio(v.postalCode)) {
    body.addresses = [
      {
        streetAddress: v.address ?? "",
        city: v.city ?? "",
        region: v.province ?? "",
        postalCode: v.postalCode ?? "",
        type: "home",
      },
    ];
  }

  if (!vacio(v.birthDate)) {
    const date = toGoogleDate(v.birthDate as string);
    if (date) body.birthdays = [{ date }];
  }

  if (!vacio(person.organization)) body.organizations = [{ name: person.organization }];

  const labels = Object.entries(person.labels).filter(([, value]) => !vacio(value));
  if (labels.length > 0) body.userDefined = labels.map(([key, value]) => ({ key, value }));

  if (opts.includeNote && !vacio(person.note)) {
    body.biographies = [{ value: person.note, contentType: "TEXT_PLAIN" }];
  }

  if (opts.groupResourceName) {
    body.memberships = [
      { contactGroupMembership: { contactGroupResourceName: opts.groupResourceName } },
    ];
  }

  return body;
}

function limpio(v: string | undefined): string | null {
  return v && v.trim() !== "" ? v.trim() : null;
}

/** Los campos de un contacto de Google, en la misma forma en que los tiene el padrón. */
export function readFieldValues(google: GooglePerson): FieldValues {
  const name = google.names?.[0];
  const address = google.addresses?.[0];
  return {
    firstName: limpio(name?.givenName),
    lastName: limpio(name?.familyName),
    email: limpio(google.emailAddresses?.[0]?.value),
    phone: limpio(google.phoneNumbers?.[0]?.value),
    address: limpio(address?.streetAddress),
    city: limpio(address?.city),
    province: limpio(address?.region),
    postalCode: limpio(address?.postalCode),
    birthDate: fromGoogleDate(google.birthdays?.[0]?.date),
  };
}

/**
 * De qué registro de FOTOFFICE salió este contacto, o null si no salió de FOTOFFICE.
 *
 * Un `null` acá significa "no lo toques": es la garantía de que la agenda que la institución
 * ya tenía queda intacta.
 */
export function readSourceMarker(
  google: GooglePerson,
): { moduleKey: string; sourceId: string } | null {
  const marca = google.clientData?.find((d) => d.key === CLIENT_DATA_KEY)?.value;
  if (!marca) return null;
  const corte = marca.indexOf(":");
  if (corte <= 0 || corte === marca.length - 1) return null;
  return { moduleKey: marca.slice(0, corte), sourceId: marca.slice(corte + 1) };
}

/**
 * Cuándo se tocó el contacto del lado de Google. `null` si no se sabe.
 *
 * Nunca devuelve "ahora" como respaldo: eso haría que Google ganara todos los conflictos.
 */
export function readRemoteUpdatedAt(google: GooglePerson): Date | null {
  const fechas = (google.metadata?.sources ?? [])
    .map((s) => (s.updateTime ? new Date(s.updateTime) : null))
    .filter((d): d is Date => d !== null && !Number.isNaN(d.getTime()));
  if (fechas.length === 0) return null;
  return fechas.reduce((a, b) => (a.getTime() >= b.getTime() ? a : b));
}
