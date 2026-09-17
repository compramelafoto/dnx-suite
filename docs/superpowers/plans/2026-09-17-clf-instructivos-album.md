# Instructivos del álbum (CompraMeLaFoto) — Plan de implementación

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Que el fotógrafo pueda compartir, desde la pestaña del álbum, un instructivo para el cliente armado automáticamente según cómo esté configurado ese álbum, más un cartel QR y una tarjeta personal editable.

**Architecture:** Dos funciones puras derivan un *perfil* del álbum (seis ejes) y lo convierten en una secuencia de pasos; ese resultado alimenta una página pública, un PDF compuesto con `pdf-lib` y dos piezas imprimibles. Lo automático se compone con `pdf-lib`; lo editable (la tarjeta) vive en el Designer que ya está montado en CLF.

**Tech Stack:** Next.js (App Router, webpack), TypeScript, Prisma, `pdf-lib`, `qrcode`, `@repo/design-studio`, `@repo/template-editor-core`. Tests con `node:test` vía `tsx --test`.

**Spec:** `docs/superpowers/specs/2026-09-17-clf-instructivos-album-design.md`

## Global Constraints

- Trabajar siempre dentro de `apps/compramelafoto/` salvo la migración de la Tarea 10.
- **Este repositorio no es el Next.js conocido**: antes de escribir código de framework, leer la guía correspondiente en `node_modules/next/dist/docs/` (regla de `AGENTS.md`).
- El segmento dinámico del álbum público se llama `[id]` aunque reciba el `publicSlug`. **No crear `[slug]`**: Next no admite dos nombres para el mismo nivel dinámico y el build falla.
- Ninguna pieza nueva puede pedirle el QR a `api.qrserver.com`. El QR se genera localmente con `QRCode.toBuffer`.
- Las funciones puras reciben `ahora: Date` inyectado. Nunca llaman a `new Date()` por dentro: sin eso los tests de preventa son irreproducibles.
- Textos de cara al usuario en español rioplatense.
- Comandos desde `apps/compramelafoto/`: tests `pnpm test:instructivos`, tipos `pnpm typecheck`, lint `pnpm lint`.

---

## Estructura de archivos

| Archivo | Responsabilidad |
|---|---|
| `lib/instructivos/album-instructivo-profile.ts` | Puro. Señales crudas → perfil de seis ejes. |
| `lib/instructivos/album-instructivo-steps.ts` | Puro. Perfil → secuencia de pasos. |
| `lib/instructivos/load-album-instructivo.ts` | Único punto que toca Prisma. |
| `lib/instructivos/instructivo-qr.ts` | QR local en PNG. |
| `lib/instructivos/instructivo-pdf.ts` | Instructivo en PDF (`pdf-lib`, texto en flujo). |
| `lib/instructivos/cartel-qr-pdf.ts` | Cartel A4/A5 (`pdf-lib`). |
| `app/a/[id]/instructivo/page.tsx` | Página pública del instructivo. |
| `app/api/a/[id]/instructivo/pdf/route.ts` | Descarga del instructivo en PDF. |
| `app/api/dashboard/albums/[id]/instructivo/cartel/route.ts` | Cartel QR. |
| `app/api/dashboard/albums/[id]/instructivo/tarjetas/route.ts` | Hoja A4 de tarjetas. |
| `app/api/fotografo/perfil/qr/route.ts` | QR de la página del fotógrafo. |
| `components/dashboard/albums/AlbumInstructivosPanel.tsx` | La subpestaña. |
| `lib/albums/album-dashboard-nav.ts` | Modificado: suma el panel `"instructivos"`. |

---

# ETAPA 1 — El instructivo (Tareas 1 a 7)

## Task 1: El perfil del álbum

**Files:**
- Create: `lib/instructivos/album-instructivo-profile.ts`
- Test: `lib/instructivos/album-instructivo-profile.test.ts`
- Modify: `package.json` (script `test:instructivos`)

**Interfaces:**
- Consumes: nada.
- Produces: `AlbumInstructivoProfile`, `AlbumInstructivoProfileInput`, `resolveAlbumInstructivoProfile(input: AlbumInstructivoProfileInput): AlbumInstructivoProfile`.

- [ ] **Step 1: Escribir el test que falla**

Crear `lib/instructivos/album-instructivo-profile.test.ts`:

```ts
import { describe, it } from "node:test";
import assert from "node:assert/strict";

import {
  resolveAlbumInstructivoProfile,
  type AlbumInstructivoProfileInput,
} from "./album-instructivo-profile";

const AHORA = new Date("2026-09-17T12:00:00Z");

function baseInput(): AlbumInstructivoProfileInput {
  return {
    album: {
      id: 1,
      title: "Maratón 2026",
      publicSlug: "maraton-2026",
      isPublic: true,
      isHidden: false,
      hiddenPhotosEnabled: false,
      preCompraCloseAt: null,
      enableDigitalPhotos: true,
      enablePrintedPhotos: false,
      includeDigitalWithPrint: false,
      deliveryType: null,
      pickupBy: null,
      expiresAt: new Date("2026-11-01T00:00:00Z"),
    },
    fotografo: { nombre: "Estudio DNX", logoUrl: null, primaryColor: null, handler: "dnx" },
    senales: {
      fotosCargadas: 500,
      rostrosDetectados: 320,
      tokensNumericos: 0,
      tokensDeTexto: 0,
      packsPreventaActivos: 0,
      packsGaleriaActivos: 0,
      videosPublicados: 0,
      laboratorio: null,
      listo: true,
    },
    baseUrl: "https://compramelafoto.com",
    ahora: AHORA,
  };
}

describe("resolveAlbumInstructivoProfile", () => {
  it("una galería abierta con rostros ofrece cara y navegar", () => {
    const p = resolveAlbumInstructivoProfile(baseInput());
    assert.equal(p.entrada, "abierta");
    assert.deepEqual(p.busqueda, ["cara", "navegar"]);
    assert.equal(p.momento, "postventa");
  });

  it("con selfie obligatoria, el reconocimiento facial es el único método", () => {
    const input = baseInput();
    input.album.hiddenPhotosEnabled = true;
    input.senales.tokensNumericos = 90;
    const p = resolveAlbumInstructivoProfile(input);
    assert.equal(p.entrada, "selfie_obligatoria");
    assert.deepEqual(p.busqueda, ["cara"]);
  });

  it("los dorsales aparecen cuando hay tokens numéricos", () => {
    const input = baseInput();
    input.senales.tokensNumericos = 90;
    input.senales.tokensDeTexto = 12;
    const p = resolveAlbumInstructivoProfile(input);
    assert.deepEqual(p.busqueda, ["cara", "dorsal", "palabra", "navegar"]);
  });

  it("un cierre de pre-compra en el futuro marca preventa", () => {
    const input = baseInput();
    input.album.preCompraCloseAt = new Date("2026-10-01T00:00:00Z");
    assert.equal(resolveAlbumInstructivoProfile(input).momento, "preventa");
  });

  it("un cierre de pre-compra ya pasado no es preventa", () => {
    const input = baseInput();
    input.album.preCompraCloseAt = new Date("2026-09-01T00:00:00Z");
    assert.equal(resolveAlbumInstructivoProfile(input).momento, "postventa");
  });

  it("sin fotos cargadas el álbum es simple", () => {
    const input = baseInput();
    input.senales.fotosCargadas = 0;
    input.senales.rostrosDetectados = 0;
    const p = resolveAlbumInstructivoProfile(input);
    assert.equal(p.momento, "simple");
    assert.deepEqual(p.busqueda, ["navegar"]);
  });

  it("un álbum oculto o no listado se marca no_listada", () => {
    const input = baseInput();
    input.album.isPublic = false;
    assert.equal(resolveAlbumInstructivoProfile(input).entrada, "no_listada");
  });

  it("arma la dirección pública del álbum", () => {
    const p = resolveAlbumInstructivoProfile(baseInput());
    assert.equal(p.album.url, "https://compramelafoto.com/a/maraton-2026");
  });

  it("propaga el estado de análisis sin inventarlo", () => {
    const input = baseInput();
    input.senales.listo = false;
    assert.equal(resolveAlbumInstructivoProfile(input).listo, false);
  });
});
```

