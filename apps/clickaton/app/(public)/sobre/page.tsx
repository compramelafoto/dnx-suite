import type { Metadata } from "next";
import {
  AboutClosing,
  AboutCommunityCta,
  AboutExperience,
  AboutExpansion,
  AboutFinalPhrase,
  AboutHero,
  AboutMoreThan,
  AboutOrigin,
  AboutTeam,
  AboutTechAndJury,
  AboutVision,
  AboutWhatIs,
} from "@/components/sobre";
import { routes } from "@/config/navigation";
import { sobrePageContent } from "@/content/sobre";
import { buildPageMetadata } from "@/lib/seo";

const content = sobrePageContent;

export const metadata: Metadata = buildPageMetadata({
  title: content.meta.title,
  description: content.meta.description,
  path: routes.about,
});

/**
 * Orden pensado para presentación institucional
 * (municipios, empresas, instituciones, sedes):
 * 1) impacto y definición
 * 2) visión compartida (cultura / educación)
 * 3) origen y equipo (confianza)
 * 4) proyección territorial (oportunidad)
 * 5) cómo funciona + valor para marcas
 * 6) tecnología / transparencia
 * 7) cierre emocional + CTA
 */
export default function SobrePage() {
  return (
    <article>
      <AboutHero />
      <AboutWhatIs />
      <AboutVision />
      <AboutOrigin />
      <AboutTeam />
      <AboutExpansion />
      <AboutExperience />
      <AboutTechAndJury />
      <AboutMoreThan />
      <AboutClosing />
      <AboutCommunityCta />
      <AboutFinalPhrase />
    </article>
  );
}
