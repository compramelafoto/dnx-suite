import { describe, it } from "node:test";
import assert from "node:assert/strict";

import {
  accionSobrePackDePrueba,
  datosDeFamiliaParaPrueba,
  elegirPackFuente,
  emailDelPackReiniciado,
  esPedidoDemo,
  plantillasDelSnapshot,
  prepararSnapshotDePrueba,
  sinPedidosDemo,
  snapshotArmaDiseno,
} from "./pack-de-prueba";
import { EXTERNAL_PREVENTA_KIND, EXTERNAL_SIN_EMAIL } from "./external-preventa";

const snapshot = {
  schemaVersion: 1,
  packDefinitionId: 89,
  redemptionDeadlineAt: "2026-10-01T00:00:00.000Z",
  benefits: [
    { stableKey: "89:benefit:107", benefitDefinitionId: 107, kind: "PHYSICAL", templatePolicy: "NONE", templateV2Id: null },
    { stableKey: "89:benefit:110", benefitDefinitionId: 110, kind: "PHYSICAL", templatePolicy: "NONE", templateV2Id: null },
  ],
};

describe("prepararSnapshotDePrueba", () => {
  it("quita el plazo de canje y no toca el snapshot original", () => {
    const out = prepararSnapshotDePrueba(snapshot, { porBeneficio: new Map(), porPruebaAnterior: new Map() });
    assert.equal(out.redemptionDeadlineAt, null);
    assert.equal(snapshot.redemptionDeadlineAt, "2026-10-01T00:00:00.000Z");
    assert.equal(snapshot.benefits[0]!.templatePolicy, "NONE");
  });

  it("pone la plantilla del beneficio con diseño obligatorio", () => {
    const out = prepararSnapshotDePrueba(snapshot, {
      porBeneficio: new Map([[107, "tpl-actual"]]),
      porPruebaAnterior: new Map([["89:benefit:107", "tpl-vieja"]]),
    });
    assert.equal(out.benefits[0]!.templateV2Id, "tpl-actual");
    assert.equal(out.benefits[0]!.templatePolicy, "REQUIRED");
    assert.equal(out.benefits[1]!.templateV2Id, null);
    assert.equal(out.benefits[1]!.templatePolicy, "NONE");
  });

  it("hereda la plantilla del pack de prueba anterior si el beneficio no tiene", () => {
    const out = prepararSnapshotDePrueba(snapshot, {
      porBeneficio: new Map(),
      porPruebaAnterior: new Map([["89:benefit:107", "cmv36"]]),
    });
    assert.equal(out.benefits[0]!.templateV2Id, "cmv36");
    assert.equal(out.benefits[0]!.templatePolicy, "REQUIRED");
  });

  it("respeta la plantilla que ya traía el pack", () => {
    const conPlantilla = {
      ...snapshot,
      benefits: [{ ...snapshot.benefits[0]!, templateV2Id: "propia", templatePolicy: "OPTIONAL" }],
    };
    const out = prepararSnapshotDePrueba(conPlantilla, {
      porBeneficio: new Map(),
      porPruebaAnterior: new Map([["89:benefit:107", "otra"]]),
    });
    assert.equal(out.benefits[0]!.templateV2Id, "propia");
    assert.equal(out.benefits[0]!.templatePolicy, "REQUIRED");
  });
});

describe("plantillasDelSnapshot / snapshotArmaDiseno", () => {
  it("lee las plantillas por stableKey", () => {
    const m = plantillasDelSnapshot({ benefits: [{ stableKey: "a", templateV2Id: "t1" }, { stableKey: "b" }] });
    assert.deepEqual([...m.entries()], [["a", "t1"]]);
    assert.equal(plantillasDelSnapshot(null).size, 0);
  });
  it("detecta diseño por la plantilla del snapshot o la de la definición", () => {
    assert.equal(snapshotArmaDiseno(snapshot, new Map()), false);
    assert.equal(snapshotArmaDiseno(snapshot, new Map([[110, "t"]])), true);
  });
});

describe("elegirPackFuente", () => {
  it("prefiere el que arma diseño, después el de más beneficios, después el más nuevo", () => {
    assert.equal(
      elegirPackFuente([
        { id: 1, beneficios: 5, conDiseno: false },
        { id: 2, beneficios: 2, conDiseno: true },
      ]),
      2
    );
    assert.equal(
      elegirPackFuente([
        { id: 1, beneficios: 3, conDiseno: false },
        { id: 2, beneficios: 2, conDiseno: false },
        { id: 3, beneficios: 3, conDiseno: false },
      ]),
      3
    );
  });
  it("sin packs con beneficios no elige ninguno", () => {
    assert.equal(elegirPackFuente([]), null);
    assert.equal(elegirPackFuente([{ id: 9, beneficios: 0, conDiseno: false }]), null);
  });
});

