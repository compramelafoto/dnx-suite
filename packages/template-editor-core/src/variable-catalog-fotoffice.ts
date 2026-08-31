import type { TemplateV2VariableGroup } from "./variable-catalog";

/**
 * Variables de FotoOffice: lo que una institución puede poner en una credencial, una placa o
 * una historia de bienvenida.
 *
 * Las claves son **las mismas** que ya entrega el renderizador del carnet
 * (`apps/fotoffice/lib/carnet/render.ts`). No es un detalle de prolijidad: si difirieran haría
 * falta una capa de traducción entre lo que se diseña y lo que se imprime, y esa capa sería
 * un lugar más donde una variable puede quedar en blanco sin que nadie lo note.
 *
 * Las marcadas como `requiredInV1` son las que el carnet siempre provee. Las demás dependen de
 * qué cargó cada institución: un socio puede no tener teléfono, y la plantilla tiene que
 * seguir imprimiéndose.
 */
export const FOTOFFICE_VARIABLE_GROUPS: TemplateV2VariableGroup[] = [
  {
    id: "socio",
    label: "Socio",
    variables: [
      {
        key: "fullName",
        label: "Nombre y apellido",
        group: "socio",
        valueType: "string",
        usableIn: ["TEXT"],
        requiredInV1: true,
        defaultFallback: null,
        formatters: ["none", "uppercase", "titleCase", "truncate"],
        description: "Nombre completo, como figura en el padrón.",
        sourcePath: "Member.firstName + Member.lastName",
      },
      {
        key: "firstName",
        label: "Nombre",
        group: "socio",
        valueType: "string",
        usableIn: ["TEXT"],
        requiredInV1: false,
        defaultFallback: null,
        formatters: ["none", "uppercase", "titleCase"],
        description: "Solo el nombre. Útil para un saludo.",
        sourcePath: "Member.firstName",
      },
      {
        key: "lastName",
        label: "Apellido",
        group: "socio",
        valueType: "string",
        usableIn: ["TEXT"],
        requiredInV1: false,
        defaultFallback: null,
        formatters: ["none", "uppercase", "titleCase"],
        description: "Solo el apellido.",
        sourcePath: "Member.lastName",
      },
      {
        key: "memberNumber",
        label: "Número de socio",
        group: "socio",
        valueType: "string",
        usableIn: ["TEXT"],
        requiredInV1: true,
        defaultFallback: null,
        formatters: ["none"],
        description: "El número que identifica al socio en el padrón.",
        sourcePath: "Member.memberNumber",
      },
      {
        key: "category",
        label: "Categoría",
        group: "socio",
        valueType: "string",
        usableIn: ["TEXT"],
        requiredInV1: false,
        defaultFallback: "—",
        formatters: ["none", "uppercase"],
        description: "Profesional, Estudiante, Honorario… según la institución.",
        sourcePath: "MemberCategory.name",
      },
      {
        key: "documentNumber",
        label: "Documento",
        group: "socio",
        valueType: "string",
        usableIn: ["TEXT"],
        requiredInV1: false,
        defaultFallback: "—",
        formatters: ["none"],
        description: "Número de documento. Puede estar vacío en el padrón.",
        sourcePath: "Member.documentNumber",
      },
      {
        key: "joinedAt",
        label: "Socio desde",
        group: "socio",
        valueType: "date",
        usableIn: ["TEXT"],
        requiredInV1: false,
        defaultFallback: "—",
        formatters: ["date.short", "date.long", "date.longUppercase"],
        description: "Fecha de alta. Sirve para mostrar antigüedad.",
        sourcePath: "Member.joinedAt",
      },
      {
        key: "photo",
        label: "Foto del socio",
        group: "socio",
        valueType: "imageUrl",
        usableIn: ["IMAGE"],
        requiredInV1: true,
        defaultFallback: null,
        formatters: ["none"],
        description: "La foto que el socio subió desde su portal.",
        sourcePath: "Member.avatarUrl",
      },
      {
        key: "email",
        label: "Email",
        group: "socio",
        valueType: "string",
        usableIn: ["TEXT"],
        requiredInV1: false,
        defaultFallback: "—",
        formatters: ["none"],
        description: "Correo del socio. 16 de los 152 no lo tienen cargado.",
        sourcePath: "Member.email",
      },
      {
        key: "phone",
        label: "Teléfono",
        group: "socio",
        valueType: "string",
        usableIn: ["TEXT"],
        requiredInV1: false,
        defaultFallback: "—",
        formatters: ["none"],
        description: "Teléfono de contacto.",
        sourcePath: "Member.phone",
      },
      {
        key: "city",
        label: "Ciudad",
        group: "socio",
        valueType: "string",
        usableIn: ["TEXT"],
        requiredInV1: false,
        defaultFallback: "—",
        formatters: ["none", "uppercase"],
        description: "Ciudad declarada por el socio.",
        sourcePath: "Member.city",
      },
    ],
  },
  {
    id: "credencial",
    label: "Credencial",
    variables: [
      {
        key: "cardNumber",
        label: "Número de credencial",
        group: "credencial",
        valueType: "string",
        usableIn: ["TEXT"],
        requiredInV1: true,
        defaultFallback: null,
        formatters: ["none"],
        description: "Identifica a esta credencial, no al socio: si se reemite, cambia.",
        sourcePath: "MemberCard.cardNumber",
      },
      {
        key: "validUntil",
        label: "Vigente hasta",
        group: "credencial",
        valueType: "date",
        usableIn: ["TEXT"],
        requiredInV1: true,
        defaultFallback: null,
        formatters: ["date.short", "date.long"],
        description: "Hasta cuándo vale esta credencial.",
        sourcePath: "MemberCard.validUntil",
      },
      {
        key: "verificationUrl",
        label: "URL de verificación",
        group: "credencial",
        valueType: "qrUrl",
        usableIn: ["TEXT"],
        requiredInV1: true,
        defaultFallback: null,
        formatters: ["none"],
        description:
          "La dirección que confirma si el socio está habilitado. Es lo que va en el QR: cambia con cada credencial, así que verifica a esa persona y no a otra.",
        sourcePath: "baseUrl + /c/:token",
      },
    ],
  },
  {
    id: "institucion",
    label: "Institución",
    variables: [
      {
        key: "institutionName",
        label: "Nombre de la institución",
        group: "institucion",
        valueType: "string",
        usableIn: ["TEXT"],
        requiredInV1: true,
        defaultFallback: null,
        formatters: ["none", "uppercase"],
        description: "El nombre comercial del workspace, o el del workspace si no tiene uno.",
        sourcePath: "FotofficeWorkspaceBranding.commercialName",
      },
      {
        key: "institutionLogo",
        label: "Logo de la institución",
        group: "institucion",
        valueType: "imageUrl",
        usableIn: ["IMAGE"],
        requiredInV1: false,
        defaultFallback: null,
        formatters: ["none"],
        description: "El logo cargado en la configuración del workspace.",
        sourcePath: "FotofficeWorkspaceBranding.logoUrl",
      },
    ],
  },
];

