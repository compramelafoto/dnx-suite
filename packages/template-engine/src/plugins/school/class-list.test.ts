import assert from "node:assert/strict";
import test from "node:test";
import {
  classListCrowdMessage,
  classListCrowdWarning,
  DEFAULT_CLASS_LIST_OPTIONS,
  layoutClassListBlock,
  parseClassListGroups,
  serializeClassListGroups,
  formatClassList,
  layoutClassList,
  parseClassListValue,
  readClassListOptions,
  serializeClassList,
  formatClassListGroups,
  formatClassListHeading,
  formatCourseName,
  formatShiftLabel,
  type ClassListStudent,
} from "./class-list";

const curso: ClassListStudent[] = [
  { firstName: "Daniel", lastName: "Pérez", isOwner: true },
  { firstName: "Ana Sofía", lastName: "Álvarez" },
  { firstName: "Bruno", lastName: "Zárate" },
];

test("ida y vuelta por el texto de la variable", () => {
  assert.deepEqual(parseClassListValue(serializeClassList(curso)), curso);
  assert.deepEqual(parseClassListValue("María Gómez"), []);
  assert.deepEqual(parseClassListValue("[roto"), []);
});

test("ordena por apellido sin que los acentos alteren el orden", () => {
  const lines = formatClassList(curso, { ...DEFAULT_CLASS_LIST_OPTIONS, sortBy: "lastName" });
  assert.deepEqual(
    lines.map((l) => l.text),
    ["Ana Sofía Álvarez", "Daniel Pérez", "Bruno Zárate"],
  );
});

test("ordena por nombre y escribe apellido primero", () => {
  const lines = formatClassList(curso, {
    ...DEFAULT_CLASS_LIST_OPTIONS,
    sortBy: "firstName",
    nameOrder: "lastFirst",
  });
  assert.deepEqual(
    lines.map((l) => l.text),
    ["Álvarez, Ana Sofía", "Zárate, Bruno", "Pérez, Daniel"],
  );
});

test("sólo el primer nombre", () => {
  const lines = formatClassList(curso, { ...DEFAULT_CLASS_LIST_OPTIONS, givenNames: "first" });
  assert.equal(lines[0]!.text, "Ana Álvarez");
});

test("el dueño del diseño va en negrita sólo si se pide", () => {
  const on = formatClassList(curso, { ...DEFAULT_CLASS_LIST_OPTIONS, highlightOwner: true });
  assert.deepEqual(on.filter((l) => l.bold).map((l) => l.text), ["Daniel Pérez"]);
  const off = formatClassList(curso, { ...DEFAULT_CLASS_LIST_OPTIONS, highlightOwner: false });
  assert.equal(off.some((l) => l.bold), false);
});

test("reparte en columnas de arriba hacia abajo y achica si no entra", () => {
  const lines = Array.from({ length: 10 }, (_, i) => ({ text: `A${i}`, bold: false }));
  const { cells, fontSize } = layoutClassList({ lines, width: 1000, height: 100, fontSize: 40, lineHeight: 1.25, columns: 2 });
  // 5 filas en 100 px: 20 px por fila → cuerpo 16.
  assert.equal(fontSize, 16);
  assert.equal(cells[4]!.x, 0);
  assert.ok(cells[5]!.x > 0);
  assert.equal(cells[5]!.y, 0);
  const amplio = layoutClassList({ lines, width: 1000, height: 10_000, fontSize: 40, lineHeight: 1.25, columns: 2 });
  assert.equal(amplio.fontSize, 40);
});