- [ ] **Step 2: Agregar el script de tests**

En `apps/compramelafoto/package.json`, junto a los otros `test:*`:

```json
"test:instructivos": "../../packages/payments/node_modules/.bin/tsx --tsconfig ./tsconfig.test.json --test lib/instructivos/album-instructivo-profile.test.ts",
```

Cada tarea siguiente extiende esta lista con su propio archivo. Empieza con uno solo para
que el script corra en verde desde el primer commit.

- [ ] **Step 3: Verificar que el test falla**

Run: `pnpm test:instructivos`
Expected: FAIL — no existe `./album-instructivo-profile`.

- [ ] **Step 4: Implementar**

Crear `lib/instructivos/album-instructivo-profile.ts`:

```ts
/**
 * Perfil del álbum para el instructivo: seis ejes que deciden QUÉ pasos existen
 * y en qué orden, no sólo qué palabras se rellenan.
 *
 * Función pura a propósito: las combinaciones reales son demasiadas para probarlas
 * contra la base. `ahora` se inyecta porque la preventa depende del reloj.
 */

export type InstructivoEntrada = "abierta" | "selfie_obligatoria" | "no_listada";
export type InstructivoBusqueda = "cara" | "dorsal" | "palabra" | "navegar";
export type InstructivoMomento = "preventa" | "postventa" | "simple";

export type AlbumInstructivoProfileInput = {
  album: {
    id: number;
    title: string;
    publicSlug: string;
    isPublic: boolean;
    isHidden: boolean;
    hiddenPhotosEnabled: boolean;
    preCompraCloseAt: Date | null;
    enableDigitalPhotos: boolean;
    enablePrintedPhotos: boolean;
    includeDigitalWithPrint: boolean;
    deliveryType: string | null;
    pickupBy: string | null;
    expiresAt: Date | null;
  };
  fotografo: {
    nombre: string | null;
    logoUrl: string | null;
    primaryColor: string | null;
    handler: string | null;
  };
  senales: {
    fotosCargadas: number;
    rostrosDetectados: number;
    tokensNumericos: number;
    tokensDeTexto: number;
    packsPreventaActivos: number;
    packsGaleriaActivos: number;
    videosPublicados: number;
    laboratorio: string | null;
    listo: boolean;
  };
  baseUrl: string;
  ahora: Date;
};

export type AlbumInstructivoProfile = {
  entrada: InstructivoEntrada;
  busqueda: InstructivoBusqueda[];
  momento: InstructivoMomento;
  venta: {
    digital: boolean;
    impreso: boolean;
    packs: boolean;
    video: boolean;
    digitalIncluidoConImpreso: boolean;
  };
  entrega: {
    descarga: boolean;
    retiro: boolean;
    envio: boolean;
    laboratorio: string | null;
  };
  vencimiento: Date | null;
  listo: boolean;
  fotografo: {
    nombre: string;
    logoUrl: string | null;
    color: string | null;
    handler: string | null;
  };
  album: { id: number; titulo: string; slug: string; url: string };
};

function resolveEntrada(album: AlbumInstructivoProfileInput["album"]): InstructivoEntrada {
  if (album.hiddenPhotosEnabled) return "selfie_obligatoria";
  if (!album.isPublic || album.isHidden) return "no_listada";
  return "abierta";
}

function resolveBusqueda(
  entrada: InstructivoEntrada,
  senales: AlbumInstructivoProfileInput["senales"]
): InstructivoBusqueda[] {
  // Con selfie obligatoria el cliente nunca ve fotos ajenas: ofrecer cualquier otro
  // método sería describir una puerta que no existe.
  if (entrada === "selfie_obligatoria") return ["cara"];

  const metodos: InstructivoBusqueda[] = [];
  if (senales.rostrosDetectados > 0) metodos.push("cara");
  if (senales.tokensNumericos > 0) metodos.push("dorsal");
  if (senales.tokensDeTexto > 0) metodos.push("palabra");
  if (senales.fotosCargadas > 0) metodos.push("navegar");
  return metodos.length > 0 ? metodos : ["navegar"];
}

function resolveMomento(
  album: AlbumInstructivoProfileInput["album"],
  senales: AlbumInstructivoProfileInput["senales"],
  ahora: Date
): InstructivoMomento {
  const cierreVigente =
    album.preCompraCloseAt != null && album.preCompraCloseAt.getTime() > ahora.getTime();
  if (cierreVigente || senales.packsPreventaActivos > 0) return "preventa";
  if (senales.fotosCargadas > 0) return "postventa";
  return "simple";
}

export function resolveAlbumInstructivoProfile(
  input: AlbumInstructivoProfileInput
): AlbumInstructivoProfile {
  const { album, fotografo, senales, baseUrl, ahora } = input;
  const entrada = resolveEntrada(album);

  return {
    entrada,
    busqueda: resolveBusqueda(entrada, senales),
    momento: resolveMomento(album, senales, ahora),
    venta: {
      digital: album.enableDigitalPhotos,
      impreso: album.enablePrintedPhotos,
      packs: senales.packsGaleriaActivos > 0 || senales.packsPreventaActivos > 0,
      video: senales.videosPublicados > 0,
      digitalIncluidoConImpreso: album.includeDigitalWithPrint,
    },
    entrega: {
      descarga: album.enableDigitalPhotos,
      retiro: album.pickupBy != null,
      envio: album.deliveryType != null && album.pickupBy == null,
      laboratorio: senales.laboratorio,
    },
    vencimiento: album.expiresAt,
    listo: senales.listo,
    fotografo: {
      nombre: fotografo.nombre?.trim() || "Tu fotógrafo",
      logoUrl: fotografo.logoUrl,
      color: fotografo.primaryColor,
      handler: fotografo.handler,
    },
    album: {
      id: album.id,
      titulo: album.title,
      slug: album.publicSlug,
      url: `${baseUrl.replace(/\/+$/, "")}/a/${album.publicSlug}`,
    },
  };
}
```

- [ ] **Step 5: Verificar que pasa**

Run: `pnpm test:instructivos`
Expected: PASS (los 9 casos del perfil; el archivo de pasos todavía no existe, así que
quitá temporalmente esa ruta del script o creá el archivo vacío en la Tarea 2 antes de
correr. Preferible: correr sólo este archivo con
`../../packages/payments/node_modules/.bin/tsx --tsconfig ./tsconfig.test.json --test lib/instructivos/album-instructivo-profile.test.ts`).

- [ ] **Step 6: Commit**

```bash
git add lib/instructivos/album-instructivo-profile.ts lib/instructivos/album-instructivo-profile.test.ts package.json
git commit -m "Derivar el perfil del álbum para el instructivo"
```

---

## Task 2: Los pasos del instructivo

**Files:**
- Create: `lib/instructivos/album-instructivo-steps.ts`
- Test: `lib/instructivos/album-instructivo-steps.test.ts`

**Interfaces:**
- Consumes: `AlbumInstructivoProfile` (Tarea 1).
- Produces: `InstructivoStep`, `buildInstructivoSteps(profile: AlbumInstructivoProfile): InstructivoStep[]`.

- [ ] **Step 1: Escribir el test que falla**

Crear `lib/instructivos/album-instructivo-steps.test.ts`:

