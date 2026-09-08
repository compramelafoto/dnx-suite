# Sorteos entre socios, con premios de aliados y azar verificable

**Fecha:** 2026-09-07
**Aplicación:** FotoOffice (`apps/fotoffice`)
**Estado:** diseño aprobado en conversación, pendiente de revisión escrita

---

## 1. Qué se construye y por qué

La Sociedad de Fotógrafos quiere sortear entre sus socios premios que donan marcas
aliadas. El requisito que ordena todo el diseño no es el sorteo en sí —eso es fácil— sino
que **el socio pueda comprobar que no hubo trampa sin tener que confiar en la
institución**.

Un sorteo cuyo resultado sale de un `Math.random()` en un servidor es, para quien mira
desde afuera, indistinguible de uno arreglado. No alcanza con ser honesto: hay que ser
verificable. Todo lo demás —el modelo de datos, los estados, la animación— existe para
sostener esa propiedad.

El sorteo cumple además una segunda función, deliberada: **participa sólo el socio al
día**, así que cada sorteo anunciado es un recordatorio de deuda que no se siente como un
reclamo.

## 2. Lo que ya existe y lo que no

Verificado en el repositorio el 2026-09-07:

| Pieza | Estado |
|---|---|
| Requisitos escritos (`docs/fotoffice/CONTEXTO-SFPR.md`) | Existen: sorteo gratuito, limitable a socios al día, ruleta animada, resultado inmutable y auditable por socio y por mes |
| Entrada de menú `/portal/sorteos` (`lib/portal/menu.ts:124`) | Declarada con `built: false`; se muestra como "Próximamente" |
| Espacio publicitario `FOTOFFICE_RAFFLE_SPONSOR` | Tipado en `@repo/partners` (`campaigns.ts:136`, `inventory.ts:138`), `mounted: false` |
| Modelos, migraciones, lógica de sorteo | **Cero.** `ESTADO-ACTUAL.md:114`: *"14 — Sorteos · NO EXISTE"* |
| Integración FotoOffice ↔ DNX Partners | **No existe.** Decisión registrada de excluir FotoOffice del despliegue de Partners. `@repo/partners` figura en `package.json:23` pero no se importa en ningún lado: dependencia muerta |

Precedente cercano y deliberado: `MembershipRecommendationBenefit` (`schema.prisma:7746`)
resuelve idempotencia con un `@unique`, congela el valor al ganarlo y exige motivo para
anular. Un resultado de sorteo necesita exactamente esa clase de garantías.

## 3. Decisiones tomadas

Acordadas en conversación el 2026-09-07:

1. **Participan sólo los socios al día.** El sorteo es también herramienta de cobranza.
2. **Acto en vivo con fecha anunciada.** El resultado queda sellado antes de la animación.
3. **Enganche mínimo con Partners.** Cada premio referencia una ficha `DnxPartner` por id;
   no se porta a FotoOffice el panel de sponsors de Clickatón.
4. **Todos participan todos los meses.** No hay exclusión del ganador anterior. Dentro de
   un mismo sorteo, nadie se lleva dos premios.
5. **Azar por drand**, con el padrón sellado por huella antes de que el número exista.
6. **Sin dinero.** Sorteo gratuito, premios donados. Queda fuera del terreno del bono
   contribución, que tiene otras exigencias.

## 4. El mecanismo de azar verificable

### 4.1 Por qué drand

