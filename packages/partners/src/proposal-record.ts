/**
 * La propuesta guardada: su código, su vencimiento y su estado.
 *
 * Hasta acá el generador componía y devolvía; nada quedaba. Una propuesta que
 * no se guarda obliga al vendedor a rehacerla —y a volver a pedir el logo— cada
 * vez que el cliente responde tarde. Guardarla cuesta un código corto que se
 * pueda dictar por teléfono.
 *
 * Sin base de datos: acá vive lo que se puede razonar y probar solo. La unicidad
 * del código la garantiza el índice de Postgres, no esta lógica.
 */
import { PartnersDomainError } from "./types";

/**
 * Treinta y dos caracteres sin ambiguos.
 *
 * Sin `0`/`O` ni `1`/`I`: el código se dicta por teléfono y se copia a mano de
 * un PDF, y esas cuatro son las que se transcriben mal.
 */
export const PROPOSAL_CODE_ALPHABET = "23456789ABCDEFGHJKLMNPQRSTUVWXYZ";

export const PROPOSAL_CODE_PREFIX = "PR-";

/** Largo de la parte aleatoria. Con 32 caracteres son ~1.070 millones. */
export const PROPOSAL_CODE_LENGTH = 6;

/** Días que una propuesta sigue siendo recuperable. */
export const PROPOSAL_TTL_DAYS = 30;

export const DNX_PARTNER_PROPOSAL_STATUSES = [
  "DRAFT",
  "READY",
  "CONVERTED",
  "EXPIRED",
] as const;
export type DnxPartnerProposalStatus = (typeof DNX_PARTNER_PROPOSAL_STATUSES)[number];

const CODE_PATTERN = new RegExp(
  `^${PROPOSAL_CODE_PREFIX}[${PROPOSAL_CODE_ALPHABET}]{${PROPOSAL_CODE_LENGTH}}$`,
);

/**
 * Genera un código nuevo.
 *
 * `random` se inyecta para poder probarlo; en producción se le pasa el
 * generador criptográfico. Un `Math.random` alcanzaría para no repetir, pero no
 * para que un tercero no pueda adivinar el siguiente.
 */
export function generateProposalCode(random: (max: number) => number): string {
  let salida = "";
  for (let i = 0; i < PROPOSAL_CODE_LENGTH; i += 1) {
    const indice = random(PROPOSAL_CODE_ALPHABET.length);
    if (!Number.isInteger(indice) || indice < 0 || indice >= PROPOSAL_CODE_ALPHABET.length) {
      throw new PartnersDomainError(
        "VALIDATION",
        "El generador de aleatorios devolvió un índice fuera de rango del alfabeto.",
      );
    }
    salida += PROPOSAL_CODE_ALPHABET[indice];
  }
  return `${PROPOSAL_CODE_PREFIX}${salida}`;
}

/**
 * Deja el código como se guarda, o `null` si no puede serlo.
 *
 * Tolera lo que hace una persona al copiarlo: minúsculas, espacios, guiones de
 * más y el prefijo olvidado. Lo que no tolera es adivinar: una `O` no se
 * convierte en `0` porque el alfabeto no tiene ninguna de las dos.
 */
export function normalizeProposalCode(input: string | null | undefined): string | null {
  const limpio = String(input ?? "")
    .trim()
    .toUpperCase()
    .replace(/[\s_-]+/g, "");
  if (!limpio) return null;
  // Se prueban las dos lecturas porque `P` y `R` están en el alfabeto: un
  // cuerpo que arranca con «PR» y viene sin prefijo es válido igual.
  const cuerpos = limpio.startsWith("PR") ? [limpio.slice(2), limpio] : [limpio];
  for (const cuerpo of cuerpos) {
    const candidato = `${PROPOSAL_CODE_PREFIX}${cuerpo}`;
    if (CODE_PATTERN.test(candidato)) return candidato;
  }
  return null;
}

export function isProposalCode(input: string | null | undefined): boolean {
  return normalizeProposalCode(input) !== null;
}

/** Cuándo deja de ser recuperable una propuesta creada ahora. */
export function proposalExpiryFrom(now: Date, days: number = PROPOSAL_TTL_DAYS): Date {
  return new Date(now.getTime() + days * 24 * 60 * 60 * 1000);
}

export type ProposalLifetime = {
  status: DnxPartnerProposalStatus;
  expiresAt: Date;
};

/**
 * Si esta propuesta ya no se puede recuperar.
 *
 * Vence por fecha aunque en la base siga figurando `READY`: entre que vence y
 * que pasa el barrido hay horas, y en esas horas nadie debería poder abrirla.
 * Una convertida no vence —es historial— pero tampoco se reutiliza.
 */
export function isProposalExpired(proposal: ProposalLifetime, now: Date): boolean {
  if (proposal.status === "EXPIRED") return true;
  if (proposal.status === "CONVERTED") return false;
  return proposal.expiresAt.getTime() <= now.getTime();
}

/** Cuántos días le quedan, redondeando hacia arriba. Cero si ya venció. */
export function proposalDaysLeft(proposal: ProposalLifetime, now: Date): number {
  const restante = proposal.expiresAt.getTime() - now.getTime();
  if (restante <= 0) return 0;
  return Math.ceil(restante / (24 * 60 * 60 * 1000));
}