```ts
import { describe, it } from "node:test";
import assert from "node:assert/strict";

import { buildInstructivoSteps } from "./album-instructivo-steps";
import type { AlbumInstructivoProfile } from "./album-instructivo-profile";

function perfil(over: Partial<AlbumInstructivoProfile> = {}): AlbumInstructivoProfile {
  return {
    entrada: "abierta",
    busqueda: ["cara", "navegar"],
    momento: "postventa",
    venta: {
      digital: true,
      impreso: false,
      packs: false,
      video: false,
      digitalIncluidoConImpreso: false,
    },
    entrega: { descarga: true, retiro: false, envio: false, laboratorio: null },
    vencimiento: new Date("2026-11-01T00:00:00Z"),
    listo: true,
    fotografo: { nombre: "Estudio DNX", logoUrl: null, color: null, handler: "dnx" },
    album: {
      id: 1,
      titulo: "Maratón 2026",
      slug: "maraton-2026",
      url: "https://compramelafoto.com/a/maraton-2026",
    },
    ...over,
  };
}

const titulos = (p: AlbumInstructivoProfile) => buildInstructivoSteps(p).map((s) => s.titulo);

describe("buildInstructivoSteps", () => {
  it("postventa: primero elegís, después pagás", () => {
    const t = titulos(perfil());
    assert.ok(t.indexOf("Elegí tus fotos") < t.indexOf("Pagá"));
  });

  it("preventa: primero pagás, después elegís", () => {
    const t = titulos(perfil({ momento: "preventa" }));
    assert.ok(t.indexOf("Pagá") < t.indexOf("Elegí tus fotos"));
  });

  it("preventa nombra la espera hasta que se publiquen las fotos", () => {
    const pasos = buildInstructivoSteps(perfil({ momento: "preventa" }));
    const texto = JSON.stringify(pasos).toLowerCase();
    assert.ok(texto.includes("todavía no están"));
  });

  it("con selfie obligatoria explica el reconocimiento facial y nada más", () => {
    const pasos = buildInstructivoSteps(
      perfil({ entrada: "selfie_obligatoria", busqueda: ["cara"] })
    );
    const texto = JSON.stringify(pasos).toLowerCase();
    assert.ok(texto.includes("selfie"));
    assert.ok(!texto.includes("dorsal"));
    assert.ok(!texto.includes("palabra clave"));
  });

  it("con dorsales explica la búsqueda por número", () => {
    const pasos = buildInstructivoSteps(perfil({ busqueda: ["cara", "dorsal", "navegar"] }));
    assert.ok(JSON.stringify(pasos).toLowerCase().includes("dorsal"));
  });

  it("antepone el aviso cuando el álbum todavía se está procesando", () => {
    const pasos = buildInstructivoSteps(perfil({ listo: false }));
    assert.equal(pasos[0].titulo, "Las fotos se están procesando");
  });

  it("no antepone nada cuando el álbum está listo", () => {
    assert.notEqual(buildInstructivoSteps(perfil())[0].titulo, "Las fotos se están procesando");
  });

  it("el vencimiento aparece como nota del último paso", () => {
    const pasos = buildInstructivoSteps(perfil());
    assert.match(String(pasos[pasos.length - 1].nota), /1 de noviembre de 2026/);
  });

  it("explica el retiro cuando las fotos se retiran en persona", () => {
    const pasos = buildInstructivoSteps(
      perfil({
        venta: {
          digital: false,
          impreso: true,
          packs: false,
          video: false,
          digitalIncluidoConImpreso: false,
        },
        entrega: { descarga: false, retiro: true, envio: false, laboratorio: null },
      })
    );
    assert.ok(JSON.stringify(pasos).toLowerCase().includes("retir"));
  });

  it("todos los pasos tienen título y al menos una línea de detalle", () => {
    for (const momento of ["simple", "postventa", "preventa"] as const) {
      for (const paso of buildInstructivoSteps(perfil({ momento }))) {
        assert.ok(paso.titulo.length > 0, `título vacío en ${momento}`);
        assert.ok(paso.detalle.length > 0, `detalle vacío en ${momento}: ${paso.titulo}`);
      }
    }
  });
});
```

- [ ] **Step 2: Verificar que falla**

Run: `pnpm test:instructivos`
Expected: FAIL — no existe `./album-instructivo-steps`.

- [ ] **Step 3: Implementar**

Crear `lib/instructivos/album-instructivo-steps.ts`:

```ts
/**
 * Perfil → pasos. Acá vive la decisión de forma del instructivo: la preventa invierte
 * la secuencia (se paga antes de que las fotos existan), así que no alcanza con un
 * guion único parametrizado.
 */

import type { AlbumInstructivoProfile } from "./album-instructivo-profile";

export type InstructivoStep = {
  titulo: string;
  detalle: string[];
  /** Advertencia o aclaración destacada (plazos, límites, requisitos). */
  nota?: string;
};

const FORMATO_FECHA = new Intl.DateTimeFormat("es-AR", {
  day: "numeric",
  month: "long",
  year: "numeric",
  timeZone: "America/Argentina/Buenos_Aires",
});

function fecha(d: Date): string {
  return FORMATO_FECHA.format(d);
}

function pasoEntrar(p: AlbumInstructivoProfile): InstructivoStep {
  const detalle = [`Abrí ${p.album.url} desde el celular o la computadora.`];
  if (p.entrada === "selfie_obligatoria") {
    detalle.push(
      "En esta galería nadie ve todas las fotos: vas a ver sólo las tuyas, después de verificar tu identidad."
    );
  }
  if (p.entrada === "no_listada") {
    detalle.push("La galería no aparece en buscadores: se entra solamente con este enlace.");
  }
  return { titulo: "Entrá a la galería", detalle };
}

function pasoEncontrar(p: AlbumInstructivoProfile): InstructivoStep {
  const detalle: string[] = [];
  if (p.busqueda.includes("cara")) {
    detalle.push(
      "Sacate una selfie desde el celular: el reconocimiento facial compara tu cara con las fotos y te muestra las que coinciden."
    );
  }
  if (p.busqueda.includes("dorsal")) {
    detalle.push("Escribí tu número de dorsal o pechera en el buscador.");
  }
  if (p.busqueda.includes("palabra")) {
    detalle.push("También podés buscar por una palabra que aparezca en la foto (un cartel, un nombre).");
  }
  if (p.busqueda.includes("navegar")) {
    detalle.push("O mirá la galería completa y elegí a mano.");
  }
  const paso: InstructivoStep = { titulo: "Encontrá tus fotos", detalle };
  if (p.entrada === "selfie_obligatoria") {
    paso.nota =
      "La selfie se usa sólo para encontrarte y no se publica. Hace falta un celular: desde la computadora no se puede subir.";
  }
  return paso;
}

/** Qué se vende. En preventa es lo que se elige ANTES de pagar. */
function pasoElegirProducto(p: AlbumInstructivoProfile): InstructivoStep {
  const detalle: string[] = [];
  if (p.venta.digital) detalle.push("Fotos digitales: las descargás vos.");
  if (p.venta.impreso) detalle.push("Fotos impresas: las imprime el laboratorio.");
  if (p.venta.digitalIncluidoConImpreso) {
    detalle.push("Cada foto impresa incluye también su versión digital.");
  }
  if (p.venta.packs) detalle.push("Hay packs: varias fotos a mejor precio que sueltas.");
  if (p.venta.video) detalle.push("También hay videos del evento.");
  if (detalle.length === 0) detalle.push("Mirá las opciones disponibles y elegí la tuya.");
  return { titulo: "Elegí qué querés", detalle };
}

/** Marcar las fotos concretas. En preventa pasa DESPUÉS de pagar y de la espera. */
function pasoElegirFotos(p: AlbumInstructivoProfile): InstructivoStep {
  if (p.momento === "preventa") {
    return {
      titulo: "Elegí tus fotos",
      detalle: [
        "Entrá de nuevo a la galería con el mismo enlace.",
        "Marcá las fotos que entran en lo que ya compraste.",
      ],
    };
  }
  const detalle: string[] = [];
  if (p.venta.digital) detalle.push("Fotos digitales: las descargás vos.");
  if (p.venta.impreso) detalle.push("Fotos impresas: las imprime el laboratorio.");
  if (p.venta.digitalIncluidoConImpreso) {
    detalle.push("Cada foto impresa incluye también su versión digital.");
  }
  if (p.venta.packs) detalle.push("Hay packs: varias fotos a mejor precio que sueltas.");
  if (p.venta.video) detalle.push("También hay videos del evento.");
  if (detalle.length === 0) detalle.push("Marcá las fotos que te quieras llevar.");
  return { titulo: "Elegí tus fotos", detalle };
}

function pasoPagar(p: AlbumInstructivoProfile): InstructivoStep {
  const detalle = [
    "El pago es con Mercado Pago: tarjeta, dinero en cuenta o efectivo.",
    "Vas a recibir el comprobante por correo.",
  ];
  const paso: InstructivoStep = { titulo: "Pagá", detalle };
  if (p.momento === "preventa") {
    paso.detalle.unshift("En la preventa pagás primero y elegís después.");
  }
  return paso;
}

function pasoEsperar(): InstructivoStep {
  return {
    titulo: "Esperá a que se publiquen las fotos",
    detalle: [
      "Las fotos todavía no están: se sacan el día del evento y se suben después.",
      "Cuando estén disponibles te avisamos por correo y entrás con el mismo enlace.",
    ],
  };
}

function pasoRecibir(p: AlbumInstructivoProfile): InstructivoStep {
  const detalle: string[] = [];
  if (p.entrega.descarga) {
    detalle.push("Las fotos digitales se descargan desde el enlace que te llega por correo.");
  }
  if (p.entrega.retiro) {
    detalle.push("Las fotos impresas se retiran en persona; te avisamos cuándo están listas.");
  }
  if (p.entrega.envio) {
    detalle.push("Las fotos impresas se envían a la dirección que cargues al comprar.");
  }
  if (p.entrega.laboratorio) {
    detalle.push(`Las imprime ${p.entrega.laboratorio}.`);
  }
  if (detalle.length === 0) detalle.push("Te avisamos por correo cuando tus fotos estén listas.");

  const paso: InstructivoStep = { titulo: "Recibí tus fotos", detalle };
  if (p.vencimiento) {
    paso.nota = `La galería está disponible hasta el ${fecha(p.vencimiento)}. Después de esa fecha las fotos se borran.`;
  }
  return paso;
}

function pasoAvisoProcesando(): InstructivoStep {
  return {
    titulo: "Las fotos se están procesando",
    detalle: [
      "Todavía se están subiendo y analizando.",
      "Si entrás ahora puede que no aparezcan todas: volvé a probar en un rato.",
    ],
  };
}

export function buildInstructivoSteps(p: AlbumInstructivoProfile): InstructivoStep[] {
  const pasos: InstructivoStep[] = [];
  if (!p.listo) pasos.push(pasoAvisoProcesando());

  pasos.push(pasoEntrar(p));

  if (p.momento === "preventa") {
    pasos.push(
      pasoElegirProducto(p),
      pasoPagar(p),
      pasoEsperar(),
      pasoEncontrar(p),
      pasoElegirFotos(p),
      pasoRecibir(p)
    );
    return pasos;
  }

  pasos.push(pasoEncontrar(p), pasoElegirFotos(p), pasoPagar(p), pasoRecibir(p));
  return pasos;
}
```

