# FotoOffice — Alta de socios y primer cobro

**Fecha:** 2026-08-24
**Estado:** diseño aprobado, pendiente de plan de implementación
**Institución de referencia:** Sociedad de Fotógrafos Profesionales de Rosario (SFPR)

---

## 1. Objetivo

Que un profesional pueda asociarse a una institución desde un formulario público, que
la Secretaría lo apruebe, y que pague sus cuotas de ingreso con MercadoPago **sin que
nadie toque nada a mano**.

El dinero de la institución va **directo a su cuenta**, no a la de DNX.

---

## 2. Contexto

### 2.1 Lo que existe

- **Padrón de socios** (`Member`, `MemberCategory`, `MemberAudit`, `MemberInvitation`):
  módulo `members`, AVAILABLE. 152 socios importados en la SFPR.
- **`@repo/payments`**: infraestructura de pagos con MercadoPago Orders 1:N, split real,
  consentimientos, reembolsos, libro contable, conciliación e idempotencia. La usan
  **compramelafoto y clickaton**.
- **Capa financiera** (`DnxFinancialIdentity`, `DnxPaymentAccount`, `DnxSplitConsent`,
  `DnxPaymentRecipient`, `DnxMercadoPagoOAuthState`): contempla organizaciones
  (`subjectType: ORGANIZATION`, `organizationRef`) y guarda credenciales cifradas.
- **Registro de módulos** (`lib/modules/registry.ts`): `membership-dues` ya declarado
  como PLANNED.

### 2.2 El hueco

**FotoOffice no usa `@repo/payments`.** Su único cobro —inscripciones a cursos— pasa por
`lib/presential-courses/mercadopago.ts`, 155 líneas con Checkout Pro y un token global
único (`MP_ACCESS_TOKEN`), **sin split**.

`CourseEnrollment` guarda `platformFeePercent`, `platformFeeArs` y `netAmountArs`: el
split está **calculado y registrado, pero la plata no se divide**. Entra toda a una sola
cuenta.

**`Workspace` no tiene credenciales de MercadoPago.** Los campos de OAuth viven en `User`
y `Lab`, que son entidades de compramelafoto.

### 2.3 Dato operativo

**FotoOffice nunca se usó en producción.** No hay inscripciones ni pagos reales. Las
migraciones no necesitan compatibilidad hacia atrás. *(A verificar con consulta a la base
antes de ejecutar.)*

### 2.4 Fuente normativa

El diseño de cuotas, mora y bajas sigue el **brief institucional de la SFPR**, basado en
el estatuto Res. 404/96 IGPJ Santa Fe y CCyC arts. 168-186. Cuando este documento y el
estatuto difieran, **manda el estatuto**.

---

## 3. Alcance

### 3.1 Entra

1. **Conexión de cobro de la institución** — OAuth de MercadoPago a nivel workspace,
   consentimiento de split, estado visible.
2. **Comisión de la plataforma** — por workspace y por módulo, editable solo por super
   admin, default 5%.
3. **Configuración de cuotas** — valor de referencia con vigencia, escalas, cuotas de
   ingreso, vencimiento, recordatorios.
4. **Solicitud de asociación** — formulario público con foto, categoría y escala
   declaradas, institución de procedencia.
5. **Bandeja de la Secretaría** — aprobar o rechazar, con contexto de reingreso.
6. **Activación y primer pago** — invitación de un clic, pago con split, activación por
   webhook.

### 3.2 No entra

| Fuera | Por qué |
|---|---|
| Motor de devengamiento mensual | Espera el CSV con el estado real de las cuentas |
| Carnets | Subsistema propio; la foto **sí** se recolecta desde ahora |
| Reembolsos | El orden aprobar→cobrar los hace innecesarios |
| Intimaciones, actas, padrón de asamblea | Módulo `governance` |
| Informe de altas para la sesión de CD | Módulo de actas y contaduría |
| Intereses | Tasa cero hasta que Fiscalía apruebe el Reglamento |
| Migrar el cobro de cursos | Se vuelve posible con la pieza 1; es otro trabajo |

### 3.3 Juntura de publicación

Las piezas 1 y 2 son infraestructura invisible; las 3 a 6 son el producto. Si el trabajo
se hace largo, el corte natural es **publicar 1+2 primero**.

---

## 4. Decisiones de arquitectura

### 4.1 Split real, no contable

