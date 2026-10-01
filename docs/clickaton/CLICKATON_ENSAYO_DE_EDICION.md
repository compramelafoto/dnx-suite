# Ensayo de edición (Clickatón)

Herramienta de administración, dentro de cada edición, para responder dos preguntas
antes de que llegue el día del evento:

1. **¿Está todo configurado?** — un chequeo instantáneo del estado real de la edición.
2. **¿Funciona todo de punta a punta?** — un ensayo del recorrido completo de un
   participante, con un reloj que se puede mover a cualquier fecha y hora.

Fecha de diseño: 2026-09-19.

---

## 1. Problema que resuelve

Hoy, saber si una edición está lista exige recorrer ocho pantallas distintas del panel
y acordarse de todos los detalles que alguna vez rompieron una maratón. Los casos
reales que motivaron esta herramienta:

- Consignas cargadas pero en estado `DRAFT`: el cronograma nunca las libera, y no hay
  ningún aviso. Pasó a un día del evento.
- Extender la inscripción tocando una sola fecha (la ventana) y olvidando la otra (la
  fase de precio): la inscripción se rompe sola.
- La subida de fotos apagada mientras las consignas ya estaban liberadas.
- Horas cargadas en el panel que quedaron guardadas en UTC y aparecieron tres horas
  adelantadas.

Ninguno de esos problemas se ve mirando una pantalla. Todos se ven recorriendo el
camino del participante. Eso es lo que esta herramienta automatiza.

## 2. Alcance

**Entra:**

- Una pestaña nueva por edición, en `/admin/ediciones/[editionId]/ensayo`.
- Un chequeo de configuración que no escribe nada.
- Un ensayo del recorrido del participante en dos modos: en seco y completo.
- Un reloj simulado que sólo existe dentro de la simulación.

**No entra:**

- Cambiar el comportamiento de producción. El único cambio de fondo es reemplazar
  `new Date()` por un reloj inyectable cuyo valor por defecto es la hora real.
- Nuevas columnas en la base. El schema Prisma es compartido por cinco bases Neon y
  cada campo nuevo hay que aplicarlo a mano en las cinco.
- Cobros reales, correos reales, ni notificaciones a terceros.
- Probar la experiencia del jurado, la tienda o el ranking. Sólo el recorrido del
  participante, desde que se quiere inscribir hasta que su foto queda admitida.

## 3. Decisiones tomadas

| Decisión | Elegido | Por qué |
|---|---|---|
| Fidelidad | Chequeo + ensayo en seco + ensayo completo | El chequeo y el seco se pueden correr el día del evento; el completo da certeza total cuando hace falta. |
| Alcance del reloj | Sólo la simulación | Imposible que un reloj falso se filtre a un participante real. |
| Servicios externos | Pago con adaptador de prueba; correos generados pero no enviados | No mueve dinero ni le llega nada a nadie. |
| Dónde escribe el ensayo completo | Sobre una **copia descartable** de la edición | La edición real nunca recibe un dato ficticio, ni por un segundo. |

### 3.1 Enfoque descartado

Automatizar un navegador con Playwright. Se descarta porque no se puede lanzar desde
el panel con un botón, no permite mover el reloj del servidor, y tarda minutos en vez
de segundos. El repositorio ya tiene suites Playwright para otras cosas; ésta es una
herramienta operativa, no una suite de integración continua.

## 4. Arquitectura

### 4.1 El principio: no reimplementar nada

El simulador **no** tiene su propia versión de las reglas. Llama a las mismas
funciones que usa el sitio público, inyectándoles el reloj:

