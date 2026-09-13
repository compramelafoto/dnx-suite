import {
  CLIENT_KINDS,
  DOC_TYPES,
  IVA_CONDITIONS,
  type ClientKind,
  type DocType,
  type IvaCondition,
} from "./constants";

/**
 * Validación del formulario de un cliente. Módulo PURO: sin base y sin red.
 *
 * La validación fiscal es deliberadamente estricta en un solo punto —un responsable
 * inscripto necesita CUIT— y laxa en todo el resto. El mostrador tiene que poder dar de
 * alta a alguien con el nombre y nada más, porque si no, nadie lo carga y el padrón queda
 * vacío. Pero si alguien declara que es responsable inscripto, sin CUIT no se le va a poder
 * facturar, y descubrirlo seis meses después es peor que frenarlo ahora.
 */

export type ClientFormValues = {
  kind: ClientKind;
  firstName: string | null;
  lastName: string | null;
  businessName: string | null;
  docType: DocType | null;
  docNumber: string | null;
  ivaCondition: IvaCondition;
  email: string | null;
  phone: string | null;
  address: string | null;
  city: string | null;
  notes: string | null;
  status: "ACTIVO" | "INACTIVO";
};

export type ClientFormResult =
  | { ok: true; values: ClientFormValues }
  | { ok: false; error: string };

function texto(fd: FormData, campo: string): string | null {
  const v = String(fd.get(campo) ?? "").trim();
  return v === "" ? null : v;
}

/** Un correo válido de verdad, sin pretender implementar el RFC. */
function correoValido(v: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v);
}

export function parseClientForm(formData: FormData): ClientFormResult {
  const kindRaw = String(formData.get("kind") ?? "PERSONA").trim();
  if (!CLIENT_KINDS.includes(kindRaw as ClientKind)) {
    return { ok: false, error: "Elegí si es una persona o una empresa." };
  }
  const kind = kindRaw as ClientKind;

  const firstName = texto(formData, "firstName");
  const lastName = texto(formData, "lastName");
  const businessName = texto(formData, "businessName");

  if (kind === "EMPRESA" && businessName === null) {
    return { ok: false, error: "Poné la razón social de la empresa." };
  }
  if (kind === "PERSONA" && firstName === null && lastName === null) {
    return { ok: false, error: "Poné al menos el nombre o el apellido." };
  }

  const ivaRaw = String(formData.get("ivaCondition") ?? "CONSUMIDOR_FINAL").trim();
  if (!IVA_CONDITIONS.includes(ivaRaw as IvaCondition)) {
    return { ok: false, error: "Esa condición frente al IVA no existe." };
  }
  const ivaCondition = ivaRaw as IvaCondition;

  const docTypeRaw = texto(formData, "docType");
  if (docTypeRaw !== null && !DOC_TYPES.includes(docTypeRaw as DocType)) {
    return { ok: false, error: "Ese tipo de documento no existe." };
  }
  const docType = docTypeRaw as DocType | null;

  // Los separadores que la gente escribe: 20-12.345.678-9.
  const docCrudo = texto(formData, "docNumber");
  const docNumber = docCrudo === null ? null : docCrudo.replace(/[.\-\s]/g, "");

  if (docNumber !== null && docType === null) {
    return { ok: false, error: "Elegí el tipo de documento." };
  }
  if (docType === "CUIT" || docType === "CUIL") {
    if (docNumber === null || !/^\d{11}$/.test(docNumber)) {
      return { ok: false, error: `El ${docType} tiene que tener once dígitos.` };
    }
  }
  if (docType === "DNI" && docNumber !== null && !/^\d{7,8}$/.test(docNumber)) {
    return { ok: false, error: "El DNI tiene que tener siete u ocho dígitos." };
  }

  // El único requisito fiscal duro: sin CUIT no hay factura A.
  if (ivaCondition === "RESPONSABLE_INSCRIPTO" && !(docType === "CUIT" && docNumber !== null)) {
    return {
      ok: false,
      error: "Un responsable inscripto necesita CUIT para poder facturarle.",
    };
  }

  const emailCrudo = texto(formData, "email");
  const email = emailCrudo === null ? null : emailCrudo.toLowerCase();
  if (email !== null && !correoValido(email)) {
    return { ok: false, error: "Ese correo no se entiende." };
  }

  const statusRaw = String(formData.get("status") ?? "ACTIVO").trim();
  const status = statusRaw === "INACTIVO" ? "INACTIVO" : "ACTIVO";

  return {
    ok: true,
    values: {
      kind,
      firstName,
      lastName,
      businessName,
      docType,
      docNumber,
      ivaCondition,
      email,
      phone: texto(formData, "phone"),
      address: texto(formData, "address"),
      city: texto(formData, "city"),
      notes: texto(formData, "notes"),
      status,
    },
  };
}