test("alineación vertical: las columnas se mueven juntas y reparten el hueco", () => {
  // 7 alumnos en 2 columnas: 4 filas de 50 px (cuerpo 40 × 1,25) = 200 px en una caja de 1000.
  const lines = Array.from({ length: 7 }, (_, i) => ({ text: `A${i}`, bold: false }));
  const base = { lines, width: 1000, height: 1000, fontSize: 40, lineHeight: 1.25, columns: 2 };
  const arriba = layoutClassList(base);
  assert.equal(arriba.cells[0]!.y, 0);
  assert.deepEqual(layoutClassList({ ...base, verticalAlign: "top" }), arriba);
  const centro = layoutClassList({ ...base, verticalAlign: "middle" });
  // Sobran 800 px: 400 arriba y 400 abajo. La segunda columna arranca a la misma altura.
  assert.equal(centro.cells[0]!.y, 400);
  assert.equal(centro.cells[4]!.y, 400);
  assert.equal(centro.cells[3]!.y + centro.cells[3]!.height, 600);
  const abajo = layoutClassList({ ...base, verticalAlign: "bottom" });
  assert.equal(abajo.cells[3]!.y + abajo.cells[3]!.height, 1000);
  // Si la lista se achicó para entrar, no hay hueco y no se mueve.
  const justa = layoutClassList({ ...base, height: 100, verticalAlign: "middle" });
  assert.equal(justa.cells[0]!.y, 0);
});

test("opciones guardadas inválidas vuelven a los valores por defecto", () => {
  assert.deepEqual(readClassListOptions({ classList: { columns: 99, sortBy: "x" } }), {
    ...DEFAULT_CLASS_LIST_OPTIONS,
    columns: 4,
  });
});

test("varios cursos: ida y vuelta y los listados viejos se leen como un curso", () => {
  const grupos = [
    { title: "7.° A", courseKey: "k-a", students: curso },
    { title: "7.° B", students: [{ firstName: "Lía", lastName: "Ruiz" }] },
  ];
  assert.deepEqual(parseClassListGroups(serializeClassListGroups(grupos)), grupos);
  // Viejo: arreglo plano → un curso con el título que se le pase.
  assert.deepEqual(parseClassListGroups(serializeClassList(curso), " 7.° A "), [{ title: "7.° A", students: curso }]);
  assert.deepEqual(parseClassListGroups(serializeClassList(curso)), [{ title: "", students: curso }]);
  // Todos los alumnos juntos, para quien sólo quiere la lista.
  assert.equal(parseClassListValue(serializeClassListGroups(grupos)).length, 4);
  assert.deepEqual(parseClassListGroups("{roto"), []);
  assert.deepEqual(parseClassListGroups('{"g":[{"t":"vacío","s":[]}]}'), []);
});

test("el título del curso va siempre, arriba y a todo el ancho, más grande y en negrita", () => {
  const opciones = readClassListOptions({});
  assert.equal(opciones.showHeading, true);
  assert.equal(opciones.allowExtraCourses, false);
  const { cells, fontSize } = layoutClassListBlock({
    groups: [{ title: "7.° A", students: curso }],
    options: opciones,
    width: 1000,
    height: 10_000,
    fontSize: 40,
    lineHeight: 1.25,
  });
  assert.equal(fontSize, 40);
  const titulo = cells[0]!;
  assert.equal(titulo.text, "7.° A");
  assert.equal(titulo.heading, true);
  assert.equal(titulo.bold, true);
  assert.equal(titulo.width, 1000);
  assert.equal(titulo.fontSize, 48);
  // Los alumnos arrancan debajo del título.
  assert.equal(cells[1]!.y, titulo.height);
  // Sin título si se apaga.
  const sin = layoutClassListBlock({
    groups: [{ title: "7.° A", students: curso }],
    options: { ...opciones, showHeading: false },
    width: 1000,
    height: 10_000,
    fontSize: 40,
    lineHeight: 1.25,
  });
  assert.equal(sin.cells.some((c) => c.heading), false);
});