| Paso del recorrido | Función real que se invoca |
|---|---|
| Ve la página de la edición | `presentRegistrationCta` (`lib/registration-cta.ts`) |
| Se inscribe | `createPublicRegistrationService(...).createRegistration` (`lib/public-registration/application/public-registration-service.ts`) |
| Paga | adaptador de prueba de `@repo/payments` + `confirmFreeRegistration` según corresponda |
| Recibe el correo | `sendParticipantFunnelEmail` con `dryRunBuildOnly: true` (`lib/registration/notifications/participant-email.ts`) |
| Recibe credencial | `buildCredentialPreviewVariables` (`lib/accreditation/credential-preview.ts`) + `resolveActiveQrPlaintext` (`lib/registration/application/confirm-free-registration.ts`) |
| Se acredita | `evaluateAccreditationEligibility` (`lib/accreditation/eligibility.ts`) |
| Entra a "en vivo" | `loadParticipantLiveState` (`lib/participant-live/service.ts`) |
| Se abren las consignas | `resolvePromptGate` (`lib/timeline/prompt-gate.ts`) |
| Sube una foto | `requestPromptUpload` + `processPromptUpload` + `confirmPromptSubmission` (`lib/photo-upload/service.ts`) |
| Admisión técnica | `evaluateSubmission` (`lib/technical-admission/service.ts`) |

Si una regla está mal, el ensayo falla igual que fallaría el participante. Ése es todo
el valor de la herramienta: si el ensayo pasa por otro camino que el usuario real, no
prueba nada.

### 4.2 El reloj

`lib/timeline/clock.ts` ya define `EditionClock` con `systemClock()`, `fixedClock()` y
`mutableClock()`, y ya lo usan el cronograma, las consignas, la ventana de subida, la
admisión técnica y la pantalla del participante en vivo.

Falta llevarlo a la inscripción. Hoy `public-registration-service.ts` resuelve la fase
de precio y las expiraciones con `new Date()` escrito a mano. La buena noticia es que
ese servicio ya es una fábrica con dependencias inyectables
(`createPublicRegistrationService({ repo, rateLimit, confirmFree, promotions })`, con
un comentario que dice literalmente *"omit in in-memory selfchecks"*): alcanza con
sumar `clock?: EditionClock` a esas dependencias, con `systemClock()` por defecto — en
producción no cambia nada.

Lo mismo vale para el correo: `sendParticipantFunnelEmail` ya acepta
`dryRunBuildOnly: true`, que arma asunto y cuerpo sin enviar nada. No hay que escribir
un simulador de correo.

**El reloj nunca cruza la frontera del servidor.** No hay cookie, ni cabecera, ni
parámetro de URL que lo propague. Vive dentro de la llamada de la simulación y muere
con ella.

### 4.3 La copia descartable

Para el ensayo completo, la herramienta crea una edición espejo:

- `isOpsFixture: true` — el schema ya documenta este flag como *"Edición ops/fixture:
  nunca comercial. Cleanup solo permitido si true"*, y ya la excluye del home, del
  carousel y de la oferta de packs.
- `isPublished: false`, slug derivado (`<slug>-ensayo-<marca de tiempo>`).
- Se copian sólo las partes que el recorrido necesita: fases de precio, tipos de
  entrada, cronograma y sus eventos, consignas, configuración de subida, de
  acreditación y de admisión técnica, y la secuencia de códigos visibles.
- No se copian sedes con datos de terceros, sponsors, banners ni contenidos.

Al terminar, se borra la copia entera y todo lo que cuelga de ella. El borrado
**verifica `isOpsFixture === true` antes de tocar nada**; si el flag no está, se
aborta sin borrar.

### 4.4 Módulos nuevos

```
lib/edition-rehearsal/
  domain/
    checks.ts          reglas puras del chequeo (sin Prisma, testeables con reloj fijo)
    types.ts           Hallazgo, Resultado, Paso, Severidad
    timeline-presets.ts atajos del reloj ("inicio de la maratón", "cierre de captura"…)
  application/
    run-edition-check.ts      lee la edición real, aplica checks.ts, devuelve hallazgos
    run-dry-rehearsal.ts      recorrido en seco, repositorios en memoria
    run-full-rehearsal.ts     recorrido completo sobre la copia descartable
    clone-edition.ts          crea la copia
    discard-edition.ts        borra la copia (con el guardián de isOpsFixture)
  ui/
    rehearsal-presentation.ts textos en castellano por hallazgo y por paso
```

Cada archivo tiene un propósito único: las reglas puras no saben de Prisma, la capa de
aplicación no arma textos, la capa de presentación no consulta la base.

## 5. El chequeo de configuración

