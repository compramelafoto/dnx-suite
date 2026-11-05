# CLF internacional: cobro directo al fotógrafo y saldo prepago

Fecha: 2026-11-04 · Estado: diseño para aprobar · App: `apps/compramelafoto`

## 1. Para qué y por qué

CompraMeLaFoto (CLF) hoy solo funciona para fotógrafos argentinos: todo está en pesos y el cobro
pasa por Mercado Pago Argentina con reparto automático (`marketplace_fee`). Hay **22 fotógrafos
registrados fuera de Argentina** (México 5, Colombia 5, Uruguay 3, Chile 2, Honduras 2, Venezuela 2,
Perú 1, El Salvador 1, Estados Unidos 1; 8 con algún álbum) que no pueden vender. Además, 426
fotógrafos no tienen el país cargado.

El plan anterior (`docs/payments/stripe-pagos-internacionales-plan.md`) dependía de Stripe y de
abrir una sociedad en Estados Unidos (LLC). Este diseño es el camino **sin LLC**:

- El **cliente le paga directo al fotógrafo**, en la cuenta del fotógrafo, con el medio de pago
  habitual de su país. **DNX nunca recibe el dinero de las ventas.**
- DNX cobra su comisión **por adelantado**: el fotógrafo carga **saldo prepago en dólares** en el
  PayPal de DNX y CLF descuenta la comisión de cada venta de ese saldo.
- Los **referidos** cobran su parte como **crédito en su saldo**, no como dinero.

Por qué así: si el dinero de terceros pasa por la cuenta de DNX, PayPal congela cuentas por
operar como marketplace sin aprobación, y para AFIP todo el monto sería ingreso de DNX. Con este
modelo DNX solo factura su comisión (exportación de servicios, factura E; lo resuelve el contador,
fuera de este diseño).

## 2. Objetivos

1. Un fotógrafo de fuera de Argentina puede conectar su cuenta de cobro, cargar saldo y vender
   fotos en su moneda local.
2. CLF registra cada venta (sabe que se pagó) y entrega las fotos igual que hoy.
3. La comisión de DNX se descuenta del saldo en dólares, con la cotización del día congelada en
   el pedido.
4. Los referidos funcionan para ventas internacionales, acreditando saldo.
5. Lanzar avisando a los 22 fotógrafos existentes.

## 3. Lo que NO se hace (no objetivos)

- **No se toca el circuito argentino.** Mercado Pago Argentina con `marketplace_fee` sigue igual.
  El saldo prepago **no** se ofrece en Argentina.
- **No se agregan transferencias bancarias** como medio de cobro, ni en Argentina ni afuera.
- No Stripe, no LLC, no reparto automático internacional.
- No traducción al inglés en esta etapa (casi todos los fotógrafos actuales hablan español). Se
  deja preparado para hacerlo después.
- No retiro de saldo a dinero para fotógrafos del exterior.

## 4. Lo que haría fracasar esto aunque "funcione" (antiobjetivos)

- Que **una venta argentina se comporte distinto** que hoy (precio, comisión, reparto, correos).
- Que **DNX reciba en su cuenta dinero que es del fotógrafo.**
- Que las credenciales de los fotógrafos queden **guardadas sin cifrar** o se muestren completas
  (ya pasó con los tokens de Mercado Pago: `User.mpAccessToken` está en texto plano).
- Que el fotógrafo **no entienda** por qué se le descontó lo que se le descontó.
- Prometerle dinero a un referidor del exterior.

## 5. Cómo es hoy (puntos de partida en el código)

- Cobro de álbum: `app/api/payments/mp/create-preference/route.ts` y
  `lib/mercadopago/album-order-mp-preference.ts`. `lib/mercadopago.ts:169` fija
  `currency_id: "ARS"` y manda `marketplace_fee`.
- Confirmación: `app/api/payments/mp/webhook/route.ts` → `finalizeAlbumOrderMercadoPagoApproved`
  (`lib/mercadopago/finalize-album-order-mp-approved.ts`) marca `PAID` y crea ganancias de referidos.
