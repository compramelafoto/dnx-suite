import type { Cuestionario, Opcion } from "../tipos";

/**
 * Cuestionario para quien ya tiene su espacio armado y vende un club por suscripción: clases en
 * vivo, clases grabadas, comunidad y un envío mensual (el BOX). Lo estrenó SOYBELUZ (María Belén
 * Saldaña), con el sitio, los planes y los diez BOX ya cargados: por eso pregunta sólo lo que
 * falta y confirma lo que se cargó sin que ella lo viera.
 *
 * Sigue la voz de su marca: inclusiva («personas», «participantes»), nunca «juntas» ni «alumnas».
 * El BOX es masculino: «el BOX», «los BOX».
 */

const SI_MAS_ADELANTE_NO: Opcion[] = [
  { valor: "si", etiqueta: "Sí, lo quiero" },
  { valor: "mas_adelante", etiqueta: "Más adelante" },
  { valor: "no", etiqueta: "No, por ahora no" },
];

const REVISION: Opcion[] = [
  { valor: "ok", etiqueta: "Lo vi y está bien así" },
  { valor: "cambios", etiqueta: "Lo vi y quiero cambiar algo" },
  { valor: "no_vi", etiqueta: "Todavía no lo vi" },
];

/** Los diez BOX como están cargados en el panel (`FotofficeBox`), sin materiales todavía. */
const BOX_CARGADOS = [
  "Mi primer universo creativo: Soltar la mano",
  "Un mundo de flores",
  "El universo de los patrones",
  "Mirar de otra manera",
  "Dibujar el movimiento",
  "Inventar lo que no existe",
  "El poder de las texturas",
  "Crear espacios y mundos",
  "Luces, sombras y volumen",
  "Encontrar mi propio trazo",
];

