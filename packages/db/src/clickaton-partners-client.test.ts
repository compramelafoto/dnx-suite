import { test } from "node:test";
import assert from "node:assert/strict";
import {
  getClickatonPartnersConnectionInfo,
  scopeToPartnerModels,
} from "./clickaton-partners-client";

function clienteFalso() {
  const llamadas: string[] = [];
  const modelo = (nombre: string) => ({
    findMany: async () => {
      llamadas.push(`${nombre}.findMany`);
      return [];
    },
    create: async () => {
      llamadas.push(`${nombre}.create`);
      return {};
    },
  });
  const cliente: Record<string, unknown> = {
    dnxPartner: modelo("dnxPartner"),
    dnxPartnerParticipation: modelo("dnxPartnerParticipation"),
    dnxPartnerAsset: modelo("dnxPartnerAsset"),
    dnxPartnerInventoryBooking: modelo("dnxPartnerInventoryBooking"),
    member: modelo("member"),
    $executeRaw: async () => 1,
    $executeRawUnsafe: async () => 1,
    $queryRaw: async () => [],
    $queryRawUnsafe: async () => [],
    $transaction: async (fn: (tx: unknown) => Promise<unknown>) => fn(cliente),
  };
  return { cliente, llamadas };
}

test("deja usar los modelos de DNX Partners, incluida la escritura", async () => {
  const { cliente, llamadas } = clienteFalso();
  const acotado = scopeToPartnerModels(cliente) as any;
  await acotado.dnxPartner.findMany();
  await acotado.dnxPartnerParticipation.create();
  await acotado.dnxPartnerAsset.create();
  await acotado.dnxPartnerInventoryBooking.create();
  assert.deepEqual(llamadas, [
    "dnxPartner.findMany",
    "dnxPartnerParticipation.create",
    "dnxPartnerAsset.create",
    "dnxPartnerInventoryBooking.create",
  ]);
});

test("rechaza cualquier otro modelo de la base de Clickatón", () => {
  const { cliente } = clienteFalso();
  const acotado = scopeToPartnerModels(cliente) as any;
  assert.throws(() => acotado.member, /DNX Partners/);
});

test("rechaza SQL crudo", () => {
  const { cliente } = clienteFalso();
  const acotado = scopeToPartnerModels(cliente) as any;
  for (const metodo of ["$executeRaw", "$executeRawUnsafe", "$queryRaw", "$queryRawUnsafe"]) {
    assert.throws(() => acotado[metodo], /DNX Partners/, metodo);
  }
});

test("la transacción recibe un cliente igual de acotado", async () => {
  const { cliente } = clienteFalso();
  const acotado = scopeToPartnerModels(cliente) as any;
  await acotado.$transaction(async (tx: any) => {
    await tx.dnxPartner.findMany();
    assert.throws(() => tx.member, /DNX Partners/);
  });
});

test("no acepta una URL que apunte a la base de FOTOFFICE", () => {
  const antes = process.env.CLICKATON_PARTNERS_DATABASE_URL;
  try {
    process.env.CLICKATON_PARTNERS_DATABASE_URL =
      "postgresql://u:p@ep-dawn-dew-adyr8f1v-pooler.c-2.us-east-1.aws.neon.tech/neondb";
    const info = getClickatonPartnersConnectionInfo();
    assert.equal(info.configured, false);
    assert.match(info.reason ?? "", /FOTOFFICE/);

    delete process.env.CLICKATON_PARTNERS_DATABASE_URL;
    assert.equal(getClickatonPartnersConnectionInfo().configured, false);

    process.env.CLICKATON_PARTNERS_DATABASE_URL =
      "postgresql://u:p@ep-silent-haze-awfh50a5-pooler.c-12.us-east-1.aws.neon.tech/neondb";
    assert.equal(getClickatonPartnersConnectionInfo().configured, true);
  } finally {
    if (antes === undefined) delete process.env.CLICKATON_PARTNERS_DATABASE_URL;
    else process.env.CLICKATON_PARTNERS_DATABASE_URL = antes;
  }
});
