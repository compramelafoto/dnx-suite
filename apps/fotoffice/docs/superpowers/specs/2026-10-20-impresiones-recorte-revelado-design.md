# Impresiones: recorte, encaje, revelado e impresión directa (Kodak, Epson y laboratorio)

- **Fecha:** 20/10/2026
- **Estado:** **aprobado por Daniel el 20/10/2026.** Plan de la etapa 1 en `docs/superpowers/plans/2026-10-20-impresiones-etapa-1.md`.
- **Dónde vive:** FOTOFFICE → Ventas (Mostrador y Foto carnet), Trabajos (carpeta del trabajo) y Configuración → Impresión.
- **Primer usuario:** DNX Estudio.
- **Código de partida:** `origin/main` en `b2bd5ecf7`.

---

## 1. Para qué

Las fotos que trae un cliente rara vez tienen la proporción del papel. Una foto de celular en 16:9 no entra en un 10x15, que es 2:3: o se corta demasiado, o hay que encajarla con bordes blancos. Hoy esa decisión la toma el laboratorio o la impresora por su cuenta, y el resultado sorprende al cliente.

**El objetivo:** que el encargado del mostrador decida el recorte o el encaje y haga un revelado básico de cada foto **antes** de que se imprima. Después, que el sistema genere los **archivos finales** a la medida exacta y sin perder calidad, y que esos archivos se impriman directamente en el local o viajen al laboratorio.

**Cómo se mide el éxito:**
- Lo que se ve en pantalla es lo que sale impreso: mismo encuadre, mismos colores y sin pérdida de nitidez.
- Un carnet o una copia instantánea se prepara, se imprime y se cobra sin salir del Mostrador.
- El laboratorio recibe archivos listos, sin tener que recortar ni decidir nada.
- Cada hoja impresa queda registrada con impresora, papel y venta. Es la base del proyecto de consumibles (§13).

## 2. Lo que dijo Daniel (y cómo queda)

| Tema | Lo que dijo | Cómo queda |
|---|---|---|
| Quién recorta | El encargado que recibe el pedido. | Lo hace el personal, no el cliente. |
| Impresoras del local | **Kodak 305** (sublimación): 10x15, 13x18, 15x20 y carnet. **Epson L800** (chorro de tinta): carnet económico (clubes, escuelas) e impresiones color hasta A4. **Las ampliaciones fotográficas nunca salen por la Epson.** | Cada producto y cada tamaño saben por qué salida salen (§4). |
| Cómo imprimir | Directo desde el navegador, después de recortar. | Página de impresión al tamaño exacto en mm (§8). Sin programa instalado. |
| Medidas reales | 10x15 = 10,2 × 15 · 13x18 = 12,7 × 18 · 15x21 = 15,2 × 21 · 20x30 = 20,3 × 30 · 25x38 = 25,4 × 38 cm. | Tabla de tamaños (§4.1). |
| Umbral recortar/encajar | Aprobado (8 %), pero tiene que poder **moverse la imagen con el mouse** y reencajarse a mano. | Editor con arrastre y zoom (§6). |
| Editor | Básico: color, contraste y "todo lo que implica revelar", con rangos acotados porque casi siempre son JPG. | §7. |
| Carnet y polaroid | Reaprovechar (copiar) los diseñadores de CompraMeLaFoto, mejorándolos. No se usaban porque bajaban la calidad. | Se copia la interfaz; el archivo final lo arma el servidor (§5, §10, §11). |
| Momento | Durante la atención en el mostrador: cargar el producto y prepararlo **antes o después de cobrar**. Sobre todo lo que se produce en DNX (carnet e instantáneas). | "Preparar" en el carrito del Mostrador (§9). |
| Carnet Kodak y carnet Epson | Tienen que ser productos separados, para contabilizar el gasto: la Kodak consume una hoja 10x15 (ribbon y papel) y la Epson consume una hoja suya. | Producto con salida fija (§4.3) y registro de hojas impresas (§9.4). |
| Archivos de laboratorio y digitalizaciones | Todo lo que se sube a la carpeta de un trabajo (pedidos a laboratorios, rollos, videos) se borra de R2 a los **30 días**. | Hoy un archivo que nunca se compartió no vence nunca: se corrige (§12.1). |
| Foto carnet original | El **original queda guardado para siempre en la ficha del cliente**, para consultarlo si vuelve. | §10.1. |
| Consumibles | Es **otro proyecto**: calcular lo que consume cada producto para tener stock y proyectar compras. Un producto puede consumir **varios insumos**, por ejemplo la foto carnet gasta el papel y el sobrecito de 5×5 cm. | Fuera de alcance. Este diseño deja el dato listo (§13). |

