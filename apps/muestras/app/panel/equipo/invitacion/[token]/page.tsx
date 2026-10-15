import type { Metadata } from "next";
import Link from "next/link";
import { ACTIVITY_ROLE_LABELS, TEAM_ROLE_DESCRIPTIONS } from "@repo/muestras";
import { AceptarInvitacionEquipo } from "@/components/equipo/aceptar-invitacion-equipo";
import { enlace } from "@/components/equipo/estilos";
import { invitacionPorToken } from "@/lib/equipo/consultas";
import { requireUsuario } from "@/lib/usuario";

export const dynamic = "force-dynamic";
// El token va en la URL: que no viaje como referencia a ningún otro sitio.
export const metadata: Metadata = { title: "Invitación al equipo", referrer: "no-referrer", robots: { index: false } };

type Props = { params: Promise<{ token: string }> };

export default async function InvitacionAlEquipo({ params }: Props) {
  const { token } = await params;
  const usuario = await requireUsuario(`/panel/equipo/invitacion/${token}`);
  const inv = await invitacionPorToken(token);
  return (
    <main className="max-w-2xl space-y-6">
      <h1 className="mf-titulo text-[clamp(2.2rem,4vw,3rem)]">Invitación al equipo</h1>
      {!inv || inv.estado === "REVOKED" ? (
        <p className="text-lg">Esta invitación no es válida. Pedile a quien organiza la muestra que te mande una nueva.</p>
      ) : inv.estado === "USED" ? (
        <p className="text-lg">Esta invitación ya se usó. <Link href="/panel/muestras" className={enlace}>Ir a mis muestras</Link></p>
      ) : inv.estado === "EXPIRED" ? (
        <p className="text-lg">La invitación venció. Pedile a quien organiza la muestra que te la vuelva a mandar.</p>
      ) : (
        <>
          <p className="text-lg leading-snug">
            {inv.invita ?? "Quien organiza la muestra"} te invitó a <strong className="font-medium">{ACTIVITY_ROLE_LABELS[inv.rol]}</strong> en «{inv.muestra}».
          </p>
          <p className="text-[15px]">{TEAM_ROLE_DESCRIPTIONS[inv.rol]}</p>
          <p className="text-[15px] text-[var(--mf-muted)]">
            La invitación es para {inv.email}: para aceptarla tenés que entrar con la cuenta de Google de ese mail (ahora entraste como {usuario.email}).
          </p>
          <AceptarInvitacionEquipo token={token} />
        </>
      )}
    </main>
  );
}
