# Clickatón — consignas, anotaciones y entrega

**Fecha:** 2026-09-03
**Estado:** diseño aprobado, sin implementar
**Maqueta revisada:** `/preview-en-vivo` (temporal, se borra al terminar)

---

## 1. Qué resuelve

Durante el evento el participante necesita un solo lugar donde leer las
consignas, anotar lo que se le ocurre en la calle y entregar sus fotos. Hoy eso
no existe: las consignas viven mezcladas dentro de la credencial, no hay dónde
anotar nada, y la persona no tiene forma de saber qué le falta.

El trabajo real de un fotógrafo en una maratón ocurre en dos momentos y dos
dispositivos: sale a la calle con el teléfono, resuelve consignas y toma notas;
más tarde, sentado, elige y revela los archivos y los sube. La pantalla tiene
que servir a los dos momentos sin obligar a nadie a aprender dos lugares.

---

## 2. Decisiones tomadas

| Tema | Definición |
|---|---|
| Apertura de consignas | Todas juntas, en un único instante. Nunca progresiva. |
| Pantalla | Una sola, con estructura fija. Lo único que cambia con la hora es qué está habilitado. |
| Anotaciones | Texto libre, una por consigna, privadas del participante. Nadie más las lee. |
| Guardado de anotaciones | Automático, y tiene que funcionar sin señal. |
| Retención de anotaciones | 30 días contados desde el cierre de la entrega. Después se borran. |
| Fotos por consigna | Una, reemplazable mientras la entrega esté abierta. |
| Check "Ya la tengo" | Existe, y **habilita** el botón de subir. |
| Entrega | Sigue siendo en dos pasos: subir y después confirmar la declaración. |
| Ventanas de horarios | De la edición, no por consigna. La toma y la subida pueden solaparse. |
| Editor de horarios | Barras arrastrables arriba, campos de fecha abajo, en la misma pantalla. |

### Riesgo aceptado

Poner "Ya la tengo" como llave del botón de subir mete un paso obligatorio entre
la persona y la entrega. Si alguien no entiende ese check, no entrega. Se
mitiga con el botón bloqueado diciendo exactamente qué falta, y tildando el
check solo al subir. La decisión está tomada a conciencia.

---

## 3. La pantalla del participante

Ruta: `/en-vivo/[registrationId]`. Ya existe.

### Estructura, siempre la misma

Una lista con todas las consignas. Cada una es una tarjeta que se abre, y
adentro el orden nunca cambia:

```
instrucciones → tus anotaciones → Ya la tengo → subir la foto
```

Lo único que decide la hora es qué está habilitado:

| Momento | Anotar | Ya la tengo | Subir | Confirmar |
|---|---|---|---|---|
| Antes de la apertura | — | — | — | — |
| Toma y entrega abiertas | sí | sí | si está tildado | sí |
| Toma cerrada, entrega abierta | sí | sí | si está tildado | sí |
| Todo cerrado | solo lectura | bloqueado | no | no |

Antes de la apertura la pantalla muestra la cuenta regresiva, sin ninguna
consigna. Eso ya está implementado y aprobado.

### La tarjeta plegada

Muestra número, título, estado y la primera línea de la nota. Con eso se barre
la lista entera sin abrir nada.

Cuatro estados posibles:

| Chip | Significa |
|---|---|
| Pendiente | no hizo nada |
| Ya la tengo | la resolvió en cámara, no subió |
| Sin confirmar (ámbar) | subió, pero **no compite** |
| Enviada (verde) | entró al concurso |

### La barra de estado del día

Fija arriba. Dice qué está abierto, cuándo cierra, y dos números: cuántas
enviadas (las confirmadas) y cuántas resueltas. Los dos siempre, para que la
pantalla no cambie de forma según la hora.

---

## 4. Anotaciones

### Modelo de datos

Tabla nueva. Guarda el texto y el check juntos porque son la misma fila lógica:
el estado del participante frente a una consigna.

```prisma
model ClickatonPromptNote {
  id             String   @id @default(cuid())
  editionId      String
  registrationId String
  promptId       String
  /// Texto libre, privado del participante. Nunca sale en ninguna API pública.
  body           String   @db.Text
  /// El check "Ya la tengo".
  solved         Boolean  @default(false)
  solvedAt       DateTime?
  /// Marca del dispositivo que escribió. Resuelve conflictos entre teléfono y computadora.
  clientUpdatedAt DateTime?
  createdAt      DateTime @default(now())
  updatedAt      DateTime @updatedAt

  edition      ClickatonEdition      @relation(fields: [editionId], references: [id], onDelete: Cascade)
  registration ClickatonRegistration @relation(fields: [registrationId], references: [id], onDelete: Cascade)
  prompt       ClickatonPrompt       @relation(fields: [promptId], references: [id], onDelete: Cascade)

  @@unique([registrationId, promptId])
  @@index([editionId])
}
```