- [ ] **Step 4: Verificar que pasa**

Run: `pnpm test:instructivos`
Expected: PASS — los 9 casos del perfil y los 10 de los pasos.

> **Por qué la preventa tiene dos pasos de elección y no uno**: en preventa el cliente
> elige el **producto** antes de pagar (`"Elegí qué querés"`) y las **fotos** después de
> que se publiquen (`"Elegí tus fotos"`). Son dos momentos distintos y por eso llevan
> títulos distintos. En postventa hay un solo paso de elección, `"Elegí tus fotos"`.

- [ ] **Step 5: Commit**

```bash
git add lib/instructivos/album-instructivo-steps.ts lib/instructivos/album-instructivo-steps.test.ts
git commit -m "Convertir el perfil del álbum en pasos del instructivo"
```

---

## Task 3: Cargar el perfil desde la base

**Files:**
- Create: `lib/instructivos/load-album-instructivo.ts`
- Modify: ninguno.

**Interfaces:**
- Consumes: `resolveAlbumInstructivoProfile` (Tarea 1), `getAlbumReadiness` de `lib/analysis/album-analysis-readiness.ts`.
- Produces: `loadAlbumInstructivo(slugOrId: string, ahora?: Date): Promise<AlbumInstructivoProfile | null>`.

- [ ] **Step 1: Leer los patrones existentes**

Leer, para copiar el modo de resolver slug-o-id y el criterio de acceso:
- `app/a/[id]/page.tsx` (bloque `generateMetadata`: busca por `publicSlug` y cae a `id` numérico).
- `lib/album-helpers.ts:66` (`canOpenAlbumGallery`).

- [ ] **Step 2: Implementar**

Crear `lib/instructivos/load-album-instructivo.ts`:

```ts
/**
 * Único punto del módulo que toca Prisma. Se mantiene separado de las funciones puras
 * para que las combinaciones se puedan probar sin base de datos.
 */

import { prisma } from "@/lib/prisma";
import { getAlbumReadiness } from "@/lib/analysis/album-analysis-readiness";
import {
  resolveAlbumInstructivoProfile,
  type AlbumInstructivoProfile,
} from "./album-instructivo-profile";

function baseUrl(): string {
  const raw = process.env.NEXT_PUBLIC_SITE_URL || "https://compramelafoto.com";
  return raw.replace(/\/+$/, "");
}

export async function loadAlbumInstructivo(
  slugOrId: string,
  ahora: Date = new Date()
): Promise<AlbumInstructivoProfile | null> {
  const clave = slugOrId.trim();
  if (!clave) return null;

  const seleccion = {
    id: true,
    title: true,
    publicSlug: true,
    isPublic: true,
    isHidden: true,
    hiddenPhotosEnabled: true,
    preCompraCloseAt: true,
    enableDigitalPhotos: true,
    enablePrintedPhotos: true,
    includeDigitalWithPrint: true,
    deliveryType: true,
    pickupBy: true,
    expiresAt: true,
    deletedAt: true,
    user: {
      select: { name: true, logoUrl: true, primaryColor: true, handler: true },
    },
  } as const;

  let album = await prisma.album.findUnique({ where: { publicSlug: clave }, select: seleccion });
  if (!album && /^\d+$/.test(clave)) {
    album = await prisma.album.findUnique({
      where: { id: Number.parseInt(clave, 10) },
      select: seleccion,
    });
  }
  if (!album || album.deletedAt) return null;

  const [fotosCargadas, rostrosDetectados, tokens, readiness] = await Promise.all([
    prisma.photo.count({ where: { albumId: album.id } }),
    prisma.photoFace.count({ where: { photo: { albumId: album.id } } }),
    prisma.ocrToken.findMany({
      where: { photo: { albumId: album.id } },
      select: { textNorm: true },
      take: 500,
    }),
    getAlbumReadiness(album.id),
  ]);

  const tokensNumericos = tokens.filter((t) => /^\d+$/.test(t.textNorm)).length;
  const tokensDeTexto = tokens.length - tokensNumericos;

  return resolveAlbumInstructivoProfile({
    album: {
      id: album.id,
      title: album.title,
      publicSlug: album.publicSlug,
      isPublic: album.isPublic,
      isHidden: album.isHidden,
      hiddenPhotosEnabled: album.hiddenPhotosEnabled,
      preCompraCloseAt: album.preCompraCloseAt,
      enableDigitalPhotos: album.enableDigitalPhotos,
      enablePrintedPhotos: album.enablePrintedPhotos,
      includeDigitalWithPrint: album.includeDigitalWithPrint,
      deliveryType: album.deliveryType ? String(album.deliveryType) : null,
      pickupBy: album.pickupBy ? String(album.pickupBy) : null,
      expiresAt: album.expiresAt,
    },
    fotografo: {
      nombre: album.user?.name ?? null,
      logoUrl: album.user?.logoUrl ?? null,
      primaryColor: album.user?.primaryColor ?? null,
      handler: album.user?.handler ?? null,
    },
    senales: {
      fotosCargadas,
      rostrosDetectados,
      tokensNumericos,
      tokensDeTexto,
      packsPreventaActivos: 0,
      packsGaleriaActivos: 0,
      videosPublicados: 0,
      laboratorio: null,
      listo: readiness.ready,
    },
    baseUrl: baseUrl(),
    ahora,
  });
}
```

> `packsPreventaActivos`, `packsGaleriaActivos`, `videosPublicados` y `laboratorio` quedan
> en cero/null en esta tarea y se completan en la Tarea 4. Separarlos evita mezclar dos
> consultas distintas en un mismo cambio.

- [ ] **Step 3: Verificar tipos**

Run: `pnpm typecheck`
Expected: sin errores. Si `prisma.photoFace` no existe con ese nombre, confirmá el nombre
real del modelo en `packages/db/prisma/schema.prisma:4035` y ajustá.

- [ ] **Step 4: Commit**

```bash
git add lib/instructivos/load-album-instructivo.ts
git commit -m "Leer de la base las señales del instructivo"
```

---

## Task 4: Completar packs, videos y laboratorio

