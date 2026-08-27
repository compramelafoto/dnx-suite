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

### Google Contacts

Cada socio nuevo debe agendarse **automáticamente** en los contactos de
`sfprosario@gmail.com`, con número de socio, nombre, apellido, email, teléfono, domicilio y
el resto de su información, y **mantenerse sincronizado** ante cada cambio.

### Google Calendar

La agenda de reservas debe estar asociada al calendario de la Sociedad.

## Pendientes de decisión

1. Quién carga el contenido institucional, y con qué frecuencia. Sin esto, la vida
   institucional no es sostenible.
2. Qué significa exactamente "cuota al día": si hay período de gracia y desde cuándo cuenta.
   Habilita sorteos y beneficios, así que no es un detalle.
3. Si las 4 categorías de socio (Estudiante, Profesional, Aficionado, Honorario) se aplican
   de verdad: hoy los 152 son `Profesional`.
4. Qué se hace con los 6 workspaces de prueba. Daniel indicó que podrían eliminarse.
