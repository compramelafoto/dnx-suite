# DNX Bot — Etapa 2: acompañamiento escolar y saludos según la situación del fotógrafo

**Fecha:** 12/10/2026 · **Estado:** diseño para revisión · **Pedido por:** Daniel Cuart
**Base:** DNX Bot etapa 1 en producción (`2026-10-11-dnx-bot-design.md`), abierto a todos los fotógrafos desde el 12/10.

## 1. Objetivo

1. Que el bot **le hable primero** a cada fotógrafo según su situación (recién llegado, nunca vendió, nunca hizo escolar) y lo lleve a la acción siguiente.
2. Que el fotógrafo que arma un **álbum escolar** se sienta acompañado todo el tiempo: el bot sabe en qué paso está, le dice qué falta y lo hace por él cuando se puede.
3. Llegar también a los que **no entran al panel**, por mail.

**Criterio de éxito:** más fotógrafos con su primera venta y más álbumes escolares completos (escuela + preventa publicada) que antes, medido en el resumen diario.

## 2. Datos reales (producción CLF, 12/10/2026)

| Segmento | Fotógrafos |
|---|---|
| Registrados (total) | 740 |
| Registrados en los últimos 14 días | 33 |
| Sin ningún álbum | 572 |
| Con álbum pero sin ninguna venta | 81 |
| Vendieron pero nunca hicieron escolar | 109 |
| Con algún álbum escolar | 9 |
| Aceptan mails de novedades (`marketingOptIn`) | 560 |
| Sin entrar al panel hace 30+ días | 649 |

La mayoría nunca creó un álbum y casi nadie usa la parte escolar: hay mucho para ganar.

## 3. Decisiones tomadas

| Tema | Decisión |
|---|---|
| Canal | **B: panel + mail** a los que hace tiempo no entran (decisión de Daniel, 11/10) |
| Saludo | Según la hora argentina («buen día» hasta las 12:59, «buenas tardes» hasta las 19:59, «buenas noches» después) y con el nombre |
| Forma en el panel | **Globito al lado del robot**, no se abre solo. Una vez por campaña |
| Si dice «No, gracias» | No se vuelve a mostrar esa campaña por 90 días |
| Mail | Uno solo por campaña y por fotógrafo, sólo con `marketingOptIn`, con enlace de baja (ruta `/unsubscribe` existente), por Resend |
| Prioridad entre segmentos | Un fotógrafo ve **una** campaña por vez, en este orden: escolar en curso → recién llegado → nunca vendió → nunca hizo escolar |

## 4. Segmentos y mensajes

Se calculan en el servidor, en cada carga de `/api/bot/estado`:

| Segmento | Condición | Globito (ejemplo) | Botones |
|---|---|---|---|
| `escolar_en_curso` | Tiene un álbum escolar (`schoolId` no nulo, o `mode = SCHOOL`) con pasos pendientes | «Buenas tardes, Martín. Tu álbum escolar **Egresados** va por el paso 4 de 11: falta armar la preventa. ¿Seguimos?» | Seguimos · Ahora no |
| `nuevo` | Registrado hace ≤14 días y sin álbum | «¡Buen día, Martín! Soy DNX Bot. ¿Te ayudo a armar tu primer álbum? Son unos minutos.» | Sí, ayudame · Ahora no |
| `sin_ventas` | Tiene álbum y ninguna venta pagada > $0 | «Buenas noches, Martín. Vi que todavía no vendiste. ¿Revisamos juntos qué le falta a tu álbum para vender?» | Revisemos · Ahora no |
| `sin_escolar` | Vendió y nunca tuvo álbum escolar | «¡Buenas tardes, Martín! ¿Te dedicás a la fotografía escolar? Si querés, te enseño a configurar todo para automatizarlo: preventa, cursos, plantillas y entrega.» | Sí, quiero aprender · Ya lo hago · No, gracias |

Tocar un botón abre la ventana del bot y manda ese texto como primer mensaje, así la conversación arranca en el tema.

## 5. Acompañamiento escolar: los 11 pasos

`computeSchoolSetupProgress(userId, albumId?)` devuelve los pasos con estado `hecho | pendiente | no_aplica`, calculado de la base (sin IA):