**Files:**
- Modify: `lib/instructivos/load-album-instructivo.ts`

**Interfaces:**
- Consumes: lo de la Tarea 3.
- Produces: mismo `loadAlbumInstructivo`, ahora con las cuatro señales reales.

- [ ] **Step 1: Encontrar las consultas correctas**

Leer para saber qué contar y con qué condición de "activo":
- `lib/album-packs/` (packs de galería, modelo `AlbumPack`).
- `lib/preventa-canjeable/` (packs de preventa, `PackDefinition`).
- `lib/videos/public-ready-videos.ts` (`albumHasPublicReadyVideos`).
- `Album.selectedLabId` y el modelo del laboratorio, para el nombre.

- [ ] **Step 2: Reemplazar los ceros**

En el `Promise.all` de `loadAlbumInstructivo`, sumar los conteos y usarlos en `senales`.
Reutilizar `albumHasPublicReadyVideos(album.id)` en lugar de escribir una consulta nueva:
ya resuelve qué video cuenta como publicado.

- [ ] **Step 3: Verificar tipos**

Run: `pnpm typecheck`
Expected: sin errores.

- [ ] **Step 4: Commit**

```bash
git add lib/instructivos/load-album-instructivo.ts
git commit -m "Sumar packs, videos y laboratorio a las señales del instructivo"
```

---

## Task 5: QR local

**Files:**
- Create: `lib/instructivos/instructivo-qr.ts`
- Test: `lib/instructivos/instructivo-qr.test.ts`
- Modify: `package.json` (sumar el test al script)

**Interfaces:**
- Consumes: dependencia `qrcode`.
- Produces: `buildQrPng(url: string, tamanoPx?: number): Promise<Buffer>`.

- [ ] **Step 1: Escribir el test que falla**

Crear `lib/instructivos/instructivo-qr.test.ts`:

```ts
import { describe, it } from "node:test";
import assert from "node:assert/strict";

import { buildQrPng } from "./instructivo-qr";

describe("buildQrPng", () => {
  it("devuelve un PNG real", async () => {
    const png = await buildQrPng("https://compramelafoto.com/a/maraton-2026");
    // Firma PNG: 89 50 4E 47
    assert.deepEqual([...png.subarray(0, 4)], [0x89, 0x50, 0x4e, 0x47]);
  });

  it("respeta el tamaño pedido", async () => {
    const chico = await buildQrPng("https://compramelafoto.com/a/x", 120);
    const grande = await buildQrPng("https://compramelafoto.com/a/x", 600);
    assert.ok(grande.length > chico.length);
  });

  it("rechaza una dirección vacía", async () => {
    await assert.rejects(() => buildQrPng("  "));
  });
});
```

- [ ] **Step 2: Sumar el archivo al script de tests**

En `package.json`, extender `test:instructivos` con `lib/instructivos/instructivo-qr.test.ts`.

- [ ] **Step 3: Verificar que falla**

Run: `pnpm test:instructivos`
Expected: FAIL — no existe `./instructivo-qr`.

- [ ] **Step 4: Implementar**

Crear `lib/instructivos/instructivo-qr.ts`:

```ts
/**
 * QR generado localmente. El QR que se muestra hoy en Publicación se pide a
 * `api.qrserver.com` (`lib/albums/album-share-url.ts`): eso no sirve para componer un PDF
 * en el servidor y además le informa a un tercero la dirección de cada álbum.
 */

import QRCode from "qrcode";

export async function buildQrPng(url: string, tamanoPx = 320): Promise<Buffer> {
  const destino = url.trim();
  if (!destino) throw new Error("El QR necesita una dirección");
  return QRCode.toBuffer(destino, {
    type: "png",
    width: tamanoPx,
    margin: 1,
    errorCorrectionLevel: "M",
  });
}
```

- [ ] **Step 5: Verificar que pasa**

Run: `pnpm test:instructivos`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add lib/instructivos/instructivo-qr.ts lib/instructivos/instructivo-qr.test.ts package.json
git commit -m "Generar el QR del instructivo sin depender de un servicio externo"
```

---

## Task 6: La página pública del instructivo

**Files:**
- Create: `app/a/[id]/instructivo/page.tsx`
- Create: `components/instructivos/InstructivoView.tsx`

**Interfaces:**
- Consumes: `loadAlbumInstructivo` (Tareas 3-4), `buildInstructivoSteps` (Tarea 2).
- Produces: la ruta `/a/<slug>/instructivo` y el componente `InstructivoView` (reutilizado por el panel del fotógrafo en la Tarea 8).

- [ ] **Step 1: Leer la guía del framework**

Leer `node_modules/next/dist/docs/` en lo referido a páginas del App Router y `params`.
En esta versión `params` llega como `Promise` (ver `app/a/[id]/page.tsx:38`).

- [ ] **Step 2: Escribir el componente de presentación**

Crear `components/instructivos/InstructivoView.tsx` — componente de servidor, sin estado:

```tsx
import type { AlbumInstructivoProfile } from "@/lib/instructivos/album-instructivo-profile";
import type { InstructivoStep } from "@/lib/instructivos/album-instructivo-steps";

export type InstructivoViewProps = {
  profile: AlbumInstructivoProfile;
  steps: InstructivoStep[];
  qrDataUrl: string;
  pdfHref: string;
};

export default function InstructivoView({
  profile,
  steps,
  qrDataUrl,
  pdfHref,
}: InstructivoViewProps) {
  const color = profile.fotografo.color || "#c27b3d";
  return (
    <main className="mx-auto w-full max-w-2xl px-4 py-8">
      <header className="mb-8 flex items-start justify-between gap-4">
        <div className="min-w-0">
          {profile.fotografo.logoUrl ? (
            /* eslint-disable-next-line @next/next/no-img-element */
            <img
              src={profile.fotografo.logoUrl}
              alt={profile.fotografo.nombre}
              className="mb-3 h-12 w-auto object-contain"
            />
          ) : null}
          <p className="m-0 text-sm text-[#6b7280]">{profile.fotografo.nombre}</p>
          <h1 className="m-0 text-2xl font-semibold" style={{ color }}>
            {profile.album.titulo}
          </h1>
          <p className="mt-1 text-sm text-[#6b7280]">Cómo encontrar y comprar tus fotos</p>
        </div>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={qrDataUrl} alt="Código QR de la galería" className="h-28 w-28 shrink-0" />
      </header>

      <ol className="m-0 list-none space-y-6 p-0">
        {steps.map((step, i) => (
          <li key={`${i}-${step.titulo}`} className="flex gap-4">
            <span
              className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-sm font-semibold text-white"
              style={{ backgroundColor: color }}
            >
              {i + 1}
            </span>
            <div className="min-w-0">
              <h2 className="m-0 text-base font-semibold text-[#1a1a1a]">{step.titulo}</h2>
              <ul className="mt-1 list-disc space-y-1 pl-5 text-sm text-[#374151]">
                {step.detalle.map((linea, j) => (
                  <li key={j}>{linea}</li>
                ))}
              </ul>
              {step.nota ? (
                <p className="mt-2 rounded-lg bg-[#fdf8f3] px-3 py-2 text-sm text-[#7c4a1e]">
                  {step.nota}
                </p>
              ) : null}
            </div>
          </li>
        ))}
      </ol>

      <div className="mt-10 flex flex-wrap gap-3">
        <a
          href={profile.album.url}
          className="rounded-lg px-4 py-2 text-sm font-semibold text-white"
          style={{ backgroundColor: color }}
        >
          Entrar a la galería
        </a>
        <a
          href={pdfHref}
          className="rounded-lg border border-[#e5e7eb] px-4 py-2 text-sm font-medium text-[#374151]"
        >
          Descargar en PDF
        </a>
      </div>
    </main>
  );
}
```

- [ ] **Step 3: Escribir la página**

Crear `app/a/[id]/instructivo/page.tsx`:

```tsx
import { notFound } from "next/navigation";
import { loadAlbumInstructivo } from "@/lib/instructivos/load-album-instructivo";
import { buildInstructivoSteps } from "@/lib/instructivos/album-instructivo-steps";
import { buildQrPng } from "@/lib/instructivos/instructivo-qr";
import InstructivoView from "@/components/instructivos/InstructivoView";

