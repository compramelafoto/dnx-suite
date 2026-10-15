# Correo a socios — etapa 3: fechas especiales, cumpleaños y aniversario de ingreso

Fecha: 05/10/2026. Sigue a `2026-10-05-correo-a-socios-etapas-1-2-design.md` y usa su base (envíos,
tandas, bajas, interruptor general).

## Qué se puede hacer

En **Comunicación → Fechas**, la institución ve un calendario de saludos y prende o apaga cada uno:

- **Saludos personales:** cumpleaños (el día del cumpleaños, a cada socio) y aniversario de ingreso
  («Hoy cumplís 10 años en la SFPR»; opción: sólo en 1, 5, 10, 15… años).
- **Fechas del año:** Año Nuevo y Fin de año, Navidad, fechas patrias y de memoria (24/3, 2/4, 25/5,
  20/6, 9/7, 17/8), 1/5, Día del Amigo, Día Mundial de la Fotografía (19/8), Día del Periodista (7/6).
- **Fechas del oficio sin fecha cargada:** Día del Fotógrafo, del Reportero Gráfico, del Camarógrafo
  y del Trabajador de Prensa. Hay versiones distintas según la fuente: vienen **sin fecha** y no se
  pueden encender hasta que la institución la confirme.
- **Fechas propias:** la institución agrega las suyas (aniversario de la SFPR, Día de Rosario…).

Cada fecha tiene asunto, texto (con `{nombre}`, `{institucion}` y, en el aniversario, `{años}`),
imagen opcional y, en las fechas del año, a qué especialidades va (vacío = a todos). Ej.: el Día del
Camarógrafo sólo a quienes tienen «Video y audiovisual». Todo viene **apagado**; cada una tiene
«Enviarme una prueba».

## Cómo sale

- La tarea programada `/api/cron/correo` (cada 10 min), desde las 9:00 hora argentina del día:
  - fechas del año encendidas cuyo día es hoy → un envío (`occasion:<ws>:<clave>:<año>`);
  - cumpleaños → un envío con los socios que cumplen hoy (`birthday:<ws>:<fecha>`), 29/2 se saluda
    el 28 en años no bisiestos (misma regla que la tarjeta del portal);
  - aniversario → los que entraron un día como hoy, con 1 año o más (`anniversary:<ws>:<fecha>`).
- Requiere el interruptor general encendido (etapa 1). Las claves únicas garantizan uno por día.
- Fechas de nacimiento e ingreso son fechas sin hora guardadas a medianoche UTC: se leen en UTC.

## Bajas

Dos temas nuevos: `efemerides` (fechas especiales) y `saludos` (cumpleaños y aniversario), además de
`blog` y `all`. La página de baja nombra el tema en lenguaje claro.

## Datos

- Tabla nueva `FotofficeMailingOccasion` (una fila por fecha configurada; sin fila rige el valor por
  defecto del catálogo en código): `key`, `kind` (`EFEMERIDE` | `BIRTHDAY` | `ANNIVERSARY`), `enabled`,
  `month`/`day` (nulos en personales y en fechas sin confirmar), `title`, `subject`, `message`,
  `imageUrl`, `specialties[]`, `milestonesOnly`.
- Columna nueva `FotofficeEmailCampaign.occasionKey` (nullable).

## Fuera de alcance

Placa de cumpleaños con la foto del socio adjunta (se puede sumar con el editor de placas), fechas
móviles (Día del Padre / de la Madre), métricas de apertura.

## Etapa 5 (05/10/2026): ciclo del socio

Sección «Ciclo del socio» en la misma pantalla (kind `LIFECYCLE`, tema de baja `novedades`, columna
`offsetDays`, todo apagado):

- **Bienvenida: completá tu perfil** — a los 7 días del ingreso, botón al portal.
- **Bienvenida: tus beneficios** — a los 30 días del ingreso, botón al portal.
- **Hace tiempo que no entrás** — socios activos con cuenta y 60 días o más sin entrar
  (`User.lastLoginAt`); como mucho una vez cada 90 días. Quien nunca activó la cuenta no entra (para eso
  está la invitación).
- **Te extrañamos (ex socios)** — a los 60 días de la baja, una vez; **nunca** a bajas por sanción;
  botón al sitio.

Los días se configuran (1 a 730). Fecha del hecho: si es fecha sola (medianoche UTC) se lee en UTC; si
tiene hora (la guardó la aplicación) se pasa a la fecha argentina. Envío diario desde las 9, uno por
correo y día (`lifecycle:<ws>:<clave>:<fecha>`).