**Confirmado por Daniel (20/10):** el **15x20 es de la Kodak** y el **15x21 es de laboratorio**. La Kodak 305 trabaja con **bobina** (rollo de papel y ribbon): 10x15, 13x18 y 15x20 salen del mismo rollo, cada uno con un largo distinto.

## 3. Lo que ya existe y lo que se reaprovecha

| Pieza | Dónde | Uso en este diseño |
|---|---|---|
| Mostrador (carrito en memoria, `Sale` / `SaleItem` al cobrar) | `app/(shell)/ventas/pos.tsx`, `mostrador-actions.ts` | Se le agrega "Preparar" en las líneas de producción propia. |
| Trabajos (`FotofficeProyecto`) con proveedor, carpeta (`FotofficeArchivoTrabajo`, R2 privado, subida directa) y "Enviar al proveedor" con enlace privado | `lib/carpetas/`, `lib/proyectos/proveedor.ts`, `components/proyectos/carpeta-proyecto.tsx` | El laboratorio recibe los archivos finales por ese mismo enlace (§12). |
| Foto carnet en Ventas (subido el 19/10, commit `693b45628`) | `app/(shell)/ventas/foto-carnet`, `components/foto-carnet/`, `lib/foto-carnet/medidas.ts` | Se conserva la interfaz y las medidas, y se cambia el motor (§10). |
| Diseñador de polaroid de CompraMeLaFoto | `apps/compramelafoto/components/polaroid/` | Se copia la interfaz (§11). |
| `sharp` | ya está en `apps/fotoffice/package.json` | Motor de archivos finales (§5). No hay dependencias nuevas en el servidor. |

### 3.1 Por qué el diseñador de carnet bajaba la calidad

Se revisó `components/carnet/export.ts` de CompraMeLaFoto, y la copia del 19/10 en `components/foto-carnet/procesar.ts` repite lo mismo:

1. **Desenfoca la foto entera.** Con "blanquear fondo" activo, `applyBoxBlur` se aplica a toda la imagen y no sólo al fondo.
2. **Achica en un solo paso con el suavizado por omisión del navegador.** Pasa de unos 4000 px a unos 400 px en un solo `drawImage`, sin `imageSmoothingQuality = "high"`. Deja bordes serruchados.
3. **Pierde el perfil de color.** El `canvas` del navegador descarta el perfil Display P3 de los celulares, y los colores salen apagados. Además los ajustes se hacen en 8 bits y aparecen escalones en los degradés.

**Decisión:** el navegador sólo hace la **vista previa**. El archivo que se imprime lo genera siempre el servidor con `sharp`, a partir del original.

## 4. Tamaños, salidas y productos

### 4.1 Tamaños de impresión (por espacio de trabajo, editables)

| Nombre | Medida real | Sale por (por omisión) |
|---|---|---|
| 10x15 | 102 × 152 mm | Kodak · laboratorio |
| 13x18 | 127 × 180 mm | Kodak · laboratorio |
| 15x20 | 152 × 203 mm | Kodak |
| 15x21 | 152 × 210 mm | Laboratorio |
| 20x30 | 203 × 300 mm | Laboratorio |
| 25x38 | 254 × 380 mm | Laboratorio |
| A4 | 210 × 297 mm | Epson |

Se cargan con estos valores al encender el módulo y se pueden editar o agregar.

### 4.2 Salidas

Una **salida** es por dónde sale una hoja: una impresora del local o un laboratorio.

- **Kodak 305:** tipo LOCAL, 300 ppp, nitidez *Suave*. Hojas: 10x15, 13x18, 15x20.
- **Epson L800:** tipo LOCAL, 300 ppp, nitidez *Fuerte*. Hojas: 10x15, A4. **No admite copias fotográficas**: sólo carnet, planchas e impresiones color.
- **Cada laboratorio** (`FotofficeProveedor`): tipo LABORATORIO, 300 ppp por omisión, nitidez *Normal*. Hojas: las que se le marquen.