export default async function InstructivoPage({
  params,
}: {
  params: Promise<{ id?: string }>;
}) {
  const resolved = await Promise.resolve(params);
  const slugOrId = String(resolved?.id || "").trim();
  const profile = await loadAlbumInstructivo(slugOrId);
  if (!profile) notFound();

  const steps = buildInstructivoSteps(profile);
  const qrPng = await buildQrPng(profile.album.url, 320);
  const qrDataUrl = `data:image/png;base64,${qrPng.toString("base64")}`;

  return (
    <InstructivoView
      profile={profile}
      steps={steps}
      qrDataUrl={qrDataUrl}
      pdfHref={`/api/a/${profile.album.slug}/instructivo/pdf`}
    />
  );
}

export async function generateMetadata({ params }: { params: Promise<{ id?: string }> }) {
  const resolved = await Promise.resolve(params);
  const profile = await loadAlbumInstructivo(String(resolved?.id || "").trim());
  if (!profile) return {};
  return {
    title: `Cómo comprar tus fotos — ${profile.album.titulo}`,
    description: `Instructivo de ${profile.fotografo.nombre} para encontrar y comprar tus fotos.`,
  };
}
```

- [ ] **Step 4: Verificar en el navegador**

Levantar el servidor y abrir `/a/<slug>/instructivo` con un álbum real de la base local.
Comprobar: se ve el logo, se ve el QR, los pasos corresponden a cómo está configurado ese
álbum, y se lee bien en ancho de celular (375px).

- [ ] **Step 5: Verificar tipos y lint**

Run: `pnpm typecheck && pnpm lint`
Expected: sin errores.

- [ ] **Step 6: Commit**

```bash
git add app/a/\[id\]/instructivo components/instructivos
git commit -m "Publicar la página del instructivo del álbum"
```

---

## Task 7: El instructivo en PDF

**Files:**
- Create: `lib/instructivos/instructivo-pdf.ts`
- Create: `app/api/a/[id]/instructivo/pdf/route.ts`

**Interfaces:**
- Consumes: `AlbumInstructivoProfile`, `InstructivoStep`, `buildQrPng`.
- Produces: `buildInstructivoPdf(profile, steps, qrPng): Promise<Uint8Array>` y la ruta de descarga.

- [ ] **Step 1: Implementar la composición**

Crear `lib/instructivos/instructivo-pdf.ts`. El punto delicado es que el texto **fluye**:
hay que medir cada línea y crear página nueva cuando no entra. Sin esto, una preventa
escolar con selfie se corta a la mitad.

```ts
import { PDFDocument, StandardFonts, rgb, type PDFFont, type PDFPage } from "pdf-lib";

import type { AlbumInstructivoProfile } from "./album-instructivo-profile";
import type { InstructivoStep } from "./album-instructivo-steps";

const A4 = { ancho: 595.28, alto: 841.89 };
const MARGEN = 56;
const ANCHO_UTIL = A4.ancho - MARGEN * 2;

function hexARgb(hex: string | null) {
  const limpio = (hex || "#c27b3d").replace("#", "");
  if (limpio.length !== 6) return rgb(0.76, 0.48, 0.24);
  const n = Number.parseInt(limpio, 16);
  return rgb(((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255);
}

/** Corta el texto en líneas que entran en `ancho` con esa fuente y tamaño. */
function quebrarEnLineas(texto: string, font: PDFFont, tam: number, ancho: number): string[] {
  const palabras = texto.split(/\s+/).filter(Boolean);
  const lineas: string[] = [];
  let actual = "";
  for (const palabra of palabras) {
    const tentativa = actual ? `${actual} ${palabra}` : palabra;
    if (font.widthOfTextAtSize(tentativa, tam) <= ancho) {
      actual = tentativa;
    } else {
      if (actual) lineas.push(actual);
      actual = palabra;
    }
  }
  if (actual) lineas.push(actual);
  return lineas;
}

export async function buildInstructivoPdf(
  profile: AlbumInstructivoProfile,
  steps: InstructivoStep[],
  qrPng: Uint8Array
): Promise<Uint8Array> {
  const pdf = await PDFDocument.create();
  const regular = await pdf.embedFont(StandardFonts.Helvetica);
  const negrita = await pdf.embedFont(StandardFonts.HelveticaBold);
  const color = hexARgb(profile.fotografo.color);
  const qr = await pdf.embedPng(qrPng);

  let page: PDFPage = pdf.addPage([A4.ancho, A4.alto]);
  let y = A4.alto - MARGEN;

  const nuevaPagina = () => {
    page = pdf.addPage([A4.ancho, A4.alto]);
    y = A4.alto - MARGEN;
  };

  const escribir = (texto: string, font: PDFFont, tam: number, sangria = 0) => {
    for (const linea of quebrarEnLineas(texto, font, tam, ANCHO_UTIL - sangria)) {
      if (y - tam < MARGEN) nuevaPagina();
      page.drawText(linea, { x: MARGEN + sangria, y: y - tam, size: tam, font });
      y -= tam * 1.45;
    }
  };

  // Encabezado: identidad del fotógrafo y QR del álbum.
  page.drawImage(qr, { x: A4.ancho - MARGEN - 96, y: y - 96, width: 96, height: 96 });
  page.drawText(profile.fotografo.nombre, {
    x: MARGEN,
    y: y - 14,
    size: 11,
    font: regular,
    color: rgb(0.42, 0.45, 0.5),
  });
  y -= 32;
  page.drawText(profile.album.titulo, { x: MARGEN, y: y - 20, size: 20, font: negrita, color });
  y -= 44;
  escribir("Cómo encontrar y comprar tus fotos", regular, 12);
  y -= 8;
  escribir(profile.album.url, regular, 10);
  y -= 24;

  steps.forEach((step, i) => {
    if (y - 60 < MARGEN) nuevaPagina();
    escribir(`${i + 1}. ${step.titulo}`, negrita, 13);
    for (const linea of step.detalle) escribir(`•  ${linea}`, regular, 11, 14);
    if (step.nota) escribir(step.nota, negrita, 10, 14);
    y -= 10;
  });

  return pdf.save();
}
```

- [ ] **Step 2: Implementar la ruta**

Crear `app/api/a/[id]/instructivo/pdf/route.ts`:

```ts
import { NextResponse } from "next/server";

import { loadAlbumInstructivo } from "@/lib/instructivos/load-album-instructivo";
import { buildInstructivoSteps } from "@/lib/instructivos/album-instructivo-steps";
import { buildQrPng } from "@/lib/instructivos/instructivo-qr";
import { buildInstructivoPdf } from "@/lib/instructivos/instructivo-pdf";

export const runtime = "nodejs";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id?: string }> }
) {
  const resolved = await Promise.resolve(params);
  const profile = await loadAlbumInstructivo(String(resolved?.id || "").trim());
  if (!profile) return NextResponse.json({ error: "No encontrado" }, { status: 404 });

  const steps = buildInstructivoSteps(profile);
  const qr = await buildQrPng(profile.album.url, 480);
  const pdf = await buildInstructivoPdf(profile, steps, qr);

  return new NextResponse(Buffer.from(pdf), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `inline; filename="instructivo-${profile.album.slug}.pdf"`,
      "Cache-Control": "no-store",
    },
  });
}
```

- [ ] **Step 3: Verificar a mano**

Abrir `/api/a/<slug>/instructivo/pdf`. Comprobar que el PDF abre, que el QR se ve y que
**un álbum de preventa con selfie no se corta**: si los pasos exceden una carilla, tiene
que haber una segunda página.

- [ ] **Step 4: Verificar tipos y lint**

Run: `pnpm typecheck && pnpm lint`
Expected: sin errores.

- [ ] **Step 5: Commit**

```bash
git add lib/instructivos/instructivo-pdf.ts app/api/a/\[id\]/instructivo
git commit -m "Componer el instructivo del álbum en PDF"
```

---

## Task 8: La subpestaña Instructivos

**Files:**
- Modify: `lib/albums/album-dashboard-nav.ts`
- Create: `components/dashboard/albums/AlbumInstructivosPanel.tsx`
- Modify: `components/dashboard/albums/AlbumPublicationSection.tsx`
- Test: `lib/albums/album-dashboard-nav.instructivos.test.ts`

**Interfaces:**
- Consumes: `AlbumPublicationPanelId`.
- Produces: el panel `"instructivos"` en la navegación de Publicación.

- [ ] **Step 1: Escribir el test que falla**

Crear `lib/albums/album-dashboard-nav.instructivos.test.ts`:

```ts
import { describe, it } from "node:test";
import assert from "node:assert/strict";