describe("accionSobrePackDePrueba (un solo pack de prueba por álbum)", () => {
  it("crea uno si no hay", () => {
    assert.deepEqual(accionSobrePackDePrueba(null), { tipo: "crear" });
  });
  it("reusa el que no se canjeó", () => {
    assert.deepEqual(accionSobrePackDePrueba({ id: 4775, redemptionOrderId: null }), { tipo: "reusar", orderId: 4775 });
  });
  it("si ya se canjeó crea una copia (el canje queda como DEMO)", () => {
    assert.deepEqual(accionSobrePackDePrueba({ id: 4775, redemptionOrderId: 5000 }), { tipo: "crear" });
  });
});

describe("datosDeFamiliaParaPrueba", () => {
  it("pack cobrado por fuera: copia alumno y curso y pide el contacto al canjear", () => {
    const refs = { kind: EXTERNAL_PREVENTA_KIND, studentName: "Avendaño Rufina", courseName: "Sala 3A", parentName: "Ana" };
    const d = datosDeFamiliaParaPrueba({ refsFuente: refs, buyerNameFuente: "Ana", emailFotografo: "foto@x.com", colegio: null });
    assert.equal(d.buyerEmail, EXTERNAL_SIN_EMAIL);
    assert.equal(d.refs.studentName, "Avendaño Rufina");
    assert.equal(d.refs.courseName, "Sala 3A");
    assert.deepEqual(d.refs.packDePrueba, { pedirContacto: true });
  });
  it("pack comprado en la plataforma: el email es el del fotógrafo y no se copia la compra escolar", () => {
    const d = datosDeFamiliaParaPrueba({
      refsFuente: null,
      buyerNameFuente: "Mamá",
      emailFotografo: "foto@x.com",
      colegio: "Colegio X",
      preCompra: { studentFirstName: "Juan", studentLastName: "Pérez", buyerName: "Laura", curso: "3 B" },
    });
    assert.equal(d.buyerEmail, "foto@x.com");
    assert.equal(d.refs.kind, EXTERNAL_PREVENTA_KIND);
    assert.equal(d.refs.studentName, "Pérez Juan");
    assert.equal(d.refs.courseName, "3 B");
    assert.equal(d.refs.schoolName, "Colegio X");
    assert.equal(d.buyerName, "Laura");
    assert.equal("preCompraPaymentRef" in d.refs, false);
  });
  it("sin datos de alumno usa un nombre de prueba", () => {
    const d = datosDeFamiliaParaPrueba({ refsFuente: null, buyerNameFuente: null, emailFotografo: "f@x.com", colegio: null });
    assert.equal(d.refs.studentName, "López Martina");
  });
});

describe("emailDelPackReiniciado", () => {
  it("vuelve al 'sin email' si la familia carga su contacto", () => {
    assert.equal(emailDelPackReiniciado({ packDePrueba: { pedirContacto: true } }, "tipeado@x.com", "f@x.com"), EXTERNAL_SIN_EMAIL);
  });
  it("vuelve al email del fotógrafo si no", () => {
    assert.equal(emailDelPackReiniciado({ packDePrueba: { pedirContacto: false } }, "otro@x.com", "f@x.com"), "f@x.com");
  });
  it("pack de prueba armado a mano: deja el email como está", () => {
    assert.equal(emailDelPackReiniciado({ kind: EXTERNAL_PREVENTA_KIND }, "f@x.com", "g@x.com"), "f@x.com");
  });
});

describe("pedidos DEMO", () => {
  it("sólo el canje de prueba es DEMO", () => {
    assert.equal(esPedidoDemo({ isTest: true, origin: "PACK_REDEMPTION" }), true);
    assert.equal(esPedidoDemo({ isTest: true, origin: "PREVENTA_PACK" }), false);
    assert.equal(esPedidoDemo({ isTest: true, origin: "STANDARD_CHECKOUT" }), false);
    assert.equal(esPedidoDemo({ isTest: false, origin: "PACK_REDEMPTION" }), false);
  });
  it("quedan fuera de los totales", () => {
    const rows = [
      { id: 1, total: 1000 },
      { id: 2, total: 0, isDemo: true },
      { id: 3, total: 500, isDemo: false },
    ];
    const reales = sinPedidosDemo(rows);
    assert.deepEqual(reales.map((r) => r.id), [1, 3]);
    assert.equal(reales.reduce((a, r) => a + r.total, 0), 1500);
  });
});
