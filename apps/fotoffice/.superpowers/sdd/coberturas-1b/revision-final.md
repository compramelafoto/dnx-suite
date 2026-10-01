# Revisión final de `feat/coberturas-armar-el-equipo` (etapa 1b)

**Alcance:** los 13 commits de `56dd314f..HEAD`, leídos enteros, más los archivos del repo que
hizo falta abrir para seguir cada camino. Verificación propia: `pnpm test` (1 falla, la ajena de
`lib/template-v2/access.test.ts`), `npx tsc --noEmit` (limpio), `pnpm lint` (los 3 errores ajenos
de `hero-block-view.tsx` y `mass-grading-screen.tsx`).

**Estado general: la rama está sana.** No encontré ninguna fuga entre workspaces ni entre
personas, ni ningún dato perdido, ni ningún estado corrupto. La distinción que sostiene la etapa
—"roles llenos" contra "equipo confirmado"— está bien separada en las dos direcciones, incluido
el camino de vuelta. Lo que sigue son dos conductas incorrectas en casos realistas, tres asuntos
menores y unas cuantas observaciones.

---

## Hallazgos

### 1. Serio — Publicar una convocatoria manda los avisos en serie, sin tope y sin reintento

**Archivo:** `app/(shell)/coberturas/c/[coverageId]/actions.ts:296` (el `for` de
`avisarConvocatoriaPublicada`), alimentado por `lib/coverages/repository.ts:285`
(`listActiveCollaboratorEmails`, sin `take`).

**Cómo se rompe.** La coordinación de una institución con 50 colaboradores activos aprieta
«Publicar convocatoria». La transacción confirma (la convocatoria ya está `PUBLICADA`) y recién
ahí arranca un bucle que espera un envío a Resend por persona, uno detrás del otro. Cincuenta
llamadas HTTP secuenciales a ~300 ms son ~15 segundos dentro de una Server Action que no declara
`maxDuration`; si la función se corta —o si una sola llamada a Resend queda colgada, porque
`sendTransactionalEmail` no tiene timeout— la coordinación ve un error aunque la convocatoria
quedó publicada, y la mitad de los colaboradores nunca se entera. **No hay forma de reintentar
desde el producto**: `publicarConvocatoriaAction` es el único lugar que manda ese correo y sólo
corre en la transición `BORRADOR → PUBLICADA`, que ya ocurrió; el panel ni siquiera muestra el
botón una vez publicada. El propio aviso que devuelve («3 de los 50 avisos no salieron. Está
registrado.») le cuenta a la coordinación un problema que no puede resolver.

**Qué haría.** Sacar el envío masivo del camino de la acción: dejar los avisos pendientes para el
cron del módulo (`/api/cron/solicitudes`, que ya tiene `maxDuration = 300`) o, como mínimo para
esta etapa, agregar un botón de «reenviar los avisos que no salieron» que lea `SentEmailLog` y
sólo reintente los que fallaron. Un timeout por envío en `sendTransactionalEmail` (`AbortSignal`)
evita además que una sola llamada colgada se lleve puesto todo el lote.

---

### 2. Serio — Dos coordinadores pueden llenar la misma vacante dos veces

**Archivo:** `app/(shell)/coberturas/c/[coverageId]/actions.ts:402-413`
(`contarAsignadasVivas`), usada en `:481` y `:625`.

