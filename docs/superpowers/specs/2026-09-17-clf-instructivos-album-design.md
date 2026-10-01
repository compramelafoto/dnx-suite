# Instructivos del álbum — CompraMeLaFoto

Fecha: 2026-09-17
Estado: etapas 1 y 2 implementadas y verificadas. La tarjeta se entrega con diseño
propio; su edición en el Designer queda pendiente (ver "Lo que quedó pendiente").

## Lo que quedó pendiente

**La tarjeta no es editable en el Designer todavía.** Se entrega con un diseño propio,
generado con `pdf-lib` como el resto de las piezas automáticas: ocho por hoja A4, con el
QR del álbum, el logo y la marca del fotógrafo.

Falta conectarla al editor visual. El camino está identificado y es
`editorADocumento` → `emitDesign({ formats: ["PDF"] })` → componer la hoja con
`PDFDocument.embedPdf`, pero exige resolver el contrato de variables y el
`ResourceResolver` del motor de render, que es la parte más profunda del trabajo. Se
separó a propósito para no desplegar una pantalla de edición cuyo resultado todavía no
se refleja en el PDF que el fotógrafo imprime.

**No hizo falta ninguna migración.** El plan preveía un campo nuevo
`User.instructivoCardTemplateId` para recordar la plantilla del fotógrafo — y con él,
cinco migraciones a mano sobre las bases Neon. Al no integrar el Designer en esta etapa,
ese campo no existe y el despliegue no toca el esquema.

## El problema

El fotógrafo comparte el enlace de su galería y el cliente llega sin saber qué hacer.
Cómo encontrar sus fotos cambia por completo según cómo esté armado el álbum: no es lo
mismo una galería abierta donde se mira todo, que una con selfie obligatoria, que una
carrera donde se busca por número de pechera, que una preventa donde se paga antes de
que las fotos existan. Hoy cada fotógrafo escribe ese texto a mano, por WhatsApp, cada
vez, y casi siempre incompleto.

## Qué se construye

Una subpestaña **Instructivos** en el álbum que produce tres piezas listas para
compartir, armadas automáticamente a partir de cómo está configurado ese álbum:

1. **Instructivo** — página web pública compartible, con botón de descarga en PDF dentro
   de la propia página.
2. **Cartel QR** — A4 y A5 para imprimir y colgar en el evento.
3. **Tarjeta personal** — tamaño tarjeta, varias por hoja A4, editable en el Designer.

Más, en el perfil del fotógrafo: el **QR de su página pública** (`/<handler>`), que lista
todos sus álbumes.

## Principio rector

**El instructivo no se escribe: se deduce.** El álbum ya guarda todo lo que el instructivo
tiene que decir. El fotógrafo no redacta ni edita nada.

La consecuencia de diseño es que el texto no puede ser una plantilla con huecos: la
combinación decide **qué pasos existen y en qué orden**, no sólo qué palabras se rellenan.
En preventa el orden se da vuelta (primero paga, después elige), así que un único guion
parametrizado no alcanza.

## Inventario verificado de lo que ya existe

Comprobado en el repositorio antes de escribir este documento:

| Pieza | Dónde está |
|---|---|
| Emisión de PDF/PNG/SVG sin navegador | `packages/design-studio/src/export/emit.ts` (`EmissionFormat = "PDF" \| "PNG_PER_SIDE" \| "SVG_PER_SIDE"`) |
| Puente diseño → documento emitible | `packages/template-editor-core/src/design-studio-bridge.ts` (`editorADocumento`) |
| Editor visual de plantillas, montado en CLF | `app/fotografo/diseno/plantillas/v2/[templateId]/[versionId]/page.tsx` |
| Bloque QR en el editor | `TemplateV2BlockType.QR` en `schema.prisma`, `QrBlockRenderer.tsx` |
| Generación local de QR | dependencia `qrcode` (`QRCode.toBuffer`), ya usada en las etiquetas escolares |
| Composición de PDF | dependencia `pdf-lib` |
| Identidad del fotógrafo | `User.logoUrl`, `User.name`, `User.primaryColor`, `User.handler` |
| Página pública del fotógrafo | `app/[handler]/` |
| Señales de configuración del álbum | `Album.mode`, `hiddenPhotosEnabled`, `isPublic`, `isHidden`, `preCompraCloseAt`, `enableDigitalPhotos`, `enablePrintedPhotos`, `deliveryType`, `pickupBy`, `expiresAt` |
| Señal de búsqueda por dorsal | `OcrToken` (relación de `Photo`) |
| Señal de "álbum listo" | `lib/analysis/album-analysis-readiness.ts` (`getAlbumReadiness`) |
| Subpestañas de Publicación | `AlbumPublicationPanelId` en `lib/albums/album-dashboard-nav.ts` |

