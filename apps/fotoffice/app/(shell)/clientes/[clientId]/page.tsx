import Link from "next/link";
import { notFound } from "next/navigation";
import { Ficha } from "@/components/ficha/ficha";
import { DatosFicha } from "@/components/ficha/datos-ficha";
import { MasDatos } from "@/components/campos/mas-datos";
import { Mensaje } from "@/components/mensajes/mensaje";
import type { InsigniaFicha } from "@/components/ficha/encabezado-ficha";
import { requireClientsViewer } from "@/lib/clients/access";
import {
  getClient,
  listMembersAvailableToLink,
} from "@/lib/clients/repository";
import { clientDisplayName } from "@/lib/clients/display";
import { resolverPersonaPorCliente } from "@/lib/ficha/persona";
import { CASH_MODULE_KEY } from "@/lib/cash/constants";
import { CLIENTS_MODULE_KEY } from "@/lib/clients/constants";
import { puede } from "@/lib/access/policy";
import { resolverAcceso } from "@/lib/access/acceso";
import { getModuleLevel } from "@/lib/permissions/module-access";
import { hasLevel } from "@/lib/permissions/levels";
import { listMovements } from "@/lib/cash/repository";
import { MovementsTable } from "@/app/(shell)/caja/movements-table";
import { SERVICE_LEADS_MODULE_KEY } from "@/lib/service-leads/constants";
import { perfilDe } from "@/lib/contactos/perfil";
import { consultasDelContacto } from "@/lib/contactos/consultas-del-contacto";
import { ETIQUETA_CATEGORIA_CONTACTO } from "@/lib/consultas/constantes";
import { PerfilContactoTarjeta } from "@/components/contactos/perfil-contacto";
import { ConsultasDelContacto } from "@/components/contactos/consultas-del-contacto";
import { ClientForm } from "../client-form";
import { linkClientToMemberAction } from "../actions";

/** Cuántos movimientos recientes se muestran en la ficha: es un resumen, no el libro completo. */
const MOVIMIENTOS_RECIENTES = 20;

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
  const { user, workspace, canEdit } = await requireClientsViewer();
  const { clientId } = await params;
  const query = await searchParams;

  const persona = await resolverPersonaPorCliente(workspace.id, clientId);
  if (!persona) notFound();
  const cliente = await getClient(workspace.id, clientId);
  if (!cliente) notFound();

  const socios = canEdit
    ? await listMembersAvailableToLink(workspace.id, cliente.member?.id ?? null)
    : [];

  // Acceso resuelto una vez: historia (Gestionar en Clientes) y la tarjeta de Consultas (Ver
  // en Consultas; el nivel ya incluye que el módulo esté encendido). Crear una consulta para
  // este contacto pide Gestionar en Consultas.
  const acceso = await resolverAcceso(user.id, workspace.id);
  const veConsultas = puede(acceso, "ver", SERVICE_LEADS_MODULE_KEY);
  const creaConsultas = puede(acceso, "operar", SERVICE_LEADS_MODULE_KEY);
  const [perfiles, delContacto] = await Promise.all([
    perfilDe(workspace.id, [cliente.id]),
    veConsultas ? consultasDelContacto(workspace.id, cliente.id) : Promise.resolve(null),
  ]);
  const perfil = perfiles.get(cliente.id);
  if (!perfil) notFound();

  const insignias: InsigniaFicha[] = [
    { texto: ETIQUETA_CATEGORIA_CONTACTO[perfil.category] },
    ...(cliente.member
      ? [
          {
            texto: `También es socio N° ${cliente.member.memberNumber}`,
            href: `/members/${cliente.member.id}`,
          },
        ]
      : []),
  ];

  // El módulo de Caja es de otro workspace-feature: si está apagado acá, no hay libro que
  // mostrar. Con roles, además, ver Clientes no da derecho a ver la plata: el consumo sale del
  // libro de Caja, así que pide al menos VIEW en Caja (el nivel ya incluye que el módulo esté
  // encendido).
  // Con "Gestionar" en Clientes la ficha tiene línea de tiempo, y ahí ya están estos movimientos
  // (filtro Plata, con la misma regla de VIEW en Caja). Sólo sin historia (nivel "Ver") se
  // muestra la lista de Consumo de main, para que nadie pierda lo que hoy ve.
  const veHistoria = puede(acceso, "operar", CLIENTS_MODULE_KEY);
  const cajaHabilitada =
    !veHistoria &&
    hasLevel(await getModuleLevel(user.id, workspace.id, CASH_MODULE_KEY), "VIEW");
  const movimientos = cajaHabilitada
    ? await listMovements(workspace.id, {
        clientId: cliente.id,
        take: MOVIMIENTOS_RECIENTES,
      })
    : [];

  return (
    <div className="space-y-4">
      <Link
        href="/clientes"
        className="text-sm text-[var(--fo-muted)] hover:underline"
      >
        ← Volver a clientes
      </Link>

      {query.ok ? (
        <p className="fo-card p-4 text-sm text-[var(--fo-success)]">
          Listo, se guardó.
        </p>
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
          <>
            <Mensaje entityType="CLIENTE" entityId={cliente.id} />
            <DatosFicha titulo="Datos">
              {/* Sin MANAGE la ficha se ve igual, pero deshabilitada: `fieldset disabled` apaga
                  cada campo y el botón de guardar. La acción igual rebota del lado del servidor. */}
              <fieldset disabled={!canEdit} className="contents">
                <ClientForm client={cliente} enColumna />
              </fieldset>
            </DatosFicha>
            <PerfilContactoTarjeta clientId={cliente.id} perfil={perfil} puedeEditar={canEdit} />
            <MasDatos entityType="CLIENTE" entityId={cliente.id} />
          </>
        }
        lateral={
          <>
            {delContacto ? (
              <ConsultasDelContacto
                clientId={cliente.id}
                consultas={delContacto.consultas}
                hayMas={delContacto.hayMas}
                puedeCrear={creaConsultas}
              />
            ) : null}
            <DatosFicha titulo="¿Es socio?">
              <p className="text-sm text-[var(--fo-muted)]">
                {cliente.member ? (
                  <>
                    Esta ficha está enlazada con el{" "}
                    <Link
                      href={`/members/${cliente.member.id}`}
                      className="hover:underline"
                    >
                      socio N° {cliente.member.memberNumber}
                    </Link>
                    .
                  </>
                ) : canEdit ? (
                  "Si esta persona también es socio de la institución, elegilo acá para enlazar las dos fichas."
                ) : (
                  "Esta ficha no está enlazada con ningún socio."
                )}
              </p>
              {canEdit ? (
                <form action={linkClientToMemberAction} className="space-y-3">
                  <input type="hidden" name="clientId" value={cliente.id} />
                  <div className="fo-field-stack">
                    <label className="fo-label" htmlFor="memberId">
                      Socio
                    </label>
                    <select
                      id="memberId"
                      name="memberId"
                      className="fo-input"
                      defaultValue={cliente.member?.id ?? ""}
                    >
                      <option value="">No es socio</option>
                      {socios.map((s) => (
                        <option key={s.id} value={s.id}>
                          N° {s.memberNumber} — {s.fullName}
                        </option>
                      ))}
                    </select>
                  </div>
                  <button
                    type="submit"
                    className="fo-btn fo-btn-secondary text-sm"
                  >
                    Guardar enlace
                  </button>
                </form>
              ) : null}
            </DatosFicha>
            {cajaHabilitada ? (
              <DatosFicha titulo="Consumo">
                <MovementsTable movements={movimientos} showAccount />
              </DatosFicha>
            ) : null}
          </>
        }
      />
    </div>
  );
}