import { buildAlbumWorkspaceNavAreas } from "./album-dashboard-nav";

describe("navegación de Publicación", () => {
  it("incluye Instructivos como última subpestaña", () => {
    const areas = buildAlbumWorkspaceNavAreas({
      videoMvpEnabled: false,
      schoolLinked: false,
    });
    const publicacion = areas.find((a) => a.id === "publicacion");
    assert.ok(publicacion);
    const labels = publicacion.subtabs.map((s) => s.label);
    assert.deepEqual(labels, [
      "Compartir",
      "Visibilidad",
      "Protección",
      "Portada",
      "Instructivos",
    ]);
  });
});
```

- [ ] **Step 2: Sumar el archivo al script y verificar que falla**

Extender `test:instructivos` en `package.json` con
`lib/albums/album-dashboard-nav.instructivos.test.ts`.

Run: `pnpm test:instructivos`
Expected: FAIL — faltan "Instructivos" en la lista.

- [ ] **Step 3: Implementar el cambio de navegación**

En `lib/albums/album-dashboard-nav.ts`:

1. Extender el tipo:

```ts
export type AlbumPublicationPanelId =
  | "compartir"
  | "visibilidad"
  | "proteccion"
  | "portada"
  | "instructivos";
```

2. En `buildAlbumWorkspaceNavAreas`, dentro del área `publicacion`, agregar al final del
   array `subtabs`:

```ts
{
  id: "publicacion",
  navKey: "publicacion-instructivos",
  label: "Instructivos",
  publicationPanel: "instructivos",
},
```

- [ ] **Step 4: Verificar que pasa**

Run: `pnpm test:instructivos`
Expected: PASS.

- [ ] **Step 5: Escribir el panel**

Crear `components/dashboard/albums/AlbumInstructivosPanel.tsx` (componente cliente, sigue
el estilo de `AlbumSharePanel.tsx` — leerlo primero):

- Explica en una línea que el instructivo se arma solo con la configuración del álbum.
- Muestra el enlace `<baseUrl>/a/<slug>/instructivo` con botón de copiar y botón de
  compartir por WhatsApp, igual que `AlbumSharePanel`.
- Botón "Ver instructivo" (abre la página) y "Descargar PDF".
- Deja preparado un bloque "Para imprimir" vacío: lo llenan las Tareas 9 y 11.

- [ ] **Step 6: Montar el panel**

En `components/dashboard/albums/AlbumPublicationSection.tsx`, junto a los bloques
`activePanel === "compartir"` etc. (líneas 182-322), agregar:

```tsx
{activePanel === "instructivos" ? (
  <AlbumInstructivosPanel albumId={albumId} publicSlug={publicSlug} />
) : null}
```

Usar los mismos nombres de props que ya recibe la sección; si `publicSlug` no está entre
ellas, sumarla desde `app/dashboard/albums/[id]/page.tsx`.

- [ ] **Step 7: Verificar en el navegador**

Abrir un álbum → Publicación → Instructivos. Comprobar que la subpestaña aparece, que el
enlace copiado abre la página correcta y que el PDF se descarga.

- [ ] **Step 8: Verificar tipos y lint**

Run: `pnpm typecheck && pnpm lint`
Expected: sin errores.

- [ ] **Step 9: Commit**

```bash
git add lib/albums components/dashboard/albums/AlbumInstructivosPanel.tsx components/dashboard/albums/AlbumPublicationSection.tsx package.json
git commit -m "Sumar la subpestaña Instructivos a Publicación"
```

---

# ETAPA 2 — Cartel QR y QR del perfil (Tareas 9 y 10)

## Task 9: Cartel QR imprimible

**Files:**
- Create: `lib/instructivos/cartel-qr-pdf.ts`
- Create: `app/api/dashboard/albums/[id]/instructivo/cartel/route.ts`
- Modify: `components/dashboard/albums/AlbumInstructivosPanel.tsx`

**Interfaces:**
- Consumes: `AlbumInstructivoProfile`, `buildQrPng`.
- Produces: `buildCartelQrPdf(profile, qrPng, tamano: "a4" | "a5"): Promise<Uint8Array>`.

- [ ] **Step 1: Implementar la composición**

Crear `lib/instructivos/cartel-qr-pdf.ts`. Una sola página, contenido fijo: logo arriba,
título del álbum, QR gigante centrado, la dirección web debajo y una línea de instrucción
tomada del primer paso de búsqueda del perfil (selfie / dorsal / mirá la galería).

Medidas: A4 `595.28 × 841.89`, A5 `419.53 × 595.28`. El QR ocupa el 55% del ancho de
página y va centrado horizontalmente.

- [ ] **Step 2: Implementar la ruta con control de dueño**

Crear `app/api/dashboard/albums/[id]/instructivo/cartel/route.ts`. Leer primero
`app/api/dashboard/albums/route.ts` para copiar exactamente cómo se obtiene el usuario
autenticado y cómo se rechaza a quien no es dueño del álbum. Aceptar `?size=a4|a5`
(por defecto `a4`) y devolver 403 si el usuario no es dueño ni administrador.

- [ ] **Step 3: Sumar los botones al panel**

En `AlbumInstructivosPanel.tsx`, en el bloque "Para imprimir": dos botones, "Cartel A4" y
"Cartel A5", que apuntan a la ruta con el `size` correspondiente.

- [ ] **Step 4: Verificar a mano**

Descargar los dos tamaños. Comprobar que el QR escanea desde el papel impreso (o desde la
pantalla, a tamaño real) y lleva a la galería.

- [ ] **Step 5: Verificar tipos y lint**

Run: `pnpm typecheck && pnpm lint`
Expected: sin errores.

- [ ] **Step 6: Commit**

```bash
git add lib/instructivos/cartel-qr-pdf.ts app/api/dashboard/albums/\[id\]/instructivo components/dashboard/albums/AlbumInstructivosPanel.tsx
git commit -m "Generar el cartel QR imprimible del álbum"
```

---

## Task 10: QR de la página del fotógrafo

**Files:**
- Create: `app/api/fotografo/perfil/qr/route.ts`
- Modify: la pantalla de configuración del fotógrafo (`app/fotografo/configuracion/`)

**Interfaces:**
- Consumes: `buildQrPng`, `buildCartelQrPdf` (Tarea 9).
- Produces: la ruta `/api/fotografo/perfil/qr?formato=png|cartel`.

- [ ] **Step 1: Implementar la ruta**

Crear `app/api/fotografo/perfil/qr/route.ts`. Resuelve el usuario autenticado, lee su
`handler`, `isPublicPageEnabled`, `name` y `logoUrl`, y arma el QR de
`<baseUrl>/<handler>`.

Casos a cubrir explícitamente:
- Sin sesión → 401.
- Sin `handler` → 409 con `{ error: "Todavía no elegiste tu dirección pública" }`.
- Con `isPublicPageEnabled === false` → 409 con `{ error: "Tu página pública está apagada" }`.
- `?formato=png` → PNG; `?formato=cartel` → PDF A4.

- [ ] **Step 2: Sumar el bloque a la configuración**

En la pantalla de configuración del fotógrafo, un bloque "El QR de tu página" con la
vista previa, los dos botones de descarga, y — cuando falta el `handler` o la página está
apagada — el texto que explica qué hacer, con enlace a donde se resuelve. **No mostrar un
QR roto.**

- [ ] **Step 3: Verificar a mano**

Probar los tres estados: fotógrafo con página activa, fotógrafo sin `handler`, fotógrafo
con página apagada.

- [ ] **Step 4: Verificar tipos y lint**

Run: `pnpm typecheck && pnpm lint`
Expected: sin errores.

- [ ] **Step 5: Commit**

```bash
git add app/api/fotografo/perfil app/fotografo/configuracion
git commit -m "Ofrecer el QR de la página pública del fotógrafo"
```

---

# ETAPA 3 — La tarjeta editable (Tareas 11 a 13)

> Esta etapa es la única con cambio de esquema. **No empezarla hasta que las Etapas 1 y 2
> estén desplegadas y verificadas.**

## Task 11: El campo que recuerda la plantilla

**Files:**
- Modify: `packages/db/prisma/schema.prisma` (modelo `User`)
- Create: `packages/db/prisma/migrations/<timestamp>_user_instructivo_card_template/migration.sql`

**Interfaces:**
- Produces: `User.instructivoCardTemplateId String?`.

- [ ] **Step 1: Agregar el campo**

En el modelo `User` de `packages/db/prisma/schema.prisma`:

```prisma
  /// Plantilla del Designer que el fotógrafo usa para la tarjeta del instructivo.
  /// null = todavía no personalizó ninguna y se usa la semilla por defecto.
  instructivoCardTemplateId String?
