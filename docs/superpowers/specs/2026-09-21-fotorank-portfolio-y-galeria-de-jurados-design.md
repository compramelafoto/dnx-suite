# FotoRank — Portfolio del jurado, galería para convocar, y el cobro por foto calificada

**Fecha:** 2026-09-21
**App:** `apps/fotorank`
**Continúa:** `2026-09-20-fotorank-altas-de-jurados-y-ux-design.md`, ya implementado y en producción
**Alcance de esta entrega:** las partes **A** y **B**. La **C** se escribe acá para que la
decisión no se pierda, pero no se construye todavía: está bloqueada por un trámite ajeno.

---

## 1. Por qué

El módulo de jurados ya está abierto: un fotógrafo se postula solo, arma su ficha y un
organizador lo encuentra en el directorio. Pero **una ficha de jurado hoy es texto y una
foto de perfil**. A un fotógrafo se lo convoca por lo que muestra, no por lo que declara.

Y hay un segundo problema: el jurado que hace el trabajo no cobra por la plataforma.

## 2. Lo que ya existe, y no se construye de nuevo

Auditado el 2026-09-21 antes de diseñar:

| Pieza | Dónde | Qué se hace |
|---|---|---|
| **El directorio con filtros** | `/jurados/directorio`, filtros por especialidad, país, disponibilidad y tarifa | Se mejora la presentación; la búsqueda no se toca |
| **Propuesta → aceptar / rechazar** | `FotorankJudgeDirectoryInvitation` | Se reutiliza tal cual |
| **Subida de la foto de perfil** | `judgeUploadOwnAvatarAction` | Se mueve también al formulario de alta |
| **Almacenamiento privado con hash en la clave** | `judgeAssetStorage.ts`, en producción | Se extiende al portfolio |
| **Ruta que sirve una imagen del bucket** | `/api/jurados/avatar/...` | Mismo patrón para el portfolio |
| **Subida directa al bucket** | `createUploadIntent` en `r2-private-storage.ts` | **No se usa** — ver 4.2 |
| **Estados en castellano y tarjeta de jurado** | `judgeStatus.ts`, `JudgeCard` | Se reutilizan |
| **El circuito de cobro** | `2026-09-19-fotorank-contratacion-de-jurados-design.md` | Se le agrega la unidad "por foto" (parte C) |

## 3. Decisiones tomadas

| Decisión | Elección |
|---|---|
| Quién ve el portfolio | Cualquiera, en la página pública del jurado |
| Cómo se cobra por foto | Se estima al aceptar y se ajusta al final |
| Qué se construye ahora | A y B. C queda escrita, sin construir |

---

# Parte A — El portfolio y la foto en el alta

## 4.1 La foto de perfil, en el formulario de postulación

Hoy el jurado se postula y **recién después** puede cargar su foto, desde su perfil. Son
dos pasos y el segundo se olvida: una ficha sin cara es una ficha que nadie convoca.

La foto pasa a ser un campo más del formulario público, opcional. Como la cuenta todavía
no existe cuando se elige el archivo, la subida ocurre **después de crear la cuenta, dentro
de la misma acción de alta**: el formulario manda el archivo, la acción crea la cuenta y
ahí guarda la foto con el `judgeAccountId` ya disponible.

Si la foto falla, **el alta no se cae**: queda creada sin foto y el panel se lo dice. Perder
una cuenta entera por una imagen sería peor que la imagen.

## 4.2 Por qué el navegador achica las fotos antes de subirlas

Una foto de portfolio sale de una cámara profesional: 8, 15, 40 MB. Hay dos caminos y se
elige el que no depende de nada trabado.

| Camino | Problema |
|---|---|
| Subida directa al bucket | Existe (`createUploadIntent`), pero **necesita CORS habilitado en `fotorank-private-prod`**, pendiente hace semanas |
| Acción de servidor | Tope de 4,5 MB en Vercel |

**Se elige el segundo, y el navegador redimensiona antes de enviar**: lado largo a 2000px,
JPEG de calidad 0,85. Una foto así pesa entre 300 KB y 1 MB, entra holgada bajo el tope, y
a 2000px se ve impecable en una ficha o en una galería. El redimensionado usa `canvas`, sin
ninguna dependencia nueva —el lockfile es de toda la suite y agregarle un paquete a una app
ya rompió el build de otra.

Si el navegador no puede redimensionar, se envía el original y el servidor lo rechaza con
un mensaje claro si excede el tope. Nunca se sube algo de 40 MB en silencio.

## 4.3 El modelo

```prisma
model FotorankJudgePortfolioImage {
  id             String   @id @default(cuid())
  judgeProfileId String
  storageKey     String   // clave en el bucket privado
  contentHash    String   // va en la URL: si cambia la imagen, cambia la ruta
  contentType    String
  sizeBytes      Int
  width          Int?
  height         Int?
  title          String?  // opcional, hasta 120 caracteres
  sortOrder      Int      @default(0)
  createdAt      DateTime @default(now())
  updatedAt      DateTime @updatedAt

  judgeProfile   FotorankJudgeProfile @relation(fields: [judgeProfileId], references: [id], onDelete: Cascade)

  @@index([judgeProfileId, sortOrder])
}
```

