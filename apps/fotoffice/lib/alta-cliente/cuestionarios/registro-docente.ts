import type { Cuestionario, Opcion } from "../tipos";

/**
 * Cuestionario para una docente de escuela (primaria o secundaria) que quiere llevar su registro
 * en FOTOFFICE: cursos, asistencia, notas, períodos, informes y el pase a Mi Escuela (Santa Fe).
 * Lo estrenó María Belén Saldaña (Historia y Arte, escuelas públicas de Santa Fe), pero sirve para
 * cualquier docente: las reglas se piden por escuela y después se ajustan por curso y por estudiante,
 * igual que en el módulo. Ver `docs/analisis-registro-docente.md`.
 */

const SI_NO_A_VECES: Opcion[] = [
  { valor: "si", etiqueta: "Sí" },
  { valor: "a_veces", etiqueta: "A veces / depende del curso" },
  { valor: "no", etiqueta: "No" },
];

const IMPORTANCIA: Opcion[] = [
  { valor: "ya", etiqueta: "Lo necesito ya" },
  { valor: "despues", etiqueta: "Me sirve, pero puede esperar" },
  { valor: "no", etiqueta: "No lo usaría" },
];

export const CUESTIONARIO_REGISTRO_DOCENTE: Cuestionario = {
  clave: "registro-docente-v1",
  titulo: "Tu registro docente",
  bienvenida:
    "Queremos armarte un registro para tus cursos de la escuela: asistencia, notas, períodos, informes y la planilla lista para pasar a Mi Escuela. Con estas respuestas lo hacemos igual a como trabajás vos. Se guarda solo mientras escribís y podés completarlo en varias veces. No pongas nombres de estudiantes: con cantidades y ejemplos alcanza.",
  secciones: [
    {
      id: "escuelas",
      titulo: "Tus escuelas y cursos",
      preguntas: [
        {
          id: "nivel",
          titulo: "¿En qué nivel das clases?",
          tipo: "opciones",
          obligatoria: true,
          conOtro: true,
          opciones: [
            { valor: "secundaria", etiqueta: "Secundaria" },
            { valor: "primaria", etiqueta: "Primaria" },
            { valor: "adultos", etiqueta: "Educación de jóvenes y adultos" },
            { valor: "terciario", etiqueta: "Terciario / profesorado" },
          ],
        },
        {
          id: "cursos",
          titulo: "Tus cursos este año",
          ayuda: "Un renglón por curso y materia. Así armamos todo de una vez.",
          tipo: "lista",
          textoAgregar: "Agregar otro curso",
          campos: [
            { id: "escuela", titulo: "Escuela (nombre o número)", tipo: "texto" },
            { id: "curso", titulo: "Año y división", tipo: "texto" },
            { id: "materia", titulo: "Materia", tipo: "texto" },
            {
              id: "turno",
              titulo: "Turno",
              tipo: "opcion",
              opciones: [
                { valor: "manana", etiqueta: "Mañana" },
                { valor: "tarde", etiqueta: "Tarde" },
                { valor: "noche", etiqueta: "Noche" },
              ],
            },
            { id: "estudiantes", titulo: "Cantidad de estudiantes", tipo: "numero" },
            { id: "horario", titulo: "Días y horas de clase", tipo: "texto" },
          ],
        },
        {
          id: "ciclo_inicio",
          titulo: "¿Lo querés empezar a usar en lo que queda de este año o para el ciclo lectivo 2027?",
          tipo: "opcion",
          obligatoria: true,
          opciones: [
            { valor: "ahora", etiqueta: "Ahora, para cerrar este año" },
            { valor: "2027", etiqueta: "Desde marzo de 2027" },
            { valor: "los_dos", etiqueta: "Ahora para probar y en serio en 2027" },
          ],
        },
      ],
    },
    {
      id: "mi_escuela",
      titulo: "Mi Escuela",
      intro: "Mi Escuela no deja importar planillas: las notas se cargan a mano. Queremos que te llegue todo listo para copiar. Si ninguna de tus escuelas usa Mi Escuela, pasá a la sección siguiente.",
      preguntas: [
        {
          id: "mi_escuela_quien",
          titulo: "¿Quién carga las notas de tus materias en Mi Escuela?",
          tipo: "opcion",
          obligatoria: true,
          conOtro: true,
          opciones: [
            { valor: "yo", etiqueta: "Yo, con el rol de Registrador de Calificaciones" },
            { valor: "otra_persona", etiqueta: "Se las paso a alguien (secretaría, preceptoría)" },
            { valor: "depende", etiqueta: "Depende de la escuela" },
          ],
        },
        {
          id: "mi_escuela_como_pasa",
          titulo: "¿Cómo se las pasás a esa persona?",
          tipo: "texto",
          placeholder: "Planilla en papel, Excel por correo, WhatsApp…",
          mostrarSi: { pregunta: "mi_escuela_quien", distintoDe: "yo" },
        },
        {
          id: "mi_escuela_asistencia",
          titulo: "La asistencia en Mi Escuela, ¿quién la carga?",
          tipo: "opcion",
          opciones: [
            { valor: "preceptor", etiqueta: "Preceptoría" },
            { valor: "yo", etiqueta: "Yo" },
            { valor: "no_se", etiqueta: "No sé" },
          ],
        },
        {
          id: "mi_escuela_dificil",
          titulo: "¿Qué es lo más pesado o lo que más errores te trae al cargar en Mi Escuela?",
          tipo: "parrafo",
        },
        {
          id: "mi_escuela_ayudante",
          titulo: "Si pudiéramos armar un ayudante que complete los desplegables de Mi Escuela mientras vos estás conectada (vos revisás y confirmás), ¿lo usarías?",
          ayuda: "Nunca te pediríamos tu clave de ID Ciudadana.",
          tipo: "opcion",
          opciones: IMPORTANCIA,
        },
      ],
    },
    {
      id: "periodos",
      titulo: "Períodos y notas",
      preguntas: [
        {
          id: "reglas_por_escuela",
          titulo: "Las reglas de cada escuela",
          ayuda:
            "Cada escuela puede tener sus reglas: el sistema las usa por defecto en todos sus cursos y después podés cambiarlas en un curso o para un estudiante. Un renglón por escuela.",
          tipo: "lista",
          textoAgregar: "Agregar otra escuela",
          campos: [
            { id: "escuela", titulo: "Escuela", tipo: "texto" },
            {
              id: "periodos",
              titulo: "Cómo se divide el año",
              tipo: "opcion",
              opciones: [
                { valor: "cuatrimestral", etiqueta: "Cuatrimestres" },
                { valor: "trimestral", etiqueta: "Trimestres" },
                { valor: "bimestral", etiqueta: "Bimestres" },
                { valor: "otro", etiqueta: "Otro" },
              ],
            },
            {
              id: "escala",
              titulo: "Escala",
              tipo: "opcion",
              opciones: [
                { valor: "enteros", etiqueta: "1 a 10, enteros" },
                { valor: "decimales", etiqueta: "1 a 10, con decimales" },
                { valor: "conceptual", etiqueta: "Conceptual" },
                { valor: "aprobado", etiqueta: "Aprobado / No aprobado" },
              ],
            },
            { id: "aprobacion", titulo: "Se aprueba con", tipo: "texto" },
            { id: "faltas", titulo: "Límite de faltas (si hay)", tipo: "texto" },
            {
              id: "destino",
              titulo: "Dónde se cargan las notas oficiales",
              tipo: "opcion",
              opciones: [
                { valor: "mi_escuela", etiqueta: "Mi Escuela (Santa Fe)" },
                { valor: "planilla", etiqueta: "Planilla o papel de la escuela" },
                { valor: "otra", etiqueta: "Otra plataforma" },
              ],
            },
          ],
        },
        {
          id: "cambia_por_curso",
          titulo: "Dentro de una misma escuela, ¿algún curso o división tiene reglas distintas?",
          ayuda: "Por ejemplo, otros pesos en un curso, o una escala distinta en primer año.",
          tipo: "parrafo",
          placeholder: "En 1.º A uso conceptual; en los demás, números…",
        },
        {
          id: "cambia_por_estudiante",
          titulo: "¿Hay estudiantes con criterios propios? Contanos de qué tipo, sin nombres.",
          ayuda: "Por ejemplo: PPI con otra escala, una materia exceptuada, alguien que entró a mitad de año o recupera en otra fecha.",
          tipo: "parrafo",
        },
        {
          id: "nota_periodo_como",
          titulo: "¿Cómo sacás hoy la nota del período?",
          tipo: "opcion",
          obligatoria: true,
          opciones: [
            { valor: "promedio", etiqueta: "Promedio simple de todas las notas" },
            { valor: "pesos", etiqueta: "Con pesos (por ejemplo, exámenes valen más que TP)" },
            { valor: "trayectoria", etiqueta: "Miro la trayectoria y decido yo" },
            { valor: "mezcla", etiqueta: "Calculo un promedio y después lo ajusto" },
          ],
        },
        {
          id: "pesos",
          titulo: "¿Qué peso le das a cada cosa?",
          tipo: "parrafo",
          placeholder: "Exámenes 50 %, TP 30 %, carpeta y participación 20 %",
          mostrarSi: { pregunta: "nota_periodo_como", igualA: "pesos" },
        },
        {
          id: "tipos_evaluacion",
          titulo: "¿Qué tipos de evaluación usás?",
          tipo: "opciones",
          conOtro: true,
          opciones: [
            { valor: "escrito", etiqueta: "Examen escrito" },
            { valor: "oral", etiqueta: "Lección oral" },
            { valor: "tp", etiqueta: "Trabajo práctico individual" },
            { valor: "tp_grupal", etiqueta: "Trabajo práctico grupal" },
            { valor: "exposicion", etiqueta: "Exposición" },
            { valor: "carpeta", etiqueta: "Carpeta / cuaderno" },
            { valor: "participacion", etiqueta: "Participación en clase" },
            { valor: "produccion", etiqueta: "Producción artística (lámina, obra)" },
            { valor: "autoevaluacion", etiqueta: "Autoevaluación" },
          ],
        },
        {
          id: "recuperatorio",
          titulo: "Cuando alguien recupera un examen, ¿qué nota queda?",
          tipo: "opcion",
          conOtro: true,
          opciones: [
            { valor: "reemplaza", etiqueta: "La del recuperatorio reemplaza a la primera" },
            { valor: "promedia", etiqueta: "Se promedian las dos" },
            { valor: "mejor", etiqueta: "Queda la mejor" },
          ],
        },
        {
          id: "entrega_tarde",
          titulo: "Un TP entregado tarde, ¿cómo cuenta?",
          tipo: "opcion",
          conOtro: true,
          opciones: [
            { valor: "igual", etiqueta: "Igual que a tiempo" },
            { valor: "descuenta", etiqueta: "Le descuento puntos" },
            { valor: "registro", etiqueta: "Cuenta igual, pero quiero que quede registrado" },
          ],
        },
        { id: "rubricas", titulo: "¿Corregís con rúbricas o grillas de criterios?", tipo: "opcion", opciones: SI_NO_A_VECES },
        {
          id: "informe_cualitativo",
          titulo: "¿Te piden un informe escrito de cada estudiante (trayectoria, informe socioeducativo)?",
          tipo: "opcion",
          opciones: SI_NO_A_VECES,
        },
        {
          id: "informe_cualitativo_cuando",
          titulo: "¿Cada cuánto y con qué formato?",
          tipo: "parrafo",
          mostrarSi: { pregunta: "informe_cualitativo", distintoDe: "no" },
        },
      ],
    },
    {
      id: "aula",
      titulo: "En el aula",
      preguntas: [
        {
          id: "lista_como",
          titulo: "¿Cómo tomás lista hoy?",
          tipo: "opcion",
          conOtro: true,
          opciones: [
            { valor: "papel", etiqueta: "En un registro de papel" },
            { valor: "planilla", etiqueta: "En una planilla en la compu" },
            { valor: "app", etiqueta: "En una aplicación" },
            { valor: "no", etiqueta: "No tomo, lo hace preceptoría" },
          ],
        },
        {
          id: "senal",
          titulo: "¿Tenés internet en el aula?",
          tipo: "opcion",
          obligatoria: true,
          opciones: [
            { valor: "si", etiqueta: "Sí, casi siempre" },
            { valor: "a_veces", etiqueta: "A veces sí, a veces no" },
            { valor: "no", etiqueta: "No, casi nunca" },
          ],
        },
        {
          id: "dispositivo",
          titulo: "¿Desde dónde lo vas a usar más?",
          tipo: "opcion",
          opciones: [
            { valor: "celular", etiqueta: "Celular" },
            { valor: "compu", etiqueta: "Computadora" },
            { valor: "los_dos", etiqueta: "Las dos: celular en el aula y compu en casa" },
          ],
        },
        {
          id: "estados_asistencia",
          titulo: "Además de presente y ausente, ¿qué más necesitás marcar?",
          tipo: "opciones",
          conOtro: true,
          opciones: [
            { valor: "tarde", etiqueta: "Llegó tarde" },
            { valor: "retiro", etiqueta: "Se retiró antes" },
            { valor: "justificada", etiqueta: "Falta justificada" },
            { valor: "actividad", etiqueta: "Fuera del aula por otra actividad" },
          ],
        },
        {
          id: "libro_temas",
          titulo: "¿Llevás libro de temas (qué se dio cada clase)?",
          tipo: "opcion",
          opciones: [
            { valor: "papel", etiqueta: "Sí, en papel, y lo firma la escuela" },
            { valor: "digital", etiqueta: "Sí, en digital" },
            { valor: "no", etiqueta: "No me lo piden" },
          ],
        },
        {
          id: "planificacion",
          titulo: "¿Tenés que presentar planificación anual?",
          tipo: "opcion",
          opciones: [
            { valor: "si_formato", etiqueta: "Sí, con un formato de la escuela" },
            { valor: "si_libre", etiqueta: "Sí, con formato libre" },
            { valor: "no", etiqueta: "No" },
          ],
        },
        {
          id: "ppi",
          titulo: "¿Tenés estudiantes con PPI o adecuaciones?",
          ayuda: "Lo preguntamos para que esa información quede reservada y sólo la veas vos.",
          tipo: "si_no",
        },
      ],
    },
    {
      id: "informes",
      titulo: "Informes y estadísticas",
      intro: "¿Qué te serviría? Marcá cuánto lo necesitás.",
      preguntas: [
        { id: "quiere_boletin", titulo: "Boletín de cada estudiante en PDF (notas, asistencia, comentario)", tipo: "opcion", opciones: IMPORTANCIA },
        { id: "quiere_planilla_curso", titulo: "Planilla del curso completa para imprimir o en Excel", tipo: "opcion", opciones: IMPORTANCIA },
        { id: "quiere_alertas", titulo: "Avisos de estudiantes en riesgo (muchas faltas, notas bajas, TP sin entregar)", tipo: "opcion", opciones: IMPORTANCIA },
        { id: "quiere_estadisticas", titulo: "Estadísticas de cada examen (cuántos aprobaron, qué criterio les costó más)", tipo: "opcion", opciones: IMPORTANCIA },
        { id: "quiere_comparar", titulo: "Comparar cursos de la misma materia (3.º A contra 3.º B)", tipo: "opcion", opciones: IMPORTANCIA },
        { id: "quiere_borrador_ia", titulo: "Un borrador del informe de cada estudiante, hecho con sus notas y observaciones, que vos corregís", tipo: "opcion", opciones: IMPORTANCIA },
        {
          id: "pedidos_direccion",
          titulo: "¿Qué te piden la dirección o supervisión a lo largo del año?",
          tipo: "parrafo",
          placeholder: "Planillas de calificaciones, informes de trayectoria, actas…",
        },
      ],
    },
    {
      id: "familias",
      titulo: "Estudiantes y familias",
      intro: "Más adelante, estudiantes y familias podrían entrar a ver sus notas del aula, entregas pendientes y devoluciones.",
      preguntas: [
        {
          id: "familias_quiere",
          titulo: "¿Te gustaría que estudiantes y familias puedan entrar a ver su información?",
          tipo: "opcion",
          opciones: IMPORTANCIA,
        },
        {
          id: "familias_que_ven",
          titulo: "¿Qué te parece bien que vean?",
          tipo: "opciones",
          mostrarSi: { pregunta: "familias_quiere", distintoDe: "no" },
          opciones: [
            { valor: "notas", etiqueta: "Las notas de cada evaluación, cuando yo las publico" },
            { valor: "devoluciones", etiqueta: "Las devoluciones escritas" },
            { valor: "pendientes", etiqueta: "Los TP pendientes y las fechas de examen" },
            { valor: "asistencia", etiqueta: "La asistencia" },
            { valor: "informe", etiqueta: "El informe del período" },
          ],
        },
        {
          id: "familias_permiso",
          titulo: "¿Tu escuela permite compartir notas del aula con las familias por fuera de Mi Escuela?",
          tipo: "opcion",
          mostrarSi: { pregunta: "familias_quiere", distintoDe: "no" },
          opciones: [
            { valor: "si", etiqueta: "Sí" },
            { valor: "no", etiqueta: "No" },
            { valor: "preguntar", etiqueta: "No sé, lo tengo que consultar" },
          ],
        },
      ],
    },
    {
      id: "cierre",
      titulo: "Para terminar",
      preguntas: [
        {
          id: "muestra",
          titulo: "Si tenés una planilla de notas o un boletín que uses hoy, pegá el enlace (sin nombres de estudiantes, o tapados)",
          ayuda: "Nos sirve para que las pantallas se parezcan a lo que ya conocés.",
          tipo: "enlace",
        },
        {
          id: "compartir",
          titulo: "¿Alguien más debería poder ver tu registro?",
          tipo: "opcion",
          opciones: [
            { valor: "solo_yo", etiqueta: "Sólo yo" },
            { valor: "preceptor", etiqueta: "Preceptoría, para ver la asistencia" },
            { valor: "colega", etiqueta: "Una colega con quien comparto curso" },
          ],
        },
        { id: "lo_que_mas", titulo: "Si pudieras resolver una sola cosa de tu trabajo con esta herramienta, ¿cuál sería?", tipo: "parrafo", obligatoria: true },
        { id: "comentarios", titulo: "¿Algo más que quieras contarnos?", tipo: "parrafo" },
      ],
    },
  ],
};