/**
 * Datos de muestra para la vista previa del editor. No son de nadie real: sirven para que el
 * diseñador vea cómo queda la plantilla antes de que exista una credencial de verdad.
 */
/**
 * Silueta de muestra para la vista previa. Va como dato incrustado y no como archivo remoto: la
 * vista previa se dibuja en el servidor y no tiene por qué depender de que una URL responda.
 *
 * Es deliberadamente sosa. Una foto bonita acá haría que el diseño se vea mejor de lo que se va
 * a ver con la foto real de un socio.
 */
export const FOTOFFICE_FIXTURE_PHOTO_DATA_URL =
  "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAGAAAACACAIAAAB7vvvtAAABTUlEQVR42u3auw3CQBBF0em/IzJCKkEioAcKsFkbCc/s50i3gpOsNPvi+XqrUSAABAgQIECAAAESIECAAAECBAiQAAECBAgQIECAErrdH+3WBTqk6YEp+qepZYpRaKqYYjidZKMYUSfTKAbVSTOKcXVyjGJonQQjQKVACTpXGwGqA0rTudQIECBAQwIl61xnBAgQIECAFgTyzAMCBMi5A9DoQE6ugHz7+Dj09Wy8YP6yyvzFgMoEz4hTgAABAgQIECBAAgQIECBA0wGV7FoKj9mA/go0gc6vRoAAAeoFaBqdn4wAAQLUBdBkOueNAAFKAJpS56QRIECAioEm1jljBAgQoEqg6XUOjQABAlQGtIhO2wgQIEA1QEvpNIwAAQJUALSgzjcjQIAAZQMtq7NrBAgQoFSgxXW2RoAAAcoDQrM1AgQIUBIQlF0jQAdAHwVqnh8npyVFAAAAAElFTkSuQmCC";

export function createFotofficeExampleData(
  overrides?: Record<string, unknown>
): Record<string, unknown> {
  return {
    fullName: "María Fernanda Gómez",
    firstName: "María Fernanda",
    lastName: "Gómez",
    memberNumber: "428",
    category: "Profesional",
    documentNumber: "28.114.507",
    joinedAt: "2014-03-15",
    photo: FOTOFFICE_FIXTURE_PHOTO_DATA_URL,
    email: "maria.gomez@example.com",
    phone: "+54 341 555-0142",
    city: "Rosario",
    cardNumber: "SFPR-2026-000428",
    validUntil: "2027-12-31",
    verificationUrl: "https://fotoffice.com/c/ejemplo",
    institutionName: "Sociedad de Fotógrafos Profesionales de Rosario",
    institutionLogo: FOTOFFICE_FIXTURE_PHOTO_DATA_URL,
    ...overrides,
  };
}
