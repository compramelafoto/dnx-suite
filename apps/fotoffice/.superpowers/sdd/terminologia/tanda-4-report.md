# Terminología por workspace — tanda 4: la pantalla y los mensajes

## Estado

**Terminado y en verde**, con dos salvedades conocidas y ajenas (abajo). La función ya se puede
usar sin tocar la base: cambiar "socio" por "voluntario/a" es ahora un formulario, no una fila
escrita a mano en Postgres.

Lo que **no** se hizo, porque no era de esta tanda: no se tocó ninguna base ni ninguna
migración, no se tocó `lib/coverages/terminology.ts`, no se resolvió el género y no se creó
ningún subagente.

---

## 1. La pantalla donde cada institución elige sus palabras

`/workspace/configuracion/palabras`, al lado de Cobros e Integraciones y con su enlace desde
`app/workspace/configuracion/page.tsx` (una tarjeta que además dice la palabra que rige hoy:
"Hoy a la gente de tu padrón le decís socios").

**Archivos nuevos**

| Archivo | Qué es |
| --- | --- |
| `lib/vocabulario/validacion.ts` | Las reglas, puras. `validarPalabras()` devuelve qué guardar, o `null` para borrar la fila. |
| `lib/vocabulario/validacion.test.ts` | 14 casos. |
| `lib/vocabulario/ejemplos.ts` | `frasesDeEjemplo()`: las frases de la vista previa, **sacadas del catálogo de módulos**, no copiadas. |
| `lib/vocabulario/ejemplos.test.ts` | 5 casos; uno falla si alguien le saca los marcadores a la descripción del módulo. |
| `app/workspace/configuracion/palabras/page.tsx` | La pantalla (servidor). |
| `app/workspace/configuracion/palabras/actions.ts` | `updatePersonWordsAction`. |
| `app/workspace/configuracion/palabras/palabras-form.tsx` | El formulario con la vista previa (cliente). |

**Las decisiones que no eran obvias**

- **Acceso**: `canManageWorkspaceSettings`, el mismo de las subpantallas vecinas. Quien no
  puede editar ve los valores en un `fieldset disabled`, sin botón de guardar, y el aviso de
  solo lectura. La server action **revalida el permiso** por su cuenta: es alcanzable por POST
  directo, así que deshabilitar campos en pantalla no controla nada.
- **Vaciar los dos campos borra la fila** (`deleteMany`, no `delete`: borrar lo que nunca
  existió tiene que ser válido). Nunca se guarda una fila con cadenas vacías, que
  `personVocabulary` tomaría como configurada y dejaría las pantallas sin la palabra.
- **O las dos o ninguna.** Si se escribe una sola, el formulario la devuelve con el mensaje de
  cómo volver atrás. `personVocabulary` tolera que falte una —es su red de seguridad— pero
  como respuesta de un formulario "voluntario/a" + "socios" es un olvido, no una decisión.
- **Las llaves están prohibidas** en la palabra: el texto del sistema lleva marcadores
  `{personas}` y una palabra con llaves los reinyectaría en el texto ya sustituido.
- **Se leen las palabras crudas de la tabla**, no `loadPersonVocabulary`: el formulario
  necesita distinguir "no configuró nada" de "configuró justo la palabra por omisión". Con el
  cargador, los campos aparecerían llenos con socio/socios para todo el mundo y guardar
  crearía una fila que nadie pidió.
- **La vista previa usa las mismas funciones que las pantallas de verdad**
  (`personVocabulary` + `aplicarVocabulario`) sobre los textos reales del catálogo: quien
  escribe "voluntario" lee "Todos los voluntarios, su estado y su ficha" antes de guardar. Los
  campos son controlados —a diferencia del resto de la configuración, que usa
  `defaultValue`— justamente por eso.
- **Dice qué NO cambia**, en una tarjeta junto a la vista previa: los textos legales, los
  correos ya enviados, el nombre del módulo en la lista general de FotoOffice y lo que alguien
  escribió a mano. Y arriba, el aviso de que cambiar la palabra no reescribe lo ya escrito.
- `revalidatePath("/", "layout")` después de guardar: la palabra se lee en el menú lateral, en
  el inicio, en todo el módulo y en el portal. Revalidar solo esta pantalla dejaría el menú
  diciendo la palabra vieja.

---

## 2. Los mensajes de las acciones y las libs

### La pieza nueva: `lib/members/mensajes.ts`

Los mensajes del padrón que nombran a la gente, en un solo lugar, con marcadores. Además de la
palabra, esto arregla una duplicación real: `friendlyLinkError` existía **palabra por palabra**
en `app/actions/member-access.ts` y en `lib/members/invite-member.ts`.

`lib/members/mensajes.test.ts` verifica dos cosas: que con el vocabulario por omisión cada
mensaje diga **exactamente** lo que decía antes (la SFPR no nota nada), y que con "voluntario/a"
ninguno diga "socio" ni quede con un marcador sin resolver.

### Dos patrones, y cuándo va cada uno

1. **Función que ya conoce el workspace** (acciones, repositorios, cargadores):
   pide `loadPersonVocabulary(workspaceId)` y arma el mensaje ahí.
