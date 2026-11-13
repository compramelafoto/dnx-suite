# Registro docente en FOTOFFICE — análisis y propuesta

**Para:** Daniel. **Caso:** María Belén Saldaña, que da Historia y Arte en escuelas públicas de la provincia de Santa Fe.
**Fecha:** 12/11/2026. **Estado:** análisis; no hay nada construido todavía.

## En una frase

FOTOFFICE ya tiene la base de un módulo **«Evaluaciones»**: alumnos, actividades, rúbricas y resultados. Pero está a medio hacer: los modelos de la base existen y la pantalla de corrección funciona con datos de prueba. **No hay** asistencia escolar, períodos, nota por período, boletín ni estadísticas. Lo que conviene es terminar ese módulo y convertirlo en un **registro docente completo**, en un espacio privado de Belén separado de SOYBELUZ, con una salida pensada para **pasar las notas a Mi Escuela**.

---

## 1. Qué existe hoy y qué se puede aprovechar

| Lo que hay | Dónde | Sirve para | Estado |
|---|---|---|---|
| Módulo «Evaluaciones»: `EvaluationContext`, `EvaluationStudent`, `EvaluationActivity`, `Rubric` (criterios y niveles), `EvaluationResult` | schema ~10223; `app/(shell)/evaluaciones` | Curso/materia, alumnos, exámenes y TP, rúbricas, notas | Modelos completos. Pantallas vacías («Próximo paso: cargar alumnos…») |
| Pantalla de corrección masiva con rúbrica | `components/evaluaciones/mass-grading-screen.tsx` | Corregir un TP para todo el curso | Hecha, pero con datos de prueba y sin usar |
| Importación de listas en CSV (vista previa y luego importar) | `lib/clients/importar.ts`, `lib/members/import` | Cargar el padrón de alumnos | Funciona. No lee Excel (.xlsx) |
| Acreditación de eventos, con cola **sin conexión** | `lib/eventos/acreditacion`, `eventos/[id]/puerta` | Molde para tomar asistencia desde el celular sin señal | Funciona en eventos |
| PDF con plantillas del diseñador (diplomas, carnets, facturas) | `lib/eventos/diploma.ts`, `@repo/design-studio` | Boletín e informe del alumno | Funciona |
| CSV «para Excel» | `lib/listado/csv.ts` | Planilla del curso y planilla para Mi Escuela | Funciona |
| Informes con períodos y matrices | `lib/informes/*` | Molde para las estadísticas | Funciona (son de dinero) |
| Roles y permisos por módulo | `lib/permissions/*` | Más adelante: preceptor o colega de solo lectura | Funciona |
| Vocabulario configurable (socio → alumno) | `lib/vocabulario/personas.ts` | Que el menú diga «estudiantes» | Funciona |
| Escuelas, cursos, ciclo lectivo y padrón | Modelos de CompraMeLaFoto (`School`, `SchoolCourse`, `AcademicYear`, `StudentEnrollment`) | **Sólo como referencia**: son de fotografía escolar y no pertenecen a un espacio de FOTOFFICE | No reutilizar tal cual |

**Lo que falta:** asistencia por clase, períodos configurables, nota de período, recuperatorios, promedios ponderados, libro de temas, boletín, estadísticas, alertas, gráficos (FOTOFFICE no tiene librería de gráficos), exportar a Excel nativo y uso sin conexión en el aula.

---

## 2. Mi Escuela (Santa Fe): qué pide y cómo llegar

