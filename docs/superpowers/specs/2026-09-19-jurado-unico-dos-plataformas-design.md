# Jurado único para Clickatón y FotoRank — diseño

Fecha: 2026-09-19
Estado: aprobado en conversación, pendiente de plan de implementación

## El problema

Las fotos de una maratón de Clickatón no se pueden evaluar. Hay tres causas
encadenadas, verificadas en producción el 2026-09-19:

1. **Clickatón no tiene panel de evaluación.** El propio código lo declara:
   "Clickatón no hospeda el panel de evaluación: eso vive en FotoRank"
   (`apps/clickaton/lib/jury-results/ui/jury-results-status-presentation.ts`).
2. **Clickatón y FotoRank usan bases distintas.** La base de Clickatón tiene 1
   concurso y 5 obras; la de FotoRank, 7 concursos y 20 obras. Las obras que
   Clickatón crea al subir una foto quedan en su propia base, y el portal del
   jurado de FotoRank lee la otra.
3. **El portal de FotoRank está incompleto.** La pantalla de evaluación muestra
   la foto con `entry.imageUrl`, pero `listEntriesForAssignment` nunca devuelve
   ese campo — lo omite a propósito, por anonimato. Compila porque los datos se
   pasan con `as any[]`. En ejecución el `src` queda vacío: **el jurado no ve la
   foto en ninguna de las dos plataformas**, ni siquiera en un concurso propio
   de FotoRank.

Además, `getPrivateEntryStorage` sólo se usa para escribir
(`apps/clickaton/lib/photo-upload/service.ts:356`). **Nadie lee nunca las fotos
subidas**: no existe ruta ni pantalla que las sirva, así que hoy tampoco la
administración puede verlas antes de admitirlas.

Al 2026-09-19 no hay ningún jurado cargado: 0 cuentas, 0 invitaciones, 0
asignaciones, 0 configuración y 0 rúbricas, en las dos bases.

## Decisiones tomadas

| Decisión | Elegido | Descartado |
|---|---|---|
| Dónde trabaja el jurado | **Un solo portal** para ambas plataformas | Dos portales gemelos; portal servido desde Clickatón |
| Dónde vive el portal | **FotoRank**, vestido con la marca del concurso | FotoRank sin cambios de marca; app nueva de jurados |
| Alcance de la etapa 1 | **Ver y puntuar las obras** | Sumar ranking y resultados; sistema completo |
| Padrón maestro de jurados | **Base de FotoRank** | Base de Clickatón; base nueva dedicada |

La decisión de "un solo portal" reemplaza la idea previa de construir el panel
dentro de Clickatón. Lo que se conserva de aquella idea es lo de fondo: las
obras de Clickatón se evalúan **sin duplicar datos**.

## Arquitectura

### Padrón maestro y ficha espejo

La identidad del jurado vive en **una sola** base, la de FotoRank:
`FotorankJudgeAccount`, `FotorankJudgeProfile`, `FotorankJudgeSession`, y las
tablas de invitación y membresía.

Al asignar un jurado a una maratón de Clickatón se copia una **ficha espejo** a
la base de Clickatón. Es obligatoria, no una comodidad: el voto
(`FotorankJudgeVote`) tiene clave foránea **tanto** a la asignación **como** a la
obra, y la obra vive en Clickatón. Las claves foráneas no cruzan bases, así que
la asignación y todo lo que ella referencia tienen que existir en Clickatón.

La cadena real, verificada en la base el 2026-09-19:

```
FotorankJudgeVote → FotorankJudgeAssignment → FotorankJudgeAccount → Workspace
                  → FotorankContestEntry      → ContestOrganization
                                               → FotorankContest / …Category
                                               → User (createdByUserId)
```

Estado de cada eslabón en la base de Clickatón:

| Eslabón | Estado |
|---|---|
| `FotorankContest` y `…Category` | creados el 2026-09-19 |
| `ContestOrganization` | creada el 2026-09-19 (`ck-org-clickaton`) |
| `User` | existe (usuario 1) |
| `Workspace` | **tabla vacía — hay que crear uno** |
| `FotorankJudgeAccount` | vacía; `passwordHash` y `workspaceId` son obligatorios |

Dos consecuencias que el diseño debe asumir explícitamente:

1. **Hay que crear un `Workspace` en Clickatón** para colgar de él las fichas
   espejo. Uno solo, dedicado a jurados.