Se usa `@repo/payments` con Orders 1:N. La institución conecta su MercadoPago y recibe su
plata directo; DNX retiene su comisión en la misma transacción.

**Alternativa descartada:** copiar el patrón de cursos (token único). Dejaría el dinero de
la institución en la cuenta de DNX hasta una transferencia manual mensual — pasivo
contable, trabajo recurrente, e implicancias fiscales que exceden lo técnico.

### 4.2 Extraer el núcleo genérico de `owner-oauth`

`packages/payments/src/partner-onboarding/owner-oauth` tiene la mecánica correcta (PKCE,
bóveda de credenciales, máquina de estados) pero **está cableado a Clickaton**: escribe
`productKey: "clickaton"` fijo, rechaza filas de otros productos, sus banderas se llaman
`DNX_CLICKATON_MP_OWNER_ONBOARDING_ENABLED`.

**Se extrae el núcleo a un servicio que reciba el producto como parámetro.** Clickaton
pasa a ser una llamada delgada que le pasa `"clickaton"`; FotoOffice le pasa `"fotoffice"`.

**Condición de ejecución:** la extracción es un paso propio que **no cambia ningún
comportamiento**, con la batería de tests de Clickaton en verde antes y después. Si algo
no cierra, se corta y FotoOffice implementa el suyo aparte (opción de contingencia) —
pero esa decisión se toma ahí, no a mitad del alta de socios.

**Riesgo:** toca código que hoy mueve dinero de Clickaton en producción.

### 4.3 Las categorías son datos, no código

El brief de la SFPR define `categoria: ACTIVO | COLABORADOR | HONORARIO`. Escribir ese
enum convertiría a FotoOffice en software de la SFPR.

**`MemberCategory` sigue siendo una tabla por institución**, y se le agregan los atributos
que el modelo necesita: `grantsVote`, `eligibleForBoard`, `generatesDues`. Las tres
categorías de la SFPR pasan a ser tres filas configuradas.

La **escala de cuota** (plena / reducida / exenta) vive en el socio, no en la categoría:
es ortogonal a los derechos. Un estudiante que se recibe cambia de escala sin tocar nada
de padrón ni de voto.

### 4.4 Dos ejes independientes de estado

Esta es la síntesis que hace encastrar el brief con el esquema existente, y refleja la
distinción del propio brief entre **sanciones** y **constataciones**:

| Eje | Qué responde | Cómo | Transiciones restrictivas |
|---|---|---|---|
| **Condición institucional** | ¿Es socio, está suspendido, se le dio de baja? | **Se guarda** (`Member.status`) | **Exigen acta de CD** |
| **Situación financiera** | ¿Al día, en mora, intimado? | **Se calcula** de los cargos impagos | Automáticas, sin acta |

**Consecuencia: no se toca `MemberStatus`.** Un socio suspendido por sanción y uno
intimado por deuda son cosas distintas; mezclarlas en un campo hace imposible contestar
después "¿por qué está suspendido este señor?".

Solo se agrega el **motivo de baja** (deuda / sanción / renuncia), que hoy no se distingue.

### 4.5 Las cuotas iniciales son cargos reales

El pago de ingreso **no se guarda como "pagó $30.000"**: genera **tres cargos concretos**
con período, monto, vencimiento y estado.

Motivo: cuando el módulo de cuotas empiece a devengar mensualmente, si esos meses no
existen como registros **se los vuelve a cobrar al socio**. Esta pieza es la primera
piedra del módulo de cuotas, puesta para que la segunda encastre.

---

## 5. Piezas

### 5.1 Conexión de cobro de la institución

**Modelo.** La institución se representa como `DnxFinancialIdentity` con
`subjectType: ORGANIZATION` y `organizationRef = "fotoffice-workspace:<workspaceId>"`,
vinculada a un `DnxPaymentRecipient` mediante `DnxFinancialIdentityRecipientLink`.

**Cambio de esquema:** `DnxPaymentRecipientType` no tiene valor para institución. Se
agrega uno (aditivo, sin riesgo para lo existente).

**Flujo.** Pantalla en la configuración del workspace → OAuth con MercadoPago (PKCE) →
`DnxPaymentAccount` con capacidad `SPLIT_RECEIVER` → consentimiento de split
(`DnxSplitConsent`).

**Credenciales.** Nunca en claro: `credentialReference` apunta a `DnxEncryptedCredential`.

