import {
  groupPartnersForPublicDisplay,
  type PublicPartnerDisplayItem,
  type PublicPartnerGroup,
} from "@repo/partners";
import { Container } from "@/components/layout/Container";
import { Section } from "@/components/layout/Section";
import { SectionHeader } from "@/components/layout/SectionHeader";
import { Badge } from "@/components/ui/Badge";
import { Card } from "@/components/ui/Card";
import {
  isClickatonPartnersPublicEnabled,
  listEditionPartnerPublicGroups,
} from "@/lib/public/edition-partners-public";
import type { PublicMarathon } from "@/types/marathon";

type MarathonSponsorsProps = {
  marathon: PublicMarathon;
};

const TIER_CLASS: Record<string, string> = {
  INSTITUTIONAL: "min-h-[7rem] sm:col-span-2",
  MAIN: "min-h-[6rem]",
  STANDARD: "min-h-[5rem]",
  SUPPORTING: "min-h-[4.5rem] opacity-95",
};

function legacyGroups(marathon: PublicMarathon): PublicPartnerGroup[] {
  if (marathon.sponsors.length === 0) return [];
  const items: PublicPartnerDisplayItem[] = marathon.sponsors.map((s, idx) => ({
    participationId: s.id,
    partnerId: s.id,
    partnerName: s.name,
    logoUrl: null,
    websiteUrl: null,
    institutionalRole: "SPONSOR",
    displayTier: s.level?.toLowerCase().includes("principal") ? "MAIN" : "STANDARD",
    displayOrder: idx * 10,
    publicRoleLabel: s.level ?? null,
    resolvedRoleLabel: s.level ?? "Sponsor",
    title: s.level,
    description: s.description,
    status: "ACTIVE",
  }));
  return groupPartnersForPublicDisplay(items);
}

function PartnerGroups({ groups }: { groups: PublicPartnerGroup[] }) {
  if (groups.length === 0) return null;
  return (
    <div className="mt-10 space-y-12">
      {groups.map((group) => (
        <div key={group.role} className="space-y-6">
          <h3 className="ck-heading-md text-ck-text">{group.heading}</h3>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {group.items.map((item) => {
              const href = item.websiteUrl?.trim() || null;
              const isTracked = Boolean(href?.startsWith("/r/"));
              const body = (
                <>
                  {item.logoUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={item.logoUrl}
                      alt=""
                      className={
                        item.displayTier === "INSTITUTIONAL"
                          ? "mx-auto h-16 w-auto object-contain"
                          : item.displayTier === "MAIN"
                            ? "mx-auto h-14 w-auto object-contain"
                            : "mx-auto h-10 w-auto object-contain"
                      }
                    />
                  ) : null}
                  <div className="text-center">
                    <h4 className="ck-heading-sm">{item.partnerName}</h4>
                    {item.resolvedRoleLabel ? (
                      <p className="ck-label mt-2 text-ck-text-muted">{item.resolvedRoleLabel}</p>
                    ) : null}
                    {item.description ? (
                      <p className="ck-body-sm mt-3 text-ck-text-secondary">{item.description}</p>
                    ) : null}
                  </div>
                </>
              );
              return (
                <Card
                  key={item.participationId}
                  variant="outlined"
                  className={`flex h-full flex-col justify-center gap-3 p-6 ${TIER_CLASS[item.displayTier] ?? ""}`}
                >
                  {href ? (
                    <a
                      href={
                        isTracked
                          ? href
                          : href.startsWith("http")
                            ? href
                            : `https://${href}`
                      }
                      target={isTracked ? undefined : "_blank"}
                      rel={isTracked ? undefined : "noopener noreferrer"}
                      className="flex h-full flex-col justify-center gap-3 no-underline"
                    >
                      {body}
                    </a>
                  ) : (
                    body
                  )}
                </Card>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}

export async function MarathonSponsors({ marathon }: MarathonSponsorsProps) {
  if (!isClickatonPartnersPublicEnabled()) return null;

  let groups: PublicPartnerGroup[] = [];
  try {
    groups = await listEditionPartnerPublicGroups(marathon.id);
  } catch {
    groups = [];
  }
  if (groups.length === 0) {
    groups = legacyGroups(marathon);
  }
  if (groups.length === 0) return null;

  return (
    <Section aria-labelledby="marathon-sponsors-title">
      <Container>
        <SectionHeader
          eyebrow="Instituciones y alianzas"
          title="Quiénes hacen posible la edición"
          description="Organizan, auspician y colaboran. Los roles son institucionales; no se infieren por aportes."
          titleId="marathon-sponsors-title"
        />
        <PartnerGroups groups={groups} />
        {marathon.sponsors.some((s) => s.localOrGlobal) ? (
          <div className="mt-6 flex flex-wrap gap-2">
            {marathon.sponsors.map((s) =>
              s.localOrGlobal ? (
                <Badge key={`lg-${s.id}`} variant="neutral">
                  {s.name}: {s.localOrGlobal === "local" ? "Local" : "Global"}
                </Badge>
              ) : null,
            )}
          </div>
        ) : null}
      </Container>
    </Section>
  );
}
