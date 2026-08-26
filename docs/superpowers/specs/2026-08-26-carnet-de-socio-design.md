# Carnet de socio

**Fecha:** 2026-08-26
**Producto:** FotoOffice
**Depende de:** `@repo/design-studio` (núcleo de render, ya construido)
**Spec del módulo:** `docs/superpowers/specs/2026-08-26-modulo-de-diseno-design.md`

---

## 1. Objetivo

Que cada socio tenga una credencial que sirva para dos cosas distintas:

- **Identificarse** ante un tercero —un evento, un comercio con convenio, otra institución—
  y que ese tercero pueda comprobar que es cierto.
- **Ver su propia situación** con la institución, y poder resolverla.

Son dos usos con audiencias distintas, y de eso sale casi todo el diseño.

## 2. Dos carnets, un socio

| | Digital | Impreso |
|---|---|---|
| Quién lo tiene | **Todos** los socios, sin pedirlo | Quien lo pide y lo paga |
| Costo | Ninguno | **El valor de una cuota** |
| Qué es | Una página web con QR | Una tarjeta de 85,6 × 54 mm, dos caras |
| Vigencia | 2 años | 2 años |
| Se actualiza | Sí, en vivo | No: lo que se imprimió, quedó impreso |

El impreso es un souvenir con valor institucional y el digital es la fuente de verdad. Por eso
**la tarjeta impresa no lleva la deuda ni el estado de cuenta**: quedaría desactualizada al día
siguiente y sería información sensible circulando en un papel.

Lo que la tarjeta lleva es el QR. Quien lo escanea llega al digital, que sí está al día.

## 3. Dos números, dos cosas

El socio preguntó si la identificación es el número de socio o el número de carnet. **Son los
dos, y hacen falta los dos**, porque responden preguntas distintas.

| | Número de socio | Número de carnet |
|---|---|---|
| Qué identifica | A la persona en la institución | A **una emisión concreta** |
| Cuándo cambia | Nunca. Es vitalicio | En cada emisión y en cada renovación |
| Para qué sirve | Es su identidad ante la SFPR | Permite invalidar un carnet perdido sin tocar la identidad del socio |
| Dónde aparece | En la tarjeta y en el digital | En la tarjeta, en el digital y dentro del QR |

Esta separación es la que resuelve el caso "perdí el carnet". Se revoca **ese** carnet, se emite
uno nuevo con otro número, y el socio sigue siendo el 128 de toda la vida. Si el QR codificara el
número de socio, un carnet perdido sería imposible de invalidar sin cambiarle la identidad.

## 4. Qué ve cada uno

Esto es lo más delicado de la spec. **Un tercero que escanea un QR en la puerta de un evento no
tiene por qué enterarse de que el socio debe tres cuotas.**

### Nivel 1 — Cualquiera que escanee

- Foto, nombre y apellido
- Número de socio y categoría
- **Si el carnet está vigente**: sí o no, con la fecha de vencimiento
- **Si el socio está habilitado**: sí o no

Y nada más. Ni deuda, ni monto, ni documento, ni teléfono, ni domicilio, ni correo.

"Habilitado" es una sola palabra que resume lo que el tercero necesita saber. **Por qué no está
habilitado no es asunto suyo**: puede ser deuda, una suspensión, una baja o un carnet vencido, y
en los cuatro casos la respuesta que necesita el de la puerta es la misma.

### Nivel 2 — El propio socio, con sesión iniciada

Todo lo anterior, y además:

- Su estado de cuenta: qué cuotas debe, de qué períodos, cuánto suma
- Desde cuándo está en mora y qué implica según el estatuto
- **El botón para cancelar la deuda** (ver §8)
- El historial de sus carnets emitidos

### Nivel 3 — La institución

Todo lo anterior de cualquier socio, más:

- Los datos de contacto y de domicilio
- El historial completo de emisiones, con quién emitió cada una y cuándo
- La facultad de revocar un carnet y de emitir uno nuevo

### La regla que ordena los tres niveles

> **El nivel 1 responde "¿es socio y está habilitado?". Cualquier dato que no sirva para
> responder eso no pertenece al nivel 1.**

## 5. Estado: lo que se guarda y lo que se calcula

El esquema ya tiene resuelta la parte difícil, y el carnet no debe romperla.