**Estado visible** para el dueño: cuenta conectada, estado del consentimiento, comisión
que retiene DNX, y acción de reconectar si vence o se revoca.

### 5.2 Comisión de la plataforma

**Problema existente.** Hoy `coursesFeePercent` **lo edita el dueño del workspace** — el
propio código lo dice: *"Solo owner/admin del workspace puede editar el fee de cursos."*
Una institución puede poner la comisión de DNX en 0%.

**Diseño.**

- Tabla de comisiones con una fila por **workspace + módulo**. No un campo por módulo:
  ese patrón obliga a migrar el esquema con cada módulo nuevo.
- **Default 5%** cuando no hay fila. Una única función resuelve el número para todo el
  sistema.
- **Solo el super admin edita.** El dueño lo **ve** —tiene que saber qué paga— pero no lo
  cambia. Aplica también a cursos.
- **Unidad: puntos básicos** (500 = 5%), enteros, como ya hace `@repo/payments`
  (`commissionOverrideBps`). Evita errores de redondeo. Se muestra como porcentaje.
- **Migración:** todo a 5%, incluido cursos (default actual 10%). Sin datos reales que
  preservar.

**Transparencia (requisito).** En **cada** lugar donde se configure un precio, un
componente único muestra el desglose en vivo:

> Cuota mensual: **$10.000**
> Fee de plataforma (5%): **$500**
> Recibís aproximadamente **$9.500**.
> ⚠️ Antes de impuestos y de la comisión de MercadoPago, que se descuentan aparte.

El fee **se descuenta del total**: quien paga abona $10.000, no $10.500. Dice
"aproximadamente" a propósito: las retenciones y la comisión de MercadoPago dependen de
la condición fiscal de cada institución y del medio de pago. Prometer un neto exacto sería
mentirle al dueño del workspace.

### 5.3 Configuración de cuotas

**Por institución:**

| Ajuste | Default |
|---|---|
| Día de generación | 1 |
| Día de vencimiento | **10, fijo** |
| Días de gracia sin intereses | 5 |
| Cuotas al ingresar | **3** |
| Cuenta el mes de ingreso si entra antes del vencimiento | Sí |
| Día de envío del recordatorio | 5 |
| Tasa de interés mensual | **0** (hasta aprobación de Fiscalía) |

**Valor de referencia** con vigencia (`vigente_desde` / `vigente_hasta`) y referencia al
acta de CD que lo resolvió. Cada cargo guarda **con qué valor se generó**: una cuota de
marzo impaga en octubre se cobra al valor de marzo. **Nunca se reajusta hacia atrás.**

**Escalas** por institución: plena (1.00), reducida (0.50), exenta (0.00).

**Por categoría:** si otorga voto, si habilita cargos, si genera cuota, y si requiere
confirmación de la Secretaría.

### 5.4 Solicitud de asociación

**Circuito:**

```
  formulario público
        ↓
  SOLICITUD_PENDIENTE  ──rechazada──→  RECHAZADA (con motivo)
        ↓ la Secretaría aprueba (sin acta)
  APROBADA_IMPAGA  ──30 días sin pagar──→  VENCIDA
        ↓ paga
  AL_DIA  ← socio pleno
```

El **número de socio se asigna al aprobar**, no antes: una solicitud rechazada no debe
consumir un número.

**Campos.**

- *Quién es:* nombre, apellido, documento, fecha de nacimiento, CUIT.
- *Cómo ubicarlo:* email, teléfono, **domicilio de notificaciones**.
- *Qué es:* categoría y escala declaradas.
- *Foto* (será perfil y carnet).
- *Socio presentante* — **opcional**, activable por configuración si el estatuto lo exige.

**Sobre el domicilio:** sin domicilio válido no se puede cursar una intimación, y **sin
intimación la baja por deuda es nula** (art. 10°). Pedirlo dos años después, con el socio
ya en deuda, es impracticable. Se pide en el alta.

**Mapeo de lo que elige la persona:**

| Elige | Categoría | Escala | Vota |
|---|---|---|---|
| Profesional en ejercicio | ACTIVO | Plena (100%) | Sí |
| Estudiante | ACTIVO | Reducida (50%) | *según flag* |
| Aficionado | COLABORADOR | Piso, libre hacia arriba | No |

