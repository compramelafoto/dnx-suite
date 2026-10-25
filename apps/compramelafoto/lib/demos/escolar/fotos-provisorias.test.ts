import assert from "node:assert/strict";
import { describe, it } from "node:test";
import sharp from "sharp";
import { generarFotoProvisoria } from "@/lib/demos/escolar/fotos-provisorias";
import { archivoDeAlumno, DEMO_ESCOLAR } from "@/lib/demos/escolar/datos";

describe("demo escolar — fotos provisorias", () => {
  it("genera un JPG vertical para el retrato y horizontal para la grupal", async () => {
    const retrato = await generarFotoProvisoria({ nombre: "Abril Benítez", curso: "Sala de 5 Naranja", tipo: "retrato" });
    assert.equal(retrato[0], 0xff);
    assert.equal(retrato[1], 0xd8);
    const m1 = await sharp(retrato).metadata();
    assert.deepEqual([m1.width, m1.height], [1200, 1500]);
    const grupal = await generarFotoProvisoria({ nombre: "6º grado A", curso: "Escuela Demo", tipo: "grupal" });
    const m2 = await sharp(grupal).metadata();
    assert.deepEqual([m2.width, m2.height], [1800, 1200]);
  });

  it("nombra los archivos como los prompts", () => {
    assert.equal(archivoDeAlumno("6A", 6), "6A-07.jpg");
    assert.equal(DEMO_ESCOLAR.cursos[1].alumnos[6].nombre, "Julieta");
    assert.equal(DEMO_ESCOLAR.cursos[1].alumnos[15].apellido, "Ojeda");
    assert.equal(DEMO_ESCOLAR.cursos[1].alumnos[15].nombre, "Juan Cruz");
    assert.equal(DEMO_ESCOLAR.cursos[0].alumnos.length, 20);
  });
});
