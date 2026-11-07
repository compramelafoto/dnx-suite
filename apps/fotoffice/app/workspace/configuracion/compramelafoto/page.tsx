import Link from "next/link";
import { prisma } from "@repo/db";
import { PageHeader } from "@/components/page-header";
import { requireActiveWorkspaceRole } from "@/lib/access/active-context";
import { puede } from "@/lib/access/policy";
import { secretoCompartido } from "@/lib/clf/api";
import { estadoDeCuentas, resumenConexionClf } from "@/lib/clf/conexion";
import { fechaHoraBA } from "@/lib/ficha/formato";
import { workspaceOrganizationRef } from "@/lib/payments/connect/constants";
import { BotonesConexionClf } from "./botones";

export const dynamic = "force-dynamic";

const AVISOS: Record<string, string> = {
  ok: "Listo: tu cuenta de CompraMeLaFoto quedó conectada.",
  cancelado: "Cancelaste la conexión en CompraMeLaFoto. No se conectó nada.",
  error: "No se pudo completar la conexión. Probá de nuevo.",
  permiso: "Sólo el dueño o un administrador pueden conectar CompraMeLaFoto.",
  "no-configurada": "La conexión con CompraMeLaFoto todavía no está habilitada en el servidor.",
};

/** La cuenta de Mercado Pago de Configuración → Cobros (sólo su número de cuenta, nunca el token). */
async function cuentaDeCobros(workspaceId: string): Promise<string | null> {
  const identidad = await prisma.dnxFinancialIdentity.findFirst({
    where: { organizationRef: workspaceOrganizationRef(workspaceId) },
    select: { id: true },
  });
  if (!identidad) return null;
  const cuenta = await prisma.dnxPaymentAccount.findFirst({
    where: { financialIdentityId: identidad.id, status: "ACTIVE" },
    select: { providerUserId: true },
  });
  return cuenta?.providerUserId ?? null;
}

/**
 * Configuración → CompraMeLaFoto (conexión con CLF, etapa 2). Sólo dueño o administrador. Conecta la cuenta de CLF
 * con consentimiento explícito en CLF (nunca por correo) y muestra si su Mercado Pago es el mismo de Cobros.
 */
export default async function ConexionClfPage({ searchParams }: { searchParams: Promise<{ r?: string }> }) {
  const { workspace, role } = await requireActiveWorkspaceRole();
  const sp = await searchParams;
  const aviso = sp.r ? AVISOS[sp.r] ?? null : null;

  if (!puede(role, "configurar")) {
    return (
      <div className="space-y-4">
        <PageHeader title="CompraMeLaFoto" description="Conexión con tus ventas de CompraMeLaFoto." />
        <p className="fo-card p-4 text-sm text-[var(--fo-muted)]">Sólo el dueño o un administrador pueden ver y cambiar esta conexión.</p>
      </div>
    );
  }

  const [conexion, cobros] = await Promise.all([resumenConexionClf(workspace.id), cuentaDeCobros(workspace.id)]);
  const habilitada = secretoCompartido() !== null;
  const activa = conexion && !conexion.cerrada;
  const cuentas = activa ? estadoDeCuentas(conexion.clfMpUserId, cobros) : null;

  return (
    <div className="space-y-4">
      <PageHeader
        title="CompraMeLaFoto"
        description="Traé tus ventas de CompraMeLaFoto a FotoOffice, validadas contra tu Mercado Pago. No toca la Caja."
      />
      {aviso ? (
        <p role="status" className="fo-card p-3 text-sm">
          {aviso}
        </p>
      ) : null}

      <section className="fo-card space-y-3 p-4 text-sm">
        {activa ? (
          <>
            <p>
              Conectado con la cuenta de CompraMeLaFoto <strong>{conexion.cuenta}</strong>.
            </p>
            {cuentas === "VERIFICADA" ? (
              <p className="text-[var(--fo-success,#15803d)]">Verificada: es la misma cuenta de Mercado Pago que tenés en Configuración → Cobros.</p>
            ) : cuentas === "SIN_COBROS" ? (
              <p className="text-[var(--fo-danger)]">
                Todavía no conectaste Mercado Pago en <Link href="/workspace/configuracion/cobros" className="underline">Configuración → Cobros</Link>. Sin eso las ventas se traen, pero ninguna sale validada.
              </p>
            ) : (
              <p className="text-[var(--fo-danger)]">
                Cuentas de Mercado Pago distintas: CompraMeLaFoto cobra en una cuenta y en Configuración → Cobros tenés otra. Las ventas se traen, pero no se pueden validar contra tu Mercado Pago.
              </p>
            )}
            <p className="text-[var(--fo-muted)]">
              Última actualización: {conexion.ultimaSincronizacionEl ? fechaHoraBA(conexion.ultimaSincronizacionEl) : "todavía no"}. Se actualiza sola cada 15 minutos.
            </p>
            {conexion.ultimoError ? <p className="text-[var(--fo-danger)]">{conexion.ultimoError}</p> : null}
            <p>
              <Link href="/ventas-clf" className="underline">Ver Ventas CLF →</Link>
            </p>
            <BotonesConexionClf />
          </>
        ) : (
          <>
            <p>
              Al conectar, CompraMeLaFoto te va a pedir que autorices a este espacio a ver tus ventas: álbum, pack, fecha, monto e id de pago de Mercado Pago.
              <strong> Nunca se comparten datos de compradores ni de alumnos.</strong> Podés desconectar cuando quieras, desde acá o desde CompraMeLaFoto.
            </p>
            {conexion?.cerrada ? <p className="text-[var(--fo-muted)]">La conexión anterior está cerrada. Las ventas ya traídas se conservan.</p> : null}
            {habilitada ? (
              <a href="/api/integraciones/clf/conectar" className="fo-btn fo-btn-primary inline-flex text-sm">
                Conectar con CompraMeLaFoto
              </a>
            ) : (
              <p className="text-[var(--fo-muted)]">La conexión con CompraMeLaFoto todavía no está habilitada en el servidor.</p>
            )}
          </>
        )}
      </section>
    </div>
  );
}