Quien elige **estudiante** declara **institución de procedencia** y ve el aviso: *"esta
categoría paga el 50% y queda sujeta a que la Secretaría confirme tu condición de
estudiante"*.

### 5.5 Bandeja de la Secretaría

Lista de solicitudes pendientes. Al abrir una: todo lo declarado, la foto, y avisos
contextuales cuando corresponda:

> ⚠️ Declara ser **estudiante** de la Escuela X. Verificá el certificado: paga el 50%.

> ℹ️ **Ya fue socio N° 556**, baja por deuda en marzo de 2024. Deuda congelada: $40.000.

El segundo aviso es posible porque **nunca se borra a nadie**.

**La Secretaría resuelve sin acta.** El informe periódico de altas para presentar en
sesión de CD corresponde al módulo de actas y contaduría; este diseño solo garantiza
**no perder los datos que ese informe necesitará** (quién aprobó, cuándo, categoría,
escala, monto cobrado).

**El rechazo siempre lleva motivo**, y se comunica.

### 5.6 Activación y primer pago

**Al aprobar**, en una transacción única, todo o nada:

1. Se crea el `Member` con su número.
2. La foto pasa a ser su `avatarUrl`.
3. Se generan **tres cargos de concepto `INGRESO`** — que no integran la racha de mora.
4. Sale el email de aprobación.

**El email tiene un solo botón.** Ese botón lo autentica y lo deja **directamente en la
pantalla de pago**, con el monto ya calculado. Un clic más: pagar. Confirmado el pago, el
portal se abre solo.

**Por qué así:** una advertencia en el dashboard se ignora, y un "menú de pagos" obliga a
buscar dónde pagar. Del email al pago: **dos clics, sin navegar**.

**Por qué la cuenta se crea al aprobar y no después de pagar:**

- Si nunca paga, **no hay nada que devolver**: la solicitud vence.
- Si el pago entra pero algo falla del lado nuestro, la cuenta ya existe y se arregla sin
  tocar dinero. Al revés, quedaría plata cobrada y una persona sin acceso.
- La confirmación la da el **webhook**, no una persona.

**Monto:** `3 × su cuota mensual`, sea cual sea la escala. El profesional paga 3 plenas,
el estudiante 3 reducidas, el colaborador 3 veces el monto que eligió (≥ piso).

**Meses cubiertos:** las 3 cuotas cubren los meses **siguientes** al ingreso; el mes de
ingreso queda bonificado. **Excepción:** si se asocia **antes del día 10**, el mes en
curso cuenta como la primera de las tres.

*Ejemplo — alta el 18/08, categoría Activo, cuota $10.000:*

```
  Cargo 09/2026   $10.000   vence 10/09/2026
  Cargo 10/2026   $10.000   vence 10/10/2026
  Cargo 11/2026   $10.000   vence 10/11/2026
  ──────────────────────────────────────────
  Total hoy: $30.000    Fee de plataforma (5%): $1.500
  Mensual desde 12/2026.
```

**Recordatorios del primer pago:** a los 3 y a los 7 días. A los **30 días** sin pagar, la
solicitud vence — el socio no queda creado a medias ni ocupando un número, y la Secretaría
lo ve en su bandeja por si quiere reactivarlo. **Nada se borra.**

---

## 6. Modelo de datos

### 6.1 Lo que ya sirve

`Member` cubre documento, fecha de nacimiento, domicilio, `avatarUrl`, `joinedAt`,
`leftAt`. Y tres decisiones que coinciden con el brief:

- **El registro nunca se borra** (comentario de `leftAt`).
- **`MemberAudit` es historial inmutable**, con relación protegida (`Restrict`) para que
  borrar un socio no se lleve su historia. Es el log append-only del brief.
- **Número único por institución** — para la SFPR equivale a "global", y además funciona
  para la próxima institución.

### 6.2 Se agrega

**A `MemberCategory`:** `grantsVote`, `eligibleForBoard`, `generatesDues`,
`requiresConfirmation`.

**A `Member`:** escala de cuota, monto propio (colaborador), motivo de baja, socio
presentante (opcional), institución de procedencia.

**A `DnxPaymentRecipientType`:** valor para institución.

**Tablas nuevas (módulo de cuotas):**