Un botón "Revisar todo". Instantáneo, sin escrituras. Cada control devuelve
`TODO BIEN` / `ATENCIÓN` / `BLOQUEANTE`, una explicación en castellano y un enlace a la
pantalla donde se arregla.

| Rubro | Controles |
|---|---|
| Publicación | Edición publicada; enlace público resuelve; inscripción habilitada (`registrationEnabled`) |
| Venta | Ventana de inscripción abierta; **fase de precio vigente coherente con la ventana**; cupos disponibles; Mercado Pago conectado y en el ambiente correcto |
| Cronograma | Hay cronograma activo; inicio anterior al fin; portón de consignas resuelto, indicando de qué fecha sale |
| Consignas | Cuántas hay; **cuántas quedaron en `DRAFT`**; ventanas de captura y subida cargadas; captura no posterior al cierre de subida |
| Acreditación | Módulo habilitado; ventana configurada; credenciales emitidas para las inscripciones confirmadas |
| Subida | Configuración creada; bucket R2 alcanzable; límites de tamaño y cantidad |
| Correos | Dominio remitente verificado; cola sin errores recientes |
| Admisión técnica | Configuración creada; tolerancias razonables |

Los dos controles en negrita son los que corresponden a roturas ya vividas y se
reportan con texto explícito sobre la consecuencia, no sólo con un estado.

## 6. El ensayo del participante

### 6.0 Dos modos, porque un instante no alcanza

Durante la implementación quedó claro que **en un único instante es imposible que los
diez pasos den verde**: cuando la inscripción está abierta todavía no hay consignas, y
cuando hay consignas la inscripción ya cerró. Un participante real atraviesa varios
momentos. Por eso el ensayo tiene dos modos:

- **Recorrido** (por defecto): cada paso se evalúa en el momento en que de verdad
  ocurriría —la venta cerca del cierre de inscripción, la acreditación antes del inicio,
  las consignas al minuto de abrir, la subida en plena captura—. Responde *¿funciona
  todo el recorrido?*.
- **Instante**: todos los pasos se evalúan en el momento elegido. Responde *¿qué le pasa
  a alguien que entra a esta hora?*. Acá no hay corte en cascada: quien ya se inscribió
  hace semanas se acredita y sube fotos igual aunque la inscripción esté cerrada.

### 6.1 El reloj

Un selector de fecha y hora que arranca en la hora actual de la zona de la edición, con
atajos calculados a partir del cronograma real:

`tres días antes` · `apertura de inscripción` · `un minuto antes del cierre de inscripción` ·
`inicio de la maratón` · `minuto de liberación de consignas` · `mitad de la captura` ·
`cierre de captura` · `entre el cierre de captura y el de subida` · `cierre de subida` ·
`después de todo`

### 6.2 Los pasos

| # | Paso | Qué demuestra |
|---|---|---|
| 1 | Mira la página pública | El botón dice lo correcto para esa hora |
| 2 | Se inscribe | Validaciones, precio vigente, cupo |
| 3 | Paga | La inscripción queda confirmada |
| 4 | Recibe el correo de confirmación | El correo se arma bien (se muestra, no se envía) |
| 5 | Recibe la credencial con QR | Se emite y el código es legible |
| 6 | Se acredita | Elegibilidad y registro de entrada |
| 7 | Entra a "en vivo" | Cuenta regresiva o consignas, según la hora |
| 8 | Se abren las consignas | Ve las N consignas, todas juntas |
| 9 | Sube una foto | Intento, EXIF, ventana de captura, confirmación |
| 10 | Admisión técnica evalúa | Aprobada, con reparo o rechazada |

Cada paso muestra: resultado, lo que vería la persona en pantalla, y —si falla— qué hay
que cambiar y dónde.

### 6.3 Modo en seco

Por defecto. Repositorios en memoria
(`in-memory-public-registration-repository.ts`, `lib/registration/domain/in-memory.ts`)
y una foto de prueba con EXIF sintético. Cero escrituras, cero red. Seguro de correr
durante el evento.

Lo que **no** demuestra: que la base, R2 y el correo funcionen. Sólo que las reglas y la
configuración están bien.

### 6.4 Modo completo

