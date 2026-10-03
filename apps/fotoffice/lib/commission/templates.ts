/**
 * Plantillas de la Comisión directiva (diseño de Roles §5 y §12.4).
 *
 * Se copian a cada institución la primera vez que abre la Comisión directiva; desde ahí son
 * suyas: las renombra, cambia la grilla o las archiva. Nombrar módulos todavía planificados es a
 * propósito: cuando se encienda Gobierno, la Secretaría ya lo tiene, sin tocar nada.
 */

import { CASH_CONFIGURE_ACTION, CASH_PROJECT_MONEY_ACTION } from "@/lib/permissions/actions";

// Se movió al catálogo de acciones; se reexporta para no romper los imports existentes.
export { CASH_PROJECT_MONEY_ACTION };

export type RoleTemplate = {
  key: string;
  name: string;
  description: string;
  permissions: readonly { moduleKey: string; level: "VIEW" | "MANAGE"; actions?: readonly string[] }[];
};

export type OfficeTemplate = { key: string; name: string; votes: boolean; order: number };

const V = "VIEW" as const;
const M = "MANAGE" as const;

export const ROLE_TEMPLATES: readonly RoleTemplate[] = [
  {
    key: "president",
    name: "Presidencia",
    description: "Ve todo y conduce proyectos y reuniones. No carga plata.",
    permissions: [
      { moduleKey: "members", level: V },
      { moduleKey: "membership-dues", level: V },
      { moduleKey: "cash", level: V },
      { moduleKey: "bookings", level: V },
      { moduleKey: "raffles", level: V },
      { moduleKey: "courses-sales", level: V },
      { moduleKey: "website", level: V },
      { moduleKey: "communications", level: V },
      { moduleKey: "events", level: V },
      { moduleKey: "exhibitions", level: V },
      { moduleKey: "transparency", level: V },
      { moduleKey: "governance", level: M },
    ],
  },
  {
    key: "secretary",
    name: "Secretaría",
    description: "Padrón, altas, carnets, actas y reuniones.",
    permissions: [
      { moduleKey: "members", level: M },
      { moduleKey: "membership-dues", level: V },
      { moduleKey: "governance", level: M },
    ],
  },
  {
    key: "treasury",
    name: "Tesorería",
    description: "Cuotas, Caja y la plata de los proyectos.",
    permissions: [
      { moduleKey: "members", level: V },
      { moduleKey: "membership-dues", level: M },
      { moduleKey: "cash", level: M, actions: [CASH_PROJECT_MONEY_ACTION, CASH_CONFIGURE_ACTION] },
      { moduleKey: "governance", level: V },
    ],
  },
  {
    key: "auditor",
    name: "Revisor de cuentas",
    description: "Órgano fiscalizador: sólo lectura de la plata y de los proyectos.",
    permissions: [
      { moduleKey: "membership-dues", level: V },
      { moduleKey: "cash", level: V },
      { moduleKey: "transparency", level: V },
      { moduleKey: "governance", level: V },
    ],
  },
  {
    key: "communication",
    name: "Comunicación",
    description: "Sitio, blog y correos. Ve la ficha y las redes de los socios; nunca la plata.",
    permissions: [
      { moduleKey: "website", level: M },
      { moduleKey: "communications", level: M },
      { moduleKey: "members", level: V },
      { moduleKey: "raffles", level: V },
      { moduleKey: "portfolio", level: V },
    ],
  },
  {
    key: "education",
    name: "Formación",
    description: "Cursos y evaluaciones.",
    permissions: [
      { moduleKey: "courses-sales", level: M },
      { moduleKey: "evaluaciones", level: M },
    ],
  },
  {
    key: "culture",
    name: "Cultura y eventos",
    description: "Eventos, muestras y sorteos.",
    permissions: [
      { moduleKey: "events", level: M },
      { moduleKey: "exhibitions", level: M },
      { moduleKey: "raffles", level: M },
      { moduleKey: "members", level: V },
    ],
  },
  {
    key: "spaces",
    name: "Espacios",
    description: "Reservas: agenda, espacios y tarifas.",
    permissions: [{ moduleKey: "bookings", level: M }],
  },
  {
    key: "partnerships",
    name: "Alianzas y beneficios",
    description: "Recomendados, partners y premios.",
    permissions: [{ moduleKey: "raffles", level: V }],
  },
  {
    key: "member-support",
    name: "Atención al socio",
    description: "Para personal administrativo: consulta socios, cuotas y reservas.",
    permissions: [
      { moduleKey: "members", level: V },
      { moduleKey: "membership-dues", level: V },
      { moduleKey: "bookings", level: V },
    ],
  },
  {
    key: "board-member",
    name: "Vocal",
    description: "Lectura general y proyectos.",
    permissions: [
      { moduleKey: "members", level: V },
      { moduleKey: "governance", level: V },
    ],
  },
];

export const OFFICE_TEMPLATES: readonly OfficeTemplate[] = [
  { key: "president", name: "Presidente", votes: true, order: 10 },
  { key: "vice-president", name: "Vicepresidente", votes: true, order: 20 },
  { key: "secretary", name: "Secretario", votes: true, order: 30 },
  { key: "pro-secretary", name: "Prosecretario", votes: true, order: 40 },
  { key: "treasurer", name: "Tesorero", votes: true, order: 50 },
  { key: "pro-treasurer", name: "Protesorero", votes: true, order: 60 },
  { key: "board-member", name: "Vocal titular", votes: true, order: 70 },
  { key: "alternate-board-member", name: "Vocal suplente", votes: true, order: 80 },
  { key: "auditor", name: "Revisor de cuentas", votes: false, order: 90 },
];