[drand](https://drand.love/) es un servicio público y gratuito operado en conjunto por
varias organizaciones (la *League of Entropy*: Cloudflare, EPFL, Protocol Labs y otras).
Produce un valor aleatorio cada pocos segundos mediante criptografía de umbral: **ninguna
de las organizaciones puede generarlo sola, ni predecirlo, ni sesgarlo**. Cada valor queda
publicado para siempre y se recupera por HTTP.

Las dos alternativas se descartaron con motivo:

- **Compromiso y revelación** (el sistema publica la huella de una semilla secreta y la
  revela después) no requiere servicios externos, pero tiene una grieta indemostrable:
  como el padrón se conoce de antemano, el organizador podría probar semillas hasta dar
  con la que hace ganar a quien él quiera, y publicar la huella de esa. La sospecha sola
  arruina el objetivo.
- **La Quiniela** es culturalmente la más aceptada en Argentina y no requiere
  infraestructura, pero obliga a cargar el número a mano o a depender de sitios sin API
  confiable, ata el calendario al de la Lotería y aporta poca entropía.

### 4.2 Las tres piezas de la prueba

```
huella del padrón  +  valor de drand  +  número de premio   →   ganador
```

- La **huella del padrón** se publica *antes* de que el valor de drand exista. No se puede
  acomodar la lista sabiendo el resultado.
- El **valor de drand** aparece *después* de publicada la huella, y en una tanda fijada al
  anunciar el sorteo. No se puede elegir el número sabiendo la lista.
- La **cuenta es determinística**. Mismos datos, mismo ganador, sin margen de decisión.

Ninguna de las dos partes puede mirar a la otra. Esa es toda la garantía.

### 4.3 Cómo se sella el padrón

**El cierre del padrón es un momento distinto del acto, y anterior.**

Esto surgió al escribir la especificación y corrige lo conversado. Si el padrón se
congelara en el mismo instante del sorteo, quedaría una ventana de manipulación: entre que
sale el valor de drand y que alguien resuelve el sorteo, un administrador que ya vio el
número podría alterar el estado de deuda de un socio y cambiar quién está en la lista. El
sellado tiene que ocurrir, y poder demostrarse que ocurrió, **antes** de que el número
exista.

Por eso el sorteo tiene dos fechas:

| Campo | Significado | Valor por defecto |
|---|---|---|
| `entriesCloseAt` | Cierre del padrón. Se congela la lista y se publica su huella | 24 h antes del acto |
| `drawsAt` | El acto. Se lee drand y se resuelven los premios | Lo elige la Secretaría |

Se anuncia con las dos fechas a la vista: *"para participar tenés que estar al día antes
del lunes 29 a las 20:00; el sorteo es el martes 30 a las 20:00"*. Un margen de 24 horas
elimina toda carrera de tiempos y no exige una tarea programada de precisión de minutos,
que el plan actual de Vercel no ofrece —los cron configurados en `vercel.json` son horarios
y diarios—.

El sellado se dispara de dos maneras, y es idempotente: una tarea programada, y de manera
perezosa la primera visita posterior a `entriesCloseAt`. La segunda existe porque un sorteo
no puede quedar sin sellar por una tarea que no corrió.

### 4.4 Quién entra en el padrón

Un socio entra si, al momento de `entriesCloseAt`:

- Su `Member.status` es `ACTIVE`, y
- No tiene ningún `MembershipCharge` con `balanceArs > 0` cuyo `dueDate` ya haya pasado.

**Decisión a confirmar:** si la deuda de apertura (período `APERTURA`, el saldo migrado del
sistema anterior) bloquea o no la participación. Recomiendo que **no bloquee** en la
primera versión: son 48 socios cuya deuda todavía no se pudo verificar contra el reporte de
pagos anterior a 10/2025, y dejarlos afuera del primer sorteo por una cifra que la propia
institución no puede justificar es la peor manera de estrenar el módulo. Las cuotas
mensuales y las de ingreso sí bloquean.

La regla vive tipada en un módulo puro y no como JSON libre, siguiendo el criterio del
resto del dominio.

### 4.5 La cuenta, en detalle

**Orden del padrón.** Las entradas se ordenan por `memberNumber` ascendente y se numeran
desde 0. El orden es determinístico y auditable; no depende de cómo la base devuelva las
filas.

**Huella del padrón.**

```
entrantsHash = SHA256(
  "fotoffice-raffle-v1\n" +
  raffleId + "\n" +
  entradas.map(e => e.position + ":" + e.memberId).join("\n")
)
```

**Tanda de drand.** Al pasar el sorteo a *Anunciado* se consulta `/info` de la cadena
—génesis y período— y se guarda el `chainHash` junto con la primera tanda cuyo instante sea
estrictamente posterior a `drawsAt`. Los parámetros se leen del servicio y no se fijan en
el código: si la cadena cambiara, un número escrito a mano dejaría de verificar.

**Extracción, premio por premio.** Se recorren los premios por `order` ascendente, sacando
de la bolsa a quien ya ganó:

```
para cada premio, con la bolsa de los que todavía no ganaron:
  i = 0
  repetir:
    digest = SHA256(entrantsHash | drandRound | drandRandomness | premio.order | i)
    x      = primeros 8 bytes del digest como entero de 64 bits sin signo
    limite = piso(2^64 / bolsa.length) * bolsa.length
    si x < limite:  ganador = bolsa[x mod bolsa.length];  terminar
    i = i + 1
```

El descarte de los valores por encima de `limite` **elimina el sesgo del módulo**. Sin él,
las primeras posiciones de la lista tendrían una probabilidad imperceptiblemente mayor: con
110 socios el desvío es del orden de 10⁻¹⁷ y nadie lo notaría jamás, pero un sorteo que se
ofrece como verificable no puede tener un sesgo conocido, por chico que sea. El costo es un
bucle que en la práctica no itera nunca.

**Qué se guarda para verificar:** `chainHash`, `round`, `randomness`, la firma devuelta por
drand, `entrantsHash`, y la lista completa de participantes con su posición.

## 5. Modelo de datos

Cinco entidades nuevas. Prefijo `Raffle`, en el `schema.prisma` compartido.

### `Raffle`

| Campo | Notas |
|---|---|
| `id`, `workspaceId` | |
| `title`, `description` | "Sorteo de septiembre" |
| `entriesCloseAt`, `drawsAt` | Las dos fechas de §4.3 |
| `status` | Ver §6 |
| `drandChainHash`, `drandRound` | Se fijan al anunciar |
| `drandRandomness`, `drandSignature` | Se completan al resolver |
| `entrantsHash`, `entrantsCount` | Se completan al sellar |
| `sealedAt`, `drawnAt` | |
| `cancelledAt`, `cancelReason` | Anular exige motivo |
| `createdByUserId`, `announcedByUserId` | |

### `RaffleEntry`

Un participante congelado. `raffleId`, `memberId`, `position`, e **instantáneas** de
`memberNumber` y `fullName` al momento del sellado.
`@@unique([raffleId, memberId])` y `@@unique([raffleId, position])`.

### `RafflePrize`

`raffleId`, `order`, `title`, `description`, `conditions`, `pickupInstructions`,
`pickupDeadline`, `estimatedValueMinor?`, `partnerId` (referencia opaca a `DnxPartner`, sin
clave foránea, igual que el resto del dominio Partners) y `partnerNameSnapshot`.
`@@unique([raffleId, order])`.

### `RafflePrizeAward`

El resultado. `prizeId @unique` —un premio, un ganador—, `raffleId`, `memberId`, `entryId`,
`winnerPosition`, `status`, `notifiedAt`, `deliveredAt`, `deliveredByUserId`,
`deliveryNote`, `voidReason`.

### `RaffleEvent`

La historia: quién anunció, quién selló, cuándo se resolvió, quién entregó cada premio, con
`actorLabel` como instantánea. Mismo criterio que `MemberCardEvent`: las decisiones se
guardan, las derivaciones se calculan.

## 6. Estados

**Sorteo:** `BORRADOR → ANUNCIADO → PADRON_SELLADO → SORTEADO → CERRADO`, y `CANCELADO`
desde `BORRADOR` o `ANUNCIADO` con motivo obligatorio.

Una vez `SORTEADO` el resultado es inmutable: no hay transición que lo deshaga. Si algo
salió mal se anula el premio con motivo y se crea otro sorteo. Un resultado que retrocede
deja de contar lo que realmente pasó.

`CERRADO` cuando todos los premios llegaron a `RETIRADO` o `NO_RETIRADO`.

**Premio:** `GANADO → NOTIFICADO → RETIRADO`, o `NO_RETIRADO` al vencer `pickupDeadline`, o
`ANULADO` con motivo escrito.

Reglas duras:

- No se anuncia un sorteo sin al menos un premio.
- No se sella un padrón con menos participantes que premios.
- No se modifican premios ni fechas después de `ANUNCIADO`.

## 7. Pantallas

**Administración** (`/members/sorteos`): lista de sorteos con su estado; alta con fechas y
premios; buscador de aliados que permite elegir una ficha `DnxPartner` existente o crear
una nueva con nombre y logo; tablero de premios pendientes de entrega, con el mismo
lenguaje visual que el tablero de carnets —tabla densa, acciones que dicen lo que hacen,
historia por fila—.

**Socio** (`/portal/sorteos`): el sorteo anunciado con premios y aliados, y su propia
situación —*"Estás participando"* o *"No estás participando: debés la cuota de agosto"* con
enlace a pagar—. Después del acto, la animación del bolillero, que **reproduce** el
resultado ya sellado. El ganador ve su premio, las condiciones, dónde retirarlo, el plazo y
su carnet a mano.

**Verificación** (`/portal/sorteos/[id]/verificacion`): los cuatro datos, la lista completa
de participantes con su posición, la explicación en castellano de la cuenta y el enlace al
valor de drand en su servicio de origen, para que un tercero recalcule sin usar FotoOffice.

## 8. Bordes y fallas

| Situación | Qué pasa |
|---|---|
| drand no responde a la hora del acto | La tanda ya estaba fijada. Se reintenta; el resultado es idéntico cuando el valor se recupera. La pantalla dice "esperando el número de la tanda N", no un error |
| Nadie abre la página a la hora del acto | El sorteo se resuelve solo en la primera visita posterior, o por la tarea programada. Idempotente y con el mismo resultado |
| Ningún socio al día al cerrar el padrón | No se puede sellar. El sorteo queda `ANUNCIADO` y avisa a la Secretaría |
| Menos participantes que premios | No se sella. Se corrige la cantidad de premios o se cancela |
| Dos procesos resuelven a la vez | El `@unique` sobre `prizeId` en `RafflePrizeAward` lo impide. El resultado no depende de quién llegue primero |
| El ganador se da de baja antes de retirar | El premio sigue siendo suyo: las instantáneas conservan quién era. La Secretaría decide y deja constancia |
| Se canceló un sorteo ya anunciado | Se avisa a los socios. Los premios vuelven a estar disponibles para otro sorteo |

## 9. Fuera de alcance de la primera versión

- Sorteos con bono contribución (pago). Otro régimen, otras exigencias.
- Números extra por antigüedad, cursos o recomendaciones.
- Exclusión del ganador de los meses siguientes.
- Montar el espacio `FOTOFFICE_RAFFLE_SPONSOR` para que el logo del auspiciante aparezca
  en el portal. El enganche mínimo con `DnxPartner` deja el camino abierto.
- Portar a FotoOffice el panel de administración de sponsors de Clickatón.

## 10. Riesgos abiertos

1. **Legal.** `docs/partners/partners-pending-decisions.md:70` marca `L-09 — Condiciones
   para premios y sorteos` como decisión sin resolver. En Argentina los sorteos están
   regulados por las loterías provinciales. Aunque este sea gratuito, entre socios y con
   premios donados, corresponde una consulta profesional **antes de anunciar el primero**.
   No frena la construcción; sí frena el anuncio.
2. **Esquema compartido.** Las cinco aplicaciones de la suite comparten `schema.prisma`.
   Estas cinco tablas hay que aplicarlas a mano en las cinco bases de Neon, o se rompen las
   escrituras de las otras aplicaciones.
3. **Dependencia externa.** drand es gratuito y operado por una coalición, sin contrato de
   servicio. Mitigado porque los valores son permanentes y recuperables desde varios
   espejos, y porque la tanda se fija de antemano: una caída retrasa el acto, no lo altera.
4. **Comprensión.** "Siete organizaciones generan un número que nadie puede predecir" no es
   evidente para todo el mundo. La pantalla de verificación tiene que estar escrita para
   alguien que no programa, o la garantía existe en el código y no en la cabeza del socio.