test("dos cursos: 4 columnas siempre, un título por curso y todo se achica junto si no entra", () => {
  const groups = [
    { title: "7.° A", students: Array.from({ length: 4 }, (_, i) => ({ firstName: `A${i}`, lastName: "X" })) },
    { title: "7.° B", students: Array.from({ length: 4 }, (_, i) => ({ firstName: `B${i}`, lastName: "Y" })) },
  ];
  // Aunque el bloque diga 1 columna, con dos cursos van 4.
  const options = { ...DEFAULT_CLASS_LIST_OPTIONS, columns: 1, headingScale: 1 };
  const amplio = layoutClassListBlock({ groups, options, width: 1000, height: 1000, fontSize: 40, lineHeight: 1.25 });
  assert.equal(amplio.columns, 4);
  assert.deepEqual(
    amplio.cells.filter((c) => c.heading).map((c) => c.text),
    ["7.° A", "7.° B"],
  );
  const xs = new Set(amplio.cells.map((c) => c.x));
  assert.ok(xs.size >= 3, "los nombres se reparten en varias columnas");
  // Cada título queda arriba de su primer alumno, en la misma columna.
  for (const titulo of amplio.cells.filter((c) => c.heading)) {
    const i = amplio.cells.indexOf(titulo);
    const primero = amplio.cells[i + 1]!;
    assert.equal(primero.x, titulo.x);
    assert.ok(Math.abs(primero.y - (titulo.y + titulo.height)) < 1e-9);
  }
  // 10 renglones (2 títulos + 8 nombres) en 4 columnas: entran en 3 renglones de alto.
  const justo = layoutClassListBlock({ groups, options, width: 1000, height: 75, fontSize: 40, lineHeight: 1.25 });
  assert.equal(justo.fontSize, 20);
  assert.ok(justo.cells.every((c) => c.y + c.height <= 75 + 1e-9));
});

test("varios cursos: un título nunca queda solo al pie de una columna", () => {
  const curso = (t: string, n: number) => ({
    title: t,
    students: Array.from({ length: n }, (_, i) => ({ firstName: `${t}${String(i).padStart(2, "0")}`, lastName: "" })),
  });
  for (const tamanos of [[7, 9, 5], [3, 3, 3, 3, 3], [10, 1], [2, 2]]) {
    const groups = tamanos.map((n, i) => curso(`${i + 1}.° A`, n));
    const { cells } = layoutClassListBlock({
      groups,
      options: DEFAULT_CLASS_LIST_OPTIONS,
      width: 1200,
      height: 400,
      fontSize: 30,
      lineHeight: 1.2,
    });
    cells.forEach((c, i) => {
      if (!c.heading) return;
      const siguiente = cells.slice(i + 1).find((x) => !x.heading);
      assert.ok(siguiente, "después del título viene un alumno");
      assert.equal(siguiente.x, c.x, `«${c.text}» va en la misma columna que su primer alumno (${tamanos})`);
    });
    // Todos los alumnos están, en orden.
    assert.equal(cells.filter((c) => !c.heading).length, tamanos.reduce((a, b) => a + b, 0));
  }
});

test("un solo curso respeta las columnas del bloque", () => {
  const students = Array.from({ length: 12 }, (_, i) => ({ firstName: `N${i}`, lastName: "" }));
  const { columns } = layoutClassListBlock({
    groups: [{ title: "3.° B", students }],
    options: { ...DEFAULT_CLASS_LIST_OPTIONS, columns: 2 },
    width: 1000,
    height: 1000,
    fontSize: 20,
    lineHeight: 1.2,
  });
  assert.equal(columns, 2);
});

