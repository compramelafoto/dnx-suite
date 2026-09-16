# Tanda 6 — Dos correcciones y la Tarea 9: que alguien se entere

Hasta esta tanda, el circuito entero funcionaba en silencio: la solicitud se aprobaba, la
cobertura se generaba, la convocatoria se publicaba, la gente se anotaba, la coordinación elegía
y cada persona confirmaba — y nadie recibía un solo correo. Además, dos cosas quedaban mal
cerradas de la tanda anterior.

Dos commits:

| Hash | Qué |
|---|---|
| `908e31c6` | Cerrar las postulaciones que quedaron sin respuesta y destrabar el modo directo |
| (este commit) | Los cuatro correos de la etapa |

---

## Parte A — Las postulaciones que nadie cerraba

**El problema.** La coordinación elegía a una persona para un rol y las demás postulaciones
quedaban en `RECIBIDA` para siempre. El portal le seguía diciendo "te anotaste" a alguien tres
meses después de la actividad.

**Qué hace ahora.** Cuando la cobertura llega a `EQUIPO_CONFIRMADO`, en la **misma transacción**,
las postulaciones de esa cobertura que siguen esperando pasan a `NO_SELECCIONADA` con su evento
de historial. **Sin correo**: nadie recibe un "no fuiste elegida".

- Lo puro: `postulacionesQueSeCierran({ equipoQuedoConfirmado, postulaciones })` en
  `lib/coverages/equipo.ts`, con 6 casos de prueba.
- Lo que escribe: `cerrarPostulacionesSinRespuesta` en `lib/coverages/equipo-server.ts`, dentro
  de `aplicarEfectosSobreLaBusqueda` — así lo heredan las cuatro acciones que tocan el equipo sin
  que ninguna se pueda olvidar.
- En el portal: `applicationStatusPortalLabel` (en `states.ts`, con test propio) traduce ese
  estado a **"Esta vez no hizo falta. Gracias por anotarte."**. El panel de coordinación sigue
  leyendo "No seleccionada", que ahí es una etiqueta de gestión y está bien.

**Se cierra al confirmarse el equipo, no al ponerse `COMPLETA` la convocatoria.** `COMPLETA` es
"dejamos de buscar" y puede volver atrás si alguien rechaza; ahí esas postulaciones vuelven a
servir.

**Una decisión chica, que conviene mirar.** El encargo decía "las que sigan en `RECIBIDA`".
Implementé el corte con `canTransitionApplication(estado, "NO_SELECCIONADA")`, que son las
`RECIBIDA` **más** `EN_REVISION` y `PRESELECCIONADA`. Hoy ninguna pantalla pone una postulación
en esos dos estados, así que el comportamiento es idéntico al pedido; el día que exista la
revisión formal, esas postulaciones tampoco van a quedar colgadas. Y de paso es imposible que la
función proponga una transición que la máquina de estados no admita.

---

## Parte B — El modo DIRECTA dejaba coberturas varadas

**El problema.** `efectosSobreLaBusqueda` sólo llevaba `EQUIPO_CONFIRMADO → BUSCANDO_EQUIPO` (la
vuelta). Un workspace que arma el equipo sólo a dedo no publica ninguna convocatoria, así que su
cobertura se quedaba en `PLANIFICADA` aunque todos confirmaran — y desde `PLANIFICADA` no existe
el salto a `EQUIPO_CONFIRMADO`.

**Los dos cambios pedidos, hechos:**

1. Una invitación directa sobre una cobertura `PLANIFICADA` la pasa a `BUSCANDO_EQUIPO` (basta
   con que haya una asignación viva).
2. `puedeCrearseConvocatoria` acepta `PLANIFICADA` **y** `BUSCANDO_EQUIPO`.

Así cada estado conserva un solo significado: `PLANIFICADA` = todavía no se movió nadie;
`BUSCANDO_EQUIPO` = falta gente, por convocatoria o a dedo. Y el caso mixto —invito a la fotógrafa
que sé que puede, publico para conseguir la segunda— ahora funciona.