**Hallazgo que corrige una deuda existente**: el QR que hoy se muestra en Publicación se
pide a un servicio externo (`api.qrserver.com`, en `lib/albums/album-share-url.ts`). Eso no
sirve para generar un PDF en el servidor (dependencia de un tercero en el camino crítico)
y además le informa a ese tercero la dirección de cada álbum. Las piezas nuevas generan el
QR localmente con `qrcode`. Migrar el QR que ya existe queda **fuera de alcance** de esta
especificación, pero se anota como deuda.

## Sección 1 — El perfil del álbum

Módulo nuevo `lib/instructivos/`. El corazón son dos funciones **puras** (sin base de
datos, sin red), que es lo que permite cubrir todas las combinaciones con tests unitarios
baratos.

### `album-instructivo-profile.ts`

```ts
export type AlbumInstructivoProfile = {
  /** Cómo entra el cliente a la galería. */
  entrada: "abierta" | "selfie_obligatoria" | "no_listada";
  /** Con qué herramientas puede encontrar sus fotos, en orden de utilidad. */
  busqueda: Array<"cara" | "dorsal" | "palabra" | "navegar">;
  /** Momento comercial. Decide el ORDEN de los pasos, no sólo el texto. */
  momento: "preventa" | "postventa" | "simple";
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
  /** Cuándo deja de estar disponible el álbum. */
  vencimiento: Date | null;
  /** Si el análisis todavía corre, el instructivo lo dice en lugar de mentir. */
  listo: boolean;
  fotografo: { nombre: string; logoUrl: string | null; color: string | null; handler: string | null };
  album: { id: number; titulo: string; slug: string; url: string };
};

export function resolveAlbumInstructivoProfile(input: AlbumInstructivoProfileInput): AlbumInstructivoProfile;
```

Reglas de derivación:

- `entrada`: `hiddenPhotosEnabled` → `"selfie_obligatoria"`; si no, `isPublic === false ||
  isHidden` → `"no_listada"`; si no, `"abierta"`.
- `busqueda`: `"cara"` si hay fotos con análisis facial terminado; `"dorsal"` si el álbum
  tiene al menos un `OcrToken` numérico; `"palabra"` si tiene `OcrToken` de texto;
  `"navegar"` siempre como último recurso. Con `entrada === "selfie_obligatoria"`, `"cara"`
  es el único método y el resto no se ofrece: el cliente nunca ve fotos ajenas.
- `momento`: `"preventa"` si `preCompraCloseAt` está en el futuro o hay packs de preventa
  activos; `"postventa"` si el álbum tiene fotos cargadas; si no, `"simple"`.
- `listo`: `getAlbumReadiness(albumId).ready`.

### `album-instructivo-steps.ts`

```ts
export type InstructivoStep = {
  titulo: string;
  detalle: string[];
  /** Advertencia o aclaración destacada (plazos, límites, requisitos). */
  nota?: string;
};

export function buildInstructivoSteps(profile: AlbumInstructivoProfile): InstructivoStep[];
```

Secuencias por `momento`:

- **`simple` / `postventa`**: entrar → encontrar mis fotos → elegir → pagar → recibir.
- **`preventa`**: entender qué se vende → reservar y pagar antes del cierre → esperar la
  sesión → elegir mis fotos cuando se publiquen → recibir.

