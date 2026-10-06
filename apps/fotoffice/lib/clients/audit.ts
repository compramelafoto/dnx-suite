import type { ClientFormValues } from "./client-form";

/**
 * Campos del cliente que se comparan para el historial. Son los del formulario menos `notes`:
 * las observaciones pasaron a ser notas de la ficha y ya no se editan acá.
 */
export const CAMPOS_AUDITADOS_CLIENTE = [
  "kind",
  "firstName",
  "lastName",
  "businessName",
  "docType",
  "docNumber",
  "ivaCondition",
  "email",
  "phone",
  "address",
  "city",
  "status",
] as const satisfies readonly Exclude<keyof ClientFormValues, "notes">[];

export const ETIQUETAS_CAMPO_CLIENTE: Record<string, string> = {
  kind: "Tipo",
  firstName: "Nombre",
  lastName: "Apellido",
  businessName: "Razón social",
  docType: "Tipo de documento",
  docNumber: "Número de documento",
  ivaCondition: "Condición frente al IVA",
  email: "Correo",
  phone: "Teléfono",
  address: "Domicilio",
  city: "Ciudad",
  status: "Estado",
  // Perfil ampliado del contacto (etapa 1, `lib/contactos/perfil.ts`): mismo historial.
  category: "Categoría",
  mobile: "Celular",
  email2: "Segundo correo",
  birthday: "Cumpleaños",
  website: "Sitio web",
  province: "Provincia",
  country: "País",
  postalCode: "Código postal",
  about: "Sobre",
};