**Tope de 12 imágenes por jurado.** Doce alcanza para una carta de presentación y evita que
FotoRank termine siendo un hosting de fotos gratis. El tope se controla en el servidor, no
sólo en la pantalla.

`onDelete: Cascade` borra las filas cuando se borra el perfil. **Los archivos del bucket se
borran aparte, explícitamente**: una cascada de base de datos no borra objetos de R2, y
dejar huérfanos en un bucket que se paga por volumen es una fuga silenciosa.

Claves de almacenamiento, siguiendo lo que ya existe:

```
fotorank/judges/<judgeAccountId>/portfolio/<hash>.<ext>
```

## 4.4 Cómo se sirven

Ruta nueva, hermana de la del avatar:

```
/api/jurados/portfolio/<imageId>/<hash>.<ext>
```

Igual que el avatar: el hash pedido tiene que ser el que esa fila tiene guardado, se
entregan los bytes desde el bucket y se cachea para siempre. Una imagen de portfolio es
pública por naturaleza —se muestra en la página pública del jurado—, pero el archivo vive
en el bucket privado y **la ruta es la que decide qué se entrega**.

## 4.5 Dónde las carga y las ordena

En `/jurado/perfil`, una sección nueva debajo de la foto de perfil:

- Subir una o varias imágenes a la vez, hasta llegar a 12.
- Ponerle un título a cada una, opcional.
- Reordenarlas con dos flechas por imagen. **No se usa arrastrar y soltar**: en un teléfono
  es incómodo y con teclado es inaccesible. Dos botones funcionan en todos lados.
- Borrar una imagen, que borra el archivo del bucket además de la fila.

## 4.6 Dónde se ven

| Pantalla | Qué muestra |
|---|---|
| `/jurados/publico/<slug>` | La galería completa, en el orden que eligió el jurado |
| `/jurados/directorio` | Las 3 primeras, como tira bajo el retrato |
| `/jurados/directorio/<id>` | La galería completa |
| `/jurado/perfil` | Las 12, con sus controles |

**No se muestran en la sección de jurados del concurso.** Ahí el foco es quién evalúa, no
su obra, y doce fotos por jurado harían ilegible la landing.

---

# Parte B — La galería para convocar

## 5.1 Qué cambia

El directorio existe y funciona. **La búsqueda no se toca**: los filtros por especialidad,
país, disponibilidad y tarifa quedan como están.

Lo que cambia es cómo se ve cada jurado en la lista: hoy es una fila con un retrato chico y
texto. Pasa a ser una **tarjeta con el retrato, el nombre, el titular profesional, y una
tira de tres fotos de su portfolio**. Un organizador que busca jurado para un concurso de
fotografía documental tiene que poder ver, en dos segundos, si esta persona hace fotografía
documental.

Un jurado sin portfolio se ve como hoy, sin huecos ni marcos vacíos.

## 5.2 Orden de la lista

Hoy el directorio ordena por lo que devuelva la consulta. Pasa a ordenar por **qué tan
completa está la ficha**: primero los que tienen portfolio, foto y bio; después el resto.

No es un ranking de calidad —eso exigiría reseñas, y el diseño anterior las descartó con
razón— sino de **utilidad para quien busca**. Una ficha vacía no ayuda a nadie y no merece
el primer lugar. Y le da al jurado un motivo concreto para completarla.

**El criterio, exacto.** Un punto por cada cosa que le sirve a quien busca:

| Vale un punto | Por qué |
|---|---|
| Tiene foto de perfil | Una ficha sin cara no se convoca |
| Tiene tres fotos de portfolio o más | Con menos, la tira queda incompleta |
| Tiene titular profesional | Es la línea que se lee primero |
| Tiene bio de 120 caracteres o más | Lo mínimo que el alta ya exige |
| Declaró años de experiencia | Es el filtro más usado después de la especialidad |
| Tiene al menos una especialidad | Sin esto no aparece en ninguna búsqueda por tema |

Seis puntos posibles. A igual puntaje, el más reciente primero, para que un jurado nuevo y
completo no quede sepultado detrás de uno viejo e igual de completo.

El puntaje **se calcula en el momento y no se guarda**: un número guardado y uno calculado
que algún día no coinciden es exactamente el problema de las cuatro estadísticas muertas
que acabamos de sacar.

---

# Parte C — El cobro por foto calificada (escrita, no construida)

## 6.1 Por qué no se construye todavía

Verificado el 2026-09-21 contra Mercado Pago:

```
productionWritesAllowed: false
```

El split sigue en sandbox. Se puede escribir todo el circuito y no se puede cobrar un peso
real. El trámite está en el panel de Mercado Pago y ya frenó a otros proyectos de la suite.

## 6.2 La decisión que resuelve la tensión

