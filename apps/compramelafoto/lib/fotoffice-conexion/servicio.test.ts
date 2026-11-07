/**
 * pnpm --filter compramelafoto test:fotoffice-vinculo
 *
 * Códigos y llaves de la conexión con FOTOFFICE, contra una base en memoria.
 */
import assert from "node:assert/strict";
import { test } from "node:test";
import { hashSecreto } from "./llaves";
import {
  type BaseConexion,
  canjearCodigo,
  crearCodigo,
  listarConexiones,
  revocarConexionDelUsuario,
  revocarLlave,
  usuarioDeLlave,
} from "./servicio";

type Fila = Record<string, any>;

function coincide(fila: Fila, where: Fila): boolean {
  return Object.entries(where).every(([k, v]) => {
    if (v && typeof v === "object" && !(v instanceof Date) && "gt" in v) return fila[k] instanceof Date && fila[k].getTime() > v.gt.getTime();
    if (v instanceof Date) return fila[k] instanceof Date && fila[k].getTime() === v.getTime();
    return (fila[k] ?? null) === v;
  });
}

function tabla(filas: Fila[], prefijo: string) {
  let n = 0;
  return {
    filas,
    async create({ data }: { data: Fila }) {
      const f = { id: `${prefijo}${++n}`, createdAt: new Date(), usedAt: null, revokedAt: null, lastUsedAt: null, ...data };
      filas.push(f);
      return f;
    },
    async findUnique({ where }: { where: Fila }) {
      return filas.find((f) => coincide(f, where)) ?? null;
    },
    async findMany({ where }: Fila) {
      return filas.filter((f) => coincide(f, where));
    },
    async update({ where, data }: { where: Fila; data: Fila }) {
      const f = filas.find((x) => coincide(x, where));
      if (!f) throw new Error("no existe");
      Object.assign(f, data);
      return f;
    },
    async updateMany({ where, data }: { where: Fila; data: Fila }) {
      const fs = filas.filter((f) => coincide(f, where));
      for (const f of fs) Object.assign(f, data);
      return { count: fs.length };
    },
  };
}

function baseFalsa() {
  const codigos = tabla([], "cod");
  const conexiones = tabla([], "con");
  const usuarios = tabla([{ id: 79, name: "DNX Estudio", mpUserId: "97484805", email: "no-cruza@example.com" }, { id: 80, name: null, mpUserId: null }], "u");
  const db: BaseConexion = {
    clfAppConnectCode: codigos,
    clfAppConnection: conexiones,
    user: usuarios,
    $transaction: (fn) => fn(db),
  };
  return { db, codigos, conexiones };
}

const T0 = new Date("2026-11-07T12:00:00.000Z");
const reloj = (d: Date) => () => d;

test("crear y canjear: devuelve la llave una vez y guarda sólo hashes", async () => {
  const { db, codigos, conexiones } = baseFalsa();
  const codigo = await crearCodigo({ userId: 79, externalLabel: " DNX   Estudio ", returnUrl: "https://fotoffice.com/api/integraciones/clf/callback" }, { db, ahora: reloj(T0) });
  assert.equal(codigos.filas.length, 1);
  assert.equal(codigos.filas[0]!.codeHash, hashSecreto(codigo));
  assert.equal(JSON.stringify(codigos.filas).includes(codigo), false);
  assert.equal(codigos.filas[0]!.expiresAt.getTime(), T0.getTime() + 2 * 60 * 1000);
  assert.equal(codigos.filas[0]!.externalLabel, "DNX Estudio");

  const r = await canjearCodigo(codigo, { db, ahora: reloj(new Date(T0.getTime() + 60_000)) });
  assert.ok(r);
  assert.match(r.llave, /^clf_fo_[A-Za-z0-9_-]{43}$/);
  assert.deepEqual(r.cuenta, { id: 79, nombre: "DNX Estudio", mpUserId: "97484805" });
  assert.equal(conexiones.filas.length, 1);
  assert.equal(conexiones.filas[0]!.keyHash, hashSecreto(r.llave));
  assert.equal(JSON.stringify(conexiones.filas).includes(r.llave), false);
  assert.equal(conexiones.filas[0]!.externalLabel, "DNX Estudio");

  const otraVez = await canjearCodigo(codigo, { db, ahora: reloj(new Date(T0.getTime() + 61_000)) });
  assert.equal(otraVez, null);
  assert.equal(conexiones.filas.length, 1);
});