**Lo que había que atender y no estaba en el encargo.** `planPublicarConvocatoria` exigía la
transición `→ BUSCANDO_EQUIPO`, y una transición hacia el estado en el que ya se está siempre
falla (y con razón: `from === to` no es una transición). Publicar sobre una cobertura que ya
estaba buscando equipo habría quedado bloqueado. La función devuelve ahora
`{ ok: true, moverCobertura: boolean }` y la acción sólo escribe el estado —y su evento de
historial— cuando de verdad hay algo que mover. Sin eso, el historial mostraría un «buscando
equipo → buscando equipo» que nunca ocurrió.

También el panel: `convocatoria-panel.tsx` comparaba contra `"PLANIFICADA"` a mano para decidir
si mostrar el formulario. Ahora llama a `puedeCrearseConvocatoria`, la misma regla que aplica el
servidor.

**Tests ajustados:** el caso "una invitación directa no saca a la cobertura de PLANIFICADA" quedó
invertido, más dos casos nuevos (sin nadie invitado no se mueve sola; desde `PLANIFICADA` se
avanza de a un paso y nunca se saltea a `EQUIPO_CONFIRMADO`). En `convocatoria.test.ts`, el caso
que fijaba el rechazo de `BUSCANDO_EQUIPO` quedó invertido y se sumó el de publicar sin mover.

---

## Parte C — Tarea 9: los cuatro correos

Claves nuevas en `lib/communications/constants.ts` (`COVERAGE_EMAIL_KEYS`), armado puro en
`lib/coverages/emails.ts` con el patrón de la etapa 1a —`compose` pone el saludo, el botón y la
firma— y 32 casos nuevos en `emails.test.ts`.

| Clave | Cuándo | A quién | Firma |
|---|---|---|---|
| `fotoffice.coverages.call-published` | Se publica la convocatoria | A cada colaborador activo, por separado | De la organización |
| `fotoffice.coverages.assignment-invited` | Alguien queda seleccionado o se lo invita | A esa persona | De la organización |
| `fotoffice.coverages.assignment-confirmed` | Alguien confirma | A la coordinación | Sin firma: es interno |
| `fotoffice.coverages.team-complete` | La cobertura llega a `EQUIPO_CONFIRMADO` | A la organización solicitante | De la organización |

### Los cuidados, uno por uno

1. **Uno por persona, nunca en copia.** `destinatariosDeColaboradores` devuelve una lista de
   direcciones sueltas y la acción manda un correo por cada una. Además descarta las filas donde
   alguien escribió dos direcciones en el mismo campo (`Member.email` es texto libre): mandar a
   `"ana@x.com, juan@y.com"` habría metido a los dos en el mismo correo, que es exactamente lo
   que esto evita. Deduplica sin distinguir mayúsculas.
2. **`team-complete` sale al confirmarse el equipo**, no cuando la convocatoria se pone
   `COMPLETA`. Lo decide `aplicarEfectosSobreLaBusqueda`, que ahora **devuelve** lo que cambió;
   la acción mira si fue ESTA respuesta la que lo completó. Sale una sola vez.
3. **La rotación del enlace se decide antes de la transacción.**
   `prepararAvisoDeEquipoCompleto` (en `equipo-server.ts`) lee la solicitud, consulta
   `debeRotarEnlace({ tieneDestinatario, tieneAppUrl })` y genera el token **antes**; la
   transacción sólo lo escribe, y **sólo si** la cobertura llegó a `EQUIPO_CONFIRMADO` ahí
   adentro. Si no hay a quién mandarle o no hay `appUrl()`, no se rota nada: el enlace que la ONG
   ya tiene sigue vivo. Cuesta dos lecturas por confirmación que casi siempre no se usan, y se
   paga igual: saber si esta confirmación completó el equipo recién se sabe dentro de la
   transacción, y ahí ya es tarde para decidir si rotar.
4. **Nada secreto en el asunto.** El nombre de quien confirmó va en el cuerpo: `SentEmailLog`
   guarda asunto y destinatario, y ese registro es para saber si un aviso salió, no para dejar
   anotado quién participa de cada actividad. Hay un test que lo fija.
