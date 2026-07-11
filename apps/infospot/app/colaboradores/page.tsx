import type { Metadata } from "next";
import Link from "next/link";
import { EditorialContainer, Section } from "@/components/foundations";
import { getInfoSpotSettings, mailtoEditorial } from "@/lib/settings";

export async function generateMetadata(): Promise<Metadata> {
  return {
    title: "Colaboradores",
    description:
      "Info Spot trabaja con una red de fotógrafos y colaboradores en distintas localidades del país.",
    alternates: { canonical: "/colaboradores" },
  };
}

export default async function ColaboradoresPage() {
  const settings = await getInfoSpotSettings();
  const mail = mailtoEditorial(settings, "Quiero colaborar con Info Spot");

  return (
    <Section spacing="lg">
      <EditorialContainer className="max-w-3xl">
        <p className="is-eyebrow">Red</p>
        <h1 className="is-h1 mt-3 text-4xl md:text-5xl">Colaboradores</h1>
        <p className="is-body mt-5 text-base md:text-lg">
          Info Spot trabaja con una red de fotógrafos, redactores y colaboradores de
          distintas localidades del país. Cubrimos deporte, cultura y vida social con
          mirada editorial y crédito visible.
        </p>
        <p className="is-body mt-4">
          Formamos parte del ecosistema DNX junto a ComprameLaFoto: cuando una cobertura
          lo amerita, la historia periodística puede conectar con álbumes fotográficos
          sin perder la independencia editorial del medio.
        </p>

        <ul className="mt-10 space-y-4 border-t border-[var(--is-border)] pt-8">
          {[
            "Cobertura deportiva, cultural y social",
            "Presencia en distintas localidades",
            "Créditos y derechos respetados",
            "Vínculo con ComprameLaFoto cuando corresponde",
          ].map((item) => (
            <li key={item} className="flex gap-3 text-[var(--is-text-secondary)]">
              <span className="mt-1.5 size-2 shrink-0 rounded-full bg-[var(--is-accent)]" aria-hidden />
              {item}
            </li>
          ))}
        </ul>

        <div className="mt-12 border border-[var(--is-border)] bg-[var(--is-surface)] p-6 md:p-8">
          <h2 className="text-xl font-semibold">Quiero colaborar con Info Spot</h2>
          <p className="mt-3 text-sm text-[var(--is-text-secondary)]">
            Todavía no publicamos perfiles individuales. Si querés sumarte a la red,
            escribinos a la redacción.
          </p>
          {mail ? (
            <a href={mail} className="is-btn is-btn-solid mt-6">
              Quiero colaborar con Info Spot
            </a>
          ) : (
            <Link href="/contacto" className="is-btn is-btn-solid mt-6">
              Ir a contacto
            </Link>
          )}
        </div>
      </EditorialContainer>
    </Section>
  );
}
