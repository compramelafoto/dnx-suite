import { Container } from "@/components/layout/Container";
import { Section } from "@/components/layout/Section";
import { AboutTeamMember } from "@/components/sobre/AboutTeamMember";
import { sobrePageContent } from "@/content/sobre";

const { team } = sobrePageContent;

export function AboutTeam() {
  return (
    <Section
      id="equipo"
      tone="raised"
      className="scroll-mt-28 py-20 sm:py-28 lg:py-36"
      aria-labelledby="sobre-team-title"
    >
      <Container>
        <div className="max-w-3xl">
          <h2 id="sobre-team-title" className="ck-display-lg text-ck-text">
            {team.title}
          </h2>
          <p className="ck-body-lg mt-8 text-ck-text-secondary">{team.lead}</p>
        </div>

        <div className="mt-4">
          {team.members.map((member, index) => (
            <AboutTeamMember
              key={member.id}
              member={member}
              reverse={index % 2 === 1}
            />
          ))}
        </div>
      </Container>
    </Section>
  );
}