Además, cada salida local guarda dos valores:
- **Corrección de escala X/Y**, en por mil (1000 = sin corrección). Si la hoja de prueba (§8.2) muestra que la regla de 100 mm mide 99 mm, se corrige acá.
- **Margen sin bordes**: el excedente que la impresora corta, en mm. *Se usa recién en la etapa 2 (copias a sangre); en la etapa 1 la plancha de carnet ya tiene 3 mm de margen.*

### 4.3 Productos de producción propia

En el catálogo, un producto puede marcarse como **"Se produce en el local"**. En ese caso indica:

- **Tipo de pieza:** `COPIA`, `CARNET` o `POLAROID`.
- **Salida:** Kodak o Epson.
- **Hoja que usa:** por ejemplo 10x15.
- **Unidad de venta:** por hoja/plancha o por copia.

Ejemplos:

| Producto | Pieza | Salida | Hoja | Se vende por |
|---|---|---|---|---|
| Foto carnet | CARNET | Kodak 305 | 10x15 | plancha |
| Foto carnet económica | CARNET | Epson L800 | 10x15 | plancha |
| Plancha escolar A4 | CARNET | Epson L800 | A4 | hoja |
| Copia 10x15 | COPIA | Kodak 305 | 10x15 | copia |
| Polaroid 7,5×10 | POLAROID | Kodak 305 | 10x15 | pieza |

Así, "Foto carnet" y "Foto carnet económica" son productos distintos aunque el editor sea el mismo, y cada uno registra el gasto en su impresora.

## 5. El motor de calidad

Un único módulo, `lib/impresion/motor/`, con partes puras y probadas.

### 5.1 La receta

Cada pieza guarda una **receta**: datos chicos y en JSON, nunca píxeles.

```ts
type Receta = {
  version: 1;
  modo: "RECORTAR" | "ENCAJAR";
  orientacion: "VERTICAL" | "HORIZONTAL";
  rotacion90: 0 | 90 | 180 | 270;
  enderezar: number;               // −10 a +10 grados
  // Encuadre en proporciones del original ya rotado (0..1), independiente de la pantalla.
  encuadre: { x: number; y: number; ancho: number; alto: number };
  // Sólo en ENCAJAR: dónde cae la foto dentro del papel (0..1) y el color del borde.
  ubicacion?: { x: number; y: number; ancho: number; alto: number };
  colorBorde?: string;             // "#ffffff" por omisión
  ajustes: Ajustes;                // §7
  nitidez: "SUAVE" | "NORMAL" | "FUERTE" | null; // null = la de la salida
};
```

La **huella** de la receta es un SHA-256 del JSON canónico, más la clave del original, la salida y la hoja. Si la huella cambia, el archivo final queda vencido y se vuelve a generar.

### 5.2 Generación del archivo final (servidor)

Se hace en este orden fijo, siempre a partir del original en R2:

1. Leer con `sharp` y girar según la orientación EXIF.
2. Convertir a **sRGB usando el perfil de color embebido** (Display P3, Adobe RGB). Si la foto no trae perfil, se asume sRGB.
3. Aplicar `rotacion90` y `enderezar`, y después **recortar** el encuadre en píxeles reales del original.
4. **Achicar o agrandar** con Lanczos3 a los píxeles exactos de destino. Por ejemplo, 10x15 a 300 ppp da 1205 × 1795 px, calculado desde los mm y no redondeando el nombre.
5. Pasar a **16 bits por canal** y aplicar los **ajustes** (§7) con la misma función que usa la vista previa.
6. Aplicar la **nitidez de salida** según la salida o la receta.
7. En ENCAJAR: componer sobre el papel del color del borde, en la `ubicacion` elegida.
8. Guardar JPG con calidad 95, **sin submuestreo de color (4:4:4)**, perfil sRGB embebido y densidad grabada (300 ppp).

**Planchas y polaroid:** primero se genera cada pieza y después se componen sobre la hoja. Las líneas de corte de las planchas son de 1 px gris claro y se pueden desactivar. En polaroid, la capa de texto llega como PNG transparente (§11).

**Peso:** como el recorte y el achique se hacen antes de pasar a 16 bits, el trabajo en memoria es del tamaño de salida. Un 25x38 a 300 ppp ocupa unos 81 MB, un 10x15 unos 13 MB. Corre en una función normal del servidor.