- Comisión: porcentaje que se suma sobre el precio del fotógrafo (`lib/pricing/fee-formula.ts`,
  `lib/pricing/client-price.ts`, `lib/services/commissionService.ts`, por defecto 10 %). Queda
  congelada en `Order.pricingSnapshot`.
- Montos: `Order.totalCents` y los precios de `Album` están en **pesos enteros** y **no hay campo de
  moneda** ni en `Album` ni en `Order`. Los formateadores (`formatPurchaseArs`,
  `formatAlbumPriceArs`, etc.) asumen pesos y `es-AR`.
- Credenciales cifradas: ya existe un camino nuevo con `CredentialVault` y `DnxEncryptedCredential`
  (`lib/mercadopago/financial-identity-dual-read.ts`). Usarlo para todo lo de este diseño.
- Referidos: `ReferralCode`, `ReferralAttribution` (vigencia 1 año), `ReferralEarning`. El
  referidor fotógrafo gana el **50 %** de la comisión efectiva (`lib/referral/referral-program.ts`).
  Hoy el saldo de referidos en pesos **se descuenta de la comisión de sus propias ventas** o se pide
  como transferencia a su CBU (`app/api/referrals/me/request-payout`).
- `User.country` es texto libre, sin validar, y el registro de fotógrafo no lo pide.
- El enum `DnxPaymentProvider` ya incluye `PAYPAL`.

## 6. Cómo funciona (decidido)

### 6.1 Quién es "internacional"

Un fotógrafo es internacional si su país **no es Argentina**. Se agrega un código de país ISO
(`AR`, `MX`, `CO`, …) en el usuario, obligatorio en el registro (lista desplegable) y editable en
el perfil. Los valores de texto actuales se normalizan con un script (por ejemplo "argentina",
"ARGENTINA" → `AR`; "México" → `MX`). A los fotógrafos sin país se los trata como argentinos
(como hoy) y se les pide completarlo la próxima vez que entren.

**Cambiar de país** con álbumes activos no se permite desde el perfil; lo hace un administrador.

### 6.2 Medio de cobro por país

| País | Medio | Moneda de venta |
|---|---|---|
| Brasil, México, Chile, Colombia, Perú, Uruguay | Mercado Pago del fotógrafo | moneda local (BRL, MXN, CLP, COP, PEN, UYU) |
| Venezuela | PayPal del fotógrafo | USD |
| Resto (EE. UU., Europa, Centroamérica, etc.) | PayPal del fotógrafo | moneda local si PayPal la admite; si no, USD |

La tabla vive en un archivo de configuración, no repartida por el código, para sumar países sin
tocar lógica.

### 6.3 Conectar la cuenta de cobro

DNX **no** registra aplicaciones de Mercado Pago por país (cada aplicación queda atada al país de
la cuenta que la crea). En cambio, **el fotógrafo crea su propia aplicación** y pega sus
credenciales en CLF:

- **Mercado Pago:** el `Access Token` de producción (`APP_USR-…`) de una aplicación creada en
  Mercado Pago Developers con su cuenta.
- **PayPal:** `Client ID` y `Secret` de una app **Live** creada en PayPal Developer con su cuenta
  Business.

Pantalla "Cobros internacionales" en el panel del fotógrafo:
- Campo(s) para pegar las credenciales, guardadas **cifradas** con el sistema existente
  (`CredentialVault`). Nunca se vuelven a mostrar completas (solo los últimos 4 caracteres).
- Botón **"Probar conexión"**: CLF hace una llamada de solo lectura con esas credenciales y
  muestra a qué cuenta corresponden (nombre/email y país). Si el país de la cuenta no coincide con
  el del fotógrafo, avisa.
- Botón "Desconectar".
- Instructivo con capturas para cada medio (Mercado Pago y PayPal), enlazado desde la pantalla.