export const CUESTIONARIO_CLUB_POR_SUSCRIPCION: Cuestionario = {
  clave: "club-suscripcion-v1",
  titulo: "Lo que falta para abrir el Club",
  bienvenida:
    "El sitio, los planes y la inscripción ya están andando. Con estas respuestas terminamos lo que falta: los BOX, las clases, los cobros y los textos. Se guarda solo mientras escribís, así que podés completarlo en varias veces desde el mismo enlace. Lo que no sepas todavía, dejalo vacío y lo charlamos.",
  secciones: [
    {
      id: "datos",
      titulo: "Tus datos",
      intro: "Lo que ya tenemos cargado. Confirmalo o corregilo.",
      preguntas: [
        { id: "nombre_completo", titulo: "Nombre y apellido", tipo: "texto", placeholder: "María Belén Saldaña", obligatoria: true },
        {
          id: "email_acceso",
          titulo: "Correo con el que entrás a administrar el Club",
          ayuda: "Hoy entrás con belenfister@gmail.com. Si es otro, escribilo.",
          tipo: "email",
          placeholder: "belenfister@gmail.com",
          obligatoria: true,
        },
        {
          id: "contacto_publico_ok",
          titulo: "En el sitio figuran infosoybeluz@gmail.com y el WhatsApp 341 212-1469. ¿Están bien?",
          tipo: "si_no",
          obligatoria: true,
        },
        {
          id: "contacto_publico_cambio",
          titulo: "¿Qué correo o WhatsApp ponemos?",
          tipo: "texto",
          mostrarSi: { pregunta: "contacto_publico_ok", igualA: false },
        },
        {
          id: "redes",
          titulo: "Tus redes además de Instagram (@soybeluz)",
          ayuda: "TikTok, YouTube, Facebook… Pegá los enlaces, uno por renglón.",
          tipo: "parrafo",
        },
      ],
    },
    {
      id: "cobros",
      titulo: "Cobros",
      intro: "Las cuotas se cobran con Mercado Pago. La cuenta conectada al Club figura con el nombre «Renera».",
      preguntas: [
        {
          id: "mp_cuenta",
          titulo: "¿La cuenta de Mercado Pago «Renera» es la tuya, donde querés recibir el dinero de las cuotas?",
          tipo: "opcion",
          obligatoria: true,
          opciones: [
            { valor: "si", etiqueta: "Sí, es mi cuenta" },
            { valor: "otra", etiqueta: "No, quiero cobrar en otra cuenta" },
            { valor: "no_se", etiqueta: "No la reconozco / no sé" },
          ],
        },
        {
          id: "mp_otra",
          titulo: "¿A nombre de quién está la cuenta donde querés cobrar?",
          ayuda: "No nos pases contraseñas: te mandamos un enlace para que la conectes vos.",
          tipo: "texto",
          mostrarSi: { pregunta: "mp_cuenta", distintoDe: "si" },
        },
        {
          id: "factura",
          titulo: "¿Tenés que emitir factura por las cuotas?",
          tipo: "opcion",
          opciones: [
            { valor: "monotributo", etiqueta: "Sí, soy monotributista" },
            { valor: "responsable", etiqueta: "Sí, soy responsable inscripta" },
            { valor: "no", etiqueta: "No facturo / todavía no" },
            { valor: "no_se", etiqueta: "No sé, lo quiero charlar" },
          ],
        },
        {
          id: "factura_automatica",
          titulo: "¿Querés que FOTOFFICE haga la factura sola cada vez que alguien paga?",
          ayuda: "Hace falta tu CUIT y un certificado de ARCA que te ayudamos a sacar.",
          tipo: "opcion",
          opciones: SI_MAS_ADELANTE_NO,
          mostrarSi: [
            { pregunta: "factura", distintoDe: "no" },
            { pregunta: "factura", distintoDe: "no_se" },
          ],
        },
        { id: "cuit", titulo: "CUIT", tipo: "texto", mostrarSi: { pregunta: "factura_automatica", igualA: "si" } },
        {
          id: "transferencia",
          titulo: "Además de Mercado Pago, ¿aceptás transferencia bancaria?",
          ayuda: "Si decís que sí, la persona te manda el comprobante y vos marcás la cuota como pagada desde el panel.",
          tipo: "si_no",
        },
      ],
    },
    {
      id: "box",
      titulo: "El BOX",
      intro:
        "Los diez BOX ya están cargados con su nombre y en orden, pero sin materiales. Completá cada uno con lo que trae y la propuesta del mes. Si todavía no lo definiste, dejá el renglón como está.",
      preguntas: [
        {
          id: "box_contenido",
          titulo: "Qué trae cada BOX",
          tipo: "lista",
          textoAgregar: "Agregar otro BOX",
          filasIniciales: BOX_CARGADOS.map((nombre, i) => ({ numero: String(i + 1), nombre })),
          campos: [
            { id: "numero", titulo: "N°", tipo: "numero" },
            { id: "nombre", titulo: "Nombre", tipo: "texto" },
            { id: "materiales", titulo: "Materiales (uno por renglón)", tipo: "parrafo" },
            { id: "propuesta", titulo: "La propuesta del mes, en dos o tres líneas", tipo: "parrafo" },
          ],
        },
        {
          id: "box_costo",
          titulo: "¿Cuánto te cuesta armar un BOX, más o menos?",
          ayuda: "Materiales y caja, sin el envío. Es para que veamos que el plan Premium te deje ganancia. No se publica.",
          tipo: "dinero",
        },
        {
          id: "box_quien_arma",
          titulo: "¿Quién arma y despacha los BOX?",
          tipo: "opcion",
          conOtro: true,
          opciones: [
            { valor: "yo", etiqueta: "Yo, desde mi casa o el taller" },
            { valor: "proveedor", etiqueta: "Un proveedor los arma y los manda" },
          ],
        },
        {
          id: "box_envio_por",
          titulo: "¿Por dónde los mandás?",
          tipo: "opciones",
          conOtro: true,
          opciones: [
            { valor: "correo", etiqueta: "Correo Argentino" },
            { valor: "andreani", etiqueta: "Andreani" },
            { valor: "moto", etiqueta: "Moto o cadete en Rosario" },
            { valor: "retiro", etiqueta: "Se puede retirar en persona" },
          ],
        },
        {
          id: "box_zonas",
          titulo: "¿A dónde llega el BOX?",
          tipo: "opcion",
          conOtro: true,
          opciones: [
            { valor: "pais", etiqueta: "A todo el país" },
            { valor: "santa_fe", etiqueta: "Sólo a la provincia de Santa Fe" },
            { valor: "rosario", etiqueta: "Sólo a Rosario y alrededores" },
          ],
        },
        {
          id: "box_envio_incluido",
          titulo: "El envío, ¿está incluido en los $70.000 del Premium o lo paga aparte la persona?",
          tipo: "opcion",
          opciones: [
            { valor: "incluido", etiqueta: "Incluido en el precio" },
            { valor: "aparte", etiqueta: "Lo paga aparte" },
            { valor: "depende", etiqueta: "Depende de la zona" },
          ],
          obligatoria: true,
        },
        {
          id: "box_fecha",
          titulo: "¿Qué día del mes despachás los BOX?",
          ayuda: "Por ejemplo: «entre el 15 y el 20 de cada mes, para quienes pagaron hasta el 10».",
          tipo: "texto",
        },
        {
          id: "box_cambio_plan",
          titulo: "Si alguien pasa del plan Base al Premium, ¿qué BOX recibe primero?",
          tipo: "opcion",
          opciones: [
            { valor: "uno", etiqueta: "El BOX N°1, como todas las personas" },
            { valor: "del_mes", etiqueta: "El que se está mandando ese mes" },
          ],
        },
        {
          id: "box_pausa",
          titulo: "Si alguien deja de pagar un mes y vuelve, ¿sigue con el BOX que le tocaba o lo retoma desde otro?",
          tipo: "opcion",
          opciones: [
            { valor: "sigue", etiqueta: "Sigue con el que le tocaba" },
            { valor: "del_mes", etiqueta: "Recibe el del mes en curso" },
          ],
        },
        {
          id: "box_danado",
          titulo: "Si un BOX llega roto o no llega, ¿qué hacés?",
          tipo: "parrafo",
          placeholder: "Lo reenvío sin cargo si me avisan en 7 días con una foto…",
        },
        {
          id: "box_fotos",
          titulo: "¿Tenés fotos de un BOX armado? Pegá el enlace de la carpeta.",
          ayuda: "Una foto real del BOX es lo que más vende el plan Premium.",
          tipo: "enlace",
        },
      ],
    },
    {
      id: "en_vivo",
      titulo: "Clases en vivo de los jueves",
      intro: "En el sitio dice: jueves a las 19 h, una semana técnica y la siguiente consultas, y queda grabada.",
      preguntas: [
        { id: "vivo_horario_ok", titulo: "¿El día y el horario están bien?", tipo: "si_no", obligatoria: true },
        {
          id: "vivo_horario_cambio",
          titulo: "¿Qué día y a qué hora?",
          tipo: "texto",
          mostrarSi: { pregunta: "vivo_horario_ok", igualA: false },
        },
        {
          id: "vivo_primera",
          titulo: "¿Cuándo es la primera clase en vivo del Club?",
          tipo: "fecha",
          obligatoria: true,
        },
        {
          id: "vivo_desde",
          titulo: "¿Desde dónde querés transmitir?",
          tipo: "opcion",
          conOtro: true,
          opciones: [
            {
              valor: "fotoffice",
              etiqueta: "Desde el portal del Club",
              ayuda: "Sólo entran quienes pagaron y la grabación queda guardada sola. Es lo que recomendamos.",
            },
            { valor: "zoom", etiqueta: "Por Zoom" },
            { valor: "meet", etiqueta: "Por Google Meet" },
          ],
        },
        {
          id: "vivo_equipo",
          titulo: "¿Con qué vas a transmitir?",
          tipo: "opciones",
          conOtro: true,
          opciones: [
            { valor: "compu", etiqueta: "Computadora con cámara" },
            { valor: "celu", etiqueta: "Celular" },
            { valor: "cenital", etiqueta: "Una cámara o celular desde arriba, mostrando la hoja" },
          ],
        },
        {
          id: "vivo_ensayo",
          titulo: "¿Qué día y hora te queda bien para un ensayo con Daniel antes de la primera?",
          tipo: "texto",
        },
      ],
    },
    {
      id: "grabadas",
      titulo: "Clases grabadas",
      intro:
        "El sitio promete clases grabadas de dibujo libre y de arte, historia y fotografía. Todavía no hay ninguna cargada. Contanos cuáles tenés listas.",
      preguntas: [
        {
          id: "grabadas_lista",
          titulo: "Las clases que ya tenés grabadas",
          ayuda: "Una por renglón. Si están en Drive, pegá el enlace de cada video o de la carpeta.",
          tipo: "lista",
          textoAgregar: "Agregar otra clase",
          campos: [
            { id: "titulo", titulo: "Título", tipo: "texto" },
            {
              id: "tema",
              titulo: "Tema",
              tipo: "opcion",
              opciones: [
                { valor: "dibujo", etiqueta: "Dibujo libre" },
                { valor: "arte", etiqueta: "Arte" },
                { valor: "historia", etiqueta: "Historia" },
                { valor: "fotografia", etiqueta: "Fotografía" },
                { valor: "otro", etiqueta: "Otro" },
              ],
            },
            { id: "enlace", titulo: "Enlace del video", tipo: "enlace" },
            { id: "material", titulo: "Material para bajar (PDF, láminas)", tipo: "enlace" },
            { id: "descripcion", titulo: "De qué se trata", tipo: "parrafo" },
          ],
        },
        {
          id: "grabadas_ritmo",
          titulo: "¿Cada cuánto vas a sumar clases grabadas nuevas?",
          tipo: "opcion",
          conOtro: true,
          opciones: [
            { valor: "semanal", etiqueta: "Una por semana" },
            { valor: "quincenal", etiqueta: "Una cada quince días" },
            { valor: "mensual", etiqueta: "Una por mes" },
          ],
        },
        {
          id: "grabadas_vivo",
          titulo: "Las clases gratuitas de los lunes por Instagram, ¿las subimos al Club como grabadas?",
          tipo: "opcion",
          opciones: [
            { valor: "si_club", etiqueta: "Sí, sólo para quienes están en el Club" },
            { valor: "si_publico", etiqueta: "Sí, y que se vean gratis en el sitio" },
            { valor: "no", etiqueta: "No, quedan sólo en Instagram" },
          ],
        },
        {
          id: "cursos_sueltos",
          titulo: "¿Querés vender cursos sueltos a personas que no están en el Club?",
          ayuda: "Por ejemplo, un curso corto de acuarela que se compra una vez, sin cuota.",
          tipo: "opcion",
          opciones: SI_MAS_ADELANTE_NO,
        },
        {
          id: "cursos_sueltos_lista",
          titulo: "¿Qué cursos y a qué precio?",
          tipo: "lista",
          textoAgregar: "Agregar otro curso",
          mostrarSi: { pregunta: "cursos_sueltos", igualA: "si" },
          campos: [
            { id: "nombre", titulo: "Nombre", tipo: "texto" },
            { id: "clases", titulo: "Cuántas clases", tipo: "numero" },
            { id: "precio", titulo: "Precio (pesos)", tipo: "dinero" },
            { id: "gratis_club", titulo: "¿Gratis para quienes están en el Club?", tipo: "opcion", opciones: [
              { valor: "si", etiqueta: "Sí" },
              { valor: "no", etiqueta: "No" },
            ] },
          ],
        },
      ],
    },
    {
      id: "comunidad",
      titulo: "La comunidad",
      preguntas: [
        {
          id: "grupo_reglas",
          titulo: "¿Qué reglas querés para el grupo de WhatsApp del Club?",
          ayuda: "Las mostramos en el portal antes del enlace al grupo. Por ejemplo: sin publicidad, sin críticas a obras ajenas, horario para mensajes.",
          tipo: "parrafo",
        },
        {
          id: "grupo_baja",
          titulo: "Cuando alguien deja de pagar, ¿lo sacás del grupo?",
          tipo: "opcion",
          opciones: [
            { valor: "si", etiqueta: "Sí, al terminar el mes pagado" },
            { valor: "gracia", etiqueta: "Le doy unos días de gracia" },
            { valor: "no", etiqueta: "No, puede quedarse" },
          ],
        },
        {
          id: "edad_minima",
          titulo: "¿Pueden sumarse menores de edad?",
          tipo: "opcion",
          opciones: [
            { valor: "no", etiqueta: "No, sólo mayores de 18" },
            { valor: "con_adulto", etiqueta: "Sí, con una persona adulta responsable" },
            { valor: "desde", etiqueta: "Sí, desde cierta edad (lo aclaro abajo)" },
          ],
        },
        { id: "edad_detalle", titulo: "¿Desde qué edad?", tipo: "texto", mostrarSi: { pregunta: "edad_minima", igualA: "desde" } },
      ],
    },
    {
      id: "sorteos_tienda",
      titulo: "Sorteos y tienda",
      intro: "El plan Premium promete sorteos de las marcas que acompañan al Club, y anunciamos una tienda de materiales.",
      preguntas: [
        {
          id: "marcas",
          titulo: "Las marcas o comercios que ya te acompañan o que querés invitar",
          tipo: "lista",
          textoAgregar: "Agregar otra marca",
          campos: [
            { id: "nombre", titulo: "Marca o comercio", tipo: "texto" },
            { id: "contacto", titulo: "Contacto (nombre, WhatsApp o correo)", tipo: "texto" },
            {
              id: "estado",
              titulo: "Estado",
              tipo: "opcion",
              opciones: [
                { valor: "confirmada", etiqueta: "Ya dijo que sí" },
                { valor: "charlando", etiqueta: "Lo estamos charlando" },
                { valor: "idea", etiqueta: "Es una idea, no hablé todavía" },
              ],
            },
            { id: "premio", titulo: "Qué podría sortear", tipo: "texto" },
          ],
        },
        {
          id: "sorteo_frecuencia",
          titulo: "¿Cada cuánto querés hacer un sorteo?",
          tipo: "opcion",
          conOtro: true,
          opciones: [
            { valor: "mensual", etiqueta: "Uno por mes" },
            { valor: "bimestral", etiqueta: "Uno cada dos meses" },
            { valor: "cuando_haya", etiqueta: "Cuando haya un premio" },
          ],
        },
        {
          id: "tienda_proveedor",
          titulo: "Enlace del proveedor de la tienda (lista de precios o catálogo)",
          tipo: "enlace",
        },
        {
          id: "tienda_ganancia",
          titulo: "¿Cuánto querés ganar sobre el precio del proveedor?",
          ayuda: "Un porcentaje, por ejemplo «30 %». Si no sabés, dejalo vacío.",
          tipo: "texto",
        },
        {
          id: "tienda_productos",
          titulo: "¿Qué productos querés vender primero?",
          ayuda: "Por ejemplo: el kit para arrancar, cuadernos, lápices, acuarelas.",
          tipo: "parrafo",
        },
        {
          id: "tienda_entrega",
          titulo: "¿Cómo se entrega lo que se compra en la tienda?",
          tipo: "opciones",
          conOtro: true,
          opciones: [
            { valor: "con_box", etiqueta: "Junto con el BOX del mes" },
            { valor: "envio", etiqueta: "Envío aparte" },
            { valor: "retiro", etiqueta: "Retiro en persona en Rosario" },
          ],
        },
      ],
    },
    {
      id: "textos",
      titulo: "Textos, fotos e Instagram",
      intro: "Escribimos los textos del sitio con lo que nos contaron. Revisalos en soybeluz.com.",
      preguntas: [
        {
          id: "revision_venta",
          titulo: "La página de planes (soybeluz.com/suscripcion)",
          tipo: "opcion",
          opciones: REVISION,
          obligatoria: true,
        },
        {
          id: "revision_venta_cambios",
          titulo: "¿Qué cambiarías de la página de planes?",
          tipo: "parrafo",
          mostrarSi: { pregunta: "revision_venta", igualA: "cambios" },
        },
        {
          id: "revision_sobre",
          titulo: "Tu presentación («Quién te acompaña» y la página Sobre)",
          tipo: "opcion",
          opciones: REVISION,
          obligatoria: true,
        },
        {
          id: "revision_sobre_cambios",
          titulo: "¿Qué cambiarías de tu presentación?",
          tipo: "parrafo",
          mostrarSi: { pregunta: "revision_sobre", igualA: "cambios" },
        },
        {
          id: "revision_materiales",
          titulo: "La guía de materiales (soybeluz.com/materiales)",
          tipo: "opcion",
          opciones: REVISION,
          obligatoria: true,
        },
        {
          id: "revision_materiales_cambios",
          titulo: "¿Qué cambiarías de la guía de materiales?",
          tipo: "parrafo",
          mostrarSi: { pregunta: "revision_materiales", igualA: "cambios" },
        },
        {
          id: "testimonios",
          titulo: "Testimonios de personas que tomaron clases con vos",
          ayuda: "Sólo de gente real que te dio permiso para publicarlo. Con nombre y, si quiere, ciudad.",
          tipo: "lista",
          textoAgregar: "Agregar otro testimonio",
          campos: [
            { id: "nombre", titulo: "Nombre (como quiere que aparezca)", tipo: "texto" },
            { id: "ciudad", titulo: "Ciudad", tipo: "texto" },
            { id: "texto", titulo: "Lo que dijo", tipo: "parrafo" },
          ],
        },
        { id: "testimonios_permiso", titulo: "¿Las personas de los testimonios aceptaron que se publiquen?", tipo: "si_no" },
        {
          id: "fotos_obras",
          titulo: "Fotos de dibujos hechos en tus clases (o tuyos) para mostrar en el sitio",
          ayuda: "Pegá el enlace de una carpeta de Drive. Si son de otras personas, con su permiso.",
          tipo: "enlace",
        },
        {
          id: "instagram",
          titulo: "Para publicar los posteos de lanzamiento en @soybeluz…",
          tipo: "opcion",
          opciones: [
            { valor: "acceso", etiqueta: "Le doy acceso a Daniel desde Meta Business para que los programe" },
            { valor: "yo", etiqueta: "Prefiero que me los pasen y los publico yo" },
          ],
          obligatoria: true,
        },
      ],
    },
    {
      id: "mas_adelante",
      titulo: "Para más adelante",
      intro: "Cosas que se pueden sumar. Marcá lo que te interesa y lo vamos armando de a una.",
      preguntas: [
        {
          id: "futuro",
          titulo: "¿Qué te gustaría sumar después?",
          tipo: "opciones",
          conOtro: true,
          opciones: [
            {
              valor: "taller_presencial",
              etiqueta: "Vender el taller presencial de Rosario desde el sitio",
              ayuda: "Inscripción y pago online, con cupo.",
            },
            { valor: "acuarela", etiqueta: "Nuevas disciplinas: acuarela, pintura, técnicas mixtas" },
            {
              valor: "probador",
              etiqueta: "El probador de cuadros",
              ayuda: "Las personas ven cómo queda su dibujo enmarcado en la pared de su casa.",
            },
            { valor: "desafio", etiqueta: "Un desafío o muestra de fin de temporada con las obras del Club" },
            { valor: "debito", etiqueta: "Débito automático de la cuota" },
          ],
        },
        {
          id: "taller_detalle",
          titulo: "Contanos del taller presencial: días, horario, lugar, cupo y precio",
          tipo: "parrafo",
          mostrarSi: { pregunta: "futuro", incluye: "taller_presencial" },
        },
        { id: "comentarios", titulo: "¿Algo más que quieras contarnos o preguntarnos?", tipo: "parrafo" },
      ],
    },
  ],
};
