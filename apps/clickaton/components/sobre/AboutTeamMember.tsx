import Image from "next/image";
import { ImagePlaceholder } from "@/components/formar-parte/ImagePlaceholder";
import type { TeamMemberData } from "@/content/sobre";
import { cn } from "@/lib/cn";

type AboutTeamMemberProps = {
  member: TeamMemberData;
  reverse?: boolean;
};

function highlightRoleText(text: string, highlight?: string) {
  if (!highlight || !text.includes(highlight)) {
    return text;
  }
  const index = text.indexOf(highlight);
  return (
    <>
      {text.slice(0, index)}
      <strong className="font-semibold text-ck-text">{highlight}</strong>
      {text.slice(index + highlight.length)}
    </>
  );
}

function BioParagraph({
  paragraph,
  clfMention,
}: {
  paragraph: string;
  clfMention?: TeamMemberData["clfMention"];
}) {
  if (!clfMention || !paragraph.includes(clfMention.label)) {
    return <p className="ck-body-md text-ck-text-secondary">{paragraph}</p>;
  }

  const index = paragraph.indexOf(clfMention.label);
  return (
    <p className="ck-body-md text-ck-text-secondary">
      {paragraph.slice(0, index)}
      <a
        href={clfMention.href}
        target="_blank"
        rel="noopener noreferrer"
        className="font-semibold text-ck-text underline-offset-4 transition-colors hover:text-ck-yellow hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ck-yellow"
      >
        {clfMention.label}
      </a>
      {paragraph.slice(index + clfMention.label.length)}
    </p>
  );
}

export function AboutTeamMember({ member, reverse = false }: AboutTeamMemberProps) {
  return (
    <article
      className={cn(
        "grid items-stretch gap-10 border-t border-ck-border pt-14 lg:grid-cols-2 lg:gap-16 lg:pt-20",
        reverse && "lg:[&>*:first-child]:order-2",
      )}
      aria-labelledby={`team-${member.id}-name`}
    >
      <div className="relative min-h-[22rem] overflow-hidden border border-ck-border bg-ck-surface-base/40 lg:min-h-[28rem]">
        {member.image.src ? (
          <Image
            src={member.image.src}
            alt={member.image.alt}
            fill
            sizes="(max-width: 1024px) 100vw, 50vw"
            className="object-cover object-center transition-transform duration-[var(--ck-duration-slow)] ease-[var(--ck-easing-standard)] hover:scale-[1.03] motion-reduce:hover:scale-100"
          />
        ) : (
          <ImagePlaceholder
            code={member.image.placeholderCode}
            label={member.image.placeholderLabel}
            className="h-full border-0"
            minHeightClassName="min-h-[22rem] lg:min-h-[28rem]"
          />
        )}
      </div>

      <div className="flex min-w-0 flex-col justify-center">
        <h3 id={`team-${member.id}-name`} className="ck-display-md text-ck-text">
          {member.name}
        </h3>
        <p className="ck-body-md mt-4 font-semibold text-ck-yellow">{member.specialties}</p>

        <div className="mt-8 space-y-4">
          {member.bio.map((paragraph) => (
            <BioParagraph
              key={paragraph.slice(0, 40)}
              paragraph={paragraph}
              clfMention={member.clfMention}
            />
          ))}
        </div>

        <div className="mt-10">
          <h4 className="ck-overline text-ck-yellow">{member.roleTitle}</h4>
          <div className="mt-5 space-y-4">
            {member.role.map((paragraph) => (
              <p key={paragraph.slice(0, 40)} className="ck-body-md text-ck-text-secondary">
                {highlightRoleText(paragraph, member.roleHighlight)}
              </p>
            ))}
          </div>
          {member.roleClosingHighlight ? (
            <p className="ck-body-md mt-4 font-semibold text-ck-text">
              {member.roleClosingHighlight}
            </p>
          ) : null}
        </div>

        <ul className="mt-10 flex flex-wrap gap-4">
          {member.socials.map((social) => (
            <li key={social.href}>
              <a
                href={social.href}
                target="_blank"
                rel="noopener noreferrer"
                className="ck-button-label inline-flex min-h-11 items-center border border-ck-border px-4 text-ck-text transition-[border-color,color,transform] duration-[var(--ck-duration-base)] ease-[var(--ck-easing-standard)] hover:-translate-y-0.5 hover:border-ck-yellow hover:text-ck-yellow focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ck-yellow motion-reduce:hover:translate-y-0"
              >
                Instagram {social.handle}
              </a>
            </li>
          ))}
        </ul>
      </div>
    </article>
  );
}