Según el [manual oficial del Registrador de Calificaciones de secundaria](https://educacion.santafe.gob.ar/wp-content/uploads/sites/2/2024/09/MANUAL_ROL_REG_CALIFICACIONES_SEC.pdf):

- Se entra con **ID Ciudadana** y se elige la escuela. Una docente que trabaja en varias escuelas ve la lista y elige.
- Las notas se cargan por **Estructura → Sección (curso) → Materia → Ciclo lectivo**. Aparece la lista de estudiantes y, por cada uno, un desplegable por período y otro para la nota final.
- La escala es **numérica entera del 1 al 10**. Además existen estos valores especiales:
  - **Exceptuado** (sale «EXCEPT»).
  - **No corresponde**.
  - **Sin calificación** (sale «SC»).
  - **Ausente** (sólo diciembre y febrero; sale «AUS»).
  - **En proceso** (para la nota final, cuando todavía falta el período de acompañamiento).
- Cada estudiante figura como «R» (regular) o «NR» (no regular). Con fondo gris aparecen quienes se dieron de baja por cambio de sección, cambio de escuela o abandono.
- Las fechas de cada período y los días habilitados para cargar («Carga desde / Carga hasta») salen del **Calendario Escolar → Períodos de Calificación**.
- Se carga por partes y se **Guarda**. Al final se toca **Confirmar Período**, que equivale a entregar la planilla en papel. Para corregir hay que «Desconfirmar», y sólo mientras la libreta no esté autorizada.
- Hay que cargar las notas de los períodos, la nota final, el período de acompañamiento (febrero) y las mesas de examen.
- **No tiene importación desde planilla ni conexión con otros sistemas (API).** Todo se carga a mano.

**La propuesta para «migrar» las notas**, de lo más seguro a lo más ambicioso:

1. **Planilla «Para Mi Escuela»** (etapa 1). Por curso y período, muestra la lista **en el mismo orden que Mi Escuela** (apellido y nombre, con DNI para comprobar). Al lado va la nota ya convertida a lo que Mi Escuela acepta: entero del 1 al 10, o el código especial. Se puede abrir en el celular al lado de la computadora, o imprimir. Cada renglón tiene un tilde «pasado», y el período queda marcado «confirmado en Mi Escuela» con la fecha. También avisa los días habilitados para cargar.
2. **Control de diferencias** (etapa 2). Belén baja de Mi Escuela el archivo de la planilla (el botón «Descargar» existe) y lo sube a FOTOFFICE. FOTOFFICE compara y le marca qué notas no coinciden o qué estudiantes faltan.
3. **Ayudante que completa los desplegables** (etapa 3, a decidir). Sería una extensión del navegador que Belén usa **con su propia sesión ya iniciada** y que completa la pantalla con las notas de FOTOFFICE. Ella revisa y toca Guardar y Confirmar. **Nunca guardamos su contraseña de ID Ciudadana** ni entramos en su nombre. Tiene dos riesgos: se rompe si el Ministerio cambia la pantalla, y conviene consultar si está permitido. Por eso queda para el final y con su autorización.

---

## 3. Ideas tomadas de Calificador Docente

[Calificador Docente](https://calificadordocente.com) es una plataforma gratuita creada por docentes de La Plata y la usan miles de docentes. Según las notas de prensa ([0221](https://www.0221.com.ar/la-plata/docentes-la-plata-crearon-una-innovadora-web-organizar-clases-informes-y-evaluaciones-escolares-n126419), [El Día](https://www.eldia.com/nota/2026-4-19-2-32-11-ingenio-platense-docentes-crearon-una-web-que-ayuda-con-el-papeleo-del-aula-la-ciudad)), ofrece:

| Lo que tiene | Cómo lo tomamos |
|---|---|
| Asistencia rápida, con comentario y foto adjunta (acta, TP) | Asistencia de un toque y la opción de adjuntar una foto a la clase o al estudiante |
| Porcentaje de asistencia automático | Porcentaje por estudiante, por período y por ciclo, con la regla de regularidad configurable |
| Notas diarias, de TP y de exámenes, con promedios | Tipos de evaluación con peso, y una nota de período sugerida que la docente puede cambiar |
| Quién no acreditó los contenidos | Alertas tempranas de estudiantes en riesgo |
| Informes en PDF por curso y por estudiante | Boletín, informe pedagógico y planilla del curso |
| Licencias docentes | Registro de licencias y clases no dadas (también paros, jornadas y feriados) |
| Calendario de planificación | Planificación anual y libro de temas |
| Página web propia de la docente | Ya existe en FOTOFFICE (como el sitio de SOYBELUZ) |
| Funciona sin conexión | Lo hacemos con el patrón de la acreditación de eventos |

FOTOFFICE puede sumar lo que Calificador Docente no tiene: **la salida para Mi Escuela de Santa Fe**, rúbricas, estadísticas que comparan cursos, y todo en el mismo lugar donde ella ya tiene su Club.

---

## 4. Lo que necesita una docente: el registro completo

Ordenado como lo vive una docente durante el año.

### Antes de empezar el ciclo
- **Escuelas**: nombre, número, CUE, turno. Puede tener varias en el mismo espacio.
- **Cursos**: año, división, turno y materia (por ejemplo, «3.º B · Historia · TM · Esc. N.º 123»), con el **ciclo lectivo**.
- **Horario semanal** de cada curso. Con eso FOTOFFICE arma solo el calendario de clases, y se le marcan feriados, jornadas, paros y licencias.
- **Esquema de períodos por curso**: bimestral, trimestral, cuatrimestral o personalizado, con fechas. Habrá un **modelo «Santa Fe secundaria»** con las fechas que publica Mi Escuela, para no tipearlas en cada curso.
- **Escala**:
  - Numérica 1–10, con o sin decimales.
  - Conceptual (Excelente / Muy bueno / Bueno / Regular / Insuficiente), o Aprobado / No aprobado.
  - Nota mínima de aprobación y cómo se redondea para Mi Escuela.
- **Criterios de cálculo**: peso de cada tipo de evaluación (por ejemplo: exámenes 50 %, TP 30 %, carpeta y participación 20 %), qué hace un recuperatorio (reemplaza, promedia o se queda con la mejor nota) y cómo cuenta una entrega tarde.
- **Padrón**:
  - Pegar la lista desde Excel o desde la planilla bajada de Mi Escuela: apellido, nombre, DNI, orden.
  - Condición R/NR.
  - Altas y bajas con fecha y motivo (pase, cambio de sección, abandono). Quien se va queda en gris, como en Mi Escuela.
  - Marca reservada de **PPI o adecuaciones** (proyecto pedagógico individual), visible sólo para la docente.

### Todos los días, en el aula (desde el celular)
- **Pasar lista en un toque**: todos presentes por defecto y se tocan los ausentes. Estados: presente, ausente, tarde, se retiró, justificada. Tiene que andar **sin señal** y sincronizar después.
- **Libro de temas**: qué se dio en la clase (contenido y actividad), unido a la planificación. Es lo que piden directivos y supervisores.
- **Observaciones rápidas** de un estudiante: participación, conducta, si no trajo material. Con fecha, y se pueden agregar por voz o con una foto.
- **Entregas**: quién entregó el TP, a tiempo o tarde, y quién no.

### Al evaluar
- **Evaluación**: tipo (escrita, oral, TP individual o grupal, exposición, carpeta, participación, autoevaluación), fecha, unidad o contenidos, peso, escala y si es recuperatorio de otra.
- **Planilla de notas del curso**, como una hoja de cálculo: estudiantes en filas y evaluaciones en columnas, con carga rápida con el teclado.
- **Rúbricas**: ya están en la base. Se corrige por criterio y la nota sale sola; la pantalla de corrección masiva ya está hecha.
- **TP grupal**: se arman grupos y la nota se pone una vez para todo el grupo, con ajuste individual.
- **Ausente al examen**: queda pendiente, con fecha de recuperatorio.

### Al cerrar cada período
- **Nota de período sugerida** con los pesos configurados. La docente la **confirma o la cambia**, con el motivo, porque la nota final la decide la docente y no el sistema.
- **Informe cualitativo** por estudiante: un párrafo de trayectoria, logros y lo que falta. Tiene un **banco de frases** reutilizables y, más adelante, un borrador hecho por IA a partir de las notas y observaciones, que ella corrige.
- **Planilla «Para Mi Escuela»** (sección 2, si la escuela usa Mi Escuela).
- **Cierre del período**: después de cerrado, lo que se cambie queda registrado.

### Fin de ciclo
- Nota final, **período de acompañamiento** (diciembre y febrero), mesas de examen y condición (regular, libre, equivalencia, saberes adquiridos, PPI), igual que Mi Escuela.
- **Pase al ciclo siguiente**: el curso nuevo se arma copiando estructura y criterios, sin las notas.

### Informes que se imprimen o se mandan
- **Boletín por estudiante** en PDF: notas por período, asistencia e informe cualitativo.
- **Informe pedagógico** del estudiante, para reuniones con la familia, equipo directivo o EDTE (equipo de trayectorias).
- **Planilla del curso** completa, en PDF o Excel.
- **Informe del curso para la dirección**: aprobados, en riesgo y asistencia.

### Estadísticas para sacar conclusiones
- **Por evaluación**: cómo se reparten las notas, porcentaje de aprobados y promedio. Así se ve si el examen fue muy difícil.
- **Por criterio de rúbrica**: en qué criterio le va peor a todo el curso. Eso dice qué hay que volver a enseñar.
- **Por estudiante**: cómo evoluciona período a período, asistencia contra nota, y entregas a tiempo o tarde.
- **Comparación entre divisiones**: la misma materia en 3.º A y 3.º B.
- **Alertas tempranas**:
  - Inasistencias seguidas o por encima del límite.
  - Dos notas bajas seguidas.
  - TP sin entregar.
  - Cerca de quedar libre.
  - Es el equivalente propio del sistema de alertas que usa Mi Escuela.
- **Avance del programa**: cuánto de lo planificado se dio, según el libro de temas.

### Planificación (etapa posterior)
- Planificación anual por curso: unidades, contenidos, capacidades, criterios e instrumentos de evaluación, con fechas tentativas.
- Las clases del libro de temas y las evaluaciones se cuelgan de cada unidad.

---

## 5. Privacidad: son datos de menores

- **Espacio propio y privado de cada docente** (el de Belén: «Belén Saldaña · Docente»), **separado de SOYBELUZ**. Nada de esto aparece en el sitio público, en el Club ni en las comunicaciones.
- Los estudiantes **no** se guardan como Clientes ni Socios, sino en la tabla propia del módulo (`EvaluationStudent`, ampliada). Así no se mezclan con ventas, correos ni campañas.
- Sólo Belén ve los datos. Las marcas de PPI y las observaciones sensibles se ocultan en los informes salvo que ella decida mostrarlas.
- Ella puede **exportar todo** cuando quiera, porque los datos son suyos. Hay que cumplir la Ley 25.326 de Protección de Datos Personales.
- En las etapas 1 a 3 no entran ni las familias ni los estudiantes. Su acceso llega en la etapa 4, con invitación y sólo a lo que la docente publique.

---

## 6. Todo configurable: escuela → curso → estudiante (pedido de Daniel, 12/11)

El registro **no se hace a medida de Belén ni de SOYBELUZ**. Es un módulo de FOTOFFICE que puede usar **cualquier docente, de cualquier escuela y provincia**. Belén es la primera.

Cada regla se define en tres niveles, y cada nivel **hereda del anterior salvo que lo cambies**:

| Nivel | Qué se configura | Ejemplo |
|---|---|---|
| **Escuela** (valores por defecto) | Ciclo lectivo y calendario (feriados, receso); esquema de períodos con sus fechas; escala y nota de aprobación; redondeo; estados de asistencia y límite de inasistencias; **destino de las notas** (Mi Escuela de Santa Fe, otra plataforma provincial, planilla propia o ninguno); formato del boletín | «Esc. N.º 123: cuatrimestres, 1 a 10, se aprueba con 6, se carga en Mi Escuela» |
| **Curso, división y materia** | Puede cambiar cualquier regla de la escuela, y además: horario semanal, tipos de evaluación y sus pesos, regla del recuperatorio, entregas tarde, plantilla de rúbrica, planificación y quién más lo ve | «3.º B Historia: exámenes 50 %, TP 30 %, carpeta 20 %; el recuperatorio reemplaza la nota» |
| **Estudiante** | Puede cambiar las reglas del curso: PPI o adecuación con su propia escala o criterios, materia exceptuada o «no corresponde», condición (regular, libre, equivalencia), fecha de alta y de baja, recuperatorio con otra fecha, y qué ve su familia en el portal | «Juan (PPI): escala conceptual y sin examen escrito» |

**Cómo se ve en la pantalla:** cada regla muestra de dónde viene («de la escuela», «cambiado en este curso»), con un botón **«volver a la regla de la escuela»**. Al crear un curso nuevo se elige la escuela y ya viene todo configurado.

**Modelos preparados:** «Santa Fe secundaria (Mi Escuela)» es el primero. Después se pueden sumar otras provincias o niveles sin tocar código: son conjuntos de valores por defecto para la escuela.

**La salida hacia Mi Escuela es un destino más, no una parte fija del sistema.** Una escuela que no la usa elige «planilla propia» y no ve nada de Mi Escuela.

## 7. Cómo se construiría

- **Módulo nuevo «Registro docente»** (familia *formación*), disponible para cualquier espacio de FOTOFFICE, sin depender de la venta de cursos. Absorbe el actual «Evaluaciones».
- **Configuración en cascada**: una tabla de reglas por escuela, otra de cambios por curso y otra de cambios por estudiante. La regla que se aplica sale de una **función pura con pruebas** («resolver regla») que mira estudiante, después curso y después escuela.
- **Se amplía lo que ya existe en la base**:
  - `EvaluationContext` pasa a ser el curso escolar: escuela, ciclo, año, división, turno, materia, esquema de períodos y escala.
  - `EvaluationStudent` suma apellido, DNI, orden, condición R/NR, alta y baja.
  - `EvaluationActivity` suma tipo, fecha, período, peso y «recupera a».
- **Modelos nuevos**:
  - `Escuela`.
  - `PeriodoDeCalificacion`: fechas y días de carga en Mi Escuela.
  - `ClaseDictada`: fecha, libro de temas y licencia o paro.
  - `Asistencia`.
  - `NotaDePeriodo`: sugerida, final, motivo y «pasada a Mi Escuela».
  - `Observacion`.
  - `InformeCualitativo`.
- **Cálculo como funciones puras con pruebas**: promedios, pesos, recuperatorios, redondeo a Mi Escuela, porcentaje de asistencia y alertas. Es el corazón del sistema y no puede fallar.
- **Gráficos con SVG propio**, sin sumar librerías. La memoria registra que una dependencia nueva ya rompió otras apps.
- **Sin conexión**: se reutiliza la cola de la acreditación de eventos para la asistencia y el libro de temas.
- **Excel**: primero el CSV «para Excel» que ya existe. El `.xlsx` nativo después, y con cuidado por la misma regla de dependencias.

---

## 8. Etapas propuestas

| Etapa | Qué incluye | Para qué le sirve |
|---|---|---|
| **1. El registro diario** | Escuelas, cursos, ciclo y horario; padrón pegado desde Excel; asistencia de un toque desde el celular; evaluaciones y planilla de notas; períodos configurables con nota sugerida y final; **planilla «Para Mi Escuela»** | Deja el papel y llega al cierre del período con todo listo para cargar |
| **2. Informes y conclusiones** | Boletín e informe pedagógico en PDF; libro de temas; observaciones; estadísticas por evaluación, estudiante y curso; alertas tempranas; control de diferencias con Mi Escuela | Detecta a tiempo a quién ayudar y tiene los papeles que le piden |
| **3. Lo avanzado** | Rúbricas con corrección masiva (la pantalla ya existe); TP grupales; sin conexión completo; banco de frases y borrador de informe por IA; planificación anual; licencias; ayudante que completa Mi Escuela | Ahorra horas en cada cierre |
| **4. Portal de estudiantes y familias** (pedido de Daniel, 12/11) | Cada estudiante, y su madre, padre o tutor, entra a su perfil y ve sus notas por período, asistencia, entregas pendientes, devoluciones de cada evaluación, el informe cualitativo y el boletín para bajar. También el calendario de exámenes y TP del curso | La familia acompaña sin esperar el boletín, y la docente recibe menos consultas |

**Cómo sería la etapa 4:**
- Se apoya en el **portal que ya existe** (`app/portal`, el del socio y alumno de cursos) y en el vínculo de personas (`FotofficePersonRelation`). Hace falta sumar el vínculo «tutor o tutora de», con correo y teléfono.
- **Acceso por invitación**: la docente invita desde el padrón, con el correo del estudiante o de quien es responsable. Un menor ve sólo lo suyo, y una familia con dos hijos ve a los dos.
- **La docente elige qué se publica y cuándo**:
  - Una nota se ve recién cuando ella la «publica» (por ejemplo, después de devolver los exámenes).
  - El informe cualitativo, recién cuando cierra el período.
  - Las observaciones privadas y las marcas de PPI **nunca** se muestran.
- Avisos opcionales por correo: «hay una nota nueva», «tenés un TP pendiente para el viernes».
- **Mensajes con la familia, sólo si ella lo quiere.** Mi Escuela ya tiene su cuaderno de comunicaciones, y duplicarlo puede generar más trabajo que el que ahorra.
- **Permisos de las familias**: hay que confirmar con la escuela, porque los datos oficiales ya están en el «Perfil Familia» de Mi Escuela. Lo de FOTOFFICE sería el seguimiento del aula (cada TP y cada devolución), no la libreta oficial.

---

## 9. Lo que hay que preguntarle a Belén antes de empezar

1. ¿En qué nivel da clases: secundaria, primaria o los dos? En cuántas escuelas, en cuántos cursos, y con cuántos estudiantes por curso, más o menos.
2. ¿Qué esquema de períodos usa su escuela este año: trimestres o cuatrimestres? ¿Cambia según la escuela?
3. ¿Ella misma carga las notas en Mi Escuela, con el rol de Registrador de Calificaciones? ¿Y la asistencia la carga ella o el preceptor?
4. ¿Cómo calcula hoy la nota del período? ¿Usa pesos o lo decide «a ojo» con la trayectoria? ¿Qué hace con los recuperatorios?
5. ¿Qué le piden directivos o supervisión: libro de temas, planificación, informes de trayectoria? ¿Con qué formato?
6. ¿Usa rúbricas? ¿Corrige en papel y después pasa la nota?
7. ¿Toma lista en el aula con señal, o hace falta que funcione sin internet?
8. ¿Quiere que un preceptor o una colega pueda ver algo, o es sólo para ella? Para la etapa 4: ¿su escuela permite compartir notas del aula con las familias por fuera de Mi Escuela?
9. ¿Le sirve una muestra real, como una planilla de un curso (sin nombres) y un boletín, para armar las pantallas iguales a lo que ya conoce?

Estas preguntas se pueden mandar con el mismo formulario de alta (`/alta/<token>`) como un cuestionario nuevo, `registro-docente-v1`.

---

## 10. Etapa 1 construida (13/11/2026)

**Qué hay:** módulo `registro-docente` (menú «Registro docente»: «Escuelas y cursos» y «Pasar lista»), con tablas propias `Docente*` (no se tocó «Evaluaciones»: en producción ni siquiera existe su tabla `EvaluationStudent`; se absorbe más adelante).

**Decisiones tomadas sin preguntar (se pueden cambiar):**
- **Reglas en cascada** modelo → escuela → curso → estudiante. Cada nivel guarda sólo lo que cambia; «Volver a la regla de…» borra el cambio. Función pura `resolverReglas` con pruebas (`lib/registro-docente/reglas.ts`).
- **Pesos por categoría**: Exámenes (escrito, oral), Trabajos prácticos (TP, TP grupal, exposición), Carpeta, Participación (participación, autoevaluación). Dentro de cada categoría, promedio simple. Si una categoría todavía no tiene notas, su peso se reparte entre las demás.
- **Pendientes**: ausente al examen, «no entregó» o sin cargar no cuentan y se muestran como pendientes; exceptuado no cuenta. Si faltó al original, vale el recuperatorio.
- **Nota final del ciclo sugerida** = promedio de las notas finales de los períodos.
- **Mi Escuela**: entero del 1 al 10 con «desde ,50 sube», o el valor especial. La planilla CSV trae además la nota con decimales.
- **Llegadas tarde**: por omisión NO suman falta (`faltaPorTarde = 0`). Hay que preguntarle a Belén cuánto suma en su escuela (¿media falta?) y cargarlo en las reglas de la escuela.
- **«Anoto el horario en el que llego»**: como está en primera persona, hay dos cosas: la hora de llegada de cada estudiante tarde y un campo «Llegué a las» de la docente en cada clase.
- **Sin señal**: la planilla de un curso y un día se guarda en el celular y se manda entera, de forma idempotente (de dos versiones gana la anotada después). Va por una ruta (`/api/registro-docente/asistencia`) y no por una acción de servidor, porque el identificador de una acción cambia en cada despliegue. Hay que **abrir la pantalla con señal** antes de entrar al aula: sin un *service worker*, la página no se puede abrir de cero sin conexión (queda para la etapa 3).
- **Privado**: el personal sin roles no ve el módulo (nivel NONE), y un espacio con el Registro docente no tiene portada pública en `/w/<slug>`.

**Caso Belén:** espacio `ws_belen_docente` («Belén Saldaña · Docente»), separado de SOYBELUZ, dueña `belenfister@gmail.com`. Escuela Juan Chassaing N.° 109 con el modelo Santa Fe y sus reglas (decimales, aprueba con 7, 15 faltas, pesos 50/30/10/10, recuperatorio promedia). Cursos 1.° a 5.° de Historia, turno mañana, ciclo 2026, sin división (no la dio) y **sin estudiantes**: el padrón lo pega ella. Script: `scripts/registro-docente-cargar-belen.ts`.

**Siguientes (etapas 2 a 4):** horario semanal y calendario de clases (feriados, paros); boletín e informe pedagógico en PDF (incluido el de estudiantes con discapacidad, lo que más le importa); estadísticas y comparación de cursos con SVG propio; alertas tempranas; libro de temas y observaciones; control de diferencias con Mi Escuela; acceso de una colega; rúbricas y TP grupal; service worker; portal de estudiantes y familias.
