import { notFound } from "next/navigation";
import { SFEF_SPONSORS_HTML, SFEF_SPONSORS_STYLES } from "./content";

/**
 * Propuesta de patrocinio, pensada para mandarle el enlace a una marca.
 *
 * Por ahora existe solo para Santa Fe en Foco: el contenido está escrito para
 * esta edición y sus espacios. Cuando haya otra, se arma su propio contenido en
 * vez de generalizar esta a la fuerza.
 */
const CONTEST_SLUG = "santa-fe-en-foco";

export const dynamic = "force-static";

type Props = { params: Promise<{ slug: string }> };

export async function generateMetadata({ params }: Props) {
  const { slug } = await params;
  if (slug !== CONTEST_SLUG) {
    return { title: "Patrocinio", robots: { index: false, follow: false } };
  }
  return {
    title: "Santa Fe en Foco · Propuesta de patrocinio",
    description:
      "Los espacios donde puede verse su marca en Santa Fe en Foco 2026, en el marco de los Juegos Suramericanos.",
    robots: { index: true, follow: true },
  };
}

export default async function ContestSponsorsPage({ params }: Props) {
  const { slug } = await params;
  if (slug !== CONTEST_SLUG) notFound();

  return (
    <>
      <link
        rel="stylesheet"
        href="https://fonts.googleapis.com/css2?family=DM+Mono:wght@400;500&family=Fraunces:opsz,wght@9..144,400;9..144,600;9..144,700&family=Karla:wght@400;500;600;700&display=swap"
      />
      <style dangerouslySetInnerHTML={{ __html: SFEF_SPONSORS_STYLES }} />
      <main
        className="sfef-sponsors"
        dangerouslySetInnerHTML={{ __html: SFEF_SPONSORS_HTML }}
      />
    </>
  );
}