### 5.3 Vista previa (navegador)

- Al subir un original, el servidor genera además una **copia liviana** (lado mayor de 1600 px, ya en sRGB) para la pantalla.
- El encuadre y la ubicación se dibujan con CSS sobre esa copia.
- Los ajustes se aplican con la misma función del §5.2, paso 5, en un Web Worker, sobre la copia liviana.
- **Prueba de coincidencia:** con fotos de muestra, se compara la vista previa con el archivo final en 20 zonas. La diferencia de color promedio tiene que ser menor a 2 (ΔE). Si no, la prueba falla.

### 5.4 Aviso de calidad

**Resolución efectiva** = píxeles del original dentro del encuadre ÷ pulgadas del papel.

| Resolución efectiva | Aviso |
|---|---|
| 200 ppp o más | Sin aviso |
| 150 a 199 ppp | Amarillo: *"Puede verse algo blanda en 20x30"* |
| Menos de 150 ppp | Rojo: *"Se va a ver pixelada en 20x30"*. Se puede imprimir igual, pero hay que confirmarlo. |

### 5.5 Propuesta automática

Al asignar un tamaño, se calcula cuánto se perdería si se recorta:

- Si se pierde **8 % o menos** del área, se propone **RECORTAR**, centrado.
- Si se pierde más, se propone **ENCAJAR**, centrado y con borde blanco.

La orientación del papel sigue a la de la foto. "Volver a la propuesta" restablece todo esto.

## 6. Pantalla de recorte y encaje

**Vista de grilla** (todas las fotos de una preparación):

- Cada foto se dibuja **sobre la silueta del papel real**. En RECORTAR, lo que se corta se ve sombreado; en ENCAJAR, se ve el borde.
- Acciones para todas o para las elegidas: tamaño, RECORTAR o ENCAJAR, cantidad de copias, pegar ajustes.
- Cada tarjeta muestra: tamaño · salida · cantidad · aviso de calidad · punto si tiene ajustes · **"Revisada"**.

**Editor de una foto:**

- **Arrastrar con el mouse** mueve la imagen dentro del papel.
- **Rueda o deslizador** para el zoom. En RECORTAR, el mínimo es "llena el papel". En ENCAJAR, la foto se puede achicar y ubicar a mano.
- Girar 90°, enderezar ±10° y cambiar entre papel vertical y horizontal.
- "Volver a la propuesta".
- Guías: tercios y zona de seguridad de 3 mm.
- Teclado:
  - ← → para la foto anterior y la siguiente.
  - `R` recortar, `E` encajar.
  - Espacio para ver el antes y después.
  - Enter confirma y marca la foto como "Revisada".

Todo se guarda como proporciones (§5.1). El tamaño de la pantalla nunca influye en el resultado.

## 7. Editor de revelado

| Grupo | Control | Rango en pantalla | Efecto real máximo |
|---|---|---|---|
| Luz | Exposición | −50 a +50 | ±1 paso (EV) |
| | Contraste | −50 a +50 | curva S suave, ±25 % |
| | Luces / Sombras | −50 a +50 | recupera o levanta ±30 % en su zona |
| | Blancos / Negros | −50 a +50 | mueve el punto blanco o negro ±8 % |
| Color | Temperatura | −50 a +50 | ±1500 K aprox. |
| | Tinte | −50 a +50 | verde ↔ magenta, moderado |
| | Saturación | −50 a +50 | ±35 % |
| | Intensidad | −50 a +50 | satura más lo apagado y protege pieles |
| Detalle | Nitidez | Suave / Normal / Fuerte | de salida, según la impresora |
| Rápidos | **Auto** | — | nivela luces y negros (percentiles 0,5 y 99,5) y corrige un tono dominante leve |
| | **Blanco y negro**, **Sepia** | — | — |
| | **Restablecer** | — | — |

- **Copiar y pegar ajustes** a las fotos elegidas o a toda la preparación.
- Las fórmulas viven en `lib/impresion/motor/ajustes.ts`. Son funciones puras sobre valores de 0 a 1 en coma flotante, y las usan tanto el navegador como el servidor.
- Los límites del "efecto real máximo" están en una tabla dentro de ese archivo y se prueban: con +50 no se pasa del tope.