Los tres modelos relacionados necesitan su campo inverso (`promptNotes`) en la
misma migración.

`body` se limita a 2000 caracteres, validado en el servidor y avisado en la
pantalla. Es un cuaderno, no un documento.

### Privacidad

Las anotaciones no se muestran en ninguna pantalla de administración, no salen
en ninguna exportación y no viajan a FotoRank. La única consulta que las
devuelve verifica que quien pregunta es el dueño de la inscripción, con el mismo
criterio que ya usa la credencial (`userId` o email coincidente).

### Guardado sin señal

El texto se escribe primero en el dispositivo y después se sincroniza. Nunca al
revés: si la señal no vuelve, la nota igual está.

1. Al escribir, se guarda en `localStorage` de inmediato, con la marca de tiempo
   del dispositivo.
2. A los 700 ms sin teclear se manda al servidor.
3. Si la petición falla, la entrada queda en una cola y se reintenta cuando
   vuelve la conexión (evento `online` y al volver la pestaña al frente).
4. La pantalla dice en qué estado está: *Guardando…* / *Guardado* / *Guardado en
   este teléfono · se sincroniza al volver la señal*.

**Conflictos entre dispositivos.** La misma persona puede tener el teléfono en
la calle y la computadora abierta en casa. Se resuelve por `clientUpdatedAt`:
gana la escritura más reciente. El servidor descarta una escritura cuyo
`clientUpdatedAt` sea anterior al que ya tiene guardado. Es suficiente para este
caso: son notas personales, no trabajo colaborativo.

### API

| Método | Ruta | Para qué |
|---|---|---|
| `GET` | `/api/account/registrations/[id]/notes` | Hidratar la pantalla al cargar |
| `PUT` | `/api/account/registrations/[id]/notes/[promptId]` | Guardar texto y/o check |

`PUT` recibe `{ body?, solved?, clientUpdatedAt }` y es idempotente. Rechaza
escrituras cuando la ventana de entrega ya cerró.

### Borrado a los 30 días

El corte no se guarda en la fila: se calcula en el momento de borrar, a partir
del cierre de la ventana de subida de la edición más 30 días. Así, si el
cronograma se mueve, el plazo se corrige solo y no queda ninguna fecha vieja
guardada en miles de filas.

Un cron nuevo (`/api/cron/clickaton-notes-purge`) recorre las ediciones cuya
entrega cerró hace más de 30 días y borra sus notas. Sigue el mismo patrón de
autenticación que los crones que ya existen. Una edición sin cierre de entrega
cargado nunca se borra: sin fecha no hay plazo que contar.

---

## 5. La entrega, en dos pasos

Se conserva el flujo actual: subir el archivo y después confirmar la
declaración. Lo que cambia es hacer imposible confundir los dos pasos.

**El problema.** Una foto subida y no confirmada no compite. Hoy nada en la
pantalla lo grita, y en un evento con plazo eso deja gente afuera.

**Lo que se agrega:**

1. El contador de arriba cuenta solo las confirmadas. Si subiste y no
   confirmaste, el número no sube. Es incómodo a propósito.
2. Aviso arriba de todo mientras haya fotos sin confirmar: *"Te queda 1 foto
   subida sin confirmar. Si no la confirmás antes de las 22:00, no compite."*
   En ámbar mientras se puede arreglar; en rojo, y en pasado, cuando ya cerró.
3. Antes de confirmar se muestran las dimensiones, la fecha de captura y la
   cámara que el sistema leyó del archivo. Sirve para que la persona detecte
   sola el problema más común —la cámara con la hora mal puesta— y cambie la
   foto, en lugar de enterarse cuando la descalifican.
4. "Elegir otra foto" reemplaza el archivo antes de confirmar.

El check "Ya la tengo" queda tildado y bloqueado una vez que hay foto subida:
no tendría sentido poder decir que no tenés una foto que ya mandaste.

---

## 6. Los horarios de la edición

Pantalla: `/admin/ediciones/[editionId]/cronograma`. Ya existe, se le agrega la
vista de barras arriba y se conservan los campos abajo.

### No hay modelo nuevo

Las ventanas ya viven en `ClickatonTimelineEvent`. Cada barra es un par de
eventos que ya existen:

| Barra | Desde | Hasta |
|---|---|---|
| Inscripciones | `REGISTRATION_OPEN` | `REGISTRATION_CLOSE` |
| Acreditación | `ACCREDITATION_OPEN` | `ACCREDITATION_CLOSE` |
| Publicación de consignas (hito) | `PROMPT_RELEASE` | — |
| Toma de fotos | `MARATHON_START` | `CAPTURE_WINDOW_CLOSE` |
| Subida de fotos | `UPLOAD_WINDOW_OPEN` | `UPLOAD_WINDOW_CLOSE` |
| Jurado | `JUDGING_OPEN` | `JUDGING_CLOSE` |
| Resultados (hito) | `RESULTS_RELEASE` | — |