test("el curso se escribe con naturalidad: sin comas y con el ordinal", () => {
  assert.equal(formatCourseName("3 B"), "3.° B");
  assert.equal(formatCourseName("3"), "3.°");
  assert.equal(formatCourseName("3°, B"), "3° B");
  assert.equal(formatCourseName("3.º, B"), "3.º B");
  assert.equal(formatCourseName("1 B (Tarde, Primario)"), "1.° B · Tarde · Primario");
  // Lo que ya se escribió bien no se toca.
  assert.equal(formatCourseName("7° Grado A"), "7° Grado A");
  assert.equal(formatCourseName("3.º B"), "3.º B");
  assert.equal(formatCourseName("Sala de 5 Celeste"), "Sala de 5 Celeste");
  assert.equal(formatCourseName("  "), "");
  assert.equal(formatShiftLabel("Mañana"), "Turno mañana");
  assert.equal(formatShiftLabel("TURNO TARDE"), "Turno tarde");
  assert.equal(formatShiftLabel(""), "");
  assert.equal(formatClassListHeading({ title: "3 B", shift: "Mañana" }, true), "3.° B · Turno mañana");
  assert.equal(formatClassListHeading({ title: "3 B", shift: "Mañana" }, false), "3.° B");
  assert.equal(formatClassListHeading({ title: "3 B" }, true), "3.° B");
});

test("el turno va según la opción, y siempre si dos cursos se llaman igual", () => {
  const alumnos = [{ firstName: "Ana", lastName: "Paz" }];
  const prendido = formatClassListGroups([{ title: "3 B", shift: "Mañana", students: alumnos }], DEFAULT_CLASS_LIST_OPTIONS);
  assert.equal(prendido[0]!.heading, "3.° B · Turno mañana");
  const apagado = { ...DEFAULT_CLASS_LIST_OPTIONS, showShift: false };
  assert.equal(formatClassListGroups([{ title: "3 B", shift: "Mañana", students: alumnos }], apagado)[0]!.heading, "3.° B");
  const mismos = formatClassListGroups(
    [
      { title: "1 B", shift: "Mañana", students: alumnos },
      { title: "1.° B", shift: "Tarde", students: alumnos },
      { title: "2 A", shift: "Tarde", students: alumnos },
    ],
    apagado,
  );
  assert.deepEqual(
    mismos.map((s) => s.heading),
    ["1.° B · Turno mañana", "1.° B · Turno tarde", "2.° A"],
  );
  // El turno viaja en el texto guardado y los listados viejos (sin turno) se siguen leyendo.
  const ida = parseClassListGroups(serializeClassListGroups([{ title: "3 B", shift: "Mañana", students: alumnos }]));
  assert.deepEqual(ida, [{ title: "3 B", shift: "Mañana", students: alumnos }]);
  assert.equal(readClassListOptions({}).showShift, true);
  assert.equal(readClassListOptions({}).showSchoolName, false);
});

test("el colegio va una sola vez arriba de todo, dentro de la caja, sólo si se pide", () => {
  const groups = [
    { title: "7 A", shift: "Mañana", students: [{ firstName: "Ana", lastName: "Paz" }, { firstName: "Leo", lastName: "Ruiz" }] },
    { title: "7 B", shift: "Tarde", students: [{ firstName: "Lía", lastName: "Sosa" }] },
  ];
  const base = { groups, width: 1000, height: 1000, fontSize: 20, lineHeight: 1.25, schoolName: "Escuela Belgrano" };
  const sin = layoutClassListBlock({ ...base, options: DEFAULT_CLASS_LIST_OPTIONS });
  assert.equal(sin.cells.some((c) => c.school), false);
  const con = layoutClassListBlock({ ...base, options: { ...DEFAULT_CLASS_LIST_OPTIONS, showSchoolName: true } });
  const colegio = con.cells.filter((c) => c.text === "Escuela Belgrano");
  assert.equal(colegio.length, 1);
  assert.equal(colegio[0]!.school, true);
  assert.equal(colegio[0]!.y, 0);
  assert.equal(colegio[0]!.width, 1000);
  // Los títulos de los cursos van debajo del colegio.
  const titulos = con.cells.filter((c) => c.heading && !c.school);
  assert.deepEqual(titulos.map((c) => c.text), ["7.° A · Turno mañana", "7.° B · Turno tarde"]);
  assert.ok(titulos.every((t) => t.y >= colegio[0]!.height));
  // Sin colegio en los datos no se imprime nada, aunque la opción esté prendida.
  const vacio = layoutClassListBlock({ ...base, schoolName: "", options: { ...DEFAULT_CLASS_LIST_OPTIONS, showSchoolName: true } });
  assert.equal(vacio.cells.some((c) => c.school), false);
  // Si no entra, se achica todo junto y nada se sale de la caja.
  const chico = layoutClassListBlock({ ...base, height: 60, options: { ...DEFAULT_CLASS_LIST_OPTIONS, showSchoolName: true } });
  assert.ok(chico.cells.every((c) => c.y + c.height <= 60 + 1e-9));
});

