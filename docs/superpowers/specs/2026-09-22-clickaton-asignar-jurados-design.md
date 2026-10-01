# Asignar jurados a una maratón de Clickatón

**Fecha:** 2026-09-22
**Estado:** diseño aprobado, en implementación

## El problema

Una maratón de Clickatón no puede tener jurado. La edición Argentina 2026 tiene
**270 obras** cargadas y **cero** jurados asignados, y no hay ninguna pantalla
—ni en Clickatón ni en FotoRank— donde cargar uno.

No es que falte el sistema: falta el último tramo.

## Lo que ya existe (auditado el 2026-09-22)

| Pieza | Dónde | Estado |
|---|---|---|
| Portal donde el jurado califica | FotoRank | Funciona, lee las dos plataformas |
| Cliente hacia la base de Clickatón, con escritura | `packages/db/src/clickaton-jury-client.ts` | Existe |
| Cliente hacia el padrón maestro | `packages/db/src/jury-directory-client.ts` | Existe |
| Ficha espejo del jurado | `apps/clickaton/lib/jury-mirror/mirror-judge.ts` | Escrita y probada, **nadie la llama** |
| Invitar a un jurado nuevo | `apps/clickaton/lib/jury-directory/service.ts` | Escrita, **con un defecto** (ver abajo) |
| Puente hacia el jurado | Pantalla de admisión de Clickatón | Existe |

**El hueco:** nadie llama a esas piezas. Falta la pantalla.

## El defecto encontrado en `inviteJudge`

`inviteJudge` guarda la invitación en el **padrón maestro** (base de FotoRank)
con el `contestId` de la maratón. Pero `FotorankJudgeInvitation.contestId` tiene
clave foránea a `FotorankContest` **de esa misma base**, y la maratón
`ck-contest-argentina-2026` sólo existe en la base de Clickatón. La invitación
falla al guardarse.

Es coherente con lo anotado en su momento: *"nada de esto se probó contra bases
reales"*. Sólo aparece al tocar las bases de verdad.

**Queda fuera de este trabajo.** No bloquea el caso real: los tres jurados del
padrón ya tienen cuenta y lo que necesitan es que les asignen trabajo.

## Qué se construye

Una pantalla **Jurados** dentro de la edición, en el panel de Clickatón, que:

1. Lista el padrón maestro (jurados aprobados y activos).
2. Muestra quiénes ya están asignados a esa maratón.
3. Permite asignar a uno, eligiendo categoría.
4. Permite quitar una asignación que todavía no tiene votos.

## Por qué la asignación se escribe en dos bases

```
FotorankJudgeVote ─── FK ──→ FotorankJudgeAssignment ─── FK ──→ FotorankJudgeAccount
        │                              │                              │
        └─── FK ──→ FotorankContestEntry                          Workspace
                    (vive en Clickatón)
```

El voto apunta a la asignación **y** a la obra a la vez. La obra vive en
Clickatón y las claves foráneas no cruzan bases: la asignación y la cuenta
tienen que existir también ahí. De ahí la ficha espejo, que ya está escrita.

**La identidad se valida siempre contra el maestro.** La ficha espejo guarda un
`passwordHash` centinela imposible y no tiene sesión: revocar el acceso en
FotoRank lo revoca en todas partes.

## Orden de las escrituras

Una asignación son tres filas en la base de Clickatón, y el orden importa
porque cada una cuelga de la anterior:

1. `Workspace` de jurados (`ck-workspace-jurados`) — upsert
2. `FotorankJudgeAccount` espejo — upsert
3. `FotorankJudgeAssignment` — create

Los tres primeros pasos ya los hace `mirrorJudgeAccount` en una transacción. La
asignación va después, en su propia escritura: si fallara, queda una ficha
espejo huérfana, que es inofensiva —no autentica a nadie y el siguiente intento
la reutiliza— mientras que una asignación sin ficha es imposible de crear.

## Reglas

- **Sólo jurados aprobados y activos.** El mismo criterio que usa el directorio
  de FotoRank: `accountStatus = ACTIVE` y `directoryReviewStatus = APPROVED`.
  No hace falta que estén listados en el directorio público: eso decide quién
  es *buscable*, no quién puede trabajar.
- **No se duplica una asignación.** Mismo jurado, misma maratón, misma
  categoría: se ignora en vez de fallar.
- **Quitar sólo si no votó.** Una asignación con votos no se borra: borrarla
  llevaría los votos con ella. Se avisa y se ofrece suspender en el maestro.
- **Nadie juzga donde compite** sigue vigente: la regla del 2026-09-22 corre en
  las dos compuertas y en las dos bases, así que una asignación a alguien que
  participa queda bloqueada al entrar. La pantalla lo avisa al asignar.

## Lo que hace falta configurar

Sin estas variables en Vercel, la pantalla se ve pero no puede escribir:

| Variable | Dónde | Para qué |
|---|---|---|
| `CLICKATON_JURY_DATABASE_URL` | FotoRank | Que el portal lea obras y escriba votos en Clickatón |
| `JURY_DIRECTORY_DATABASE_URL` | Clickatón | Que Clickatón lea el padrón maestro |
| `CLICKATON_JURY_MEDIA_SECRET` | **Las dos**, mismo valor | Que el jurado vea las fotos |
| `CLICKATON_PUBLIC_BASE_URL` | FotoRank | Volver a Clickatón desde el portal |

La pantalla tiene que **decir con todas las letras** cuando la conexión no está
configurada, en vez de mostrarse vacía: una lista vacía se confunde con "no hay
jurados".

## Qué queda afuera

- Invitar a alguien que todavía no tiene cuenta (el defecto de arriba).
- El correo al jurado avisándole de la asignación.
- Ranking, resultados y diplomas de la maratón.
- Congelar el lote de admisión: ya existe su botón y es un paso aparte.

## Cómo se verifica

- Pruebas de la lógica pura: elegibilidad, duplicados, orden de escrituras.
- Las pruebas se rompen a propósito para comprobar que sirven.
- Contra la base real no se puede probar hasta que las variables estén
  cargadas. **Eso queda explícito, no se da por probado.**