Mover una barra escribe el `startsAt` de los dos eventos del par. El motor de
cronograma no se toca.

### Comportamiento

- **Arrastrar la barra** mueve el horario manteniendo la duración.
- **Arrastrar los bordes** cambia solo el comienzo o solo el final.
- Todo se acopla a **cuartos de hora**.
- **Con teclado**: Tab hasta la barra, flechas para moverla, Shift para ir de a
  una hora, Alt para correr solo el final.
- Dos escalas: **toda la edición** y **un día**, con flechas para cambiar de
  día. El día queda anclado: arrastrar no mueve la vista.
- Las barras que vienen de otro día muestran ◀ o ▶ en el borde.
- Los campos de abajo y las barras son la misma fuente: mover una actualiza el
  otro.

### Validaciones cruzadas

Se pintan en la barra y en el campo, en el momento:

- El final llega antes que el comienzo.
- La entrega cierra antes de que termine la toma de fotos.
- La entrega abre después de que ya se puede fotografiar.
- Se puede fotografiar antes de que se publiquen las consignas.

**La toma y la entrega se solapan a propósito.** El caso normal es toma de 16:00
a 20:00 y entrega de 16:00 a 22:00: se puede subir desde el principio, y quedan
dos horas de margen al final.

---

## 7. Qué ya está hecho y qué falta

### Hecho (en el árbol de trabajo, sin commitear)

- Apertura conjunta de consignas: `lib/timeline/prompt-gate.ts`, con tests.
- Pantalla `/en-vivo/[registrationId]` con cuenta regresiva y lista de consignas.
- Redirección automática al escanear el QR en la acreditación.
- El botón del panel publica todas las consignas juntas.
- El cron de liberación programada abre la edición completa de una vez.

### Falta

1. Tabla `ClickatonPromptNote` y su migración.
2. API de notas (`GET` de todas, `PUT` de una).
3. Guardado local con cola de sincronización.
4. El check "Ya la tengo" y su efecto sobre el botón de subir.
5. Estado "sin confirmar" en la tarjeta, el contador y el aviso de arriba.
6. Datos técnicos del archivo antes de confirmar.
7. Cron de borrado a los 30 días.
8. Vista de barras en el cronograma del panel.
9. Borrar la maqueta `/preview-en-vivo`.

---

## 8. Riesgos operativos

Dos cosas conocidas de este monorepo que afectan directamente a este trabajo:

1. **El `schema.prisma` es compartido por cinco bases Neon.** Agregar
   `ClickatonPromptNote` obliga a aplicar la migración a mano en las cinco, o se
   rompen las escrituras de las otras aplicaciones. Para verificarlo existe
   `pnpm --filter @repo/db db:drift`, que compara el schema contra las bases que
   le pases y dice qué falta sin ejecutar nada. Correrlo es parte del trabajo,
   no un extra.
2. **El deploy de Clickatón no corre `prisma migrate deploy`,** y automatizarlo
   no es viable hoy porque cada base tiene un subconjunto distinto del historial
   de migraciones (ver `docs/infrastructure/DERIVA_DE_SCHEMA.md`). La tabla no
   va a aparecer sola en producción: hay que aplicarla a mano y verificarla con
   `db:drift` antes de liberar la pantalla.

Mitigación: la pantalla tiene que seguir funcionando si la tabla todavía no
existe. Sin la tabla, las anotaciones se guardan solo en el dispositivo y la
interfaz lo dice, en vez de romperse. El resto —consignas, subida, confirmación—
no depende de la tabla nueva.

---

## 9. Pruebas

**Lógica pura, con reloj fijo:**

- El portón de apertura conjunta (ya cubierto en `prompt-gate.test.ts`).
- Resolución de conflictos por `clientUpdatedAt`: gana la escritura más nueva,
  se descarta la vieja.
- Selección de ediciones vencidas para el borrado, incluido el caso de una
  edición sin cierre de entrega cargado, que no debe borrarse nunca.
- Las cuatro validaciones cruzadas del cronograma.
- Estado de cada consigna a partir de nota, check y foto.

**De extremo a extremo:**

- Escribir una nota sin conexión, recuperar la conexión, verificar que llegó.
- Subir sin confirmar y comprobar que el contador no la cuenta y que aparece el
  aviso.
- Confirmar y comprobar que el aviso desaparece.
- Que la nota de un participante no aparezca en la sesión de otro.

---

## 10. Fuera de alcance

- Fotos de referencia o ubicación dentro de las anotaciones: solo texto.
- Bloc general del día: solo notas por consigna.
- Varias fotos por consigna.
- Que el jurado o la organización vean las anotaciones.
- Anotaciones compartidas entre participantes.