## 8. Imprimir desde el navegador

### 8.1 Página de impresión

`/imprimir/hoja/[hojaId]` (fuera del panel, como `/imprimir/acta/[id]`) muestra únicamente el JPG final de la hoja:

```css
@page { size: <ancho>mm <alto>mm; margin: 0; }
img   { width: <ancho>mm; height: <alto>mm; display: block; }
```

- Las medidas incluyen la corrección de escala y el margen sin bordes de la salida (§4.2).
- La página abre el cuadro de impresión sola.
- Tiene un botón **"Descargar JPG"** como alternativa, para imprimir desde el programa de fotos de la compu.
- Varias hojas iguales se imprimen indicando las **copias en el cuadro de impresión**. Varias hojas distintas van en páginas consecutivas del mismo documento.

### 8.2 Configuración de una vez por impresora

En Configuración → Impresión → [salida]:
- Un instructivo con lo que hay que dejar fijo en el cuadro de impresión: papel, "sin bordes", escala 100 % y calidad máxima.
- Una **hoja de prueba**, con una regla de 100 mm en ambos sentidos, una cuadrícula y un degradé gris y de color.
- Se mide la regla impresa y se cargan los dos números en la corrección de escala.

**Límite asumido:** el navegador siempre muestra el cuadro de impresión y no permite elegir la impresora desde la página. Daniel eligió esto en lugar de instalar un programa en la compu. Si más adelante molesta, se puede sumar un pequeño agente local sin cambiar nada de este diseño.

## 9. Dentro del Mostrador

### 9.1 La preparación

Como el carrito del Mostrador vive sólo en la pantalla, el trabajo de impresión se guarda aparte, en una **preparación** (`FotofficePreparacionImpresion`):

- Nace al tocar **"Preparar"** en una línea del carrito.
- Queda atada al cliente del ticket, si hay uno.
- Si se recarga la página antes de cobrar, la preparación no se pierde. Aparece en **"Preparado sin cobrar"** y se puede volver a meter en un ticket.

### 9.2 Flujo

1. Se agrega al ticket un producto de producción propia (§4.3). La línea muestra **"Preparar"**.
2. "Preparar" abre el editor en pantalla completa: carnet, copias o polaroid según el tipo de pieza. Se suben las fotos que trae el cliente, desde el pendrive, el celular o WhatsApp en la compu.
3. Al volver, la **cantidad de la línea se actualiza** sola según lo armado, por ejemplo 2 planchas o 12 copias, y queda un ícono para reabrir.
4. **Imprimir** y **cobrar** se hacen en el orden que se quiera:
   - **Preparar → imprimir → cobrar.** El caso del carnet con el cliente esperando.
   - **Cobrar → preparar → imprimir.**
   - **Cobrar y dejarlo para después.** Queda en la cola "Para imprimir".
5. Al cobrar, la preparación se vincula con el renglón vendido (`saleItemId`). No se toca la tabla de ventas.

### 9.3 Colas del Mostrador

Una pestaña nueva en Ventas, **"Impresiones"**, con tres listas:

- **Para imprimir:** cobrado y no impreso.
- **Preparado sin cobrar:** preparado o impreso, sin venta.
- **Impreso hoy:** con reimpresión.

### 9.4 Registro de hojas impresas

Cuando se cierra el cuadro de impresión, la página pregunta **"¿Cómo salió?"** y cada respuesta guarda un **registro**:

- Salida, hoja (tamaño) y cantidad de hojas.
- Producto, preparación, renglón de venta o trabajo.
- Quién y cuándo.
- Motivo: `NORMAL` (salió bien y se entrega), `DESCARTADA` (salió mal y se tira) o `PRUEBA` (hoja de prueba).

Si sale mal, se toca **"Salió mal, reimprimir"**: esas hojas quedan como `DESCARTADA`, porque el desperdicio también cuenta en el gasto, y se vuelve a abrir el cuadro de impresión.

**Para qué sirve:** es el dato con el que el proyecto de consumibles (§13) va a descontar el stock y calcular el costo real.

## 10. Foto carnet (migración de lo subido el 19/10)

