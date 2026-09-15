import { notFound } from "next/navigation";
import { prisma } from "@repo/db";
import { CATEGORIAS } from "@/lib/proveedores/categorias";
import { FormularioProveedor } from "./formulario";

export const dynamic = "force-dynamic";

type Props = { params: Promise<{ token: string }> };

/**
 * La página que abre un proveedor con el enlace del evento.
 *
 * Se identifica con el evento y con quién lo invitó, porque alguien que llega desde un
 * QR pegado en la puerta de un salón necesita saber por qué le están pidiendo sus datos.
 * Una página que sólo dice "completá tu ficha" no la completa nadie.
 */
export default async function FichaDeProveedor({ params }: Props) {
  const { token } = await params;

  const enlace = await prisma.subilafotoAccessLink.findUnique({
    where: { token },
    select: {
      kind: true,
      revokedAt: true,
      expiresAt: true,
      event: {
        select: {
          name: true,
          venueName: true,
          sellerProfile: { select: { displayName: true, logoUrl: true } },
        },
      },
    },
  });

  if (!enlace || enlace.kind !== "VENDOR" || enlace.revokedAt) notFound();

  const vencido = enlace.expiresAt ? enlace.expiresAt <= new Date() : false;
  const vendedor = enlace.event.sellerProfile;

  return (
    <main className="sobre-claro mx-auto max-w-xl px-6 py-14">
      {/* La marca es la del vendedor, no la nuestra: el proveedor lo conoce a él. */}
      {vendedor.logoUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={vendedor.logoUrl} alt={vendedor.displayName} className="h-12 w-auto" />
      ) : (
        <p className="text-sm font-extrabold" style={{ color: "var(--slf-violeta)" }}>
          {vendedor.displayName}
        </p>
      )}

      <h1 className="mt-6 text-3xl font-extrabold leading-tight">Sumá tu empresa</h1>
      <p className="mt-3" style={{ color: "var(--slf-tinta-suave)" }}>
        Trabajaste en <strong>{enlace.event.name}</strong>
        {enlace.event.venueName ? ` en ${enlace.event.venueName}` : ""}. Dejanos tus datos y
        aparecés en el registro de proveedores del evento.
      </p>

      {vencido ? (
        <div
          className="mt-8 rounded-xl px-5 py-4 text-sm"
          style={{ background: "var(--slf-purpura)", color: "var(--slf-lila)" }}
        >
          Este enlace venció. Pedile uno nuevo a {vendedor.displayName}.
        </div>
      ) : (
        <FormularioProveedor token={token} categorias={CATEGORIAS} />
      )}
    </main>
  );
}
