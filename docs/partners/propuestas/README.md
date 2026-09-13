# Generador de propuestas — etapas 1, 2 y 3

Pantalla en `/propuesta` (Clickatón, puerto 3005) donde un vendedor sube el logo
de un cliente potencial y obtiene, al instante, las piezas publicitarias
compuestas sobre las pantallas reales de las plataformas, más un dossier en PDF
para mandarle a la marca.

**Las piezas salen del mapa de inventario, no de una lista fija.** La pantalla le
pregunta a `listSellableSpaces` qué espacios puede ofrecer quien está vendiendo y
arma la propuesta solo con esos. Ver [inventario.md](../inventario.md).

**Guarda la propuesta con un código.** Al descargar el PDF queda una fila con
sus líneas y su logo, recuperable en `/propuesta/<código>` durante treinta días.
El código va impreso en la portada y en la contratapa del dossier.

**La pantalla es pública**: cualquiera con el enlace arma una propuesta sin
cuenta. Por eso las dos rutas tienen tope de uso por cliente —90 piezas cada 5
minutos, 6 PDF cada 10— y el logo se valida por sus bytes, no por lo que declara
el navegador. El tope es por proceso: en serverless cada instancia lleva su
cuenta, así que frena al insistente pero no reparte cupo con precisión.

SVG queda rechazado salvo que el despliegue lo habilite: rasterizar SVG de
cualquiera es superficie de ataque que no hace falta abrir.

## Cómo se usa

```bash
pnpm --filter clickaton dev
# abrir http://localhost:3005/propuesta
```

1. Subir el logo del cliente (PNG, JPG o WEBP, hasta 5 MB).
2. Escribir el nombre de la marca y el rubro.
3. Recorrer las piezas disponibles y alternar entre escritorio y celular.
4. Descargar el PDF. La pantalla muestra el código con el que se recupera.
5. Para volver a abrirla: `/propuesta/PR-XXXXXX`.

## Cómo está armado

| Capa | Dónde | Qué hace |
|---|---|---|
| Catálogo de piezas | `packages/partners/src/proposal-pieces.ts` | Las nueve piezas, su fondo y su geometría |
| Decisión de placa | `packages/partners/src/proposal-contrast.ts` | Mide el logo y elige placa clara u oscura |
| Plan de líneas | `packages/partners/src/proposal-plan.ts` | Arma la lista de la propuesta |
| Composición | `apps/clickaton/lib/propuesta/compose.ts` | Superpone logo y fondo con `sharp` |
| Dossier | `apps/clickaton/lib/propuesta/pdf.ts` | Arma el documento con `pdf-lib` |
| Pantalla | `apps/clickaton/app/(public)/propuesta/` | Formulario, vista previa y descarga |
| Rutas | `apps/clickaton/app/api/propuesta/` | `pieza` (PNG), `pdf` (dossier) y `[codigo]/pdf` (re-descarga) |
| Código y vencimiento | `packages/partners/src/proposal-record.ts` | Genera y valida el código; decide si venció |
| Repositorio | `packages/db/src/partners-proposals.ts` | Guardar, recuperar, vencer y borrar |
| Guardado desde la app | `apps/clickaton/lib/propuesta/persistencia.ts` | Sube el logo y escribe la fila |
| Recuperación | `apps/clickaton/app/(public)/propuesta/[codigo]/` | Qué tiene la propuesta y botón de descarga |
| Limpieza diaria | `apps/clickaton/app/api/cron/purge-proposals/` | Vence, borra y suelta logos |

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

Una portada, una presentación, una página por pieza, un resumen y una
contratapa. Con el inventario de hoy y DNX como vendedor son once páginas:

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

## Quién vende

`PROPOSAL_SELLER`, en `apps/clickaton/lib/propuesta/seller.ts`, hoy está fijo en
`{ owner: "PLATFORM" }`: Clickatón es el equipo de DNX vendiendo la red. Cuando la
herramienta la usen organizadores o workspaces, eso sale de la sesión.

Si el vendedor no tiene ningún espacio montado, la pantalla lo dice y no ofrece
el PDF; la ruta responde 409. Nadie manda un dossier vacío por accidente.

## Cómo se guarda y se recupera

El código es `PR-` más seis caracteres de un alfabeto de treinta y dos **sin
`O`/`0` ni `I`/`1`**: se dicta por teléfono y se copia a mano de un PDF, y esas
cuatro son las que se transcriben mal. Son unos mil millones de combinaciones.

La unicidad la garantiza el índice único de la base, no el generador: si dos
propuestas compartieran código, un vendedor abriría la de otro. Ante el rechazo
de la base se reintenta con un código nuevo.

**Guardar no puede romper el generador.** Si la tabla no está migrada o R2 no
está configurado, el PDF sale igual pero sin código, y la pantalla no muestra
nada de recuperación. La herramienta existe para vender; que después no se pueda
recuperar es peor que nada, pero no vender es peor todavía.

**El logo va al mismo namespace que los logos de sponsors**
(`clickaton/partners/logos/`). No es descuido: cuando la propuesta se convierta
en alta, el archivo ya está donde tiene que estar.

**Al recuperar se rearma, no se sirve un archivo cacheado.** Entre que se guardó
y que se la abre pueden haberse vendido espacios, y mandar un dossier que ofrece
un lugar ya tomado es peor que tardar veinte segundos en rehacerlo. Se rearma con
las piezas que tenía la propuesta —lo que el vendedor sacó sigue afuera— pero con
el cupo de hoy.

Un código inexistente, uno mal escrito y una propuesta vencida devuelven todos lo
mismo: quien prueba códigos al azar no debería poder distinguir «no existe» de
«venció».

### El ciclo de vida

| Cuándo | Qué pasa |
|---|---|
| Se descarga el PDF | Fila `READY`, código impreso, vence a los 30 días |
| Pasan 30 días | El dominio deja de abrirla; el cron la marca `EXPIRED` |
| Pasan 37 | El cron la borra con sus líneas y su logo |
| Se convierte en sponsor | Queda `CONVERTED` como historial; a los 30 días suelta el logo |

La semana de gracia entre vencer y borrar existe porque una propuesta recién
vencida todavía se puede querer consultar, y recuperar una fila borrada no es una
opción.

El barrido corre a las 4:45 en `/api/cron/purge-proposals`.

## Qué falta

Revisado el 2026-09-10. Las etapas 1, 2 y 3 están completas y la pantalla es
**pública en producción**: `maratonfotografica.com/propuesta`.

**Lo que falta, por orden de lo que más destraba:**

1. **El botón de reservar.** Hoy se manda el dossier y ahí se corta: no hay cómo
   tomarle el lugar a la marca que aceptó. El circuito de reserva está
   construido en `@repo/db/partners-inventory-bookings` y nadie lo llama. Con la
   propuesta ya guardada, reservar desde ella es el paso corto que queda.
2. **Etapa 4 — capa autenticada**: búsqueda de sponsors existentes con detección
   de duplicados, y alta como `PROSPECT` con assets en `PENDING`.
3. **Etapa 5 — panel de propuestas** generadas y su conversión. El repositorio ya
   expone `listProposals`; falta la pantalla.

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
