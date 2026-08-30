# Editor de plantillas en una sola pantalla

**Fecha:** 2026-08-29
**Paquete:** `@repo/template-editor-ui`
**Apps afectadas:** FotOffice, Clickatón, CLF (monorepo). **No** la copia de CLF legacy.

## Problema

El editor no entra en una pantalla: hay que scrollear para ver el lienzo completo. Tres causas,
verificadas en el código:

1. **La cabecera crece hacia abajo.** `TemplateEditorShell` apila hasta cuatro filas
   (acciones, documento, hojas, aviso de error) y todas usan `flex-wrap`: al angostarse la
   ventana, envuelven y suman alto.
2. **El cuerpo tiene un alto mínimo grande.** `min-h-[min(88vh,calc(100vh-8rem))]` es un
   mínimo, no un máximo: empuja hacia abajo en vez de adaptarse.
3. **La app host lo encajona.** En FotOffice el editor se renderiza dentro de
   `<main className="flex-1 p-6 md:p-10 w-full mx-auto max-w-6xl">` (`components/shell/shell-frame.tsx`):
   40px de padding y 1152px de ancho máximo. El editor nunca puede ocupar la ventana.

Además, el panel derecho de 320px apila Capas y Propiedades, robándole ancho al lienzo.

## Objetivo

Que el editor se vea y se opere lo más parecido posible a **Canva** (propiedades contextuales
en una barra superior) **+ Photoshop** (capas compactas a la derecha), siempre dentro del alto
de la ventana y sin scroll de página.

## Decisiones tomadas

| Decisión | Resuelto |
|---|---|
| Panel lateral de propiedades | Desaparece. Todo sube a la barra contextual; lo que no entra va en desplegables anclados. |
| Alto | El editor ocupa la ventana entera y oculta el chrome de la app host. |
| CLF legacy | Queda como está. Su copia divergió demasiado (Shell: 853 de 1613 líneas distintas). |

## Diseño

### A. Superficie de alto fijo

La raíz del editor pasa a `h-[100dvh] overflow-hidden` con tres zonas: cabecera (alto
automático pero acotado), cuerpo (`flex-1 min-h-0`) y tira de hojas (colapsable). Se elimina
el `min-h-[min(88vh,…)]`.

`100dvh` y no `100vh`: en móvil `vh` no descuenta las barras del navegador y deja el pie
cortado.

**Salida del chrome del host.** El editor obtiene ruta propia fuera del grupo `(shell)` de
FotOffice, con las mismas comprobaciones de acceso que hoy (`requireActiveWorkspace`,
`canDesignTemplates`, plantilla perteneciente al workspace activo). Alternativa descartada:
montar el editor en `fixed inset-0`, que se escapa del `<main>` sin tocar rutas pero deja la
página del host debajo, viva y scrolleable.

En Clickatón y CLF del monorepo no se cambia el montaje: el editor se adapta al alto que
tenga. El rediseño de barras les llega igual.

### B. Ajustar a pantalla

El lienzo calcula el zoom para que la hoja entre completa: al abrir, al cambiar de hoja y al
redimensionar la ventana. Se agrega el control explícito "Ajustar" junto a los de zoom
existentes (−, %, +, 1:1). El ajuste automático **no** pisa un zoom elegido a mano: una vez
que la persona toca el zoom, la ventana deja de reajustar hasta que pulse "Ajustar".

### C. Barra de propiedades (Canva)

Una sola fila de **alto fijo**, `overflow-x: auto`, **sin `flex-wrap`**. Que no pueda crecer en
alto es lo que sostiene la promesa de "una pantalla".

Contenido según la selección:

| Selección | Controles |
|---|---|
| Nada | Fondo de la hoja, tamaño del lienzo |
| Texto | Fuente, cuerpo, color, negrita/cursiva, alineación, interlineado |
| Imagen / contenedor | Reemplazar, encuadre, redondez, borde, opacidad |
| QR | Contenido, color, margen |
| Forma | Relleno, borde, redondez, opacidad |
| Varios bloques | Alinear y distribuir |

Lo que no entra en la fila se abre en un **desplegable anclado al botón** (color, borde,
opacidad), no en un panel lateral.

Los controles no se reescriben: `inspector/ColorField`, `NumberSliderField`,
`SegmentedControl` y `ToggleSwitch` ya existen y se recomponen dentro de los desplegables.
`TemplateEditorInspector` deja de montarse como panel; su lógica por tipo de bloque pasa a
alimentar la barra.

### D. Panel de capas (Photoshop)

Columna de ~210px a alto completo, colapsable a un borde de 32px con ícono. Fila por capa de
~26px: ícono de tipo, nombre, ojo (visibilidad) y candado. Sin secciones desplegables: ahí
sólo hay capas.

### E. Cabecera de dos filas

- **Documento:** volver, nombre, guardar, deshacer/rehacer, zoom, ver.
- **Propiedades:** lo de la sección C.

Las hojas pasan a una tira inferior de miniaturas, colapsable y cerrada cuando hay una sola.
El aviso de error deja de ser una fila y pasa a mensaje flotante sobre el lienzo.

### F. Separación de archivos

`TemplateEditorShell.tsx` tiene 1613 líneas. El rediseño se apoya en tres componentes nuevos
en el paquete:

- `EditorTopBar` — fila de documento.
- `EditorPropertiesBar` — fila contextual y sus desplegables.
- `EditorLayersPanel` — columna de capas.

El Shell queda como orquestador: estado, atajos, guardado.

## Etapas

Cada una se prueba antes de seguir.

1. **Alto fijo y ajuste a pantalla.** Ruta propia en FotOffice, raíz `100dvh`, se quita el
   `min-h`, zoom "ajustar".
2. **Propiedades arriba.** `EditorPropertiesBar` + desplegables; se desmonta el panel de
   propiedades.
3. **Capas compactas.** `EditorLayersPanel` a la derecha, colapsable.
4. **Hojas y limpieza.** Tira inferior, aviso flotante, cabecera a dos filas.

## Verificación

- **Sin scroll:** con la ventana en 1280×800 y en 1440×900, `document.scrollingElement.scrollHeight`
  no supera `innerHeight`, y la raíz del editor mide exactamente el alto de la ventana.
- **La cabecera no crece:** al angostar hasta 900px de ancho, la fila de propiedades mantiene
  su alto (aparece scroll horizontal, no una segunda línea).
- **Ajuste a pantalla:** al abrir, la hoja entra completa dentro del área de lienzo.
- **Sin regresión funcional:** guardar, deshacer/rehacer, selección múltiple, cambio de hoja y
  atajos siguen funcionando; `pnpm --filter @repo/template-editor-ui check-types` y `lint` en
  verde.

## Riesgos

- El paquete es compartido: el rediseño le cambia la cara al editor de Clickatón y CLF del
  monorepo, no sólo a FotOffice.
- Mover la ruta del editor en FotOffice duplica comprobaciones de acceso si se copian mal. Las
  comprobaciones se extraen a una función y se usan desde el layout nuevo.
