import { documentChanged, normalizeDocument } from "@/lib/members/documents";

/**
 * Los datos personales que el socio edita en su propio portal.
 *
 * Función PURA: no toca la base ni la sesión, así que lo que decide se puede probar. Es la
 * única puerta por la que el portal escribe sobre la ficha, y por eso la lista de campos está
 * escrita a mano: cualquier cosa que llegue en el formulario y no esté acá —número de socio,
 * estado, categoría, observaciones internas— se descarta antes de llegar a Prisma. Un POST
 * armado a mano no puede ascenderse de categoría ni reactivarse una baja.
 *
 * Comparte los normalizadores de documento con el alta y con el import CSV a propósito: si el
 * panel guarda el DNI sin puntos y el portal lo guardara con puntos, el mismo socio quedaría
 * escrito de dos formas según por dónde entró.
 */

export type DatosPersonalesInput = {
  firstName?: string | null;
  lastName?: string | null;
  documentType?: string | null;
  documentNumber?: string | null;
  email?: string | null;
  phone?: string | null;
  /** "AAAA-MM-DD", tal como lo manda un <input type="date">. */
  birthDate?: string | null;
  address?: string | null;
  city?: string | null;
  province?: string | null;
  postalCode?: string | null;
};

/** Lo guardado hoy. Solo se mira el documento, y solo para no revalidar lo que nadie tocó. */
export type DocumentoGuardado = {
  documentType: string | null;
  documentNumber: string | null;
};

export type DatosPersonales = {
  firstName: string;
  lastName: string;
  documentType: string | null;
  documentNumber: string | null;
  email: string | null;
  phone: string | null;
  birthDate: Date | null;
  address: string | null;
  city: string | null;
  province: string | null;
  postalCode: string | null;
};

export type ResultadoDatosPersonales =
  | { ok: true; data: DatosPersonales }
  | { ok: false; error: string; field?: string };

const MAX = {
  firstName: 100,
  lastName: 100,
  email: 200,
  phone: 60,
  address: 200,
  city: 120,
  province: 120,
  postalCode: 20,
} as const;

/** Una fecha del calendario, sin hora ni zona: el día que la persona eligió. */
const FECHA_SIMPLE = /^\d{4}-\d{2}-\d{2}$/;

/**
 * Chequeo deliberadamente permisivo: "tiene algo, un arroba, algo, un punto y algo". No se
 * intenta decidir si la casilla existe —eso solo lo prueba un email entregado— y una regla más
 * estricta rechazaría direcciones legítimas.
 */
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function texto(v: string | null | undefined): string {
  return String(v ?? "").trim();
}

/** Vacío es ausencia de dato, y la ausencia se guarda como null: "" duplicaría el vacío. */
function textoONull(v: string | null | undefined): string | null {
  return texto(v) || null;
}

export function parseDatosPersonales(
  raw: DatosPersonalesInput,
  guardado: DocumentoGuardado,
  ahora: Date = new Date(),
): ResultadoDatosPersonales {
  const firstName = texto(raw.firstName);
  if (!firstName) {
    return { ok: false, error: "Escribí tu nombre.", field: "firstName" };
  }
  if (firstName.length > MAX.firstName) {
    return { ok: false, error: "El nombre es demasiado largo.", field: "firstName" };
  }

  const lastName = texto(raw.lastName);
  if (!lastName) {
    return { ok: false, error: "Escribí tu apellido.", field: "lastName" };
  }
  if (lastName.length > MAX.lastName) {
    return { ok: false, error: "El apellido es demasiado largo.", field: "lastName" };
  }

  const doc = normalizeDocument(raw.documentType, raw.documentNumber);
  // Validación NO retroactiva: solo se exige el formato si el documento cambió respecto del
  // guardado. Mismo criterio que la edición del panel — el padrón migrado tiene documentos
  // que hoy no pasarían, y quien los tenga igual tiene que poder corregir su teléfono.
  if (
    doc.validationStatus === "INVALID" &&
    documentChanged(
      guardado.documentType,
      guardado.documentNumber,
      raw.documentType,
      raw.documentNumber,
    )
  ) {
    return {
      ok: false,
      error: doc.message ?? "Revisá el número de documento.",
      field: "documentNumber",
    };
  }

  const emailCrudo = texto(raw.email);
  if (emailCrudo && !EMAIL.test(emailCrudo)) {
    return { ok: false, error: "Revisá el email: no parece una dirección válida.", field: "email" };
  }
  if (emailCrudo.length > MAX.email) {
    return { ok: false, error: "El email es demasiado largo.", field: "email" };
  }
  const email = emailCrudo ? emailCrudo.toLowerCase() : null;

  const fecha = parsearNacimiento(raw.birthDate, ahora);
  if (!fecha.ok) return fecha;

  for (const campo of ["phone", "address", "city", "province", "postalCode"] as const) {
    if (texto(raw[campo]).length > MAX[campo]) {
      return { ok: false, error: "Ese dato es demasiado largo.", field: campo };
    }
  }

  return {
    ok: true,
    data: {
      firstName,
      lastName,
      // Los dos salen de la normalización: sin documento quedan en null (nunca ""), y con
      // documento quedan en su forma canónica.
      documentType: doc.canonicalType,
      documentNumber: doc.normalizedNumber,
      email,
      phone: textoONull(raw.phone),
      birthDate: fecha.valor,
      address: textoONull(raw.address),
      city: textoONull(raw.city),
      province: textoONull(raw.province),
      postalCode: textoONull(raw.postalCode),
    },
  };
}

/**
 * La fecha se arma en UTC a medianoche, no con `new Date("...")` sobre un texto con hora: la
 * ficha guarda el día, y un desfase de zona lo correría un día para atrás en todo el padrón.
 */
function parsearNacimiento(
  raw: string | null | undefined,
  ahora: Date,
): { ok: true; valor: Date | null } | { ok: false; error: string; field: string } {
  const t = texto(raw);
  if (!t) return { ok: true, valor: null };

  if (!FECHA_SIMPLE.test(t)) {
    return { ok: false, error: "Revisá tu fecha de nacimiento.", field: "birthDate" };
  }
  const [anio, mes, dia] = t.split("-").map(Number) as [number, number, number];
  const d = new Date(Date.UTC(anio, mes - 1, dia));
  // Rebota los días que no existen: "2026-02-31" se convertiría solo en el 3 de marzo.
  if (
    Number.isNaN(d.getTime()) ||
    d.getUTCFullYear() !== anio ||
    d.getUTCMonth() !== mes - 1 ||
    d.getUTCDate() !== dia
  ) {
    return { ok: false, error: "Esa fecha de nacimiento no existe.", field: "birthDate" };
  }
  if (d.getTime() > ahora.getTime()) {
    return { ok: false, error: "La fecha de nacimiento no puede ser futura.", field: "birthDate" };
  }
  return { ok: true, valor: d };
}
