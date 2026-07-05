import { prisma } from "@/lib/prisma";

export const PACK_EMPTY_ACTIVATION_MESSAGE =
  "Este pack todavía no tiene productos incluidos. Agregá al menos un producto antes de publicarlo.";

export class PackActivationError extends Error {
  constructor(message: string = PACK_EMPTY_ACTIVATION_MESSAGE) {
    super(message);
    this.name = "PackActivationError";
  }
}

export async function countBenefitsForPack(packDefinitionId: number): Promise<number> {
  return prisma.benefitDefinition.count({
    where: { packDefinitionId },
  });
}

/** Impide activar/publicar un pack sin BenefitDefinition. */
export async function assertPackHasBenefitsForActivation(
  packDefinitionId: number
): Promise<void> {
  const count = await countBenefitsForPack(packDefinitionId);
  if (count === 0) {
    throw new PackActivationError();
  }
}