| Dato | Dónde vive | Por qué |
|---|---|---|
| Condición institucional | **Guardada** en `Member.status` (`ACTIVE`, `SUSPENDED`, `INACTIVE`) | Es una decisión que alguien tomó, con fecha y responsable |
| Situación financiera | **Calculada** desde `MembershipCharge.balanceArs` | Cambia sola con el paso del tiempo y con cada pago |
| Vigencia del carnet | **Calculada** desde la fecha de emisión | Es aritmética, no una decisión |
| Revocación del carnet | **Guardada** | Es una decisión |

El comentario del propio esquema lo dice: el `MemberStatus` viejo mezclaba estado societario con
estado de deuda y por eso se reemplazó. **El carnet no puede reintroducir esa mezcla** guardando
un campo "habilitado".

`habilitado` es una función de tres cosas, y se evalúa cada vez que alguien mira:

```
habilitado = Member.status === ACTIVE
           ∧ el carnet no está revocado
           ∧ el carnet no está vencido
           ∧ la mora no supera el umbral del estatuto
```

El umbral de mora **no lo define esta spec**: sale del estatuto y está en
`docs/superpowers/specs/2026-08-24-fotoffice-alta-socios-cobros-design.md`. El carnet lo consulta,
no lo decide. Si mañana la institución reforma el estatuto, el carnet no se toca.

Así, un socio que paga a las 11 de la noche aparece habilitado a las 11 y un minuto, sin que
ningún proceso tenga que acordarse de actualizarlo.

## 6. El QR

Codifica **una URL corta con un token opaco**, y nada más:

```
https://fotoffice.com/c/<token>
```

El token no es el número de socio, ni el de carnet, ni deriva de ellos: es aleatorio. Tres
motivos, en orden de importancia:

1. **Nadie lee datos personales del código.** Un QR es texto plano para cualquiera con un
   teléfono.
2. **Se puede revocar.** Un token invalidado deja de resolver; un número de socio no.
3. **Menos información es más legible.** El módulo de diseño calcula la legibilidad con el
   contenido real: un token corto entra en 29 módulos por lado y una URL con parámetros necesita
   37. En los mismos 26 mm eso es la diferencia entre 0,70 mm y 0,58 mm por módulo.

El token se guarda **hasheado**, como una contraseña. Quien tenga acceso a la base no puede
fabricar carnets válidos a partir de ella.

## 7. Emisión

La emisión es del producto; el dibujo es del módulo. El carnet arma el contrato de variables,
resuelve los datos del socio y llama a `emitDesign`.

```
Secretaría aprueba / el socio pide su tarjeta
        ↓
Se crea el carnet: número, token, vigencia
        ↓
Contrato de variables + datos del socio
        ↓
emitDesign()  →  PDF de imprenta · PNG frente · PNG dorso
        ↓
Se guardan los archivos y su checksum, con la versión de plantilla y de renderizador
```

Las variables del carnet:

| Clave | Tipo | Obligatoria | De dónde sale |
|---|---|---|---|
| `fullName` | text | Sí | `Member.firstName` + `lastName` |
| `memberNumber` | number | Sí | `Member.memberNumber` |
| `cardNumber` | text | Sí | Del propio carnet |
| `category` | text | No | `MemberCategory.name` |
| `photo` | image | Sí | `Member.avatarUrl` |
| `issuedAt` | date | Sí | Emisión |
| `validUntil` | date | Sí | Emisión + 2 años |
| `verificationUrl` | qrPayload | Sí | La URL corta con el token |
| `institutionName` | text | Sí | `Workspace` |

**`photo` es obligatoria a propósito.** Un carnet de identificación sin foto no identifica. El
módulo detiene la emisión si falta, que es exactamente el comportamiento que queremos: mejor no
emitir que emitir un carnet con un hueco.

**La emisión es de a uno o en tanda.** Cuando la Secretaría aprueba cuarenta socios, los cuarenta
carnets digitales se emiten en un proceso automático, sin que nadie abra una pantalla.

## 8. Pagar la deuda desde el carnet

Es lo que el socio pidió: que pueda cancelar y que **se actualice en el momento**.

**Esta parte está bloqueada** por la habilitación de cobro dividido de MercadoPago, que quedó en
suspenso (`docs/payments/mercadopago-split-habilitacion.md`). Así que la spec la define pero la
deja para una fase posterior.