| Tabla | Qué guarda |
|---|---|
| Configuración de cuotas | Por workspace: días, cantidad inicial, tasas, umbrales |
| Valor de cuota | Monto de referencia con vigencia y acta |
| Escala | Multiplicadores por institución |
| Cargo | Socio, concepto, período, monto, vencimiento, saldo, valor con que se generó |
| Pago | Socio, fecha, monto, medio, comprobante, referencia del proveedor |
| Imputación | Pago ↔ cargo, capital e interés separados |
| Solicitud de asociación | Datos declarados, estado, resolución, autor |
| Comisión de plataforma | Workspace + módulo → puntos básicos |

### 6.3 Deuda conocida

`Member` tiene **un solo campo de domicilio**. El brief pide `domicilio_notificaciones`,
que legalmente puede diferir del particular y es el que vale para una intimación. Por ahora
se usa el existente; **cuando llegue el módulo de intimaciones habrá que separarlos**.

---

## 7. Política de morosidad

**Definida ahora, implementada en el módulo de cuotas.** En el proyecto del alta no hay
morosos: el primer socio entra al día por definición.

### 7.1 Contadores (estatutarios)

```
cuotas seguidas impagas     >= 3   → dispara
cuotas alternadas impagas   >= 5   → dispara   (ventana 24 meses)
deuda otros conceptos       > 90 días y > 1 cuota → dispara
```

**Un pago parcial no corta la racha.** La racha se mide sobre cargos con saldo cero.

### 7.2 Reglas fijas

1. **El sistema nunca da de baja a un socio.** Arma el expediente y lo pone en la bandeja;
   **la baja la ejecuta una persona, con acta**. Un software que da de baja solo es un
   software que genera un problema con alguien.
2. **Nunca se le bloquea la puerta al que quiere pagar.** El suspendido siempre puede
   entrar a saldar.
3. **Nadie es moroso por datos que no tenemos.** El cálculo solo corre **desde la fecha en
   que hay información confiable**. El CSV fija esa línea de corte. Sin eso, los 152 socios
   aparecerían debiendo todo desde siempre.
4. **Los intereses se congelan al dar de baja** (`fecha_corte = fecha del acta`). Si
   siguieran corriendo, el derecho a reincorporarse pagando se vuelve imposible.
5. **Interés simple, nunca capitalizado, con tope duro:** el interés acumulado nunca
   supera al capital.
6. **Durante la suspensión sigue generando cuota** — la suspensión es una sanción, no una
   salida.

### 7.3 Recordatorios

**Un recordatorio por ciclo, no uno por cuota adeudada.** Quien debe cinco cuotas recibe
*un* mensaje con el total, no cinco el mismo día. Es el error clásico que convierte un
recordatorio en hostigamiento: la gente marca como spam y después no se entera de nada.

Máximo **una comunicación de cobranza cada 7 días** por socio. Todo queda registrado.

---

## 8. Errores y casos borde

### 8.1 Webhook duplicado

MercadoPago reintenta. El pago se registra por su identificador de proveedor con
**restricción de unicidad en la base**: el segundo intento choca y no hace nada. No se
confía en un chequeo previo en memoria — dos webhooks pueden llegar en el mismo instante.
**La base es el árbitro.** Se usa el módulo de idempotencia de `@repo/payments`.

### 8.2 Aprobación simultánea

La aprobación completa ocurre en **una transacción, todo o nada**. El número se asigna con
la restricción `[workspaceId, memberNumber]` como juez: si dos coinciden, uno falla y
reintenta. **Nunca se calcula "el último más uno" fuera de la transacción** — es la forma
clásica de terminar con dos socios 557.

### 8.3 Institución sin MercadoPago conectado

Aprobar sin cobros conectados generaría cuotas que nadie puede pagar y un email con un
botón roto.

**Se corta en el origen:** el formulario público **no se puede publicar** hasta que los
cobros estén conectados. Si se desconectan después, el formulario se despublica solo y se
avisa a la institución.

### 8.4 Pago en efectivo (pendiente)

Rapipago / Pago Fácil quedan **pendientes varios días**. No es un rechazo: es plata que va
a llegar.

- El socio no se activa hasta la confirmación, y ve *"estamos esperando la confirmación de
  tu pago"*, no un error.
- **El plazo de 30 días se congela** mientras haya un pago pendiente. Sería absurdo vencer
  la solicitud de alguien que ya pagó.

### 8.5 Contracargo o devolución posterior

Las cuotas vuelven a impagas y el socio queda en mora, siguiendo el circuito normal. **No
se lo expulsa automáticamente ni se le borra nada.** Queda en el log: un contracargo es
justo lo que alguien va a tener que explicar después.

