import { randomUUID } from "node:crypto";
import { assertLiveCollectorAccount } from "@repo/payments/mercado-pago";
import { resolvePilotoConfig } from "../split-1n-piloto/config";
import { crearClientesPiloto } from "../split-1n-piloto/mp";
import { crearRepositorioConsentimiento } from "./repositorio";
import type { ClienteConsentimientoMp, DepsConsentimiento } from "./servicio";

/**
 * Dependencias reales: el token de la plataforma del piloto (la cuenta cobradora es la que
 * invita) y la base de CLF. Lanza si falta la configuración; la ruta lo convierte en un error
 * para la persona, sin detalles.
 */
export function crearDepsConsentimiento(): DepsConsentimiento {
  const config = resolvePilotoConfig();
  const clientes = crearClientesPiloto(config);
  const mp: ClienteConsentimientoMp = {
    async invitar(correo) {
      // Como el comando `prod-split-consent-invite`: antes de escribir, se confirma que el token
      // sea de una cuenta real y no de un usuario de prueba.
      await assertLiveCollectorAccount(clientes.http);
      return clientes.consents.invite({
        environment: "production",
        sellerEmails: [correo],
        idempotencyKey: randomUUID(),
      });
    },
    listar: () => clientes.consents.list({ environment: "production" }),
    consultar: (receiverId) => clientes.consents.getConsent(receiverId),
  };
  return {
    repo: crearRepositorioConsentimiento(config.ownerUserId as string),
    mp,
    ahora: () => new Date(),
  };
}
