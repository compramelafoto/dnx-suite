import "server-only";
import { searchMembers, updateMember } from "@repo/db/fotoffice-members";
import { MEMBERS_MODULE_KEY } from "@/lib/members/constants";
import type { FieldValues, SyncablePerson } from "../person";
import type { ContactSource } from "./types";

/**
 * El padrón de socios como fuente de contactos.
 *
 * Lo único que este archivo decide es QUÉ es una persona para Socios y qué acepta que le
 * corrijan. Cómo se sincroniza no es asunto suyo.
 */

type MemberRow = {
  id: string;
  memberNumber: string;
  firstName: string;
  lastName: string;
  email: string | null;
  phone: string | null;
  address: string | null;
  city: string | null;
  province: string | null;
  postalCode: string | null;
  birthDate: Date | null;
  businessName: string | null;
  status: string;
  updatedAt: Date;
};

const ETIQUETAS_DE_ESTADO: Record<string, string> = {
  ACTIVE: "Activo",
  SUSPENDED: "Suspendido",
  INACTIVE: "Baja",
};

/** La fecha como texto: es la forma en que se compara con lo que devuelve Google. */
function fechaComoTexto(d: Date | null): string | null {
  if (!d) return null;
  return d.toISOString().slice(0, 10);
}

function limpio(v: string | null): string | null {
  return v && v.trim() !== "" ? v.trim() : null;
}

export function toSyncablePerson(
  member: MemberRow,
  categoryLabel: string | null,
): SyncablePerson {
  const values: FieldValues = {
    firstName: limpio(member.firstName),
    lastName: limpio(member.lastName),
    email: limpio(member.email),
    phone: limpio(member.phone),
    address: limpio(member.address),
    city: limpio(member.city),
    province: limpio(member.province),
    postalCode: limpio(member.postalCode),
    birthDate: fechaComoTexto(member.birthDate),
  };

  // Lo que se ve en la pantalla del contacto. Sirve justo cuando suena el teléfono.
  const labels: Record<string, string> = { "Nº de socio": member.memberNumber };
  if (categoryLabel) labels["Categoría"] = categoryLabel;
  const estado = ETIQUETAS_DE_ESTADO[member.status];
  if (estado) labels["Estado"] = estado;

  return {
    sourceId: member.id,
    values,
    organization: limpio(member.businessName),
    labels,
    updatedAt: member.updatedAt,
  };
}

export const memberContactSource: ContactSource = {
  moduleKey: MEMBERS_MODULE_KEY,
  sourceType: "MEMBER",
  moduleLabel: "Socios",

  // Todos los datos de contacto vuelven. Los institucionales —número, categoría, estado—
  // no están acá a propósito: nadie cambia de categoría editando un contacto en el celular.
  pullableFields: [
    "firstName",
    "lastName",
    "email",
    "phone",
    "address",
    "city",
    "province",
    "postalCode",
    "birthDate",
  ],

  async list(workspaceId) {
    // Solo los vigentes. Un socio de baja deja de pertenecer al grupo, pero su contacto
    // NO se borra: eso lo resuelve `sync.ts` comparando esta lista con los vínculos.
    const personas: SyncablePerson[] = [];
    let page = 1;
    for (;;) {
      const result = await searchMembers(workspaceId, { status: "ACTIVE", page });
      for (const m of result.items) {
        personas.push(toSyncablePerson(m as unknown as MemberRow, m.category?.name ?? null));
      }
      if (result.items.length === 0 || personas.length >= result.total) break;
      page += 1;
    }
    return personas;
  },

  async applyPull(workspaceId, sourceId, changes) {
    const data: Record<string, unknown> = {};
    for (const [campo, valor] of Object.entries(changes)) {
      data[campo] = campo === "birthDate" && valor ? new Date(`${valor}T00:00:00Z`) : valor;
    }
    if (Object.keys(data).length === 0) return;

    // `SYSTEM` y no un valor nuevo del enum: `MemberAuditSource` es un enum de Postgres y
    // agregarle un valor obligaría a migrarlo en las cinco bases de Neon. El `actorLabel`
    // deja el historial igual de legible: "Google Contacts" aparece en la ficha del socio.
    await updateMember(workspaceId, sourceId, data, {
      actor: { userId: null, label: "Google Contacts" },
      source: "SYSTEM",
      action: "UPDATED",
    });
  },
};