```

- [ ] **Step 2: Escribir la migración a mano**

```sql
ALTER TABLE "User" ADD COLUMN "instructivoCardTemplateId" TEXT;
```

- [ ] **Step 3: Regenerar el cliente**

Run: `pnpm prisma:generate`
Expected: sin errores.

- [ ] **Step 4: Aplicar en las cinco bases**

**Este es el paso que puede romper las otras plataformas.** `schema.prisma` es compartido
por cinco bases Neon y el despliegue no corre `prisma migrate deploy`.

Para cada una de las cinco bases: aplicar el `ALTER TABLE` y después registrar la
migración en `_prisma_migrations` con el checksum tomado de una base donde ya quedó
aplicada correctamente. El procedimiento está documentado en la memoria del proyecto
("Registrar migraciones con el checksum de una base sana").

Verificar en cada base:

```sql
SELECT column_name FROM information_schema.columns
WHERE table_name = 'User' AND column_name = 'instructivoCardTemplateId';
```

Expected: una fila en las cinco.

- [ ] **Step 5: Commit**

```bash
git add packages/db/prisma/schema.prisma packages/db/prisma/migrations
git commit -m "Recordar qué plantilla usa el fotógrafo para la tarjeta del instructivo"
```

---

## Task 12: Semilla de la plantilla y botón Personalizar

**Files:**
- Create: `lib/instructivos/tarjeta-template-seed.ts`
- Create: `app/api/dashboard/albums/[id]/instructivo/tarjeta-template/route.ts`
- Modify: `components/dashboard/albums/AlbumInstructivosPanel.tsx`

**Interfaces:**
- Consumes: modelos `TemplateV2`, `TemplateV2Version`, `TemplateV2Block`; `User.instructivoCardTemplateId` (Tarea 11).
- Produces: `ensureTarjetaTemplate(userId: number): Promise<string>` — devuelve el `templateId`, creándolo la primera vez.

- [ ] **Step 1: Leer cómo se crea una plantilla**

Leer `app/api/template-v2/templates/` y `packages/template-editor-core/src/presets/` para
copiar exactamente cómo se arma una `TemplateV2` con su primera versión y sus bloques. **No
inventar la forma del `canvasJson`**: tomarla de un preset existente.

- [ ] **Step 2: Implementar la semilla**

Crear `lib/instructivos/tarjeta-template-seed.ts` con `ensureTarjetaTemplate(userId)`:

- Si `User.instructivoCardTemplateId` ya apunta a una plantilla existente, devolverlo.
- Si no, crear una `TemplateV2` llamada "Tarjeta del instructivo" con una versión y estos
  bloques: `IMAGE` (logo), `QR` ligado a la variable `qr_album`, `VARIABLE_TEXT`
  (`nombre_fotografo`), `VARIABLE_TEXT` (`titulo_album`), `TEXT` (la dirección web).
- Tamaño de lienzo: tarjeta de 85 × 55 mm.
- Guardar el id en `User.instructivoCardTemplateId` y devolverlo.

- [ ] **Step 3: Implementar la ruta**

`POST /api/dashboard/albums/[id]/instructivo/tarjeta-template` llama a
`ensureTarjetaTemplate` y devuelve `{ templateId, versionId, editorUrl }`, donde
`editorUrl` es `/fotografo/diseno/plantillas/v2/<templateId>/<versionId>`.

- [ ] **Step 4: Sumar el botón**

En `AlbumInstructivosPanel.tsx`, botón "Personalizar tarjeta": llama a la ruta y navega al
`editorUrl` que devuelve.

- [ ] **Step 5: Verificar a mano**

Apretar el botón con un fotógrafo que nunca personalizó nada: tiene que crear la plantilla
y abrir el editor con los bloques en su lugar. Apretarlo de nuevo: tiene que abrir **la
misma** plantilla, no crear una segunda.

- [ ] **Step 6: Commit**

```bash
git add lib/instructivos/tarjeta-template-seed.ts app/api/dashboard/albums/\[id\]/instructivo components/dashboard/albums/AlbumInstructivosPanel.tsx
git commit -m "Crear y abrir la tarjeta del instructivo en el Designer"
```

---

## Task 13: Hoja A4 de tarjetas

**Files:**
- Create: `app/api/dashboard/albums/[id]/instructivo/tarjetas/route.ts`
- Modify: `components/dashboard/albums/AlbumInstructivosPanel.tsx`

**Interfaces:**
- Consumes: `ensureTarjetaTemplate` (Tarea 12), `editorADocumento` de `@repo/template-editor-core`, `emitDesign` de `@repo/design-studio`, `buildQrPng`.
- Produces: la ruta que devuelve la hoja A4 de tarjetas en PDF.

- [ ] **Step 1: Leer cómo se emite un diseño**

Leer `lib/social/build-album-pieces.ts` y `packages/design-studio/src/export/emit.ts` para
copiar el camino `editorADocumento` → `emitDesign({ formats: ["PDF"] })`, incluido cómo se
resuelven las variables con el `ResourceResolver`.

**Cuidado con la densidad**: `emitDesign` usa 300dpi por defecto. Para impresión está bien;
si el PDF sale desmedido, revisar `SCREEN_PNG_DPI` en `build-album-pieces.ts:33` y el
comentario que explica por qué.

- [ ] **Step 2: Implementar la ruta**

Resolver el álbum y su dueño, cargar el perfil, generar el QR, llamar a
`ensureTarjetaTemplate`, resolver las variables (`qr_album`, `logo`, `nombre_fotografo`,
`titulo_album`, `web`) y emitir el PDF de una tarjeta.

Después, con `pdf-lib`, **componer la hoja A4**: repetir esa tarjeta en una grilla de 2
columnas × 4 filas con marcas de corte finas. Usar `PDFDocument.embedPdf` para incrustar la
tarjeta emitida en cada posición.

Devolver 403 si quien pide no es dueño del álbum, igual que en la Tarea 9.

- [ ] **Step 3: Sumar el botón**

En el bloque "Para imprimir" de `AlbumInstructivosPanel.tsx`: botón "Hoja de tarjetas A4".

- [ ] **Step 4: Verificar a mano**

Descargar la hoja. Comprobar: ocho tarjetas, todas con el QR de **ese** álbum, y que el
diseño refleja lo que el fotógrafo editó en la Tarea 12 (editar algo, volver a descargar,
ver el cambio).

- [ ] **Step 5: Verificar tipos y lint**

Run: `pnpm typecheck && pnpm lint`
Expected: sin errores.

- [ ] **Step 6: Commit**

```bash
git add app/api/dashboard/albums/\[id\]/instructivo components/dashboard/albums/AlbumInstructivosPanel.tsx
git commit -m "Armar la hoja A4 de tarjetas del instructivo"
```

---

## Verificación final

Antes de dar el trabajo por terminado, con evidencia en pantalla (no de memoria):

- [ ] `pnpm test:instructivos` — todos los casos en verde.
- [ ] `pnpm typecheck` — sin errores.
- [ ] `pnpm lint` — sin errores.
- [ ] Los siete criterios de aceptación de la especificación, probados uno por uno contra
      álbumes reales de la base local: simple abierto, selfie obligatoria, carrera con
      dorsales, preventa escolar, sin fotos, con análisis en curso.
- [ ] Ninguna pieza nueva pide nada a `api.qrserver.com` (`grep -rn "qrserver" lib app`
      no debe devolver coincidencias dentro de `lib/instructivos/`).
