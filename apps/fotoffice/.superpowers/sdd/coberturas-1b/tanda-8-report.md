# Tanda 8 — los arreglos de la revisión final

**Estado: los seis puntos resueltos.** Ninguno necesitó tocar la base ni agregar una migración, y
no salió ningún correo real. Cuatro commits, uno por tema.

| Commit | Tema |
| --- | --- |
| `b3cbfde4` | Serio 1 — avisos en tandas, reenvío, y el padrón en `listActiveCollaboratorEmails` |
| `cf2db3fd` | Serio 2 — el candado sobre la fila del rol |
| `19360f8d` | Menores 3, 4 y 5 — retirar la postulación, distinguir P2002, esconder el briefing |
| `bc3a4905` | La barrera de aislamiento extendida a todo el módulo |

Verificación, desde `apps/fotoffice`:

```
pnpm test          1 falla (la ajena de lib/template-v2/access.test.ts) · 2851 pasan
npx tsc --noEmit   limpio
pnpm lint          3 errores (los ajenos de hero-block-view.tsx y mass-grading-screen.tsx)
pnpm build         ✓ Compiled successfully
```

---

## 1. Los avisos de la convocatoria

**Qué pasaba.** Publicar mandaba un correo por colaborador, uno detrás del otro, después de que la
transacción ya había cerrado. Cincuenta colaboradores son quince segundos adentro de una Server
Action; si se cortaba, la convocatoria quedaba publicada y media institución no se enteraba, y no
había forma de reintentar porque ese correo sólo sale en la transición `BORRADOR → PUBLICADA`.

**Qué se hizo.**

- **Tandas paralelas.** `lib/coverages/avisos.ts` (nuevo, puro y probado) reparte la lista en
  tandas de `CALL_NOTICE_BATCH_SIZE` = 5 y decide a quién falta escribirle. El bucle de
  `avisarConvocatoriaPublicada` manda cada tanda con `Promise.all`.
- **Tope.** `listActiveCollaboratorEmails` lleva `take: CALL_NOTICE_MAX_RECIPIENTS` = 200. Es un
  techo del módulo, no una primera página: el orden por apellido es estable, así que el
  colaborador 201 no recibe el aviso ni en la publicación ni en el reenvío. Para no mentir sobre
  eso, se agregó `countActiveCollaboratorEmails` y la pantalla dice «el aviso alcanza a 200
  colaboradores y hay 340 con correo cargado» cuando corresponde. Repartirlo de verdad en varias
  corridas es trabajo del cron, o sea 1c.
- **Reenvío.** `reenviarAvisoConvocatoriaAction` y su botón en el panel, visible mientras la
  convocatoria está `PUBLICADA`. Lee `SentEmailLog` (`lib/communications/sent-log.ts`, nuevo) por
  `templateKey` + asunto exacto + `status: SENT` + `createdAt >= publishedAt`, y le escribe sólo a
  quien falta. Es idempotente: apretarlo de nuevo no le manda nada a nadie y lo dice.
- **El padrón.** `listActiveCollaboratorEmails` mira ahora `status: "ACTIVE"` del socio además del
  perfil de colaborador. Quien estaba de baja con el perfil encendido recibía cada convocatoria.

**Por qué `sent-log.ts` vive en `lib/communications` y no en el repositorio del módulo.**
`SentEmailLog` no tiene columna `workspaceId`; ponerla en `repository.ts` habría obligado a
abrirle una excepción a la barrera de aislamiento por una tabla que ni siquiera es del módulo. El
aislamiento lo pone quien llama: la lista de candidatos ya viene filtrada por workspace y la
consulta no puede devolver nada que no esté en ella.

También se arregló algo que la revisión dejó implícito: el renglón «3 de los 50 avisos no
salieron» desaparecía de la pantalla apenas la convocatoria pasaba a `PUBLICADA`, porque vivía
dentro del bloque que se esconde al publicar. Ahora se sigue viendo, al lado del botón de
reenviar.

## 2. El candado sobre la fila del rol

`bloquearRol(tx, roleId)` hace `SELECT id FROM "CoverageRole" WHERE id = ${roleId} FOR UPDATE`
dentro de la transacción y antes del recuento, en las dos acciones de armar equipo.

En `invitarDirectoAction` es literalmente la primera sentencia. En `seleccionarPostulacionAction`
va inmediatamente después de leer la postulación, porque lo que llega del formulario es el
`applicationId` y hasta esa lectura no se sabe qué rol hay que bloquear. Lo que importa —y está
escrito en el comentario— es que el candado esté **antes del recuento** y **en la transacción que
escribe**: esa lectura previa no decide ningún cupo.

Como es el tipo de línea que alguien borra por parecer inútil, hay un test sobre el fuente
(`app/(shell)/coberturas/c/[coverageId]/candado-de-rol.test.ts`) que verifica que siga estando,
que las dos acciones lo tomen, y que cada recuento tenga su propio candado antes.

## 3. La postulación de quien avisa que no puede

`SELECCIONADA → RETIRADA` se agregó a `TRANSICIONES_POSTULACION` con sus tests. `RETIRADA` ya
estaba entre las resoluciones alcanzables desde cualquier estado vivo, y ese atajo se comía la
fila nueva: `canTransitionApplication` ahora consulta también la tabla cuando el destino es una
resolución.