2. **Función pura o catálogo global** (no sabe ni puede saber en qué institución está):
   **devuelve el texto con los marcadores sin resolver**, y quien lo muestra —que sí sabe— lo
   pasa por `aplicarVocabulario`. Es el patrón que ya usaba `lib/modules/registry.ts`.

El segundo evita el error de arrastrar un `PersonVocabulary` hasta funciones que no lo
necesitan: `selectEntrants`, por ejemplo, arma el padrón de un sorteo y no tiene por qué saber
cómo se llama la gente.

### Qué quedó vocabularizado

**Padrón y acceso** — `app/actions/members.ts`, `app/actions/member-access.ts`,
`lib/members/invite-member.ts`, `lib/members/schema.ts` (`friendlyMemberError` ahora pide
`vocabulary`, obligatorio y sin valor por omisión), `app/actions/accept-invitation.ts` (la
institución sale de la ficha invitada: quien acepta todavía no pertenece a ningún workspace),
`app/actions/membership-applications.ts` ("Socio N° 735 creado…"),
`lib/members/audit-labels.ts` ("Número de socio" en el historial de la ficha).

**Importaciones** — `app/actions/members-import.ts` + `lib/members/import/parse.ts`, y
`app/actions/payments-import.ts` + `lib/membership/history-import/parse.ts`. En los dos casos
el vocabulario viaja con el resto de los datos del workspace (`lookups`), así que los dos pasos
—validar y confirmar— hablan con la misma palabra sin que cada uno tenga que acordarse.

**Cobros** — `app/actions/manual-payment.ts`, `lib/membership/manual-payment.ts`,
`lib/payments/connect/messages.ts` (resuelto en `/workspace/configuracion/cobros`, cuya
descripción también decía "cuotas de tus socios").

**Carnet** — `lib/carnet/status.ts` (marcadores) resuelto en `lib/carnet/my-card.ts`,
`lib/carnet/print-order.ts`, `lib/carnet/issue.ts`, `lib/carnet/board-actions.ts` (resuelto en
el tablero de carnets).

**Sorteos** — `lib/raffles/eligibility.ts` (marcadores) resuelto en `lib/raffles/portal.ts`,
que además vocabulariza "No encontramos tu ficha de socio" y "Socio en la posición N";
`lib/raffles/lifecycle.ts` resuelto en `app/(shell)/sorteos/actions.ts`.

**Reservas** — `lib/bookings/create.ts`, `lib/bookings/space-form.ts` y
`lib/bookings/extra-form.ts` (marcadores) resueltos en `app/(shell)/reservas/actions.ts`, y
`lib/bookings/calendar/event-content.ts` resuelto en `sync.ts`: el evento que se escribe en el
Google Calendar de la institución decía "Socio N° 100 · …".

**Portal** — `lib/portal/menu.ts` resuelto en `components/portal/portal-sections.tsx` (la
descripción de "Mi carnet"), `lib/portal/dues-help.ts` (el mensaje de WhatsApp que el propio
socio manda a Secretaría: "Hola, soy el socio N° 623…").

**Catálogos globales** — se les pusieron marcadores a
`lib/modules/registry.ts` (reservas, comunicaciones, clientes),
`lib/modules/submodules.ts` (sorteos) y `lib/integrations/registry.ts` (Google Contacts). De
paso, `app/workspace/configuracion/integraciones/page.tsx` **no resolvía** los marcadores de
las etiquetas de módulo: hoy no se nota porque la única integración que declara el módulo del
padrón está en `PLANNED`, pero el día que se habilite iba a mostrar literalmente
`{Personas}`. Queda resuelto.

---

## Qué NO se pudo vocabularizar, y por qué

### a) No hay workspace en ese punto del código — imposible, no pendiente

`loadPortalContext(userId)` devuelve `null` cuando la persona **no tiene ninguna ficha de
padrón**. Sin ficha no hay workspace, y sin workspace no hay palabra que consultar. El mensaje
"No encontramos tu ficha de socio." sale justo en ese caso:

- `app/actions/dues-payment.ts:37`
- `app/actions/advance-dues.ts:29`
- `app/actions/request-printed-card.ts:28`
- `app/actions/coverage-portal.ts:62` y `:215`
- `lib/portal/professional-profile.ts:35` y `:42` (busca la ficha por `userId`; si no hay
  ficha, tampoco hay workspace)
- `lib/membership/advance-store.ts:115` y `lib/membership/recommendation-store.ts:77` (lo
  mismo, buscando por `memberId`)
- `lib/portal/claim.ts:75` ("Esa ficha de socio ya no está disponible para vincular"): el
  candidato es `null`, así que no hay ficha de donde sacar el workspace.

Si esto llegara a importar, la salida no es forzarlo: es que `loadPortalContext` devuelva a qué
institución pertenece la sesión aunque no encuentre ficha activa, y eso es otro trabajo.

### b) Textos que la consigna dejó afuera a propósito