Sin cuenta conectada, sus álbumes no pueden vender (el botón de compra muestra "El fotógrafo aún
no habilitó la venta").

### 6.4 Moneda del álbum y precios

- Cada álbum de un fotógrafo internacional tiene **moneda** (la de su país según 6.2), fijada al
  crearlo. Se agrega moneda a `Album` y a `Order`, con valor por defecto `ARS`, para que todo lo
  existente siga siendo pesos sin migrar datos.
- Los formateadores de precio reciben la moneda. En pantallas argentinas el resultado tiene que
  ser **idéntico** al actual.
- Los álbumes en `ARS` siguen guardando **pesos enteros**, como hoy. Los álbumes en otra moneda
  guardan **centavos** (la unidad mínima de la moneda; en monedas sin decimales, como el peso
  chileno, la unidad entera), para permitir precios como 2,50 USD y que la comisión de una foto
  barata no se redondee a cero. Toda conversión entre "monto guardado" y "monto de la moneda" pasa
  por un único helper que conoce la moneda.
- La comisión se calcula con la **misma fórmula y porcentaje** que en Argentina (se suma al precio
  del fotógrafo; el cliente paga precio + comisión), así el fotógrafo cobra en su cuenta el total y
  la comisión le sale de lo que pagó el cliente.

### 6.4 bis Qué se vende (decidido por el owner)

- **Fotos digitales e impresas.** Las impresas las resuelve **cada fotógrafo por su cuenta**:
  él pone el precio de cada tamaño en su moneda, imprime y entrega. En los álbumes internacionales
  **no hay laboratorio** de CLF: no se usa `selectedLabId` ni precios de laboratorio, y CLF no
  gestiona envíos. El pedido le llega al fotógrafo con los datos de contacto del cliente, igual que
  un pedido de impresión con entrega del fotógrafo.
- La comisión de las impresas se calcula igual que la de las digitales (mismo porcentaje sobre el
  precio del fotógrafo).
- **Preventas escolares y productos de álbum (`AlbumProduct`) quedan apagados** en álbumes
  internacionales en esta etapa (decisión de Claude).

### 6.4 ter Álbumes que ya existen

Los álbumes ya creados por fotógrafos del exterior (8 fotógrafos) se pasan a la moneda del país
del fotógrafo con un script, **sin venta habilitada** hasta que el fotógrafo revise y confirme los
precios (los valores en pesos no se convierten: se le pide cargarlos). Decisión de Claude.

### 6.5 La compra

- **Mercado Pago:** CLF crea la preferencia con el token del fotógrafo, `currency_id` de su
  moneda, **sin** `marketplace_fee`, y con `notification_url` y `external_reference` propios de
  CLF. La confirmación llega al webhook de CLF, que consulta el pago con el token del fotógrafo
  (igual que hoy: la consulta es la fuente de verdad).
- **PayPal:** CLF crea la orden con las credenciales del fotógrafo y, cuando el cliente aprueba,
  **CLF captura el pago desde el servidor**. Así CLF sabe que se cobró sin depender de webhooks
  configurados en la cuenta del fotógrafo.
- Al confirmarse el pago, la orden pasa a `PAID` por el mismo camino de finalización que hoy
  (entrega de fotos, correos, referidos), más el descuento de saldo (6.6).

### 6.6 Saldo prepago (solo fotógrafos internacionales)

- El saldo es en **dólares**, y se lleva como un **libro de movimientos** (cada carga, descuento,
  crédito de referido o ajuste es una fila con monto en centavos de dólar, motivo y referencia). El
  saldo es la suma. Nada se edita: los errores se corrigen con un movimiento de ajuste.
- **Carga:** el fotógrafo paga con PayPal (cuenta de DNX). **Mínimo 10 USD**; puede cargar más.
  El saldo **no vence** y se acumula.
- **Descuento por venta:** al confirmarse el pago, se descuenta la comisión convertida a dólares
  con la cotización del día (6.7). Queda registrado en el pedido: moneda, comisión en moneda local,
  cotización usada y monto en dólares.
- **Saldo bajo:** al quedar por debajo de **2 USD**, aviso por correo y en el panel.
- **Saldo agotado:** si el saldo es 0 o negativo, los álbumes del fotógrafo **dejan de aceptar
  compras nuevas** hasta que recargue (se avisa al fotógrafo; al cliente se le muestra que la venta
  está pausada momentáneamente). Una compra ya iniciada antes de llegar a cero se completa
  aunque deje el saldo negativo; la próxima carga cubre la diferencia.
- **Saldo de bienvenida:** no hay; el primer saldo lo carga el fotógrafo (salvo créditos de
  referidos).
- **Devoluciones:** una tarea diaria vuelve a consultar, con las credenciales del fotógrafo, el
  estado de los pagos internacionales de los **últimos 30 días**. Si un pago figura devuelto o
  anulado, se devuelve la comisión al saldo con un movimiento. Pasados los 30 días, solo un
  administrador puede registrar una devolución (ajuste manual). No se usan webhooks para esto.
- **Desconectar o cambiar la cuenta de cobro:** la credencial anterior no se borra; queda
  inactiva para ventas nuevas pero se conserva cifrada **30 días** para confirmar pagos en curso y
  revisar devoluciones. Cada pedido guarda qué credencial se usó.
- El fotógrafo ve su saldo y los movimientos en su panel, cada uno con moneda local y dólares
  ("Venta 500 MXN · comisión 2,72 USD · saldo 7,28 USD").
- El administrador ve el saldo de cada fotógrafo internacional, sus movimientos y puede cargar un
  ajuste manual con motivo.

### 6.7 Cotizaciones

- Una tarea diaria trae la cotización de cada moneda usada contra el dólar desde un servicio
  público de cotizaciones y la guarda (moneda, valor, fecha, fuente).
- Cada venta usa la cotización guardada más reciente y **la congela en el pedido**; nunca se
  recalcula.
- Si la cotización más reciente tiene más de 48 h, aviso al administrador. Se sigue usando la
  última disponible.
- Venezuela vende en USD, así que no necesita conversión.
- Se guardan los dos valores cuando el servicio los da (**compra** y **venta**); si da uno solo, se
  guarda ese en los dos. Para pesos argentinos se usa el dólar oficial del Banco Nación (compra y
  venta). Qué valor se usa en cada caso lo fija la regla de 6.8 bis.

### 6.8 Referidos

Mismo cálculo que hoy: el referidor fotógrafo gana el 50 % de la comisión efectiva, durante el
año de vigencia de la atribución.

- **Referidor internacional** (de una venta internacional o argentina): se acredita en su
  **saldo prepago en dólares** como movimiento "crédito de referido". Le sirve para pagar sus
  propias comisiones. No se puede retirar.
- **Organizador internacional** con comisión sobre una venta (eventos): igual que el referidor
  internacional, su parte va a su **saldo en dólares**. No se paga en dinero.
- **Referidor u organizador argentino** de un fotógrafo internacional: el crédito se convierte a
  pesos (6.8 bis) y se registra como una `ReferralEarning` normal en pesos. Así entra en el mecanismo que ya
  existe: **se descuenta de la comisión de sus propias ventas por Mercado Pago** o lo pide por
  CBU como hoy.
- Las ventas argentinas con referidor argentino siguen exactamente igual.

### 6.8 bis Cambio interno de moneda (pedido del owner, 2026-11-05)

DNX hace el cambio por dentro: cuando lo que se acredita o se descuenta está en una moneda y el
saldo de la persona en otra, se convierte. **Siempre se usa el valor que más le conviene a la
plataforma.**

| Caso | Dirección | Valor que se usa | Por qué conviene a DNX |
|------|-----------|------------------|------------------------|
| Comisión de una venta en moneda local que se descuenta del saldo en dólares | local → USD | **compra** (menos moneda local por dólar) | se descuentan más dólares |
| Crédito de referido u organizador internacional por una venta en moneda local | local → USD | **venta** (más moneda local por dólar) | se acreditan menos dólares |
| Crédito de referido u organizador internacional por una venta argentina | ARS → USD | **venta** del oficial Banco Nación | se acreditan menos dólares |
| Crédito de referido u organizador argentino por una venta internacional | USD → ARS | **compra** del oficial Banco Nación | se acreditan menos pesos |

- Si el servicio da un solo valor, se usa ese (no se agrega margen).
- El pedido guarda los dos valores, cuál se usó y el resultado. Nunca se recalcula.
- La regla vive en una sola función ("elegir cotización según quién cobra") con pruebas por cada
  fila de la tabla.

### 6.9 Lo que ve el cliente

- Galería y carrito con precios en la moneda del álbum.
- Botón de pago de Mercado Pago o PayPal según el medio del fotógrafo.
- Textos en español en esta etapa. Los textos nuevos se escriben de modo que se puedan traducir
  después (sin frases armadas con pedazos de texto dentro de la lógica).

## 7. Orden de trabajo (decidido)

1. País del fotógrafo (código ISO, registro, perfil, normalización) y moneda en álbum/pedido con
   formateadores. Argentina debe quedar idéntica.
2. Conexión de cuenta de cobro (Mercado Pago y PayPal), cifrado, "Probar conexión", instructivos.
3. Cotizaciones diarias.
4. Saldo prepago: libro de movimientos, carga por PayPal de DNX, descuento por venta, avisos, pausa.
5. Compra internacional (Mercado Pago y PayPal) conectada a la finalización existente.
6. Referidos internacionales.
7. Panel de administración y aviso a los 22 fotógrafos.

Cada etapa se puede publicar sola sin afectar a los fotógrafos argentinos (lo internacional queda
oculto hasta la etapa 7).

## 8. Restricciones

- **Requisito del owner (aprobado el 2026-11-05): el sistema que funciona hoy no puede verse
  interrumpido en ningún momento.** Cada cambio de base de datos es solo aditivo (columnas nuevas
  con valor por defecto o nulas, tablas nuevas; nunca renombrar ni borrar). Todo lo internacional
  queda detrás de un interruptor apagado hasta la etapa 7. Cada etapa se publica sola y tiene
  pruebas que demuestran que una compra argentina sigue igual (precio, comisión, `marketplace_fee`,
  correos, referidos).

- Producción de CLF vive en el monorepo y en la base Neon `divine-hall-10689679`, rama
  `production` (`br-autumn-rain-ad18wq7y`). El `.env.local` de CLF apunta a otra rama: no usarlo
  para verificar datos de producción.
- Las migraciones de base se aplican a mano y se registran (ver práctica del repo).
- Pruebas de pago: Mercado Pago y PayPal en modo prueba (sandbox) antes de cualquier cobro real.
- No agregar dependencias que rompan otras apps del monorepo.

## 9. Lo que queda a criterio de quien lo construya

- Nombres de modelos, campos y rutas.
- Qué servicio de cotizaciones usar (gratuito y con valores de referencia oficiales).
- Cómo validar las credenciales en "Probar conexión" (qué llamada de solo lectura).
- Cómo se ve exactamente la pantalla de saldo y movimientos, siguiendo el estilo del panel actual.
- Cómo y dónde mostrar la pausa de venta al cliente.
- Si la creación de pedidos internacionales reutiliza `ensureAlbumOrderMpPreference` o va por
  un camino propio, siempre que el argentino no cambie.

## 10. Decisiones tomadas por Claude (para revisar)

- Mínimo de carga 10 USD, aviso a los 2 USD, saldo que no vence.
- Misma comisión que en Argentina (10 % por defecto, con las excepciones por fotógrafo que ya
  existen).
- Venezuela vende en USD por PayPal.
- La compra en curso puede dejar el saldo negativo.
- Referidor u organizador argentino recibe el crédito en pesos al dólar oficial **comprador** del
  Banco Nación (regla 6.8 bis, que reemplaza la idea anterior de usar el vendedor).
- Si el servicio de cotizaciones da un solo valor, se usa sin margen agregado.
- Un organizador del exterior que no es fotógrafo acumula su crédito en dólares igual; lo puede usar
  si después vende como fotógrafo. No se retira.
- Fotógrafos sin país cargado se tratan como argentinos.
- Montos en centavos para monedas que no sean `ARS`.
- Devoluciones detectadas por revisión diaria durante 30 días; después, ajuste manual.
- Credenciales desconectadas se conservan 30 días, inactivas.
- Preventas y productos de álbum apagados en álbumes internacionales.
- Álbumes existentes del exterior: se pasan a su moneda sin venta hasta que el fotógrafo cargue
  los precios.