2. **`passwordHash` es obligatorio y no puede quedar vacío.** La ficha espejo
   guarda un **centinela imposible**: un valor que ningún algoritmo de hash puede
   producir, de modo que ninguna contraseña valide contra él aunque alguien lo
   intente. No se copia el hash real: duplicar la credencial es justo lo que este
   diseño evita.

**La identidad se valida siempre contra el maestro, nunca contra la copia.** La
ficha espejo no guarda contraseña utilizable ni sesión, así que revocar el acceso
en el maestro lo revoca en todas partes. Una prueba automática debe fallar si
alguna ruta de Clickatón llegara a autenticar contra `FotorankJudgeAccount`
local.

El padrón se mantiene desde ambas plataformas: cada una escribe contra el
maestro a través del cliente compartido, no contra su copia local.

### Conexiones entre bases

Se sigue el patrón que el monorepo ya usa (`packages/db/src/clf-write-client.ts`,
`clickaton-readonly-client.ts`, `partners-publication-targets.ts`): clientes
Prisma dedicados apuntando a otro `DATABASE_URL`, resueltos por variable de
entorno y con información de diagnóstico enmascarada.

Dos clientes nuevos en `packages/db/src`:

- **Cliente del padrón maestro**: para que Clickatón lea y mantenga el padrón
  alojado en la base de FotoRank.
- **Cliente de evaluación hacia Clickatón**: para que FotoRank lea las obras y
  escriba los votos en la base de Clickatón. Necesita escritura, acotada a las
  tablas de evaluación.

### Cómo ve la foto el jurado

Las fotos viven en un bucket R2 privado de Clickatón. La admisión técnica ya
crea un `FotorankContestEntryAsset` de tipo `JURY_PREVIEW` con
`storageProvider: "clickaton_private"` y su `storageKey`
(`apps/clickaton/lib/technical-admission/service.ts:546`), sin datos de
identidad ni GPS. Falta quien sirva ese archivo: FotoRank sólo conoce los
proveedores `r2`, `r2_private` y `local_private`.

Clickatón expone una **ruta de imagen para jurado**. FotoRank no recibe las
llaves del bucket: arma un enlace firmado con vencimiento corto usando un
secreto compartido, y el navegador del jurado pide la imagen directamente a
Clickatón. Clickatón verifica firma, vencimiento y que la obra tenga vista
previa admitida antes de devolver el archivo.

Se gana: las llaves del bucket quedan en una sola aplicación, Clickatón sigue
decidiendo quién ve qué, y un enlace copiado caduca solo.

La misma ruta permite que la pantalla de admisión muestre las fotos.

## Recorrido

**Preparación (administración):**

1. Alta e invitación del jurado en FotoRank. El jurado crea su contraseña. Ya existe.
2. Asignación a la maratón, con categoría y plazo. Aquí ocurre la copia de la ficha espejo.
3. Admisión técnica de la edición, que genera las vistas previas. Sin este paso
   el jurado no ve nada, por diseño.

**Trabajo del jurado:**

4. Entra a `/jurado/login` de FotoRank. La identidad se valida contra el maestro.
5. Ve un panel con todas sus asignaciones juntas, de ambas plataformas, etiquetadas.
6. Abre la maratón: las obras se leen de la base de Clickatón, sin autor visible.
7. Puntúa y, si corresponde, declara conflicto de interés. Todo se guarda en la
   base de Clickatón, junto a la foto.

## Qué se toca

**`packages/db/src`** — dos clientes nuevos, según el patrón existente.

**FotoRank** (`apps/fotorank`):

- `app/actions/judges.ts` → `listJudgeAssignmentsForCurrentJudge`: unir las
  asignaciones propias con las de Clickatón, etiquetadas por plataforma.
- `app/actions/judges.ts` → `listEntriesForAssignment`: leer de la base que
  corresponda según el origen de la asignación y **devolver el enlace de vista
  previa**, que hoy no devuelve.
- `app/actions/judges.ts` → `saveJudgeVote`: escribir en la base que corresponda.
- `app/jurado/asignaciones/[assignmentId]/evaluar/`: la pantalla deja de pedir
  `imageUrl`, `title` y `description` — que además rompían el anonimato — y usa
  la vista previa. **Se elimina el `as any[]` de `page.tsx`**: ese atajo es lo
  que dejó pasar el error sin que nadie se enterara.
- Marca del concurso en el encabezado del portal.

**Clickatón** (`apps/clickaton`):

- Ruta de imagen para jurado, firmada y con vencimiento.
- Creación del `Workspace` de jurados y copia de la ficha espejo al asignar, en
  una sola transacción.
