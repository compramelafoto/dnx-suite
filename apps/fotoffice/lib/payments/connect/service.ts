import {
  completeMpConnection as completeMpConnectionCore,
  startMpConnection as startMpConnectionCore,
  type ConnectDeps as ConnectDepsCore,
  type ConnectProduct,
} from "@repo/payments/mercado-pago-connect";
import { FOTOFFICE_PRODUCT_KEY, workspaceOrganizationRef } from "./constants";

/**
 * Conexión de la cuenta de MercadoPago de una institución.
 *
 * El flujo vive en `@repo/payments/mercado-pago-connect` desde el 2026-09-14, cuando Subí
 * la Foto necesitó lo mismo. Acá queda sólo lo propio de FotoOffice: que quien conecta es
 * un **workspace**, y que la cuenta se marca como receptora de reparto.
 *
 * La firma no cambió a propósito: el resto de FotoOffice sigue hablando de `workspaceId`
 * y sus tests siguen valiendo como prueba de que la subida al paquete no cambió nada.
 */

export {
  ConnectError,
  OAUTH_STATE_TTL_MS,
  type ConnectErrorCode,
  type ConnectStateRecord,
  type MpConnectConfig,
  type StartConnectionResult,
} from "@repo/payments/mercado-pago-connect";

/** FotoOffice conecta instituciones que además reciben reparto 1:N. */
const PRODUCTO: ConnectProduct = {
  key: FOTOFFICE_PRODUCT_KEY,
  nombre: "FotoOffice",
  capabilities: ["SPLIT_RECEIVER"],
};

/**
 * Las dependencias que arma FotoOffice.
 *
 * Sin `product`: eso lo pone este archivo, que es lo único que sabe que quien conecta es
 * una institución de FotoOffice. Se sigue llamando `ConnectDeps` porque es el nombre que
 * el resto de la aplicación ya usaba.
 */
export type ConnectDeps = Omit<ConnectDepsCore, "product">;

export async function startMpConnection(
  input: { workspaceId: string; userId: number; legalName?: string },
  deps: ConnectDeps,
) {
  return startMpConnectionCore(
    {
      organizationRef: workspaceOrganizationRef(input.workspaceId),
      userId: input.userId,
      legalName: input.legalName,
    },
    { ...deps, product: PRODUCTO },
  );
}

export type CompleteConnectionResult = {
  workspaceId: string;
  providerUserId: string;
  paymentAccountId: string;
};

export async function completeMpConnection(
  input: { code: string; state: string },
  deps: ConnectDeps,
): Promise<CompleteConnectionResult> {
  const resultado = await completeMpConnectionCore(input, { ...deps, product: PRODUCTO });
  // El workspace vive en el sufijo de la referencia de organización.
  const workspaceId = resultado.organizationRef.split(":").slice(1).join(":");
  return {
    workspaceId,
    providerUserId: resultado.providerUserId,
    paymentAccountId: resultado.paymentAccountId,
  };
}
