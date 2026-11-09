import test from "node:test";
import assert from "node:assert/strict";
import {
  claveTelefono,
  consultarUsuariosExistentes,
  usuariosExistentes,
  type BuscarUsuarios,
  type UsuarioCandidato,
} from "./usuarios-existentes";

const USUARIOS: UsuarioCandidato[] = [
  { id: 10, email: "Luz.Estudio@Gmail.com", phone: null, whatsapp: null, role: "PHOTOGRAPHER", createdAt: new Date("2026-03-01T12:00:00.000Z"), unsubscribedAt: null },
  { id: 11, email: "otra@mail.com", phone: "0341 15-555-1234", whatsapp: null, role: "CUSTOMER", createdAt: new Date("2026-04-02T12:00:00.000Z"), unsubscribedAt: new Date("2026-05-01T00:00:00.000Z") },
  { id: 12, email: "tercera@mail.com", phone: null, whatsapp: "+54 9 351 777 8899", role: "ORGANIZER", createdAt: new Date("2026-05-03T12:00:00.000Z"), unsubscribedAt: null },
];

/** Buscador falso: imita el filtro grueso de la base (email exacto sin mayúsculas, o cola del teléfono). */
const buscarFalso: BuscarUsuarios = async ({ emails, colas }) =>
  USUARIOS.filter(
    (u) =>
      emails.includes(u.email.toLowerCase()) ||
      colas.some((c) => (u.phone ?? "").includes(c) || (u.whatsapp ?? "").includes(c)),
  );

const LUZ = { clave: "luz.estudio@gmail.com", userId: 10, rol: "PHOTOGRAPHER", creadoEn: "2026-03-01T12:00:00.000Z", baja: false };

test("encuentra por email sin importar mayúsculas", async () => {
  const r = await usuariosExistentes({ emails: ["  LUZ.estudio@gmail.COM "], telefonos: [] }, buscarFalso);
  assert.deepEqual(r, [LUZ]);
});

test("encuentra por teléfono con 9 y 15", async () => {
  // El pedido trae el número con 9 de WhatsApp; la base lo tiene con 0 y 15 (y al revés).
  const r = await usuariosExistentes({ emails: [], telefonos: ["+5493415551234", "351 15 777 8899"] }, buscarFalso);
  assert.deepEqual(
    r.sort((a, b) => a.userId - b.userId),
    [
      { clave: "+543415551234", userId: 11, rol: "CUSTOMER", creadoEn: "2026-04-02T12:00:00.000Z", baja: true },
      { clave: "+543517778899", userId: 12, rol: "ORGANIZER", creadoEn: "2026-05-03T12:00:00.000Z", baja: false },
    ],
  );
});

test("devuelve el rol y nunca el nombre", async () => {
  const conNombre = async () => [{ ...USUARIOS[0]!, name: "Luz Pérez" } as UsuarioCandidato];
  const r = await usuariosExistentes({ emails: ["luz.estudio@gmail.com"], telefonos: [] }, conNombre);
  assert.equal(r.length, 1);
  assert.deepEqual(Object.keys(r[0]!).sort(), ["baja", "clave", "creadoEn", "rol", "userId"]);
  assert.equal(JSON.stringify(r).includes("Luz Pérez"), false);
});

test("claveTelefono copia la de FOTOFFICE", () => {
  assert.equal(claveTelefono("0341 15-555-1234"), "+543415551234");
  assert.equal(claveTelefono("+54 9 341 555 1234"), "+543415551234");
  assert.equal(claveTelefono("+543415551234"), "+543415551234");
  assert.equal(claveTelefono("1234"), null);
  assert.equal(claveTelefono(null), null);
});

// ---------------------------------------------------------------------------------------------
// Ruta

const pedido = (body: unknown, auth?: string) =>
  new Request("https://compramelafoto.com/api/internal/usuarios/existentes", {
    method: "POST",
    headers: { "content-type": "application/json", ...(auth ? { authorization: auth } : {}) },
    body: typeof body === "string" ? body : JSON.stringify(body),
  });

test("sin secreto configurado responde 503", async () => {
  const r = await consultarUsuariosExistentes(pedido({ emails: [], telefonos: [] }, "Bearer algo"), { secreto: undefined, buscar: buscarFalso });
  assert.equal(r.status, 503);
});

test("secreto incorrecto 401", async () => {
  const deps = { secreto: "secreto-bueno", buscar: buscarFalso };
  assert.equal((await consultarUsuariosExistentes(pedido({ emails: [] }, "Bearer secreto-malo"), deps)).status, 401);
  assert.equal((await consultarUsuariosExistentes(pedido({ emails: [] }, "Bearer corto"), deps)).status, 401);
  assert.equal((await consultarUsuariosExistentes(pedido({ emails: [] }), deps)).status, 401);
});

test("más de 200 claves 400", async () => {
  const deps = { secreto: "s3cr3t", buscar: buscarFalso };
  const emails = Array.from({ length: 150 }, (_, i) => `a${i}@mail.com`);
  const telefonos = Array.from({ length: 51 }, (_, i) => `341555${String(i).padStart(4, "0")}`);
  const r = await consultarUsuariosExistentes(pedido({ emails, telefonos }, "Bearer s3cr3t"), deps);
  assert.equal(r.status, 400);
});

test("JSON inválido 400", async () => {
  const r = await consultarUsuariosExistentes(pedido("{no es json", "Bearer s3cr3t"), { secreto: "s3cr3t", buscar: buscarFalso });
  assert.equal(r.status, 400);
});

test("con secreto correcto responde sólo las coincidencias", async () => {
  const r = await consultarUsuariosExistentes(
    pedido({ emails: ["luz.estudio@gmail.com", "nadie@mail.com"], telefonos: [] }, "Bearer s3cr3t"),
    { secreto: "s3cr3t", buscar: buscarFalso },
  );
  assert.equal(r.status, 200);
  assert.deepEqual(await r.json(), { coincidencias: [LUZ] });
});

test("usuarios existentes devuelve creadoEn y baja", async () => {
  const r = await usuariosExistentes({ emails: ["otra@mail.com", "luz.estudio@gmail.com"], telefonos: [] }, buscarFalso);
  assert.deepEqual(
    r.sort((a, b) => a.userId - b.userId),
    [LUZ, { clave: "otra@mail.com", userId: 11, rol: "CUSTOMER", creadoEn: "2026-04-02T12:00:00.000Z", baja: true }],
  );
});