- La pantalla de admisión pasa a mostrar las fotos con esa misma ruta.

## Pruebas

**Automáticas**, sobre las decisiones que se equivocan en silencio:

- Un enlace de imagen vencido o con firma adulterada es rechazado.
- Una asignación de Clickatón lee y escribe en la base de Clickatón, no en la de
  FotoRank.
- **Una prueba falla si el objeto que llega a la pantalla del jurado trae el
  nombre del autor.** El anonimato deja de depender de que alguien se acuerde.
- **Una prueba falla si alguna ruta de Clickatón autentica contra su
  `FotorankJudgeAccount` local.** La copia no es una puerta de entrada.
- El centinela de `passwordHash` no valida contra ninguna contraseña, incluida
  la cadena vacía.

**Contra copias descartables de las dos bases** (ramas Neon): el recorrido
completo — alta, asignación, listado de obras, voto — verificando que el voto
quede en la base correcta.

**En el navegador**: que la foto se vea, que no aparezca el autor y que la marca
sea la del concurso. Con captura.

## Orden de construcción

1. Ruta de imagen en Clickatón y admisión que muestra fotos. *Mayor riesgo y
   entrega valor sola: se deja de admitir a ciegas.*
2. Cliente cruzado y ficha espejo al asignar.
3. Panel con las asignaciones de ambas plataformas.
4. Pantalla de evaluación con foto y anonimato real. *Arregla también los
   concursos propios de FotoRank.*
5. Voto guardándose en la base correcta.
6. Mantenimiento del padrón desde ambos lados.
7. Marca por concurso.

## Fuera de alcance

Ranking, desempate y publicación de resultados. Voto del público. Diplomas y
paquetes de finalistas. Métodos de puntuación nuevos: se usan los siete que ya
existen (`SCORE_1_5`, `SCORE_1_10`, `SCORE_0_100`, `YES_NO`,
`FAVORITES_SELECTION`, `SELECTION_WITH_QUOTA`, `CRITERIA_BASED`). Unificar las
bases.

Decisión menor pendiente: hoy conviven dos caminos de evaluación en el portal,
el viejo por concurso (`/jurado/concursos/[contestId]`, con el cartel
"Evaluación aún no habilitada (rúbricas pendientes)") y el nuevo por asignación.
Dejar los dos confunde. Se propone retirar el viejo, pero no en esta etapa.

## Riesgos

**El esquema repartido en cinco bases.** Un campo nuevo hay que aplicarlo a mano
en cada base, Clickatón no corre `prisma migrate deploy` solo, y FotoRank ya se
rompió una vez por un valor ausente en la base. Mitigación: **el diseño no
agrega ningún campo nuevo** — las 29 tablas de jurado, evaluación, resultados y
voto público ya existen en las dos bases. Si hiciera falta uno, se avisa antes
de escribirlo: deja de ser un cambio de código y pasa a ser trabajo manual en
varias bases.

**La ficha espejo arrastra una cadena de tablas.** No alcanza con copiar la
cuenta del jurado: hay que crear un `Workspace` en Clickatón y poner un
centinela en `passwordHash`, porque ambos son obligatorios. Es más superficie de
la que parecía y hay que crearla en orden, en una sola transacción. Mitigación:
la creación de la ficha espejo es una única operación atómica, cubierta por la
prueba del recorrido completo contra copias de base.

**Una tabla de cuentas que no autentica.** Tener filas en
`FotorankJudgeAccount` de Clickatón que parecen cuentas pero no lo son invita a
que alguien, más adelante, las use para iniciar sesión. Mitigación: el centinela
imposible y la prueba automática que falla si alguna ruta de Clickatón autentica
contra esa tabla.

**FotoRank escribiendo en la base de Clickatón.** Una credencial más circulando.
Mitigación: permisos acotados a las tablas de evaluación y aislamiento en un
cliente propio. El riesgo no es cero.

**El padrón convive con FOTOFFICE.** La base de FotoRank es la misma que la de
FOTOFFICE (proyecto `divine-hall-10689679`, rama `development`). El padrón
maestro queda alojado junto a los datos de socios e instituciones. Decisión
tomada a conciencia; no rompe nada.

**Dependencia entre plataformas.** Si Clickatón está caído, el jurado no ve esas
obras. La pantalla debe avisarlo con claridad en vez de mostrarse vacía.

**El enlace firmado.** Si el secreto se filtra se pueden generar enlaces.
Mitigación: vencimiento corto y secreto rotable.