test("un título largo se achica para entrar en su columna", () => {
  const groups = [
    { title: "3 B", shift: "Intermedio vespertino", students: [{ firstName: "Ana", lastName: "Paz" }] },
    { title: "3 C", students: [{ firstName: "Leo", lastName: "Ruiz" }] },
  ];
  const { cells } = layoutClassListBlock({ groups, options: DEFAULT_CLASS_LIST_OPTIONS, width: 400, height: 1000, fontSize: 40, lineHeight: 1.2 });
  // No entra ni al cuerpo de los nombres: el curso arriba y el turno abajo, en la misma columna.
  const curso = cells.find((c) => c.heading && c.text === "3.° B")!;
  const turno = cells.find((c) => c.heading && c.text === "Turno intermedio vespertino")!;
  assert.equal(turno.x, curso.x);
  assert.ok(Math.abs(turno.y - (curso.y + curso.height)) < 1e-9);
  for (const t of [curso, turno]) assert.ok([...t.text].length * t.fontSize * 0.6 <= t.width + 1e-9);
});

test("con varios cursos, un nombre largo achica todo para no cortarse en su columna", () => {
  const largo = "Valentina Agustina Alvargonzález Etcheverry";
  const groups = [
    { title: "7 A", students: [{ firstName: largo, lastName: "" }, { firstName: "Ana", lastName: "" }] },
    { title: "7 B", students: [{ firstName: "Leo", lastName: "" }] },
  ];
  const { cells, fontSize } = layoutClassListBlock({ groups, options: DEFAULT_CLASS_LIST_OPTIONS, width: 1200, height: 2000, fontSize: 40, lineHeight: 1.2 });
  const celda = cells.find((c) => c.text === largo)!;
  assert.ok(fontSize < 40);
  assert.ok([...largo].length * fontSize * 0.5 <= celda.width + 1e-9);
});

test("un solo curso sin título reparte igual que antes", () => {
  const students = Array.from({ length: 7 }, (_, i) => ({ firstName: `N${i}`, lastName: "" }));
  const base = { width: 1000, height: 100, fontSize: 40, lineHeight: 1.25 };
  const viejo = layoutClassList({ ...base, lines: formatClassList(students, DEFAULT_CLASS_LIST_OPTIONS), columns: 2 });
  const nuevo = layoutClassListBlock({ ...base, groups: [{ title: "", students }], options: DEFAULT_CLASS_LIST_OPTIONS });
  assert.equal(nuevo.fontSize, viejo.fontSize);
  assert.deepEqual(
    nuevo.cells.map(({ x, y, width, height, text }) => ({ x, y, width, height, text })),
    viejo.cells.map(({ x, y, width, height, text }) => ({ x, y, width, height, text })),
  );
});

test("aviso de foto con más gente que el listado: 30 % más de caras", () => {
  assert.equal(classListCrowdWarning(39, 30), true);
  assert.equal(classListCrowdWarning(38, 30), false);
  assert.equal(classListCrowdWarning(null, 30), false);
  assert.equal(classListCrowdWarning(50, 0), false);
  assert.equal(
    classListCrowdMessage(52, 25),
    "En esta foto se ven unas 52 personas y el listado tiene 25. ¿Hay más de un curso?",
  );
});