- Se conservan la pantalla de `Ventas → Foto carnet`, las 9 medidas de `lib/foto-carnet/medidas.ts`, las medidas personalizadas y la plancha automática.
- **Se reemplaza el motor:** `procesar.ts` deja de generar el archivo y la plancha la genera el servidor (§5.2). Se elimina el desenfoque global.
- La pantalla suelta sigue disponible para un uso rápido sin venta. Desde el Mostrador se abre la misma pantalla, atada a la preparación.
- La salida (Kodak o Epson) sale del producto. En la pantalla suelta se elige.
- **Guías de rostro:** líneas de mentón y coronilla, con la proporción de cabeza de cada medida (por ejemplo, para el DNI 4×4 la cabeza ocupa entre el 70 y el 80 % del alto).
- **"Blanquear fondo" queda fuera de la primera entrega.** Se rehace después, con detección del fondo.

### 10.1 El original queda en la ficha del cliente (pedido de Daniel, 20/10)

- Cuando una preparación de carnet tiene cliente, **una copia del original** se guarda como adjunto de su ficha (`FotofficeAttachment`, con `origen = "FOTO_CARNET"`). No vence: sólo se borra si alguien lo borra a mano desde la ficha.
- Si el cliente se elige recién al cobrar, la copia se guarda en ese momento.
- En el editor, al elegir un cliente que ya tiene fotos carnet, aparece **"Fotos anteriores"**: tocar una la usa como original de la nueva preparación, sin volver a subirla.
- La preparación, la plancha y su copia del original sí se borran a los 30 días (§14).

## 11. Polaroid

- Se copia la interfaz de `apps/compramelafoto/components/polaroid/`: los 3 formatos (7,5×10 en hoja 10x15, 9×13 en 13x18, 10x15 completa), marco blanco con franja inferior, textos con tipografías, texturas y configuración en masa.
- **Texto sin pérdida:** el navegador dibuja sólo la capa de texto y textura, a la resolución final de la hoja, en un PNG transparente. El servidor la superpone sobre la foto ya procesada. Así la tipografía sale idéntica a la pantalla y la foto no pasa por el `canvas`.

## 12. Laboratorio (trabajos)

- En la carpeta de un trabajo (`components/proyectos/carpeta-proyecto.tsx`), las fotos subidas se pueden **"Preparar para imprimir"** con el mismo editor. La preparación queda atada al trabajo.
- La salida es el proveedor del trabajo. Los tamaños que se ofrecen son los que ese laboratorio admite.
- El **enlace del laboratorio** (`/archivos/[token]`) entrega:
  - Los **archivos finales** en carpetas por tamaño, con nombres como `10x15/0001_x2.jpg`, donde `x2` son las copias.
  - Un **resumen** de cantidades por tamaño.
  - Los originales sólo si se marca *"Incluir originales"*.
- Si una foto de la carpeta no se preparó, se avisa antes de enviar: *"Hay 3 fotos sin preparar: van como están"*.

### 12.1 Los archivos de los trabajos vencen a los 30 días (pedido de Daniel, 20/10)

Hoy la carpeta de un trabajo vence 30 días después de **compartirla** (`nuevoVencimiento`). Si nunca se comparte, `carpetaVence` queda vacío y **los archivos no se borran nunca**. Desde ahora, al confirmar el primer archivo de un trabajo sin vencimiento, `carpetaVence` pasa a ser hoy + 30 días. Compartir lo sigue llevando a 30 días desde ese momento, y nunca lo acorta. Vale para todo: pedidos a laboratorios, digitalizaciones de rollos, videos, etc. La migración les pone vencimiento (hoy + 30) a los trabajos que ya tienen archivos y no tienen fecha. Así nada se borra de golpe, y queda un mes de aviso.

## 13. Consumibles: otro proyecto (sólo lo que deja listo este)

Daniel quiere saber qué consume cada producto, para tener stock y proyectar compras. **No se construye acá.** Este diseño deja:

- Productos con **salida y hoja fijas** (§4.3).
- El **registro de cada hoja impresa** con salida, tamaño, cantidad, producto, venta y motivo, reimpresiones incluidas (§9.4).

**Un producto consume varios insumos, y no todos son de impresión** (lo pidió Daniel el 20/10). Por ejemplo, una foto carnet en la Kodak gasta la hoja 10x15 (ribbon y papel) **y además el sobrecito de 5×5 cm** para entregarla. Por eso el proyecto de consumibles va a contar desde **dos fuentes**:

| Fuente | Qué cuenta | Ejemplo | Dato que ya existe |
|---|---|---|---|
| **Por hoja impresa** | Lo que gasta la impresora, reimpresiones y pruebas incluidas | 1 hoja 10x15 en la Kodak = ribbon y papel de un 10x15 | Registro de impresión (§9.4) |
| **Por unidad vendida** | Lo que acompaña al producto, se imprima o no | 1 Foto carnet = 1 sobrecito de 5×5 cm | Renglón de venta (`SaleItem`: producto y cantidad) |

Ese proyecto va a sumar:
- Un catálogo de **insumos**: ribbon/papel Kodak 10x15, hoja Epson A4, sobrecito 5×5, etc., con su costo y su stock.
- La **lista de insumos de cada producto**, con la cantidad por unidad y si se cuenta por hoja impresa o por unidad vendida.

Con eso calcula lo gastado, el stock que queda, el costo real de cada venta y cuándo comprar. **Este diseño no necesita nada más para eso.**

**Kodak 305 con bobina (dicho por Daniel el 20/10):** 10x15, 13x18 y 15x20 salen del mismo rollo de papel y ribbon, y cada tamaño gasta un largo distinto. Por eso el consumo de la Kodak conviene medirlo **en largo de rollo según el tamaño**, no en "hojas". El registro de impresión ya guarda el tamaño de cada hoja, que es lo que hace falta para eso. **A verificar en ese proyecto:** el largo exacto que consume cada tamaño, incluido el desperdicio entre copias.

## 14. Datos nuevos

Todas las tablas tienen `workspaceId` y se borran en cascada con el espacio de trabajo. La migración se escribe a mano y se aplica antes que el código, como siempre en FOTOFFICE.

| Tabla | Para qué | Campos principales |
|---|---|---|
| `FotofficeTamanoImpresion` | §4.1 | `nombre`, `anchoMm`, `altoMm` (Decimal 6,1), `orden`, `activo` |
| `FotofficeSalidaImpresion` | §4.2 | `nombre`, `tipo` (LOCAL / LABORATORIO), `proveedorId?`, `ppp`, `nitidez`, `escalaXMil`, `escalaYMil`, `margenSinBordesMm`, `admiteCopias`, `activo`, y la lista de tamaños admitidos (tabla puente `FotofficeSalidaTamano`) |
| `FotofficeProductoProduccion` | §4.3, uno por producto | `productId` @unique, `tipoPieza`, `salidaId`, `tamanoHojaId`, `unidad` (HOJA / COPIA / PIEZA) |
| `FotofficePreparacionImpresion` | §9.1 | `productId?`, `clientId?`, `saleItemId?` @unique, `proyectoId?`, `estado` (PREPARANDO / LISTA / IMPRESA / ANULADA), `createdByUserId` |
| `FotofficeOriginalImpresion` | el archivo que trajo el cliente | `preparacionId`, `key` (R2 privado), `previewKey`, `nombre`, `anchoPx`, `altoPx`, `bytes`, `perfilColor`, `archivoTrabajoId?` (si viene de la carpeta de un trabajo, apunta a ese archivo y no lo copia) |
| `FotofficePiezaImpresion` | una foto en un tamaño | `preparacionId`, `originalId`, `tipo`, `tamanoId?` o `medidaMm` (carnet), `receta` Json, `huella`, `cantidad`, `revisadaAt?` |
| `FotofficeHojaImpresion` | lo que se imprime | `preparacionId`, `salidaId`, `tamanoId`, `disposicion` Json (dónde va cada pieza), `capaTextoKey?`, `finalKey?`, `finalHuella?`, `finalAnchoPx`, `finalAltoPx`, `copias` |
| `FotofficeRegistroImpresion` | §9.4 | `hojaId`, `salidaId`, `tamanoId`, `hojas`, `productId?`, `saleItemId?`, `proyectoId?`, `motivo` (NORMAL / DESCARTADA / PRUEBA), `userId`, `createdAt` |
| `FotofficeAttachment.origen` (columna nueva, nula) | §10.1 | `"FOTO_CARNET"` en las copias del original guardadas en la ficha |

**Reglas que se controlan en la base (CHECK):**
- Una preparación pertenece a lo sumo a un renglón de venta y a lo sumo a un trabajo.
- `cantidad`, `copias` y `hojas` son mayores que 0.
- Las medidas son positivas.