En `responderInvitacionAction`, cuando la respuesta es «no puedo» y la asignación vino con
`origin: "POSTULACION"`, `retirarPostulacionDeLaInvitacion` mueve la postulación a `RETIRADA` con
su evento, en la misma transacción. Si ya estaba resuelta por otro camino, la máquina de estados
lo frena y no se pisa nada.

## 4. Los tres `catch` ciegos

`Prisma.PrismaClientKnownRequestError` con `code === "P2002"` es lo único que significa «ya te
anotaste» / «ya está en el equipo». Lo demás va a `console.error` con contexto y devuelve «No
pudimos guardar tu respuesta. Probá de nuevo.» / «No pudimos guardarlo. Probá de nuevo.». En el
panel se unificó en `errorAlArmarElEquipo`, que usan las dos acciones.

## 5. El briefing privado

`app/portal/coberturas/asignacion/[id]/page.tsx` condiciona el bloque «Para el día de la
actividad» a `ASSIGNMENT_LIVE_STATUSES`. Alcanza a `RECHAZADA`, `CANCELADA` y `REEMPLAZADA`.

## 6. La barrera de aislamiento

`lib/coverages/aislamiento.test.ts` se reescribió. Barre cuatro zonas —`lib/coverages`,
`app/(shell)/coberturas`, `app/portal/coberturas` y `app/actions/coverage*`— detectando cada
llamada a Prisma por código, sin ninguna lista de nombres.

Cómo juzga cada consulta:

- **Lecturas y escrituras dirigidas**: `workspaceId` tiene que estar adentro del `where` de primer
  nivel, directo o por relación (`call: { workspaceId }`). Un `where` anidado dentro de un
  `include` no cuenta, porque filtra las filas relacionadas y no las de la consulta.
- **Altas** (`create`, `createMany`): el aislamiento viaja en lo que se escribe.
- **SQL crudo** (`$executeRaw`, `$queryRaw`): entra siempre, porque no se le puede leer un `where`
  y es donde un filtro que falta pasa más desapercibido.

Para leer el archivo sin que una llave escrita adentro de un texto o de un comentario descoloque
el conteo, el barrido trabaja sobre una copia enmascarada que conserva posiciones. De paso, una
consulta comentada no entra al barrido.

**La única salida es declararla.** Las consultas que legítimamente no pueden llevar `workspaceId`
—la que resuelve de qué workspace hablamos a partir del slug público, o una escritura por `id`
sobre una fila que la consulta de arriba ya verificó— llevan `// aislamiento: …` pegado arriba,
diciendo qué las aísla en su lugar. Quedaron 20 así, todas revisadas una por una. No es una lista
blanca: vive al lado de la consulta, hay que escribirla a propósito, y una consulta nueva que se
olvide del workspace y no declare nada cae en el barrido igual. Hay además un tope de
declaraciones (20), para que las excepciones no se multipliquen sin que nadie lo mire.

### La prueba de que sigue siendo una barrera

Se agregó a mano en `app/portal/coberturas/page.tsx` —una carpeta que hoy no tiene ninguna
consulta propia, o sea el caso más exigente para el alcance del barrido— esta función de mentira:

```ts
async function consultaInfractoraDeMentira() {
  return prisma.coverageRequest.findMany({
    where: { status: "RECIBIDA" },
    select: { id: true },
  });
}
```

El test falló nombrándola con archivo, línea y modelo:

```
"app/portal/coberturas/page.tsx:180 — coverageRequest.findMany"
```

Segunda prueba, para descartar el falso positivo que el test viejo ya evitaba: se le agregó
`workspaceId: true` al `select` y un `coverages: { where: { workspaceId: "ws-1" } }` adentro. El
test siguió fallando y nombrándola, que es lo correcto: devolver el campo o filtrar las filas
relacionadas no aísla la consulta.

Se borró la función y el test volvió a verde. `git diff` sobre ese archivo quedó vacío.

---

## Dudas

1. **`listActiveCollaborators` quedó sin el filtro del padrón.** Sólo se arregló
   `listActiveCollaboratorEmails`, que es lo que pedía el encargo. La otra alimenta el desplegable
   de la invitación directa, así que a un socio dado de baja con el perfil encendido todavía se lo
   puede ofrecer y `planInvitacionDirecta` lo acepta: sólo mira el perfil, no el padrón. No es una
   fuga y nadie se entera por correo, pero es el mismo bug en el otro camino. ¿Lo arreglo también,
   o entra en 1c junto con el resto de las reglas de elegibilidad?
2. **El tope de 200 no es una primera página.** Con un padrón más grande, al colaborador 201 no le
   llega el aviso y la pantalla lo dice, pero no hay forma de alcanzarlo desde el producto.
   Resolverlo de verdad es repartir el envío en varias corridas del cron, que es 1c. Doscientos es
   holgado para las instituciones de hoy (la SFPR tiene ~110 socios), así que lo dejé así.
3. **El reenvío identifica la corrida por asunto + fecha de publicación**, porque `SentEmailLog` no
   tiene ni `workspaceId` ni una referencia a la convocatoria. Dos convocatorias con exactamente el
   mismo título en la misma institución, publicadas la segunda después de la primera, confundirían
   sus envíos. Es raro y el costo de equivocarse es no reenviarle a alguien que sí lo necesitaba;
   agregarle una columna a `SentEmailLog` sí sería migración, y el encargo decía que no.