El diseño del 19/9 descartó el pago por obra evaluada con un argumento correcto: si el
monto depende de cuánto trabaje el jurado, no se sabe cuánto cobrar al aceptar, y cobrar al
final deja al jurado trabajando sin garantía.

**Se resuelve estimando y ajustando:**

```
El concurso tiene 400 obras; el jurado cobra $500 por foto
      ↓  se cobra por adelantado 400 × $500 = $200.000
      ↓  el jurado ve la plata acreditada ANTES de empezar
      ↓  evalúa 380 (20 quedaron fuera de su categoría o se retiraron)
      ↓  al cerrar: se devuelven 20 × $500 = $10.000 al organizador
```

Las dos partes quedan protegidas por lo mismo que ya se verifica solo: **la cantidad de
obras evaluadas no la declara nadie, se cuenta**, sumando los dos motores de evaluación que
conviven en FotoRank (`FotorankJudgeVote` y `FotorankJuryEvaluation`).

## 6.3 Lo que hace falta

- Un valor nuevo en `FotorankJudgePriceUnit`: **`PER_PHOTO`** (hoy hay `PER_CONTEST`,
  `PER_CATEGORY`, `PER_HOUR` y `CUSTOM`).
- En `FotorankJudgeEngagement` —el compromiso que define el spec del 19/9—: las obras
  estimadas al aceptar, las evaluadas al cerrar y el ajuste resultante.
- El reembolso parcial, con `DnxPaymentRefund` y `DnxPaymentRefundAllocation`, que ya
  existen.
- La regla de cierre: el ajuste se calcula **una sola vez**, al pasar a `SETTLED`, y queda
  registrado. Un ajuste recalculable es un ajuste que algún día devuelve dos veces.

## 6.4 El riesgo propio de esta forma de cobro

Si el concurso recibe muchas menos obras de las previstas, el reembolso puede ser enorme
respecto de lo cobrado. Los términos tienen que decir qué pasa si la estimación falla por
mucho, y conviene **un mínimo garantizado** que el jurado cobra aunque evalúe menos. Ese
número es una decisión de negocio, no de programación, y hay que escribirlo antes de
encender nada.

---

## 7. Migración

Una sola migración: la tabla `FotorankJudgePortfolioImage` y su índice. **No toca ninguna
tabla existente**, así que es la más segura posible.

Se aplica a mano en **las cinco bases** del schema compartido —FotoRank/FOTOFFICE,
CompraMeLaFoto, Clickatón, InfoSpot y DNX Suite staging— y se registra en
`_prisma_migrations` con su checksum. `compramelafoto-staging` queda afuera: no tiene las
tablas de FotoRank. El procedimiento está en `docs/fotorank/migracion-alta-jurados.md`.

## 8. Pruebas

Se implementa con TDD: primero la prueba, después el código.

**Unitarias**

- Claves de almacenamiento del portfolio: armado, lectura y rechazo de claves ajenas.
- El tope de 12: la número 13 se rechaza en el servidor, no sólo en la pantalla.
- Reordenar: subir la primera y bajar la última no rompen el orden ni dejan huecos.
- Borrar una imagen del medio deja el orden sin saltos.
- Validación del archivo: tipo real, tamaño, imagen corrupta.
- El cálculo de "qué tan completa está la ficha", con casos borde: ficha vacía, sólo foto,
  completa.
- Redimensionado: que la función devuelva las dimensiones esperadas y respete la proporción.

**De punta a punta (Playwright)**

1. Un jurado sube tres fotos, las reordena y borra una; su página pública refleja el orden.
2. Una foto que excede el tope se rechaza con un mensaje que se entiende.
3. El directorio muestra la tira de tres y ordena primero a los que tienen ficha completa.
4. Un jurado sin portfolio se ve sin huecos.

## 9. Riesgos

- **Los archivos huérfanos se pagan.** Si una fila se borra y el objeto queda en R2, nadie
  lo nota hasta la factura. Cada borrado toca las dos cosas, y conviene un chequeo
  periódico —ya existe `orphan-assets-report.ts` para las obras de concurso.
- **Doce fotos por jurado, por cien jurados, son mil doscientos archivos.** A 2000px son
  unos 800 MB. Es manejable, pero el tope de 12 es lo que lo mantiene así.
- **El portfolio es obra ajena.** Un jurado podría subir fotos que no son suyas. Los
  términos tienen que decir que responde por lo que sube, y Super Admin tiene que poder
  bajar una imagen sin borrar la cuenta.
- **La parte C mueve dinero de terceros.** No se despliega nada sin la homologación
  completa y sus evidencias.

## 10. Orden de implementación

```
A.1  Almacenamiento y claves del portfolio
A.2  Ruta que sirve las imágenes
A.3  Migración de la tabla
A.4  Subir, titular, reordenar y borrar en /jurado/perfil
A.5  La foto de perfil dentro del formulario de postulación
A.6  El portfolio en la página pública
B.1  La tarjeta del directorio con la tira de tres
B.2  El orden por ficha completa
C    Cuando Mercado Pago se destrabe
```
