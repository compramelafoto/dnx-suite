import type { FieldValues, SyncablePerson } from "../person";

/**
 * Cómo se ve un cliente en Google Contacts. Puro, sin base, para poder probarlo.
 *
 * Una empresa o institución (`kind: "EMPRESA"`) suele no tener nombre y apellido: su nombre es
 * la razón social, que va como organización. Así Google la muestra por su nombre y no como un
 * contacto vacío. Las etiquetas del cliente («Asociación fotográfica», «Proveedor»…) van en
 * los campos de la ficha y, al crearlo, también en las Notas, que son las que se ven en el iPhone.
 */

export type ClientRow = {
  id: string;
  clientNumber: number;
  kind: string;
  firstName: string | null;
  lastName: string | null;
  businessName: string | null;
  email: string | null;
  phone: string | null;
  address: string | null;
  city: string | null;
  updatedAt: Date;
  perfil: { category: string; province: string | null; postalCode: string | null } | null;
  etiquetas: string[];
};

const ETIQUETAS_DE_CATEGORIA: Record<string, string> = {
  CONTACTO: "Contacto",
  CLIENTE: "Cliente",
  PROVEEDOR: "Proveedor",
  COLABORADOR: "Colaborador",
};

function limpio(v: string | null | undefined): string | null {
  return v && v.trim() !== "" ? v.trim() : null;
}

export function clientToSyncablePerson(c: ClientRow): SyncablePerson {
  const values: FieldValues = {
    firstName: limpio(c.firstName),
    lastName: limpio(c.lastName),
    email: limpio(c.email),
    phone: limpio(c.phone),
    address: limpio(c.address),
    city: limpio(c.city),
    province: limpio(c.perfil?.province),
    postalCode: limpio(c.perfil?.postalCode),
    birthDate: null,
  };

  const etiquetas = c.etiquetas.map((e) => e.trim()).filter(Boolean).sort((a, b) => a.localeCompare(b, "es"));
  const labels: Record<string, string> = { "Nº de cliente": String(c.clientNumber) };
  const categoria = c.perfil ? ETIQUETAS_DE_CATEGORIA[c.perfil.category] : undefined;
  if (categoria) labels["Categoría"] = categoria;
  if (etiquetas.length > 0) labels["Etiquetas"] = etiquetas.join(", ");

  const nota = [`Nº de cliente: ${c.clientNumber}`, ...etiquetas].join(" · ");

  return {
    sourceId: c.id,
    values,
    organization: limpio(c.businessName),
    labels,
    note: nota,
    updatedAt: c.updatedAt,
  };
}
