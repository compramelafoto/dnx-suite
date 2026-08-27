# FotoOffice — Portal del socio: alcance y orden

**Fecha:** 2026-08-27
**Origen:** conversación de definición con Daniel.
**Estado del portal hoy:** 3 pantallas, 473 líneas. Ver [ESTADO-ACTUAL.md](ESTADO-ACTUAL.md).

## Decisión de partida

No se invita al padrón de 152 socios hasta que el portal justifique la invitación. Se
invita una sola vez: la primera impresión no se repite.

El portal debe generar **pertenencia**, no ser solo un trámite. Lo que más pesa:

1. **Reconocimiento** — que el socio vea quién es para la institución.
2. **Vida institucional** — qué pasa en la SFPR.

Comunidad y transparencia importan, pero van después.

### El mínimo para invitar

Definido por Daniel: identidad y estado de cuenta, **más** beneficios y sponsors, **más**
reservas de espacios. Es un alcance de meses, no de semanas.

## Los tres subproyectos, en orden

Cada uno con su propio ciclo de diseño, plan e implementación.

### 1 · Portal del socio: identidad, cuenta y carnet

**En curso.** Estado al 2026-08-27:

| Paso | Estado |
|---|---|
| Importar el padrón real con su deuda | ✅ Hecho — ver [ANALISIS-PADRON-SFPR.md](ANALISIS-PADRON-SFPR.md) |
| Escala histórica de la cuota | ✅ Cargada |
| Exentos a categoría Honorario | ✅ 8 socios |
| Baja transitoria por deuda | ✅ 45 socios |
| Generación automática de septiembre | ✅ Verificada: cron, secreto y proyección de 99 cuotas |
| Identidad del socio en la portada | ✅ Número, categoría y antigüedad |
| Estado de cuenta con datos reales | ✅ Ya no miente: la deuda es la verdadera |
| Emitir los carnets | ⏳ Pendiente — 0 emitidos, falta definir el diseño |
| Cargar los emails faltantes | ⏳ Pendiente — 11 de los 107 activos no tienen |
| Referido con mes bonificado | ⏳ Pendiente |

Casi todo existe; falta ponerlo en marcha y rediseñar cómo se presenta.

- Datos del socio: número, antigüedad, categoría, escala de cuota.
- Estado de cuenta real. **Hoy dice "estás al día" cuando nunca se emitió una cuota**: es
  una tranquilidad que no corresponde.
- Carnet emitido y a mano. Hoy hay 0 emitidos.
- Generar la primera camada de cuotas. La configuración y 3 valores ya están cargados.
- Cargar los 16 socios sin email: sin email no se puede invitar.

**Por qué primero:** es lo más cerca de estar listo y habilita el cobro, que financia el resto.

**Se engancha al final:** *referido con mes bonificado*. Un socio recomienda, el nuevo se
asocia y paga, el que recomendó recibe un mes gratis. Sus dos piezas ya existen —
`MembershipApplication` con su pantalla `/w/sfpr/asociarse`, y el módulo de cuotas, donde un
mes bonificado es una cuota con importe cero. Falta el vínculo.

### 2 · Beneficios, sponsors y convenios

Traer DNX Partners a FotoOffice. Es reutilizar algo ya construido en el monorepo, no crearlo.

- Beneficios y descuentos de comercios.
- Sponsors y auspiciantes.
- Convenios con colegios e instituciones educativas: misma pieza que los beneficios.

**Por qué después del 1:** es lo que justifica pagar la cuota, y deja el terreno listo para
los sorteos, que dependen de que existan sponsors.

### 3 · Reservas de espacios

Salón, estudio y coworking. **No existe nada**: cero archivos, cero modelos.

- Disponibilidad y prevención de superposiciones.
- Reglas de cancelación.
- Tarifas, posiblemente distintas para socios y terceros.
- **La agenda debe estar asociada al Google Calendar de la Sociedad.**

**Por qué último:** es el más grande y el único enteramente nuevo. Se beneficia de que
cuotas y pagos ya estén funcionando y probados.

## Después de los tres

### Sorteos mensuales

Requisitos definidos:

- Periodicidad **mensual**.
- Sorteo aleatorio con **ruleta animada**, que cada socio pueda ver.
- **100% transparente y auditable.**
- Notificación automática al **sponsor**, a la **administración** y al **socio ganador**.
- El ganador se encarga de retirar el premio, con un **límite de días**.

Depende del subproyecto 2: sin sponsors no hay qué sortear.

### Portfolio de cada socio

Autogestionado por el propio socio.

### Blog público y privado

Un blog abierto y otro reservado a socios. Ligado a la idea de que los posteos de redes
sociales se reflejen en el sitio público.

**Advertencia registrada:** hoy no se está cargando contenido de ningún tipo. Diseñar el
portal alrededor de contenido que nadie produce todavía es construir un hueco. La vida
institucional se suma cuando haya quién la sostenga.

### Transparencia institucional

En qué se usa la cuota, qué decidió la Comisión, actas y balances. Daniel lo ubicó
explícitamente en segunda etapa.

