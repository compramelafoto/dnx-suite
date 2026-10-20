import type { Metadata } from "next";
import Link from "next/link";
import { AceptarInvitacion } from "@/components/curaduria/aceptar-invitacion";
import { buscarInvitacion } from "@/lib/curaduria/consultas";
import { requireUsuario } from "@/lib/usuario";

export const dynamic = "force-dynamic";
// El token va en la URL: que no viaje como referencia a ningún otro sitio.
export const metadata: Metadata = { title: "Invitación a curar", referrer: "no-referrer", robots: { index: false } };

type Props = { params: Promise<{ token: string }> };

export default async function Invitacion({ params }: Props) {
  const { token } = await params;
  const usuario = await requireUsuario(`/panel/curaduria/invitacion/${token}`);
  const inv = await buscarInvitacion(token);
  return (
    <main className="max-w-2xl space-y-6">
      <h1 className="mf-titulo text-[clamp(2.2rem,4vw,3rem)]">Invitación a curar</h1>
      {!inv || inv.estado === "REVOKED" ? (
        <p className="text-lg">Esta invitación no es válida. Pedile a quien organiza que te mande una nueva.</p>
      ) : inv.estado === "USED" ? (
        <p className="text-lg">Esta invitación ya se usó. <Link href="/panel/curaduria" className="underline underline-offset-[6px]">Ir a Curaduría</Link></p>
      ) : inv.estado === "EXPIRED" ? (
        <p className="text-lg">La invitación venció. Pedile a quien organiza que te la vuelva a mandar.</p>
      ) : (
        <>
          <p className="text-lg leading-snug">Te invitaron a formar parte del equipo curatorial de <strong className="font-medium">{inv.convocatoria}</strong>.</p>
          <p className="text-[15px] text-[var(--mf-muted)]">
            La invitación es para {inv.email}: para aceptarla tenés que entrar con la cuenta de Google de ese mail (ahora entraste como {usuario.email}). Si enviaste obras a esta convocatoria, no podés curarla.
          </p>
          <AceptarInvitacion token={token} />
        </>
      )}
    </main>
  );
}