5. **Todo después de la transacción.** Ningún `sendAndLogEmail` corre adentro de un `$transaction`.
6. **Ningún correo trabado rompe una acción.** `sendAndLogEmail` no lanza. La persona confirma
   aunque Resend esté caído.
7. **El enlace de `assignment-invited` va directo** a `/portal/coberturas/asignacion/{id}`.
8. **El briefing privado no viaja.** El correo dice que entre y que ahí están los detalles del
   día. Lo fija un test sobre el código fuente de `emails.ts` —comentarios aparte— como ya hace
   `aislamiento.test.ts` con el repositorio: una ausencia no se puede probar con un caso normal,
   porque el día que alguien agregue el campo al armado, el test que "no lo encuentra" seguiría
   pasando si nadie se lo pasa.
9. **Textos de voluntariado.** "Te invitamos a participar", "si esta vez no llegás, no pasa nada",
   "ya tenemos el equipo". `call-published` no promete cuántos lugares quedan: ese número cambia
   entre que sale el correo y que la persona lo abre.
10. **`team-complete` no lleva los nombres del equipo.** La organización se entera de que va a
    tener cobertura; quiénes van es asunto del día y del panel de la 1c.

### Dónde se enchufó

| Acción | Correo |
|---|---|
| `publicarConvocatoriaAction` | `call-published`, uno por colaborador |
| `seleccionarPostulacionAction` | `assignment-invited` |
| `invitarDirectoAction` | `assignment-invited` |
| `responderInvitacionAction` (confirmar) | `assignment-confirmed` + `team-complete` si completó el equipo |

**El tercer canal.** `ConvocatoriaState` y `EquipoState` ganaron `warn`, como ya tenía
`PanelState` en la etapa 1a: "quedó publicada, pero 2 de los 12 avisos no salieron", "la
invitación quedó hecha, pero esa persona no tiene correo cargado: avisale vos". Ni verde ni rojo.
A quien confirma desde el portal **no** se le muestra nada: que un correo interno no haya salido
no es asunto suyo, y un renglón rojo la haría dudar de si confirmó.

**Consultas nuevas** en `repository.ts`, las tres con `workspaceId` en su `where`:
`listActiveCollaboratorEmails`, `loadWorkspaceContactEmail`, `loadCoverageParaAvisoDeEquipo`. La
barrera de `aislamiento.test.ts` sigue en verde.

---

## Verificación

| Comando | Resultado |
|---|---|
| `pnpm test` | 2802 pasan, 1 falla: `lib/template-v2/access.test.ts` (**ajena, falla desde `main`**). `lib/coverages`: 361/361 |
| `npx tsc --noEmit -p tsconfig.json` | Limpio |
| `pnpm lint` | 3 errores, los conocidos en `hero-block-view.tsx` (2) y `mass-grading-screen.tsx` (1). Ninguno en lo tocado |
| `pnpm build` | Compila. Los `prisma:error DATABASE_URL` del prerender son los de siempre |

Ninguna base ni migración tocada. Ningún correo real enviado.

---

## Lo que queda abierto

- **Nadie prueba el envío de punta a punta.** Los cuatro correos están probados en su armado y en
  a quién le tocan; que salgan de verdad depende de la configuración de Resend, que es de otra
  tanda.
- **`call-published` respeta la visibilidad de la convocatoria: todavía no.** El modelo tiene
  `visibility` (`TODOS` / `POR_ZONA` / `POR_ESPECIALIDAD`) y `visibilityValues`, pero el aviso
  sale a **todos** los colaboradores activos. Filtrar por zona o especialidad es la misma lógica
  que la recomendación de candidatos, que el plan deja fuera de la 1b.
- **Sin correos configurados no hay aviso de confirmación.** Cae al `contactEmail` del branding y,
  si tampoco hay, se registra un `console.warn` y no sale para nadie — mismo criterio que el
  aviso de solicitud nueva de la etapa 1a.
- **Deuda anotada en tandas anteriores, sin tocar**: reinvitar a quien rechazó y retirar una
  postulación (las dos son el mismo índice único).
- Tarea 10 (`criterios-1b.test.ts`, el recorrido de punta a punta con funciones puras) sigue
  pendiente.