Pide escribir el nombre de la edición para confirmar. Crea la copia descartable, corre
los diez pasos escribiendo de verdad (inscripción en la base, foto real subida a R2,
credencial emitida, check-in registrado), y al terminar borra la copia entera.

Muestra un resumen de qué creó y qué borró. Si el borrado falla, lo dice fuerte y deja
el identificador de la copia a la vista para borrarla a mano.

### 6.5 Tres cosas que el ensayo completo no prueba, a propósito

1. **El cobro.** En la copia las entradas valen cero, así que el recorrido no pasa por
   Mercado Pago ni mueve un peso. Que el precio y la fase vigente estén bien lo
   verifican el chequeo y el ensayo en seco, que sí miran el importe.
2. **La subida del archivo a R2.** El ensayo no sube una foto real al depósito: dejaría
   basura fuera de la base, donde el borrado de la copia no llega. Las reglas de la
   ventana de subida y de la admisión técnica sí se ejercitan.
3. **El envío del correo.** Se arma con `dryRunBuildOnly` y se muestra, pero no sale.

### 6.6 Un hallazgo del camino: mirar no puede modificar

Al implementarlo apareció que armar el contexto público de inscripción llamaba a
`ensureMarathonPackTicket`, que **crea o actualiza la entrada Pack 4 en la base**. Un
ensayo «en seco» sobre una edición real la habría modificado. Ese paso pasó a ser
inyectable (`ensurePackTicket` en las dependencias del servicio, con el comportamiento
de siempre por defecto) y el ensayo lo desactiva.

## 7. Seguridad

- `requireClickatonAdmin` en la página y en cada acción del servidor.
- El reloj simulado no se propaga fuera de la llamada.
- El borrado exige `isOpsFixture === true`; sin ese flag no toca nada.
- El correo del participante ficticio usa un dominio reservado
  (`ensayo+<edicion>@clickaton.test`) que no puede recibir correo real.
- El adaptador de prueba de pagos nunca usa credenciales de producción.

## 8. Errores y casos límite

| Situación | Comportamiento |
|---|---|
| La edición no tiene cronograma | El chequeo lo marca bloqueante; el ensayo se detiene en el paso 7 con una explicación |
| Todas las consignas en `DRAFT` | El paso 8 falla con el texto exacto de la consecuencia |
| R2 no responde (modo completo) | El paso 9 falla; los pasos 1–8 igual se reportan |
| El borrado de la copia falla | Se avisa con el identificador a la vista; nunca se borra la edición real |
| Dos admins corren el ensayo a la vez | Cada uno crea su propia copia, con marca de tiempo en el slug |
| La hora simulada es anterior a la apertura | Es un caso válido: los pasos posteriores se marcan "todavía no corresponde", no "error" |

## 9. Pruebas

Siguiendo la convención del repositorio:

- `lib/edition-rehearsal/domain/checks.test.ts` — cada control con reloj fijo, casos
  bien y mal.
- `lib/edition-rehearsal/domain/timeline-presets.test.ts` — los atajos del reloj sobre
  cronogramas reales y sobre cronogramas incompletos.
- `scripts/edition-rehearsal.selfcheck.ts` — recorrido en seco completo contra una
  edición armada en memoria, en ambos sentidos: una edición sana pasa los diez pasos,
  una edición con las roturas conocidas falla en el paso esperado.

La prueba central es la última: **una edición con consignas en `DRAFT` debe fallar en el
paso 8, y una edición con la fase de precio vencida debe fallar en el paso 2.** Si el
ensayo no detecta las roturas que ya ocurrieron de verdad, no sirve.

## 10. Etapas de implementación

1. **El reloj llega a la inscripción.** `clock?: EditionClock` en el servicio de
   inscripción y en la resolución de fase de precio, con la hora real por defecto.
   Verificación: la suite existente sigue en verde.
2. **El chequeo.** Reglas puras, capa de lectura, pestaña nueva con el botón.
3. **El ensayo en seco.** Reloj movible, los diez pasos, sin escrituras.
4. **El ensayo completo.** Clonado, recorrido con escrituras, borrado con guardián.

Cada etapa se cierra con sus pruebas en verde antes de pasar a la siguiente.