Lo importante para el diseño de hoy: **el resto del carnet no depende de esto**. Como
"habilitado" se calcula en cada consulta y no se guarda, en cuanto el pago se acredite la
pantalla cambia sola. No hace falta ningún mecanismo de actualización en vivo: hace falta **no
haber guardado un estado que después haya que sincronizar**.

Mientras el cobro no esté, el nivel 2 muestra la deuda y explica cómo regularizarla por los
medios que la institución ya usa.

## 9. Reemisión, pérdida y revocación

| Situación | Qué pasa |
|---|---|
| Vence el carnet digital | Se renueva **solo**, con número y token nuevos. El socio no tiene que pedir nada: si lo tienen todos, tenerlo vencido por trámite no tendría sentido |
| Vence la tarjeta impresa | No se renueva sola: hay que pedirla y pagarla de nuevo, como la primera vez |
| El socio lo pierde | La Secretaría lo revoca. El token deja de resolver. Se emite uno nuevo |
| El socio deja de serlo | El carnet queda revocado; el nivel 1 dice que no está habilitado |
| Cambia la plantilla | **Los carnets ya emitidos no cambian.** Cada emisión guardó su versión de plantilla |
| Se reimprime el mismo carnet | Se reproduce el archivo original: misma versión, mismos datos, mismo renderizador |

Un carnet emitido **nunca se modifica**. Corregir un nombre mal escrito no es editar el carnet:
es revocar ese y emitir otro, y las dos cosas quedan registradas.

## 10. Modelo de datos

Un modelo nuevo. El resto ya existe.

```
MemberCard
  id
  workspaceId, memberId
  cardNumber            único por workspace
  tokenHash             el token nunca se guarda en claro
  issuedAt, validUntil
  revokedAt, revokedReason, revokedByUserId
  designTemplateVersionId    qué versión dibujó este carnet
  rendererVersion
  format                DIGITAL | PRINTED
  printOrderChargeId    el cargo de la tarjeta impresa, si la pagó
  files                 PDF y PNG con su checksum
```

`format` distingue el carnet digital —que todos tienen— del pedido de tarjeta impresa. Son
registros separados porque tienen ciclos de vida distintos: el digital se renueva solo, la
tarjeta se pide, se paga y se imprime.

`printOrderChargeId` apunta a un `MembershipCharge` de concepto `OTRO` por el valor de una cuota.
**El pago de la tarjeta entra por el mismo circuito que las cuotas**, no por uno paralelo.

## 11. Lo que el carnet no hace

| Fuera | Por qué |
|---|---|
| Dibujar | Es de `@repo/design-studio` |
| Decidir quién es socio | Es del módulo de socios |
| Guardar los archivos | Ya está resuelto en R2 |
| Controlar acceso a eventos | Un carnet dice quién sos, no a dónde podés entrar |

## 12. Riesgos

| Riesgo | Mitigación |
|---|---|
| Un tercero se entera de la deuda de un socio | El nivel 1 no la muestra, y la regla de §4 es explícita |
| Se guarda "habilitado" y queda desincronizado | Se calcula en cada consulta; §5 lo prohíbe expresamente |
| Un carnet perdido sigue sirviendo | Token opaco y revocable, distinto del número de socio |
| Alguien fabrica carnets desde la base | El token se guarda hasheado |
| Cambiar la plantilla altera carnets viejos | Cada emisión guarda su versión; el módulo lo garantiza |
| Se emite un carnet sin foto | La foto es variable obligatoria: la emisión falla |
| El carnet queda atado a MercadoPago | El pago es una fase aparte; nada más depende de él |

## 13. Fases

1. **Carnet digital y verificación pública.** Modelo, token, emisión, la página del QR con sus
   tres niveles. Es lo que da valor sin depender de nada bloqueado.
2. **Tarjeta impresa.** El pedido, el cargo por el valor de una cuota, la emisión del PDF y la
   entrega.
3. **Pagar desde el carnet.** Cuando MercadoPago habilite el cobro dividido.
4. **Emisión en tanda y plancha imprimible.** Cuando haya volumen que lo justifique.

La fase 1 sola ya resuelve el uso principal: que un socio pueda mostrar quién es y que alguien
pueda comprobarlo.
