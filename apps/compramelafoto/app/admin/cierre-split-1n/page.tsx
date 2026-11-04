import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Role } from "@/lib/prisma";
import { getAuthUser } from "@/lib/auth";
import { REPARTO_BPS, resolveCierreConfig } from "@/lib/cierre-split-1n/config";
import { CierreClient } from "./CierreClient";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Orden de cierre Split 1:N",
  robots: { index: false, follow: false, nocache: true },
};

/**
 * Orden productiva de cierre de homologación Split 1:N (IXFS-16376).
 *
 * Mercado Pago pide un Order ID real con `live_mode: true` y tres receptores. Esta pantalla
 * existe solo para producir ese dato.
 *
 * Mueve **dinero real**. Por eso: bandera propia apagada por omisión, solo admin, y
 * bloqueada en el sitio desplegado — se corre en local contra credenciales productivas.
 * Los frenos viven en `resolveCierreConfig`.
 *
 * No crea ventas de CLF, no habilita descargas, no manda correos y no toca Checkout Pro.
 */
export default async function CierreSplit1nPage() {
  const resolved = resolveCierreConfig();
  // 404 y no un mensaje: fuera de esta operación, la ruta no existe.
  if (!resolved.ok) notFound();

  const user = await getAuthUser();
  if (!user) notFound();
  if (user.role !== Role.ADMIN && String(user.role) !== "SUPER_ADMIN") notFound();

  const { config } = resolved;

  return (
    <main className="mx-auto max-w-xl px-4 py-10">
      <header className="mb-8">
        <h1 className="text-xl font-semibold tracking-tight text-neutral-900">
          Orden de cierre — Split 1:N
        </h1>
        <p className="mt-1 text-sm text-neutral-600">
          Operación única para cerrar la homologación con Mercado Pago.
        </p>
      </header>

      <CierreClient
        publicKey={config.publicKey}
        amountMinor={Number(config.totalMinor)}
        payerEmail={config.payerEmailOverride ?? user.email ?? ""}
        pagadorDeclarado={config.payerEmailOverride !== null}
        repartoBps={REPARTO_BPS}
      />
    </main>
  );
}
