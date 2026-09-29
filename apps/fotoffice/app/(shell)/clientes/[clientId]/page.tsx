import Link from "next/link";
import { notFound } from "next/navigation";
import { Ficha } from "@/components/ficha/ficha";
import { DatosFicha } from "@/components/ficha/datos-ficha";
import type { InsigniaFicha } from "@/components/ficha/encabezado-ficha";
import { requireClientsStaff } from "@/lib/clients/access";
import { getClient, listMembersAvailableToLink } from "@/lib/clients/repository";
import { clientDisplayName } from "@/lib/clients/display";
import { resolverPersonaPorCliente } from "@/lib/ficha/persona";
import { ClientForm } from "../client-form";
import { linkClientToMemberAction } from "../actions";

export const dynamic = "force-dynamic";

const TIPO: Record<string, string> = { PERSONA: "Persona", EMPRESA: "Empresa" };

/**
 * Ficha del cliente sobre la ficha estándar: encabezado con contacto y etiquetas, notas y
 * línea de tiempo al centro (los movimientos de caja aparecen ahí, como Plata), y a la
 * derecha los datos editables, el enlace con el socio, las relaciones y los adjuntos.
 * Las categorías de notas las asegura `<Ficha>` después de su propio control de acceso.
 */
export default async function ClientePage({
  params,
  searchParams,
}: {
  params: Promise<{ clientId: string }>;
  searchParams: Promise<{ error?: string; ok?: string }>;
}) {
  const { workspace } = await requireClientsStaff();
  const { clientId } = await params;
  const query = await searchParams;

  const persona = await resolverPersonaPorCliente(workspace.id, clientId);
  if (!persona) notFound();
  const cliente = await getClient(workspace.id, clientId);
  if (!cliente) notFound();

  const socios = await listMembersAvailableToLink(workspace.id, cliente.member?.id ?? null);

  const insignias: InsigniaFicha[] = cliente.member
    ? [{ texto: `También es socio N° ${cliente.member.memberNumber}`, href: `/members/${cliente.member.id}` }]
    : [];

  return (
    <div className="space-y-4">
      <Link href="/clientes" className="text-sm text-[var(--fo-muted)] hover:underline">
        ← Volver a clientes
      </Link>

      {query.ok ? (
        <p className="fo-card p-4 text-sm text-[var(--fo-success)]">Listo, se guardó.</p>
      ) : null}
      {/* Arriba de todo (y no dentro del formulario, que ahora está en la columna lateral):
          acá llegan los errores del formulario y los del enlace con el socio. */}
      {query.error ? (
        <p className="fo-card p-4 text-sm text-[var(--fo-danger)]" role="alert">
          {query.error}
        </p>
      ) : null}

      <Ficha
        persona={{ tipo: "CLIENTE", id: cliente.id }}
        encabezado={{
          titulo: clientDisplayName(cliente),
          subtitulo: `Cliente N° ${cliente.clientNumber} · ${TIPO[cliente.kind] ?? cliente.kind}`,
          insignias,
          telefono: cliente.phone,
          correo: cliente.email,
        }}
        datos={
          <DatosFicha titulo="Datos">
            <ClientForm client={cliente} enColumna />
          </DatosFicha>
        }
        lateral={
          <DatosFicha titulo="¿Es socio?">
            <p className="text-sm text-[var(--fo-muted)]">
              {cliente.member ? (
                <>
                  Esta ficha está enlazada con el{" "}
                  <Link href={`/members/${cliente.member.id}`} className="hover:underline">
                    socio N° {cliente.member.memberNumber}
                  </Link>
                  .
                </>
              ) : (
                "Si esta persona también es socio de la institución, elegilo acá para enlazar las dos fichas."
              )}
            </p>
            <form action={linkClientToMemberAction} className="space-y-3">
              <input type="hidden" name="clientId" value={cliente.id} />
              <div className="fo-field-stack">
                <label className="fo-label" htmlFor="memberId">
                  Socio
                </label>
                <select id="memberId" name="memberId" className="fo-input" defaultValue={cliente.member?.id ?? ""}>
                  <option value="">No es socio</option>
                  {socios.map((s) => (
                    <option key={s.id} value={s.id}>
                      N° {s.memberNumber} — {s.fullName}
                    </option>
                  ))}
                </select>
              </div>
              <button type="submit" className="fo-btn fo-btn-secondary text-sm">
                Guardar enlace
              </button>
            </form>
          </DatosFicha>
        }
      />
    </div>
  );
}
