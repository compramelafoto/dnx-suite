import Link from "next/link";
import { redirect } from "next/navigation";
import { PageHeader } from "@/components/page-header";
import { requireSponsorsManager } from "@/lib/sponsors/access";
import { sponsorsWriteBlockedReason } from "@/lib/sponsors/clients";
import { InvitarSponsorForm } from "../enlace-autoalta";

export const dynamic = "force-dynamic";

/**
 * Invitar a un sponsor a que se dé de alta solo: la institución pone sólo el nombre de la marca
 * y recibe un enlace para mandarle. El logo, las redes, el beneficio y el contacto los carga el
 * sponsor.
 */
export default async function InvitarSponsorPage() {
  const { workspace } = await requireSponsorsManager();
  if (sponsorsWriteBlockedReason()) redirect("/sponsors");

  return (
    <div className="max-w-2xl space-y-8">
      <PageHeader
        title="Invitar a un sponsor"
        description="Escribí el nombre de la marca y te damos un enlace para mandarle. El sponsor carga su logo, sus redes, el beneficio para los socios y un contacto."
        actions={
          <Link href="/sponsors" className="fo-btn fo-btn-secondary text-sm">
            Volver
          </Link>
        }
      />

      <section className="fo-card space-y-4 p-5">
        <InvitarSponsorForm institucion={workspace.name} />
      </section>

      <p className="fo-helper">
        ¿Ya trabaja con otra plataforma de DNX? Buscalo primero en{" "}
        <Link href="/sponsors/nuevo" className="underline">
          Agregar sponsor
        </Link>
        : si ya tiene ficha, vinculalo y después, desde su ficha, generale el enlace para que complete lo que falte.
      </p>
    </div>
  );
}
