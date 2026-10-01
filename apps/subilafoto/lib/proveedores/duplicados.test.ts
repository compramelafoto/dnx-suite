import { describe, expect, test } from "vitest";
import { buscarDuplicados, elegirVinculo } from "./duplicados";

const SALON = {
  id: "p1",
  nombre: "Salón Luna S.R.L.",
  cuit: "30-71234567-4",
  email: "hola@salonluna.com.ar",
  instagram: "@salonluna",
  sitioWeb: "https://www.salonluna.com.ar",
};

const OTRO = {
  id: "p2",
  nombre: "Catering Norte",
  cuit: "30-99999999-9",
  email: "info@cateringnorte.com",
  instagram: null,
  sitioWeb: null,
};

describe("buscar duplicados", () => {
  test("sin nada parecido no encuentra nada", () => {
    const r = buscarDuplicados({ nombre: "DJ Pablo" }, [SALON, OTRO]);
    expect(r).toEqual([]);
  });

  test("el mismo CUIT es la misma empresa aunque cambie el nombre", () => {
    const r = buscarDuplicados({ nombre: "Eventos Luna", cuit: "30712345674" }, [SALON, OTRO]);
    expect(r).toEqual([{ id: "p1", motivo: "cuit", seguro: true }]);
  });

  test("el mismo correo alcanza", () => {
    const r = buscarDuplicados({ nombre: "Otra cosa", email: "HOLA@salonluna.com.ar" }, [SALON]);
    expect(r[0]).toEqual({ id: "p1", motivo: "email", seguro: true });
  });

  test("el mismo Instagram alcanza, escrito de cualquier forma", () => {
    const r = buscarDuplicados(
      { nombre: "Otra cosa", instagram: "https://instagram.com/SalonLuna/" },
      [SALON],
    );
    expect(r[0]).toEqual({ id: "p1", motivo: "instagram", seguro: true });
  });

  test("el mismo dominio alcanza", () => {
    const r = buscarDuplicados({ nombre: "Otra cosa", sitioWeb: "salonluna.com.ar/fotos" }, [
      SALON,
    ]);
    expect(r[0]).toEqual({ id: "p1", motivo: "sitio", seguro: true });
  });

  test("el mismo nombre es una sospecha, no una certeza", () => {
    const r = buscarDuplicados({ nombre: "salon luna" }, [SALON]);
    expect(r).toEqual([{ id: "p1", motivo: "nombre", seguro: false }]);
  });

  test("devuelve el motivo más fuerte de cada empresa, no todos", () => {
    const r = buscarDuplicados({ nombre: "Salón Luna", cuit: "30712345674" }, [SALON]);
    expect(r).toEqual([{ id: "p1", motivo: "cuit", seguro: true }]);
  });

  test("ordena lo seguro antes que la sospecha", () => {
    const r = buscarDuplicados({ nombre: "Catering Norte", cuit: "30712345674" }, [OTRO, SALON]);
    expect(r.map((c) => c.id)).toEqual(["p1", "p2"]);
    expect(r.map((c) => c.seguro)).toEqual([true, false]);
  });

  test("un campo vacío no engancha con otro campo vacío", () => {
    const vacio = { id: "p3", nombre: "Sin datos", cuit: null, email: null, instagram: null };
    const r = buscarDuplicados({ nombre: "Nuevo", cuit: null, email: null }, [vacio]);
    expect(r).toEqual([]);
  });
});

describe("con qué se vincula", () => {
  test("sin coincidencias, se crea una empresa nueva", () => {
    expect(elegirVinculo([])).toEqual({ accion: "crear" });
  });

  test("con una coincidencia segura, se vincula a esa", () => {
    expect(elegirVinculo([{ id: "p1", motivo: "cuit", seguro: true }])).toEqual({
      accion: "vincular",
      partnerId: "p1",
      motivo: "cuit",
    });
  });

  test("con sólo sospechas, se crea y se deja marcado para revisar", () => {
    const r = elegirVinculo([{ id: "p1", motivo: "nombre", seguro: false }]);
    expect(r).toEqual({ accion: "crear", posiblesDuplicados: ["p1"] });
  });

  test("con dos coincidencias seguras se vincula a la primera y se avisa", () => {
    const r = elegirVinculo([
      { id: "p1", motivo: "cuit", seguro: true },
      { id: "p2", motivo: "email", seguro: true },
    ]);
    expect(r).toEqual({
      accion: "vincular",
      partnerId: "p1",
      motivo: "cuit",
      posiblesDuplicados: ["p2"],
    });
  });
});
