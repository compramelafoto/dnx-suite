import type { ReactNode } from "react";
import {
  groupPartnersForPublicDisplay,
  type DnxPartnerInstitutionalRole,
  type PublicPartnerDisplayItem,
  type PublicPartnerGroup,
} from "@repo/partners";
import { Container } from "@/components/layout/Container";
import { Section } from "@/components/layout/Section";
import { SectionHeader } from "@/components/layout/SectionHeader";
import { Badge } from "@/components/ui/Badge";
import { EditionPartnerLogoMarquee } from "@/components/marathon/EditionPartnerLogoMarquee";
import {
  isClickatonPartnersPublicEnabled,
  listEditionPartnerPublicGroups,
} from "@/lib/public/edition-partners-public";
import type { PublicMarathon } from "@/types/marathon";

type MarathonSponsorsProps = {
  marathon: PublicMarathon;
};

/** Solo organizadores fijos; sponsors/colaboradores en marquee. */
const STATIC_ROLES = new Set<DnxPartnerInstitutionalRole>([
  "ORGANIZER",
  "CO_ORGANIZER",
]);

const TIER_SLOT: Record<string, string> = {
  INSTITUTIONAL: "h-24 w-[20rem] sm:h-28 sm:w-[24rem]",
  MAIN: "h-20 w-[18rem] sm:h-24 sm:w-[22rem]",
  STANDARD: "h-20 w-[16rem] sm:h-24 sm:w-[20rem]",
  SUPPORTING: "h-20 w-[16rem] sm:h-24 sm:w-[18rem]",
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
    publicVisibility: "PUBLIC",
  }));
  return groupPartnersForPublicDisplay(items);
}

function partnerHref(item: PublicPartnerDisplayItem): string | null {
  const href = item.websiteUrl?.trim() || null;
  if (!href) return null;
  if (href.startsWith("/r/") || href.startsWith("http") || href.startsWith("/")) return href;
  return `https://${href}`;
}

function PartnerLogo({ item }: { item: PublicPartnerDisplayItem }) {
  if (!item.logoUrl) {
    return (
      <span className="text-center text-xl font-medium text-ck-text">{item.partnerName}</span>
    );
  }
  const slot = TIER_SLOT[item.displayTier] ?? TIER_SLOT.STANDARD;
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={item.logoUrl}
      alt={`Logo de ${item.partnerName}`}
      className={`mx-auto object-contain object-center ${slot}`}
    />
  );
}

function PartnerLinkWrap({
  item,
  children,
  className,
}: {
  item: PublicPartnerDisplayItem;
  children: ReactNode;
  className?: string;
}) {
  const href = partnerHref(item);
  if (!href) {
    return <div className={className}>{children}</div>;
  }
  const isTracked = href.startsWith("/r/");
  return (
    // eslint-disable-next-line react/jsx-no-target-blank -- rel fijo
    <a
      href={href}
      target={isTracked ? undefined : "_blank"}
      rel={isTracked ? undefined : "noopener noreferrer"}
      className={`cursor-pointer no-underline ${className ?? ""}`}
    >
      {children}
    </a>
  );
}

function OrganizerRow({ items }: { items: PublicPartnerDisplayItem[] }) {
  return (
    <ul className="m-0 flex list-none flex-wrap items-center justify-center gap-10 p-0 sm:gap-14">
      {items.map((item) => (
        <li key={item.participationId}>
          <PartnerLinkWrap item={item} className="flex flex-col items-center justify-center">
            <PartnerLogo item={item} />
          </PartnerLinkWrap>
        </li>
      ))}
    </ul>
  );
}

function PartnerGroupBlock({ group }: { group: PublicPartnerGroup }) {
  const useMarquee = !STATIC_ROLES.has(group.role);

  return (
    <div className="space-y-6">
      {useMarquee ? (
        <EditionPartnerLogoMarquee
          heading={group.heading}
          items={group.items.map((item) => ({
            participationId: item.participationId,
            partnerName: item.partnerName,
            logoUrl: item.logoUrl ?? null,
            websiteUrl: item.websiteUrl ?? null,
            displayTier: item.displayTier,
          }))}
        />
      ) : (
        <OrganizerRow items={group.items} />
      )}
    </div>
  );
}

function PartnerGroups({ groups }: { groups: PublicPartnerGroup[] }) {
  if (groups.length === 0) return null;
  return (
    <div className="mt-10 space-y-14">
      {groups.map((group) => (
        <PartnerGroupBlock key={group.role} group={group} />
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