**Cómo se rompe.** Un rol de 1 vacante con dos personas anotadas. Dos coordinadores tienen la
pantalla abierta y aprietan «Sumar al equipo» sobre postulantes **distintos** en el mismo
instante. Postgres corre las transacciones de Prisma en `READ COMMITTED`: las dos cuentan
`asignadasVivas = 0` antes de que ninguna escriba, las dos pasan `planSeleccionarPostulacion`, y
las dos escriben su `CoverageAssignment`. El índice `@@unique([coverageId, memberId])` no frena
nada porque son dos personas diferentes. Resultado: dos voluntarios reciben el correo «te
invitamos a participar» para un solo lugar, los dos confirman, y a la organización solicitante se
le avisa que el equipo está completo. El plan pedía exactamente lo contrario ("Una vacante no se
puede asignar dos veces"), y el comentario del código reconoce que el recuento "no es una
garantía absoluta".

Es una ventana corta (unos milisegundos de transacción) y está documentada, pero es el caso que
el plan nombró como real y la promesa no se cumple.

**Qué haría.** Tomar el candado sobre la fila del rol como primera sentencia de la transacción,
antes de contar: `await tx.$executeRaw\`SELECT id FROM "CoverageRole" WHERE id = ${roleId} FOR
UPDATE\``. Serializa a los dos coordinadores sobre ese rol y el segundo ve el recuento ya
actualizado, que es justo lo que `ROL_YA_LLENO` quiere decir. No necesita migración ni cambia
ninguna función pura.

---

### 3. Menor — A quien avisa que no puede, el portal le sigue diciendo «Seleccionada»

**Archivos:** `app/actions/coverage-portal.ts:264` (el `updateMany` toca sólo la asignación),
`lib/coverages/repository.ts:472` (`listMyApplications` trae todos los estados),
`app/portal/coberturas/page.tsx:157`.

**Cómo se rompe.** Ana se anota, la coordinación la selecciona (su `CoverageApplication` pasa a
`SELECCIONADA` y nace la asignación `INVITADA`), y Ana entra y aprieta «Esta vez no puedo». La
asignación queda `RECHAZADA` y el lugar se libera bien, pero **su postulación sigue en
`SELECCIONADA`**. En «Tus postulaciones» ella lee para siempre "Seleccionada", que es lo
contrario de lo que hizo. Tampoco la alcanza el cierre automático del final: cuando el equipo
queda confirmado, `postulacionesQueSeCierran` sólo toca las que están en estados vivos, y
`SELECCIONADA` no lo es.

**Qué haría.** En la misma transacción de la respuesta, cuando el nuevo estado es `RECHAZADA` y
la asignación vino con `origin: "POSTULACION"`, mover su postulación a `RETIRADA` —es la palabra
exacta: la decisión fue de ella— con su evento de historial. La transición
`SELECCIONADA → RETIRADA` hoy no existe en `TRANSICIONES_POSTULACION` y habría que agregarla a la
tabla con su test.

---

### 4. Menor — Un error cualquiera se traduce a un mensaje que afirma algo falso

**Archivos:** `app/actions/coverage-portal.ts:142-148`;
`app/(shell)/coberturas/c/[coverageId]/actions.ts:556-562` y `:685-688`.

**Cómo se rompe.** Los tres `catch` son ciegos: atrapan cualquier error y devuelven siempre el
mismo texto. Si la base se cae un segundo mientras Juan aprieta «Quiero participar», Juan lee
«Ya te anotaste.» y se queda tranquilo, pero no hay ninguna fila: su postulación no existe y
nadie lo va a llamar. En el panel pasa lo simétrico: cualquier fallo al seleccionar a alguien le
dice a la coordinación «Esa persona ya está en el equipo de esta cobertura», que es información
falsa sobre el estado del equipo.

**Qué haría.** Distinguir el choque de índice único del resto: `if (error instanceof
Prisma.PrismaClientKnownRequestError && error.code === "P2002")` devuelve el mensaje amable; lo
demás se registra con `console.error` y devuelve "No pudimos guardarlo. Probá de nuevo."

---

### 5. Menor — El briefing privado se sigue viendo después de rechazar

**Archivos:** `app/portal/coberturas/asignacion/[id]/page.tsx:83`;
`lib/coverages/repository.ts:365` (`loadMyAssignment`, que lo trae sin mirar el estado).

**Cómo se rompe.** Ana dice «esta vez no puedo». Dos semanas después vuelve a abrir el enlace que
le llegó por WhatsApp: la pantalla le dice "Ya respondiste esta invitación", pero abajo sigue
mostrando el bloque «Para el día de la actividad» con el teléfono de emergencia y el contacto del
lugar —datos de terceros que el propio módulo define como "lo ve solamente quien está en el
equipo"—. Lo mismo para una asignación `CANCELADA` o `REEMPLAZADA` por la coordinación.

**Qué haría.** Condicionar ese bloque a que la asignación esté viva:
`ASSIGNMENT_LIVE_STATUSES.includes(asignacion.status)`. Es una línea en la pantalla; no hace
falta tocar la consulta.

---

## Observaciones (no son hallazgos)

- **La barrera de aislamiento ya no cubre la mayor parte del módulo.**
  `lib/coverages/aislamiento.test.ts` lee únicamente `repository.ts`, y esta rama sumó unas 20
  consultas nuevas fuera de ese archivo (`c/[coverageId]/actions.ts`, `coverage-portal.ts`,
  `equipo-server.ts`). **Las revisé una por una y todas filtran bien** —por `workspaceId` directo
  o por una relación ya verificada—, pero el día que alguien agregue una que no filtre, el test
  sigue en verde. Extender el barrido a esos tres archivos es barato y conserva la promesa del
  plan.
- **"Un correo por persona, nunca en copia" está probado en la función pura, no en el envío.**
  `destinatariosDeColaboradores` tiene cinco tests excelentes, pero el bucle de
  `avisarConvocatoriaPublicada` —donde de verdad se decide el campo «para»— no tiene barrera. Un
  `destinatarios.join(", ")` futuro pasaría todos los tests. El proyecto ya tiene el patrón para
  esto (`emails.test.ts` verifica la ausencia de `privateBriefing` leyendo el fuente).
- **Que alguien rechace no le avisa a nadie.** Confirmar manda correo a la coordinación;
  rechazar, no. El estado se corrige solo (la convocatoria vuelve a `PUBLICADA`), pero la
  coordinación se entera únicamente si abre el panel. Los cuatro correos del plan son los que
  están, así que es alcance, no error — pero es el único punto donde "un rechazo deja la
  cobertura sin equipo y nadie se entera" sigue siendo cierto en la práctica.
- **Callejones sin salida que la 1c va a tener que mirar:** una cobertura en `SIN_EQUIPO` acepta
  invitaciones (`puedeArmarseElEquipo` la incluye) pero nunca puede llegar a `EQUIPO_CONFIRMADO`
  desde ahí, porque esa transición no existe; hoy no se alcanza porque `SIN_EQUIPO` sólo lo
  produce el cron de vencimiento, que es 1c. Y una convocatoria que se llena entera por
  invitación directa mientras está en `BORRADOR` se queda en borrador para siempre: ya no es
  publicable, porque `puedePublicarse` exige un rol con lugar libre.
- **Campos que nadie escribe.** `CoverageAssignment.respondBy` nunca se completa, así que el
  renglón "Nos vendría bien tu respuesta antes del…" del correo y el "Avisanos antes de" de la
  pantalla no aparecen nunca. `CoverageRole.status` (`ABIERTO | COMPLETO | CERRADO`) queda en
  `ABIERTO` aunque el rol se llene; nadie lo lee, así que hoy no miente a nadie, pero es una
  fuente de verdad duplicada esperando a que alguien la consulte.
- **Una convocatoria en `BORRADOR` se puede abrir por URL.** `loadCallForPortal` no filtra por
  estado: un colaborador activo que conozca el id (un cuid) ve el borrador completo, dirección
  incluida. No se puede postular (`puedePostularse` lo frena) y el id no se filtra por ninguna
  pantalla, así que no es una vía de fuga real; lo anoto porque el filtrado por `visibility` ya
  quedó para la 1c y este conviene resolverlo junto con aquel.
- **Calidad de los tests: muy buena.** No encontré ninguno que no pueda fallar ni ninguno que
  verifique un mock en vez de la conducta. `criterios-1b.test.ts` recorre el circuito entero con
  los datos del caso de demostración y fija las dos direcciones de la distinción central;
  `equipo.test.ts` cubre los bordes que importan (una cobertura sin roles, un estado inventado,
  la convocatoria en borrador que no se publica de costado). Lo que falta de cobertura es lo de
  siempre en este proyecto: lo que vive en las Server Actions, que es donde están los hallazgos 1
  a 4.