| # | Paso | Hecho cuando | Cómo ayuda el bot |
|---|---|---|---|
| 1 | Crear la escuela | `School` con `ownerId` = usuario | **Acción**: `crear_escuela` (nombre, localidad) |
| 2 | Cargar cursos y divisiones | `SchoolCourse` > 0 o inscripciones del año | **Acción**: `cargar_cursos` (lista «5° A, 5° B…») |
| 3 | Invitar a alguien de la escuela (opcional) | Invitación PENDING/ACCEPTED u organizador ACTIVE | **Acción**: `invitar_admin_escuela` (nombre + mail; manda la invitación existente) |
| 4 | Crear el álbum vinculado a la escuela | Álbum con `mode = SCHOOL` y `schoolId` | **Acción**: `vincular_album_a_escuela` (álbum existente) o enlace al asistente de creación |
| 5 | Elegir cómo se identifica cada alumno | `studentIdentificationMode` no nulo (+ lista si ROSTER_*) | **Acción**: `elegir_identificacion_alumnos` |
| 6 | Armar el pack de preventa | `PackDefinition` activo con ≥1 beneficio | Guía + enlace a la pestaña Preventa (sin acción: el armado tiene muchos pasos) |
| 7 | Elegir la plantilla de diseño (si hay impresos) | Todo beneficio físico REQUIRED con `templateV2Id` | Guía + enlace |
| 8 | Comisión de la escuela (opcional) | `organizerCommissionEnabled` + % | **Acción**: `configurar_comision_escuela` |
| 9 | Publicar la preventa | La precompra pública devuelve packs activos | Verificación + enlace a compartir |
| 10 | Subir las fotos y avisar a las familias | Fotos > 0 y aviso «ya están las fotos» enviado | Enlace a subir; **acción**: `avisar_familias_fotos_listas` |
| 11 | Revisar diseños y entregar | Ítems DELIVERED / pendientes por estado | Resumen de pendientes + enlace a Pedidos escolares |

- **Alerta nueva:** álbum con `mode = SCHOOL` y sin `schoolId` → «queda a medias: no aparecen alumnos y la preventa funciona como común». El bot ofrece vincularlo (paso 4).
- Herramienta de lectura `ver_progreso_escolar` (para el modelo) y **tarjeta de progreso** en la burbuja: lista de 11 pasos con ✓ y el próximo resaltado, con «Hacelo por mí» (si hay acción) o «Abrir» (enlace).
- Todas las acciones nuevas siguen las reglas de la etapa 1: propuesta → **Confirmar** → el servidor ejecuta, dueño verificado, registro con valor anterior, deshacer cuando corresponde. Invitar y avisar a familias **no se pueden deshacer** (mandan mails) y lo dicen en la tarjeta.
- Reutilizar la lógica de las rutas existentes (`/api/fotografo/schools`, `…/courses`, invitaciones, PATCH de álbum, `preventa-aviso`), extrayendo funciones compartidas como en la etapa 1, sin cambiar su comportamiento.

## 6. Mail a los que no entran

- Cron diario (10:00 hora argentina) que elige hasta **50 fotógrafos por día** con `marketingOptIn = true`, sin entrar hace 30+ días, que no recibieron esa campaña.
- Un mail por segmento (nunca vendió / nunca hizo escolar), corto, con un botón «Entrar y que DNX Bot me ayude» → `/fotografo?dnxbot=<campaña>`. Al entrar con ese parámetro, la burbuja se abre con el globito de esa campaña.
- Enlace de baja que apaga `marketingOptIn` (ruta existente).
- Registro en `BotOutreach` (abajo) para no repetir y para medir.
- Interruptor propio: `CLF_BOT_OUTREACH_EMAIL_ENABLED=1` (apagado hasta que Daniel apruebe el texto del mail).

## 7. Datos nuevos

`BotOutreach`: `id`, `platform`, `userId`, `campaign` (`nuevo | sin_ventas | sin_escolar | escolar_en_curso`), `channel` (`panel | email`), `status` (`SHOWN | CLICKED | DISMISSED | DECLINED | SENT | BOUNCED`), `answer`, `createdAt`, `updatedAt`; único (`platform`, `userId`, `campaign`, `channel`). Migración a mano + registro, como en la etapa 1.

## 8. Conocimiento

Nueva sección «Venta escolar» en la guía: qué es la preventa canjeable, cómo compran las familias, canjes, identificación de alumnos, plantillas, entrega con QR, comisión de la escuela. Basada en el código y la auditoría escolar (`docs/compramelafoto/AUDITORIA-VENTA-ESCOLAR.md`), sin prometer partes que nunca se usaron en producción (selfie escolar).

## 9. Medición (resumen diario)

Agregar: globitos mostrados / tocados / rechazados por campaña; mails enviados y fotógrafos que entraron después; fotógrafos con primera venta en el mes; álbumes escolares que llegaron al paso 9 (preventa publicada).

## 10. Fuera de esta etapa

Bot para compradores (etapa 3, plan propio), WhatsApp, creación completa del pack de preventa por el bot, diseño de plantillas por el bot.

## 11. Riesgos

- El circuito escolar casi no se usó de punta a punta: el primer fotógrafo que lo recorra con el bot debería ser alguien de confianza (sugerencia: Belén).
- Mails: cuidar reputación del dominio (50/día, sólo con permiso, baja visible).
- Que el globito moleste: una vez por campaña, nunca se abre solo, «No, gracias» respeta 90 días.
