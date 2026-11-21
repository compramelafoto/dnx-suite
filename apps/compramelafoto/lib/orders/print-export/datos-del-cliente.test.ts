import { describe, it } from "node:test";
import assert from "node:assert/strict";

import { cabeceraDelPdf, clienteEnElPdf, encabezadoDelManifest, nombreSinContacto, rotuloDelCliente } from "./datos-del-cliente";

const buyer = { name: "Ana Pérez", email: "ana.perez@gmail.com", phone: "+54 9 341 555-1234" };
const base = { orderId: 3888, alumno: null, buyer, createdAt: new Date("2026-11-20T15:00:00.000Z"), totalCents: 48000 };
const tieneContacto = (lineas: string[]) =>
  lineas.some((l) => /email|whatsapp|tel[eé]fono|total|@|555-1234|48000/i.test(l));

describe("datos del cliente para el fotógrafo (sin cambios)", () => {
  it("el MANIFEST lleva nombre, correo, teléfono, fecha y total, en el mismo orden de siempre", () => {
    assert.deepEqual(encabezadoDelManifest({ ...base, paraLaboratorio: false }), [
      "Pedido Álbum: 3888",
      "Nombre: Ana Pérez",
      "Email: ana.perez@gmail.com",
      "WhatsApp / teléfono: +54 9 341 555-1234",
      "Fecha: 2026-11-20T15:00:00.000Z",
      "Total: 48000 ARS",
      "",
      "ITEMS IMPRESIÓN:",
      "Producto | Acabado | Tamaño | Cantidad | Ruta ZIP",
    ]);
  });
  it("con alumno, como siempre", () => {
    const l = encabezadoDelManifest({ ...base, alumno: { alumno: "Juan", curso: "7° A" }, paraLaboratorio: false });
    assert.deepEqual(l.slice(0, 4), ["Pedido Álbum: 3888", "Alumno: Juan", "Curso: 7° A", "Adulto: Ana Pérez"]);
  });
  it("el PDF y la carpeta, como siempre", () => {
    assert.deepEqual(cabeceraDelPdf({ orderId: 3888, fecha: "20/11/2026 12:00", totalCents: 48000, paraLaboratorio: false }), [
      "Pedido N°: 3888", "Fecha: 20/11/2026 12:00", "Total: $48000 ARS",
    ]);
    assert.deepEqual(clienteEnElPdf(buyer, false), [
      "Nombre: Ana Pérez", "Email: ana.perez@gmail.com", "WhatsApp / teléfono: +54 9 341 555-1234",
    ]);
    assert.deepEqual(clienteEnElPdf({ name: null, email: null, phone: null }, false), ["Nombre: -", "Email: -", "WhatsApp / teléfono: -"]);
    assert.equal(rotuloDelCliente(buyer, false), "Ana Pérez");
    assert.equal(rotuloDelCliente({ name: null, email: "ana@x.com", phone: null }, false), "ana@x.com");
    assert.equal(rotuloDelCliente({ name: null, email: null, phone: null }, false), "Cliente");
  });
});

describe("datos del cliente para el laboratorio", () => {
  it("el MANIFEST no lleva correo, teléfono ni total", () => {
    const l = encabezadoDelManifest({ ...base, paraLaboratorio: true });
    assert.equal(tieneContacto(l), false, l.join("\n"));
    assert.deepEqual(l.slice(0, 3), ["Pedido Álbum: 3888", "Nombre: Ana Pérez", "Fecha: 2026-11-20T15:00:00.000Z"]);
  });
  it("el PDF no lleva correo, teléfono ni total", () => {
    const l = [
      ...cabeceraDelPdf({ orderId: 3888, fecha: "20/11/2026 12:00", totalCents: 48000, paraLaboratorio: true }),
      ...clienteEnElPdf(buyer, true),
    ];
    assert.equal(tieneContacto(l), false, l.join("\n"));
    assert.deepEqual(l, ["Pedido N°: 3888", "Fecha: 20/11/2026 12:00", "Nombre: Ana Pérez"]);
  });
  it("un correo o teléfono guardado como nombre no aparece en ningún lado", () => {
    const comoCorreo = { name: "ana.perez@gmail.com", email: "ana.perez@gmail.com", phone: "3415551234" };
    assert.equal(rotuloDelCliente(comoCorreo, true), "Cliente");
    assert.equal(rotuloDelCliente({ name: null, email: "ana@x.com", phone: null }, true), "Cliente");
    assert.equal(tieneContacto(encabezadoDelManifest({ ...base, buyer: comoCorreo, paraLaboratorio: true })), false);
    assert.deepEqual(clienteEnElPdf({ ...comoCorreo, name: "+54 341 555-1234" }, true), ["Nombre: Cliente"]);
  });
  it("nombreSinContacto deja los nombres comunes", () => {
    assert.equal(nombreSinContacto("Ana Pérez"), "Ana Pérez");
    assert.equal(nombreSinContacto("Juan 2"), "Juan 2");
    assert.equal(nombreSinContacto("  "), "Cliente");
  });
});
