# Generador de propuestas — etapas 1 y 2

Pantalla en `/propuesta` (Clickatón, puerto 3005) donde un vendedor sube el logo
de un cliente potencial y obtiene, al instante, las nueve piezas publicitarias
compuestas sobre las pantallas reales de las cuatro plataformas, más un dossier
en PDF para mandarle a la marca.

**No usa base de datos.** Nada se guarda: se sube, se compone y se devuelve.
En producción la pantalla y las tres rutas responden 404.

## Cómo se usa

```bash
pnpm --filter clickaton dev
# abrir http://localhost:3005/propuesta
```

1. Subir el logo del cliente (PNG, JPG, WEBP o SVG, hasta 5 MB).
2. Escribir el nombre de la marca y el rubro.
3. Recorrer las nueve piezas y alternar entre escritorio y celular.
4. Descargar el PDF.

## Cómo está armado

| Capa | Dónde | Qué hace |
|---|---|---|
| Catálogo de piezas | `packages/partners/src/proposal-pieces.ts` | Las nueve piezas, su fondo y su geometría |
| Decisión de placa | `packages/partners/src/proposal-contrast.ts` | Mide el logo y elige placa clara u oscura |
| Plan de líneas | `packages/partners/src/proposal-plan.ts` | Arma la lista de la propuesta |
| Composición | `apps/clickaton/lib/propuesta/compose.ts` | Superpone logo y fondo con `sharp` |
| Dossier | `apps/clickaton/lib/propuesta/pdf.ts` | Arma el documento con `pdf-lib` |
| Pantalla | `apps/clickaton/app/(public)/propuesta/` | Formulario, vista previa y descarga |
| Rutas | `apps/clickaton/app/api/propuesta/` | `pieza` (PNG) y `pdf` (dossier) |

## Cada formato se compone distinto

Las tres piezas de una misma plataforma comparten el fondo pero son formatos
publicitarios distintos, y tienen que verse distintos:

| Formato | Cómo se dibuja |
|---|---|
| Placa de bienvenida | Ventana centrada, con la página muy oscurecida detrás |
| Banner horizontal | Franja ancha y baja, en el cuerpo de la página |
| Franja de logos | Renglón al pie, con el logo del cliente **entre otras marcas en gris** |

La geometría vive en `getProposalPieceLayout` y se expresa en **fracciones del
lienzo**, no en píxeles, para que la misma definición sirva en escritorio
(1440×900) y en celular (390×844).

Los logos vecinos de la franja son bloques grises, no logos inventados de otras
marcas: el espacio lo comparten hasta doce anunciantes, y mostrar el logo del
cliente solo ahí daría a entender una exclusividad que no se está vendiendo.

### Por qué existe la prueba de que las piezas difieren

Durante un tiempo `composePiece` usaba la pieza elegida **únicamente para elegir
el archivo de fondo**. Las nueve piezas del catálogo producían cuatro imágenes
—una por plataforma— y el vendedor le mostraba al cliente la misma placa tres
veces con distinto epígrafe. No había ninguna prueba que lo detectara.

`compose.test.ts` ahora compone las tres piezas de InfoSpot con el mismo logo y
compara sus huellas: si dos coinciden, falla.

## Por qué el logo va sobre una placa

Los logos suelen venir diseñados para un solo fondo. Uno blanco sobre
transparente desaparece en una superficie clara. `resolvePlateTreatment` mide la
luminancia media de los píxeles visibles —ignorando los transparentes— y elige
placa clara, oscura o ninguna.

## El dossier

Trece páginas para una propuesta completa:

```
Portada       logo del cliente, marca, rubro y fecha
Presentación  las cuatro plataformas y su alcance
Cuerpo        una página por línea: mockup de escritorio y de celular,
              formato, plataforma y cantidad
Resumen       todo lo que incluye + qué debe entregar el anunciante
Contratapa    cierre y validez
```

El PDF **recorre las líneas del plan**, no secciones fijas: la cantidad de
páginas depende de cuántas piezas tenga la propuesta. Es lo que permite que el
mismo generador sirva cuando aparezcan precios, extras físicos y merchandising,
sin reescribir el armado.

Sin precios: `unitPriceMinor` queda en nulo por decisión comercial. El dossier
presenta el valor y el número se conversa aparte.

## Qué falta

Etapas 3 a 5 del spec: guardar la propuesta con su código recuperable,
vencimiento y limpieza; búsqueda de sponsors existentes con detección de
duplicados; alta como `PROSPECT` con assets en `PENDING`; y el panel de
propuestas generadas.

Ver `docs/superpowers/specs/2026-08-22-generador-propuestas-sponsors-design.md`.

### Inventario disponible

Las nueve piezas del catálogo corresponden a placements montados. FotoRank tenía
una brecha —no había inventario global de plataforma— y quedó cubierta:

| Placement | Superficie | Dueño | Estado |
|---|---|---|---|
| `FOTORANK_CONTEST_WELCOME` | Página de un concurso | Organizador | Montado |
| `FOTORANK_HOME_WELCOME` | Portada | Plataforma | Montado |
| `FOTORANK_HOME_MARQUEE` | Portada | Plataforma | Montado |
| `FOTORANK_CONTEST_MARQUEE` | Página de un concurso | Organizador | Sin montar |

Los cargadores de portada **no llevan `contestContextId`**: solo alcance GLOBAL
o PLATFORM explícito. Es lo que impide que el sponsor de un concurso aparezca en
la portada sin haberla contratado.

Cada superficie tiene su propia bandera, y las de portada están separadas de la
de concurso porque son inventarios de dueños distintos:

| Bandera | Superficie |
|---|---|
| `FOTORANK_PARTNER_WELCOME_ENABLED` | Placa de concurso |
| `FOTORANK_HOME_WELCOME_ENABLED` | Placa de portada |
| `FOTORANK_HOME_MARQUEE_ENABLED` | Franja de portada |

Todas en OFF por defecto: sin configurarlas, la portada no cambia y no se
consulta DNX Partners.