test("un código vencido, inventado o mal formado no da llave", async () => {
  const { db, conexiones } = baseFalsa();
  const codigo = await crearCodigo({ userId: 79, externalLabel: "X", returnUrl: "u" }, { db, ahora: reloj(T0) });
  assert.equal(await canjearCodigo(codigo, { db, ahora: reloj(new Date(T0.getTime() + 2 * 60 * 1000)) }), null);
  assert.equal(await canjearCodigo("A".repeat(43), { db, ahora: reloj(T0) }), null);
  assert.equal(await canjearCodigo("corto", { db, ahora: reloj(T0) }), null);
  assert.equal(conexiones.filas.length, 0);
});

test("cuenta sin nombre: «Cuenta <id>»", async () => {
  const { db } = baseFalsa();
  const codigo = await crearCodigo({ userId: 80, externalLabel: "X", returnUrl: "u" }, { db, ahora: reloj(T0) });
  const r = await canjearCodigo(codigo, { db, ahora: reloj(T0) });
  assert.deepEqual(r?.cuenta, { id: 80, nombre: "Cuenta 80", mpUserId: null });
});

test("usuarioDeLlave: sólo llaves activas; revocar es idempotente", async () => {
  const { db, conexiones } = baseFalsa();
  const codigo = await crearCodigo({ userId: 79, externalLabel: "X", returnUrl: "u" }, { db, ahora: reloj(T0) });
  const { llave } = (await canjearCodigo(codigo, { db, ahora: reloj(T0) }))!;

  const uso = new Date(T0.getTime() + 5000);
  assert.deepEqual(await usuarioDeLlave(llave, { db, ahora: reloj(uso) }), { userId: 79 });
  assert.equal(conexiones.filas[0]!.lastUsedAt.getTime(), uso.getTime());
  assert.equal(await usuarioDeLlave(`clf_fo_${"B".repeat(43)}`, { db }), null);
  assert.equal(await usuarioDeLlave("otra-cosa", { db }), null);
  assert.equal(await usuarioDeLlave(null, { db }), null);

  await revocarLlave(llave, { db, ahora: reloj(uso) });
  await revocarLlave(llave, { db, ahora: reloj(new Date(uso.getTime() + 1)) });
  assert.equal(conexiones.filas[0]!.revokedAt.getTime(), uso.getTime());
  assert.equal(await usuarioDeLlave(llave, { db }), null);
});

test("Apps conectadas: lista las activas y revoca sólo las propias", async () => {
  const { db } = baseFalsa();
  const c1 = await crearCodigo({ userId: 79, externalLabel: "DNX Estudio", returnUrl: "u" }, { db, ahora: reloj(T0) });
  const { llave } = (await canjearCodigo(c1, { db, ahora: reloj(T0) }))!;
  const [conexion] = await listarConexiones(79, { db });
  assert.equal(conexion?.externalLabel, "DNX Estudio");
  assert.deepEqual(await listarConexiones(80, { db }), []);

  assert.equal(await revocarConexionDelUsuario(80, conexion!.id, { db }), false);
  assert.deepEqual(await usuarioDeLlave(llave, { db }), { userId: 79 });

  assert.equal(await revocarConexionDelUsuario(79, conexion!.id, { db }), true);
  assert.equal(await usuarioDeLlave(llave, { db }), null);
  assert.deepEqual(await listarConexiones(79, { db }), []);
});