- **Correos** (`lib/members/invitation-email.ts`, `lib/membership/application-emails.ts`,
  `lib/carnet/notice.ts`, `lib/membership/recommendation-emails.ts`): son otra superficie, con
  su propio diseño, y la pantalla que hicimos promete que los correos ya enviados no cambian.
- **Textos legales** (`lib/legal/content.ts`) y **landings** (`lib/landing/*`): la landing
  además es pública y no tiene workspace.
- **El panel de super admin** (`app/actions/super-admin.ts:75`, "3 socio(s) registrado(s)" y
  `app/(shell)/admin/workspaces/*`): dice "Socios" a propósito, como ya estaba decidido en las
  tandas anteriores con `personVocabulary(null)`.

### c) Se puede, pero cuesta más de lo que rinde (y lo digo, no lo escondo)

- **`lib/members/schema.ts:13`** — `z.string().min(1, "Número de socio obligatorio")`. El
  schema es una constante de módulo: vocabularizarlo exige convertirlo en una fábrica
  (`memberSchemaFor(vocabulary)`) y tocar todos sus usos. Es el único mensaje de validación de
  campo que quedó con la palabra escrita.
- **`lib/carnet/template.ts` y `template-store.ts`** — el diseño del carnet ("Socio N°
  {{memberNumber}}", "Carnet de socio"). Es una plantilla que se **escribe una vez en la base**
  y después la institución edita a mano en el Diseñador. Cambiarle la palabra al código no
  cambiaría las plantillas ya creadas, y sí pisaría lo que alguien haya editado.
- **Textos que hoy no se muestran en ninguna parte**: las descripciones de columnas de
  `lib/members/import/columns.ts` y `lib/membership/history-import/columns.ts` (las pantallas
  solo importan el encabezado), `IMAGE_PRESETS.memberAvatar.label` ("Foto de socio", nadie lo
  renderiza) y `describeQuote` en `lib/bookings/pricing.ts` ("bonificadas por ser socio", sin
  ningún llamador fuera de sus tests). Marcarlos ahora sería dejar marcadores que nadie
  resuelve.
- **Valores internos que nunca llegan a una pantalla**: los `reason` de
  `lib/membership/recommendation.ts` y `lib/membership/monthly-plan.ts` (diagnósticos que el
  llamador descarta), el `throw` de `lib/membership/repository.ts:148` y los `actorLabel` de
  auditoría ("El propio socio", "El socio pidió la tarjeta"), que son **registro histórico
  escrito**: cambiarlos solo afectaría a los asientos nuevos y dejaría el historial hablando
  dos idiomas.
- **Los prompts de importación asistida** (`lib/members/import/prompt.ts`,
  `lib/membership/history-import/prompt.ts`): texto que se copia y se le pega a un modelo, no
  interfaz.

---

## Los cuatro comandos

```
pnpm test        1 fallo | 2920 pasan   (el fallo es lib/template-v2/access.test.ts, ajeno, viene de main)
npx tsc --noEmit limpio
pnpm lint        3 errores | 7 warnings (los 3 errores son hero-block-view.tsx y mass-grading-screen.tsx, ajenos)
pnpm build       Compiled successfully → se queda sin heap DESPUÉS de compilar
```

**Sobre el build**: con la memoria por omisión de Node termina en
`FATAL ERROR: Ineffective mark-compacts near heap limit`, ya con el "Compiled successfully"
impreso. Lo probé también **sin los cambios de la tanda 2** (guardando el árbol de trabajo) y
falla igual, así que no lo trae este trabajo. Con
`NODE_OPTIONS="--max-old-space-size=8192" pnpm build` **termina en verde**, y
`/workspace/configuracion/palabras` aparece en la lista de rutas.

---

## Dudas para vos

1. **El género.** "{Persona} no encontrado" con la palabra "voluntaria" queda mal concordado, y
   la deuda ya estaba documentada. Con la pantalla en la mano, la salida barata podría ser una
   casilla "palabra femenina" en vez de un género completo. ¿Lo armamos en la próxima tanda?
2. **Coberturas y el padrón no se pisan, pero se rozan.** `/coberturas/configuracion` nombra
   las cosas del módulo (solicitud, colaborador, convocatoria) y `/workspace/configuracion/palabras`
   nombra a la gente del padrón: son dos ejes y conviven bien. Lo único que veo es que un dueño
   va a encontrar dos lugares distintos donde "se eligen las palabras". ¿Le ponemos un enlace
   cruzado a cada una?
3. **La migración sigue sin aplicarse en ninguna base.** La pantalla lee y escribe
   `WorkspaceVocabulary`: hasta que la migración `20260915150000_vocabulario_por_workspace`
   esté aplicada, abrirla va a dar error de tabla inexistente. Queda de tu lado, como acordamos.
4. **`explainDisabled` y `isEligible` ahora devuelven marcadores.** Si mañana alguien muestra
   esos textos desde otra pantalla y se olvida de `aplicarVocabulario`, va a ver `{persona}` en
   crudo. Se nota a la primera mirada (por eso se eligió así), pero si preferís una red más
   dura, el paso siguiente sería un tipo `TextoConMarcadores` que no sea asignable a `string`.