**Archivos en R2** (bucket privado de FOTOFFICE): `fotoffice/impresion/{workspaceId}/{preparacionId}/{original|preview|final}/…`.

**Vencimiento:**
- Las preparaciones del Mostrador se borran a los **30 días** de impresas.
- Las de trabajos siguen el vencimiento de la carpeta del trabajo.
- El registro de impresión **no se borra**: es contable.

**Permisos:** preparar e imprimir exige el nivel de vender del módulo Ventas. Configurar salidas y tamaños exige la acción de catálogo (`sales.catalog`).

## 15. Etapas

Cada etapa sale sola a producción.

| # | Etapa | Contenido |
|---|---|---|
| 1 | **Motor, salidas y Foto carnet en el Mostrador** | Tablas, Configuración → Impresión (tamaños, salidas, hoja de prueba), motor (§5) con sus pruebas, Foto carnet migrado (§10), "Preparar" en el carrito, página de impresión, colas y registro de hojas. |
| 2 | **Copias instantáneas en la Kodak** | Grilla y editor de recorte/encaje (§6) para 10x15, 13x18 y 15x20 desde el Mostrador. |
| 3 | **Editor de revelado** | §7, para copias y carnet. |
| 4 | **Laboratorio** | Preparar en la carpeta del trabajo y archivos finales en el enlace (§12). |
| 5 | **Planchas de escuelas y clubes** | Varias personas en una hoja A4 de la Epson, con nombre debajo, carga múltiple y armado automático de hojas. |
| 6 | **Polaroid** | §11. |
| — | *Consumibles* | Proyecto aparte (§13). |

## 16. Pruebas

- **Geometría (puras):**
  - De la receta a los rectángulos en píxeles, con las 4 rotaciones, enderezado, RECORTAR y ENCAJAR.
  - Propuesta automática con el umbral del 8 %.
  - mm a píxeles en todas las medidas de §4.1.
  - Capacidad de las planchas.
- **Ajustes (puras):** cada control en 0 no cambia nada; los topes del efecto máximo; Auto sobre imágenes sintéticas.
- **Motor (con `sharp`, fotos de muestra en el repo):**
  - Medidas exactas del archivo final.
  - Densidad 300 ppp grabada.
  - sRGB embebido.
  - Una foto Display P3 conserva la saturación de un parche rojo.
  - El borde de ENCAJAR es blanco puro.
  - **No hay desenfoque:** la nitidez de un patrón de líneas se mantiene dentro de un margen.
- **Coincidencia vista previa / final:** ΔE promedio menor a 2 (§5.3).
- **Mostrador:**
  - Preparar sin cobrar y recargar recupera la preparación.
  - Cobrar vincula `saleItemId`.
  - Imprimir genera un registro; reimprimir genera otro con su motivo.
  - Sin permiso de Ventas no se accede.
- **Manual, en el local:** hoja de prueba en la Kodak y en la Epson, medir la regla y comparar el color con la pantalla.

## 17. Riesgos

| Riesgo | Qué se hace |
|---|---|
| El driver de la impresora escala o recorta por su cuenta | Hoja de prueba con regla, corrección de escala por salida, e instructivo de configuración (§8.2). |
| Fotos HEIC de iPhone | `sharp` las lee si la compilación tiene libheif. Si no, se avisa *"Convertí la foto a JPG"* y se agrega conversión en una etapa posterior. Se verifica en la etapa 1. |
| Fotos enormes, de más de 50 MP | Límite de 60 MP por original con aviso. El recorte se hace antes del paso a 16 bits (§5.2). |
| El color de pantalla no coincide con el papel | Fuera de alcance calibrar monitores. La hoja de prueba sirve de referencia visual. |
| Dos sesiones tocando el Mostrador | El cambio en `pos.tsx` se limita a la línea con "Preparar" y a un panel. La lógica vive en `lib/impresion/`. |

## 18. Fuera de alcance

- Consumibles, stock de insumos y compras (§13).
- Que el cliente prepare sus fotos desde su casa.
- Impresión sin cuadro de diálogo (agente local).
- "Blanquear fondo" en carnet.
- Retoque de piel, ojos rojos, eliminar objetos.
- Formatos RAW.
