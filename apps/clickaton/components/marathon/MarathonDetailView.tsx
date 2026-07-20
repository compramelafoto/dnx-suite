import { MarathonCategories } from "@/components/marathon/MarathonCategories";
import { MarathonChallengesNotice } from "@/components/marathon/MarathonChallengesNotice";
import { MarathonDemoBanner } from "@/components/marathon/MarathonDemoBanner";
import { MarathonFAQ } from "@/components/marathon/MarathonFAQ";
import { MarathonHero } from "@/components/marathon/MarathonHero";
import { MarathonJury } from "@/components/marathon/MarathonJury";
import { MarathonKeyFacts } from "@/components/marathon/MarathonKeyFacts";
import { MarathonOrganizer } from "@/components/marathon/MarathonOrganizer";
import { MarathonPrizes } from "@/components/marathon/MarathonPrizes";
import { MarathonResultsPlaceholder } from "@/components/marathon/MarathonResultsPlaceholder";
import { MarathonRules } from "@/components/marathon/MarathonRules";
import { MarathonSchedule } from "@/components/marathon/MarathonSchedule";
import { MarathonSponsors } from "@/components/marathon/MarathonSponsors";
import { MarathonValidations } from "@/components/marathon/MarathonValidations";
import type { PublicMarathon } from "@/types/marathon";
import type { PublicMarathonCapabilities } from "@/types/public";

type MarathonDetailViewProps = {
  marathon: PublicMarathon;
  capabilities?: PublicMarathonCapabilities | null;
  nativeRegistrationHref?: string | null;
  nativeRegistrationLabel?: string | null;
};

export function MarathonDetailView({
  marathon,
  capabilities = null,
  nativeRegistrationHref = null,
  nativeRegistrationLabel = null,
}: MarathonDetailViewProps) {
  return (
    <article>
      {marathon.isDemo ? <MarathonDemoBanner /> : null}
      <MarathonHero
        marathon={marathon}
        capabilities={capabilities}
        nativeRegistrationHref={nativeRegistrationHref}
        nativeRegistrationLabel={nativeRegistrationLabel}
      />
      <MarathonKeyFacts marathon={marathon} />
      <MarathonSchedule marathon={marathon} />
      <MarathonCategories marathon={marathon} />
      <MarathonRules marathon={marathon} />
      <MarathonValidations marathon={marathon} />
      <MarathonChallengesNotice marathon={marathon} />
      <MarathonPrizes marathon={marathon} />
      <MarathonJury marathon={marathon} />
      <MarathonSponsors marathon={marathon} />
      <MarathonOrganizer marathon={marathon} />
      <MarathonResultsPlaceholder marathon={marathon} />
      <MarathonFAQ marathon={marathon} />
    </article>
  );
}