Dentro de cada paso, el contenido lo deciden los otros ejes del perfil: el paso "encontrar
mis fotos" explica la selfie, el dorsal o la palabra clave según `busqueda`; el paso
"recibir" explica descarga, retiro o envío según `entrega`. El plazo de `vencimiento`
aparece siempre como nota del último paso.

Si `listo === false`, se antepone un aviso: las fotos todavía se están procesando.

### `load-album-instructivo.ts`

Única pieza que toca Prisma: lee el álbum, el fotógrafo, el estado del análisis y las
señales de OCR, y arma el `AlbumInstructivoProfileInput`. Se mantiene separada de las
funciones puras a propósito.

## Sección 2 — Las tres piezas y sus dos motores

| Pieza | Editable | Motor | Por qué |
|---|---|---|---|
| Instructivo | no | `pdf-lib` | Largo variable (4 pasos en un álbum simple, 9 en una preventa escolar con selfie). El texto tiene que fluir y repaginarse solo. |
| Cartel QR | no | `pdf-lib` | Tamaño fijo y contenido mínimo; no justifica arrastrar el Designer. |
| Tarjeta personal | **sí** | Designer (`TemplateV2` + `editorADocumento` + `emitDesign`) | El fotógrafo la quiere con su estética. Lo editable va al Designer. |

Regla: **lo automático se compone con `pdf-lib`; lo editable vive en el Designer.**

Maquetar el instructivo con bloques de posición fija se rompería en las combinaciones
largas, y como el texto no es editable no se gana nada a cambio.

## Sección 3 — La página del instructivo

Ruta: `app/a/[id]/instructivo/page.tsx` → `compramelafoto.com/a/<slug>/instructivo`

> El segmento se llama `[id]` aunque reciba el `publicSlug`: así se llama ya en `app/a/` y
> en `app/api/a/`. Next no admite dos nombres distintos para el mismo nivel dinámico, así
> que estrenar `[slug]` haría fallar el build.

- **Pública**, sin login: el cliente tiene que poder abrirla desde WhatsApp.
- **Se arma en el momento**: refleja siempre la configuración actual del álbum. Un enlace
  compartido hace un mes no puede mentir sobre el precio o la selfie.
- Encabezado con logo, nombre y color del fotógrafo; QR del álbum al costado.
- Pasos numerados, legibles en celular.
- Botón **"Descargar PDF"** dentro de la página, visible para el fotógrafo y para el
  cliente.
- Si el álbum no existe, está borrado (`deletedAt`) o es de prueba, devuelve 404 con el
  mismo criterio que la vista pública del álbum.

## Sección 4 — Los PDF

| Ruta | Produce |
|---|---|
| `app/api/a/[id]/instructivo/pdf/route.ts` | Instructivo en PDF (pública, mismo criterio de acceso que la página) |
| `app/api/dashboard/albums/[id]/instructivo/cartel/route.ts` | Cartel QR, `?size=a4\|a5` (requiere ser dueño del álbum) |
| `app/api/dashboard/albums/[id]/instructivo/tarjetas/route.ts` | Hoja A4 de tarjetas (requiere ser dueño del álbum) |
| `app/api/fotografo/perfil/qr/route.ts` | QR de la página del fotógrafo, `?formato=png\|cartel` |

Todos generan el QR con `qrcode` localmente. Ninguno depende de un servicio externo.

## Sección 5 — La tarjeta editable y el QR del perfil

### Tarjeta

La primera vez que el fotógrafo entra a la pestaña, el sistema crea una **`TemplateV2`
semilla** con el diseño por defecto: logo, QR del álbum, nombre del fotógrafo, título del
álbum y dirección web. El botón **"Personalizar"** abre el editor que ya existe
(`/fotografo/diseno/plantillas/v2/...`). Lo que edite queda guardado y se usa de ahí en
adelante para todos sus álbumes.

Variables de la plantilla: `{qr_album}`, `{logo}`, `{nombre_fotografo}`, `{titulo_album}`,
`{web}`.