## Integraciones con Google — transversales

No son un subproyecto: atraviesan a los demás y conviene decidirlas una sola vez.

### Google Contacts — alcance acotado por decisión

Cada socio nuevo se agenda **automáticamente** en los contactos de `sfprosario@gmail.com`, y
se mantiene sincronizado ante cada cambio.

**Solo nombre, apellido, teléfono y número de socio.** No se sincronizan documento, domicilio
ni otros datos sensibles.

**Por qué:** esa cuenta vive en el teléfono de la Sociedad, que usa la secretaría. El objetivo
es que cuando un socio escriba al WhatsApp de la SFPR, quien atienda sepa de inmediato con
quién habla. Para eso alcanza el nombre y el teléfono; volcar el padrón entero a una casilla
de Gmail agregaría riesgo sin agregar utilidad.

### Google Calendar

La agenda de reservas debe estar asociada al calendario de la Sociedad.

## Sorteos: la transparencia no la da la animación

Registrado para cuando se diseñe el módulo.

Si el servidor elige al ganador y después se muestra una ruleta que "cae" en ese nombre, eso
es una animación, no una prueba. Un socio desconfiado no tiene cómo verificar que no se eligió
a dedo.

Para que sea auditable, el resultado tiene que poder **comprobarse después**: se publica antes
del sorteo una huella del número secreto que se usará, y se revela ese número al terminar.
Cualquiera recalcula y confirma que el ganador salió de ahí. La ruleta sigue, pero como puesta
en escena de algo que además se puede verificar.

La diferencia práctica: en un caso el socio tiene que confiar en la Comisión; en el otro no
hace falta que confíe.

## Configuración de cobro ya cargada

Verificado en producción el 2026-08-27. Resuelve pendientes que el documento de contexto daba
por abiertos.

| Definición | Valor |
|---|---|
| Cuota Profesional | $8.000 — la pagan los 152 socios |
| Cuota Estudiante | $4.000 — sin socios asignados |
| Cuota Aficionado | $8.000 — sin socios asignados |
| Honorario | Sin valor cargado: exento |
| Generación | Día 1 de cada mes |
| Vencimiento | Día 10 |
| Gracia | 5 días |
| **"Cuota al día"** | **Hasta el día 15 inclusive** |
| Interés por mora | 0% |
| Cuotas al asociarse | 3 |
| Baja por deuda | 3 consecutivas, o 5 alternadas en 24 meses |

## Pendientes de decisión

1. **Desde qué mes se generan las cuotas.** Nunca se generó ninguna. Generar retroactivo crea
   deuda real para 152 personas.
2. Quién carga el contenido institucional, y con qué frecuencia. Sin esto, la vida
   institucional no es sostenible.
3. Si las 4 categorías se aplican de verdad: hoy los 152 son `Profesional`.
4. Qué se hace con los 6 workspaces de prueba. Daniel indicó que podrían eliminarse.

## Pendiente: carga manual de pagos y cuándo se cobra el fee

Planteado por Daniel el 2026-08-27.

**Qué falta.** El owner y quienes en el futuro ocupen Tesorería o Secretaría tienen que poder
registrar pagos a mano: hoy solo se acreditan los de Mercado Pago, por webhook. En el historial
del último año, **44 de 333 pagos fueron en efectivo o por transferencia** — un 13% que hoy no
se podría registrar.

Esto no es futuro: desde que existan cuotas generadas, alguien va a pagar en efectivo en la
sede, y sin dónde anotarlo el portal le va a seguir mostrando una deuda que ya saldó. Es peor
que no tener sistema.

**Lo que ya existe.** El modelo `MembershipPayment` contempla todo: `method` para distinguir
efectivo de transferencia, y `platformFeeArs` y `netAmountArs` para el fee. La lógica de
comisión también está, en puntos básicos (500 = 5%), con su validación. Falta la pantalla y la
regla.

**La regla del fee, según Daniel:** se cobra a partir de las cuotas que se abonen desde
septiembre. Los pagos previos a septiembre no pagan fee.

**Una distinción que conviene resolver antes de implementarlo.** "A partir de septiembre" puede
leerse de dos maneras, y no dan lo mismo:

1. Por **fecha de pago**: todo lo que se cobre desde el 1 de septiembre paga fee, incluso si
   salda una cuota vieja o el cargo de apertura.
2. Por **período de la cuota**: solo las cuotas de septiembre en adelante pagan fee, sin
   importar cuándo se paguen.

La segunda parece más justa: los $1.868.500 de deuda importada vienen del sistema anterior y
cobrarles comisión sería cobrar por trabajo que FotoOffice no hizo. Con la primera lectura, un
socio que regulariza en octubre pagaría fee sobre once meses de deuda vieja.

**Cuándo conviene hacerlo:** antes del 1 de septiembre, junto con la generación. Es el mismo
momento en que empiezan a existir las cuotas y, por lo tanto, los pagos.

**Además hay que definir** —ya anotado como pendiente— si el fee sale del total cobrado o se
adiciona al precio. Esa elección es por módulo y la hace el owner.
