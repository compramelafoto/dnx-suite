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

type MarathonDetailViewProps = {
  marathon: PublicMarathon;
};

export function MarathonDetailView({ marathon }: MarathonDetailViewProps) {
  return (
    <article>
      {marathon.isDemo ? <MarathonDemoBanner /> : null}
      <MarathonHero marathon={marathon} />
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
