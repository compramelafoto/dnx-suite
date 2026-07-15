/**
 * Regla oficial Clickatón (Etapa 09A).
 * Un evento es maratón oficial Clickatón solo si:
 *   experienceType = marathon
 *   AND distributionChannel = clickaton
 *
 * El canal solo no alcanza. Un concurso en canal Clickatón no es oficial.
 */

import { CLICKATON_PUBLIC_CHANNEL } from "@/config/public-channel";
import type {
  FotorankPublicDistributionChannelV1,
  FotorankPublicExperienceTypeV1,
} from "@/data/public-marathons/fotorank-v1-types";

export function isOfficialClickatonMarathon(input: {
  experienceType: FotorankPublicExperienceTypeV1 | string | null | undefined;
  distributionChannel:
    | FotorankPublicDistributionChannelV1
    | string
    | null
    | undefined;
}): boolean {
  return (
    input.experienceType === "marathon" &&
    input.distributionChannel === CLICKATON_PUBLIC_CHANNEL
  );
}
