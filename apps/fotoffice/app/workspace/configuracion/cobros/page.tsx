import Link from "next/link";
import { redirect } from "next/navigation";
import { PageHeader } from "@/components/page-header";
import { SplitConsentPanel } from "@/components/payments/split-consent-panel";
import { requireActiveWorkspace } from "@/lib/workspace";
import { canManageWorkspaceCollection } from "@/lib/payments/connect/authz";
import { readMpConnectConfig } from "@/lib/payments/connect/config";
import { collectionCopy, connectErrorMessage } from "@/lib/payments/connect/messages";
import { getWorkspaceCollectionStatus } from "@/lib/payments/connect/status";
import { formatFeeBpsAsPercent } from "@/lib/platform-fee/fee";
import { getPlatformFeeBpsByModule } from "@/lib/platform-fee/store";
import { MEMBERS_MODULE_KEY } from "@/lib/members/constants";

export const dynamic = "force-dynamic";

/**
 * Configuración de cobros de la institución.
 *
 * Muestra el estado de la vinculación con MercadoPago y, cuando corresponde, el botón para
 * conectarla. Leer esta pantalla **no crea nada**: la identidad financiera se crea recién
 * al iniciar la conexión a propósito.
 */
export default async function CobrosPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; ok?: string }>;
}) {
  const { user, workspace } = await requireActiveWorkspace();
  if (!workspace) redirect("/workspace");

  const params = await searchParams;
  const [collection, canManage, feeByModule] = await Promise.all([
    getWorkspaceCollectionStatus(workspace.id),
    canManageWorkspaceCollection(user.id, workspace.id),
    getPlatformFeeBpsByModule(workspace.id, [MEMBERS_MODULE_KEY]),
  ]);

  const copy = collectionCopy(collection.status, collection.mode);
  const errorMessage = connectErrorMessage(params.error ?? null);
  const config = readMpConnectConfig();
  const feeBps = feeByModule.get(MEMBERS_MODULE_KEY) ?? 500;

  const toneClass =
    copy.tone === "ok"
      ? "text-[var(--fo-success)]"
      : copy.tone === "warn"
        ? "text-[var(--fo-danger)]"
        : "text-[var(--fo-muted)]";

  return (
    <div className="space-y-8">
      <PageHeader
        title="Cobros"
        description="Vinculá tu cuenta de MercadoPago para cobrar cuotas de tus socios."
      />

      {params.ok === "conectado" ? (
        <p className="fo-card p-4 text-sm text-[var(--fo-success)]">
          Listo: tu cuenta de MercadoPago quedó conectada.
        </p>
      ) : null}

      {errorMessage ? (
        <p className="fo-card p-4 text-sm text-[var(--fo-danger)]" role="alert">
          {errorMessage}
        </p>
      ) : null}

      <section className="fo-card space-y-4 p-5">
        <div className="space-y-1">
          <h2 className={`text-base font-semibold ${toneClass}`}>{copy.title}</h2>
          <p className="text-sm text-[var(--fo-muted)] leading-relaxed">{copy.body}</p>
        </div>

        {collection.accountLabel ? (
          <dl className="grid gap-2 text-xs sm:grid-cols-2">
            <div>
              <dt className="text-[var(--fo-muted-soft)]">Cuenta</dt>
              <dd className="font-medium">{collection.accountLabel}</dd>
            </div>
            {collection.connectedAt ? (
              <div>
                <dt className="text-[var(--fo-muted-soft)]">Conectada el</dt>
                <dd className="font-medium">
                  {collection.connectedAt.toLocaleDateString("es-AR")}
                </dd>
              </div>
            ) : null}
          </dl>
        ) : null}

        {/*
          El consentimiento solo existe en el cobro dividido 1:N, y solo tiene sentido con la
          cuenta ya vinculada: sin receptor no hay a quién autorizar. En dos vías el que cobra
          es el que recibe, así que el panel no se muestra.
        */}
        {collection.mode === "SPLIT_1N" && canManage && collection.status !== "NOT_CONNECTED" ? (
          <SplitConsentPanel
            consent={collection.consent}
            savedInviteUrl={collection.consentInviteUrl}
          />
        ) : null}

        {!config.configured ? (
          <p className="text-xs text-[var(--fo-danger)]">
            La conexión con MercadoPago todavía no está habilitada en la plataforma.
            Escribinos y lo resolvemos.
          </p>
        ) : !canManage ? (
          <p className="text-xs text-[var(--fo-muted)]">
            Solo el dueño o un administrador del workspace puede conectar los cobros.
          </p>
        ) : (
          <Link
            href="/api/payments/mercadopago/connect/start"
            prefetch={false}
            className="fo-btn fo-btn-primary text-sm inline-flex"
          >
            {copy.actionLabel}
          </Link>
        )}
      </section>

      <section className="fo-card space-y-2 p-5">
        <h2 className="text-sm font-semibold">Comisión de la plataforma</h2>
        <p className="text-lg font-semibold">{formatFeeBpsAsPercent(feeBps)}</p>
        <p className="text-xs text-[var(--fo-muted)] leading-relaxed">
          Se descuenta del total de cada cobro, en la misma operación. El resto va directo a
          tu cuenta. La define DNX; si necesitás revisarla, escribinos.
        </p>
        <p className="text-xs text-[var(--fo-muted)] leading-relaxed">
          ⚠️ Aparte de esta comisión, se descuentan impuestos y la comisión de MercadoPago,
          que dependen de tu condición fiscal y del medio de pago que use quien abona.
        </p>
      </section>
    </div>
  );
}