**Cambio de base de datos**: un campo nuevo `User.instructivoCardTemplateId String?` para
recordar qué plantilla usa. Es el único cambio de esquema de todo el trabajo.

> **Advertencia operativa**: `schema.prisma` es compartido por cinco bases Neon. Un campo
> nuevo hay que aplicarlo a mano en las cinco o rompe las escrituras de las otras
> plataformas. Además, el despliegue no corre `prisma migrate deploy`: la migración se
> aplica a mano y se registra con `migrate resolve`.

### QR del perfil

Bloque nuevo en `/fotografo/configuracion` con el QR de `compramelafoto.com/<handler>`,
descargable en PNG y en cartel A4. Es independiente del álbum: por eso vive en el perfil y
no en la pestaña del álbum. Si el fotógrafo no tiene `handler` o tiene la página pública
apagada (`isPublicPageEnabled === false`), el bloque explica qué le falta en vez de
ofrecer un QR roto.

## Sección 6 — Dónde vive en la interfaz

Nueva subpestaña **Instructivos** dentro del área **Publicación** del álbum, junto a
*Compartir*, *Visibilidad*, *Protección* y *Portada*.

- `AlbumPublicationPanelId` suma `"instructivos"` en `lib/albums/album-dashboard-nav.ts`.
- Componente nuevo `components/dashboard/albums/AlbumInstructivosPanel.tsx`.
- Es el vecindario correcto: ahí ya viven el enlace público y el QR.

## Sección 7 — Etapas de entrega

1. **Etapa 1** — perfil, pasos, página web del instructivo, PDF del instructivo, subpestaña.
   Entrega valor sola: ya se puede compartir el instructivo.
2. **Etapa 2** — cartel QR A4/A5 y QR del perfil del fotógrafo.
3. **Etapa 3** — tarjeta personal editable en el Designer (única etapa con migración).

## Fuera de alcance (a propósito)

- Edición de los textos del instructivo.
- Otros idiomas.
- Envío automático del instructivo por correo al cliente.
- Métricas de cuántos abrieron el instructivo.
- Migrar el QR existente de Publicación fuera de `api.qrserver.com` (deuda anotada).
- Instructivos para el organizador, la escuela o el sponsor: esta especificación cubre
  sólo al cliente final.

Nada de esto exige rehacer lo construido; todo se puede sumar después.

## Riesgos

| Riesgo | Mitigación |
|---|---|
| Un instructivo que describe una galería que todavía se está procesando | El eje `listo` antepone el aviso; se reutiliza la regla de "álbum listo" que ya usan los correos |
| El campo nuevo rompe las otras cuatro plataformas | La migración se aplica a mano en las cinco bases y se registra con `migrate resolve`; queda aislada en la etapa 3 |
| El texto queda desactualizado respecto del álbum | La página se arma en el momento; no se guarda ningún instructivo generado |
| Combinaciones no previstas producen pasos contradictorios | `buildInstructivoSteps` es pura y se cubre con tests de tabla sobre las combinaciones reales |

## Criterios de aceptación

1. `resolveAlbumInstructivoProfile` y `buildInstructivoSteps` tienen tests unitarios que
   cubren, como mínimo: álbum simple abierto; álbum con selfie obligatoria; carrera con
   dorsales; preventa escolar; álbum sin fotos; álbum con análisis en curso.
2. En preventa, los pasos aparecen en el orden invertido (pagar antes de elegir) y el texto
   nombra la fecha de cierre.
3. Con selfie obligatoria, el instructivo no ofrece ningún método de búsqueda distinto del
   reconocimiento facial.
4. La página `/a/<slug>/instructivo` abre sin sesión iniciada y se lee en un celular.
5. El botón de descarga produce un PDF con el logo y el color del fotógrafo y el QR del
   álbum, sin pedirle nada a ningún servicio externo.
6. El cartel A4 y la hoja de tarjetas se descargan desde la subpestaña y sólo los puede
   pedir el dueño del álbum.
7. El QR del perfil apunta a `compramelafoto.com/<handler>` y el bloque explica qué falta
   cuando el fotógrafo no tiene página pública activa.