### 8.6 Red de seguridad

Los webhooks se pierden. Una **tarea programada concilia** periódicamente los pagos
pendientes contra MercadoPago. Se usan los servicios de conciliación de `@repo/payments`.

### 8.7 Formulario público abierto

El **gate humano es el antispam**: nada ocurre hasta que una persona aprueba. Se suma
límite de tasa por origen y validación de tamaño y formato de la foto.

---

## 9. Pruebas

**La aritmética del dinero primero y a fondo.** Escalas, comisión, imputación de lo más
viejo a lo más nuevo, tope de interés sobre capital. Son funciones puras y es donde un
error se traduce directo en plata mal cobrada.

**Nunca coma flotante.** Decimales o centavos enteros. Se usa el módulo de dinero de
`@repo/payments`. Un `0.1 + 0.2` en una cuota de socio es un reclamo.

**Las fechas, con tabla de casos:** alta el 18, el 3, el 10 exacto, el 31 en un mes de 30,
años bisiestos. Ahí se esconden los "me cobraron un mes de más".

**Un test por cada caso de la sección 8.**

**Nada toca MercadoPago de verdad:** se usa `FakeMercadoPagoHttpClient`.

**Dos configuraciones que hay que probar explícitamente: comisión en 0% e interés en 0%.**
El sistema tiene que funcionar bien en cero, no solo con números "normales" — es el caso
que se rompe cuando nadie lo prueba, y el interés arranca en cero por definición.

**La extracción de `owner-oauth`** se valida con la batería de Clickaton en verde antes y
después, sin cambios de comportamiento.

---

## 10. Decisiones pendientes

| # | Decisión | Recomendación |
|---|---|---|
| 1 | **`escala_reducida_vota`**: ¿default `true` o `false`? | **`false`.** Darle voto al estudiante requiere reforma estatutaria por 2/3 y aprobación de Fiscalía (arts. 48°-49°). Si sale en `true` y se celebra una asamblea antes de la reforma, el padrón incluyó votantes no habilitados y **la asamblea queda impugnable**. Es la misma lógica que aplicar interés cero hasta que Fiscalía apruebe. |
| 2 | Socio presentante | ¿El estatuto lo exige para el alta? Hoy queda opcional, activable por configuración |
| 3 | Reingreso de quien fue dado de baja | ¿Paga cuotas de ingreso de nuevo? Propuesta: entra por el mismo formulario y la Secretaría decide con el contexto a la vista |

Los **umbrales de mora** (3 seguidas / 5 alternadas) **no son decisión pendiente**: son
estatutarios según el brief institucional. Quedan como configuración por institución
porque otras tendrán los suyos, no porque estén en discusión para la SFPR.

---

## 11. Riesgos

| Riesgo | Mitigación |
|---|---|
| La extracción de `owner-oauth` toca código que mueve dinero de Clickaton | Paso propio, sin cambio de comportamiento, tests de Clickaton en verde antes y después. Contingencia: implementación separada para FotoOffice |
| El circuito sancionatorio no está validado legalmente | **Antes de la primera baja automatizada, que lo revise un abogado matriculado en Santa Fe.** Fuera del alcance de este proyecto, pero bloqueante para el módulo de bajas |
| Cobrar cuotas de terceros | Resuelto por diseño: el split manda la plata directo a la institución |
| El art. 26° inc. f) remite a un artículo inexistente (error de la reforma del 91) | Se interpreta como remisión al art. 10° inc. a). **Dejar comentado en el código** |

---

## 12. Módulos siguientes

Orden sugerido, tomado del brief institucional:

1. **Cuotas mensuales** — devengamiento, mora, estados automáticos *(espera el CSV)*
2. **Recordatorios** — mail primero, WhatsApp después
3. **Intimación y expediente de baja** — módulo `governance`
4. **Reingreso autogestionado**
5. **Plan anual** con devengamiento diferido
6. **Padrón de asamblea y snapshots**
7. **Calendario institucional** — jobs, actas, informes, contaduría

Del 1 al 2 sirve para cobrar. El 3 y el 4 dan respaldo legal. El resto es la capa
institucional.

**El portal del socio se llena solo** a medida que estos módulos existan: su contenido es
dinámico por módulo, no una pantalla que haya que escribir a mano.
