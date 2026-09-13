/**
 * A quién de los que ya están se parece este contacto. Módulo PURO.
 *
 * El orden no es casual: documento, después correo, después teléfono. El documento
 * identifica a una persona; el correo y el teléfono identifican a un contacto, y un
 * matrimonio comparte teléfono más seguido de lo que comparte DNI.
 *
 * Nunca empareja por un campo nulo: dos clientes sin documento no son la misma persona.
 */

export type ClientCandidate = {
  id: string;
  docNumber: string | null;
  email: string | null;
  phone: string | null;
};

export type ClientLookup = {
  docNumber?: string | null;
  email?: string | null;
  phone?: string | null;
};

const soloDigitos = (v: string) => v.replace(/\D/g, "");
const normalizarCorreo = (v: string) => v.trim().toLowerCase();

export function matchExistingClient<T extends ClientCandidate>(
  candidates: readonly T[],
  input: ClientLookup,
): T | null {
  const doc = input.docNumber ? soloDigitos(input.docNumber) : null;
  if (doc) {
    const porDoc = candidates.find((c) => c.docNumber && soloDigitos(c.docNumber) === doc);
    if (porDoc) return porDoc;
  }

  const mail = input.email ? normalizarCorreo(input.email) : null;
  if (mail) {
    const porMail = candidates.find((c) => c.email && normalizarCorreo(c.email) === mail);
    if (porMail) return porMail;
  }

  const tel = input.phone ? soloDigitos(input.phone) : null;
  if (tel) {
    const porTel = candidates.find((c) => c.phone && soloDigitos(c.phone) === tel);
    if (porTel) return porTel;
  }

  return null;
}
