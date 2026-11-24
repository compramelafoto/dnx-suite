"""Guion del curso «Fotografía escolar paso a paso» (para fotógrafos), pantalla por pantalla.

Escrito el 23/11/2026 recorriendo el código de apps/compramelafoto: los textos entre «» son los de la pantalla.
Cada clase: lo que se ve (🎬, no se lee) y lo que dice Daniel (letra grande). Audios: E01.m4a, E02.m4a…
El curso escolar que ya existe (lib/tutorials/escolar-course.ts) explica el recorrido; este enseña a configurarlo.
"""

CURSO = [
    {
        "titulo": "Capítulo 1 · Antes de empezar",
        "clases": [
            {
                "cod": "E01", "titulo": "La venta escolar paso a paso", "dur": "2 min",
                "arranca": "Placa con el recorrido",
                "tomas": [
                    ("Placa: «Fotografía escolar paso a paso».",
                     "En este curso te muestro, pantalla por pantalla, cómo configurar toda la venta escolar en "
                     "ComprameLaFoto. Desde que conseguís el colegio hasta que entregás el último sobre."),
                    ("Placa del recorrido: Colegio → Álbum → Alumnos → Preventa → Toma → Producción → Imprenta → "
                     "Entrega.",
                     "El orden es este: das de alta el colegio, creás el álbum escolar, cargás los alumnos, armás la "
                     "preventa, sacás las fotos, revisás los diseños, mandás a imprimir y entregás."),
                    ("Menú lateral: grupo «Escolar» con «Instituciones», «Pedidos escolares», «Diseños escolares» y "
                     "«Mi landing escolar».",
                     "Todo vive en el menú «Escolar». Tiene cuatro partes: las instituciones, los pedidos escolares, "
                     "los diseños y tu landing para conseguir colegios."),
                    ("Placa: «La clave: primero se vende, después se saca la foto».",
                     "La idea de fondo es simple: las familias compran antes de la toma. Así sabés cuánto vas a "
                     "vender antes de sacar una sola foto. Arranquemos."),
                ],
            },
            {
                "cod": "E02", "titulo": "Tu landing escolar para conseguir colegios", "dur": "3 min",
                "arranca": "/fotografo/escuelas/landing",
                "tomas": [
                    ("Menú «Escolar» → «Mi landing escolar». Tarjeta «Dirección de tu landing» con la dirección "
                     "…/tunombre/escolar.",
                     "Antes de tener el colegio, te conviene tener tu landing escolar: una página para mostrarle al "
                     "directivo cómo trabajás. La encontrás en «Mi landing escolar»."),
                    ("Botones «Copiar dirección», «Ver mi landing» y «Descargar QR».",
                     "Arriba tenés tu dirección. La copiás para mandarla por WhatsApp, la abrís para verla como la ve "
                     "el colegio, o descargás el QR para imprimirlo en un folleto."),
                    ("Tarjeta «Qué le falta a tu landing»: «Dirección pública definida» y «Página pública activada» "
                     "con «(sin esto la landing no se ve)», y los opcionales «Logo cargado», «WhatsApp o teléfono», "
                     "«Nombre comercial». Tocar «Completar →».",
                     "Abajo te dice qué le falta. Dos cosas son obligatorias: tener tu dirección pública y la página "
                     "pública activada. Sin eso, la landing no se ve. El logo, el WhatsApp y el nombre comercial son "
                     "opcionales, pero suman mucho. Cada uno tiene su «Completar»."),
                    ("Tarjeta «Consultas de colegios»: una consulta con «Contacto», «Email», «WhatsApp» y «Alumnos "
                     "aprox.».",
                     "Cuando un colegio completa el formulario de tu landing, la consulta te aparece acá, con el "
                     "contacto, el WhatsApp y cuántos alumnos tiene. Le escribís directo desde el botón de WhatsApp."),
                ],
                "ojo": "Las consultas son solo de lectura: el fotógrafo no puede cambiarles el estado. No mostrar "
                       "botones de estado.",
            },
        ],
    },
    {
        "titulo": "Capítulo 2 · El colegio",
        "clases": [
            {
                "cod": "E03", "titulo": "Dar de alta el colegio", "dur": "2 min",
                "arranca": "/fotografo/escuelas",
                "tomas": [
                    ("Menú «Escolar» → «Instituciones». Pantalla «Escolar» sin instituciones: «Crear primera "
                     "institución».",
                     "Conseguiste el colegio: lo primero es darlo de alta. Entrás a «Instituciones» y tocás «Nueva "
                     "institución»."),
                    ("Formulario «Nueva escuela»: «Subir logo», «Nombre de la escuela *», «Email de contacto», "
                     "«Teléfono de contacto».",
                     "Subís el logo del colegio, escribís el nombre y cargás el correo y el teléfono de contacto. Lo "
                     "único obligatorio es el nombre."),
                    ("Buscador «Buscar dirección» con el mapa; elegir el resultado. Campo «Observaciones» con "
                     "«Notas internas...».",
                     "Buscás la dirección y la marcás en el mapa. En «Observaciones» podés dejar tus notas internas: "
                     "con quién hablaste, qué acordaron. Eso no lo ve nadie más."),
                    ("Tocar «Crear escuela». Se abre la ficha del colegio. Volver a la lista: la tarjeta con «N cursos "
                     "· N álbumes vinculados» y «Ver / Editar».",
                     "Tocás «Crear escuela» y listo: se abre la ficha del colegio. En la lista vas a ver cada colegio "
                     "con cuántos cursos y álbumes tiene, y desde «Ver / Editar» volvés a entrar."),
                ],
            },
            {
                "cod": "E04", "titulo": "La ficha del colegio", "dur": "2 min",
                "arranca": "/fotografo/escuelas/<id>",
                "tomas": [
                    ("Ficha del colegio: recorrer las pestañas «Institución», «Administradores», «Gestión escolar», "
                     "«Álbumes», «Plantillas» y «Comisiones y ventas».",
                     "Cada colegio tiene su ficha, con pestañas. En este curso las vamos a ir usando una por una: los "
                     "administradores, los alumnos, el álbum, las plantillas y las comisiones."),
                    ("Pestaña «Institución»: tocar «Editar», cambiar el teléfono y tocar «Guardar».",
                     "En «Institución» están los datos que cargaste. Si algo cambia, tocás «Editar», lo corregís y "
                     "guardás."),
                ],
                "ojo": "No mostrar la tarjeta «Color institucional», la insignia «Institucional (pronto)» ni la pestaña "
                       "«Configuración y privacidad»: son textos de algo que todavía no existe.",
            },
            {
                "cod": "E05", "titulo": "El usuario del colegio", "dur": "3 min",
                "arranca": "/fotografo/escuelas/<id>, pestaña «Administradores»",
                "tomas": [
                    ("Pestaña «Administradores». Tocar «Invitar administrador de escuela».",
                     "El colegio puede tener su propio usuario, para seguir sus ventas y sus alumnos sin pedirte "
                     "planillas. Lo invitás desde «Administradores»."),
                    ("Completar «Nombre» y «Email» y tocar «Invitar y asignar». Caja «Invitación enviada… Vence: …».",
                     "Escribís el nombre y el correo de la persona del colegio y tocás «Invitar y asignar». Le llega "
                     "un correo para crear su usuario. La invitación tiene vencimiento."),
                    ("Tabla de invitaciones: botones «Reenviar» y «Cancelar».",
                     "Si no la usó a tiempo, la reenviás. Y si te equivocaste de correo, la cancelás."),
                    ("Buscador «Buscar por nombre o email», select «Elegir administrador para asignar» y «Asignar "
                     "administrador».",
                     "Si esa persona ya tiene usuario de administrador, la buscás y la asignás directamente, sin "
                     "invitación."),
                    ("Tabla de administradores con «Remover».",
                     "Y si alguien deja de trabajar en el colegio, lo sacás con «Remover»."),
                ],
                "ojo": "Las columnas de estado muestran PENDING / ACTIVE en inglés: encuadrar sin esa columna o "
                       "arreglarlo antes.",
            },
        ],
    },
    {
        "titulo": "Capítulo 3 · El álbum escolar",
        "clases": [
            {
                "cod": "E06", "titulo": "Crear el álbum escolar", "dur": "3 min",
                "arranca": "/dashboard/albums/new",
                "tomas": [
                    ("Menú «Álbumes» → «Crear álbum». Paso «Tipo»: elegir «Escolar» («Para escuelas, cursos, carpetas "
                     "escolares…»).",
                     "Ahora creás el álbum del colegio. Es donde van a estar las fotos y la preventa. En el asistente "
                     "elegís el tipo «Escolar»."),
                    ("Barra de pasos: «Tipo, Datos, Ventas digitales, Impresiones, Escuela, Cursos y alumnos, "
                     "Seguridad y privacidad, Listo».",
                     "El asistente escolar tiene ocho pasos. Los primeros son como en cualquier álbum: los datos, la "
                     "venta digital y las impresiones."),
                    ("Paso «Datos»: título «Colegio San Martín · Fotos 2026», fecha y lugar.",
                     "En «Datos» le ponés un nombre claro, con el colegio y el año. Así las familias lo reconocen."),
                    ("Pasos «Ventas digitales» e «Impresiones»: marcar la venta digital y elegir la lista de "
                     "impresiones.",
                     "Después elegís si vendés fotos digitales y con qué lista imprimís. Si tenés dudas, en el curso "
                     "«Empezá a vender» está explicado paso por paso."),
                ],
                "ojo": "Recordar marcar «Vender fotos digitales»: viene desmarcada.",
            },
            {
                "cod": "E07", "titulo": "Vincular el colegio y su comisión", "dur": "3 min",
                "arranca": "Asistente del álbum, paso «Escuela y comisión»",
                "tomas": [
                    ("Paso «Escuela y comisión»: radio «¿Cómo vinculás la escuela?» → «Ya la tengo en mi cuenta» y "
                     "select «Escuela vinculada».",
                     "En el paso «Escuela» elegís el colegio que ya diste de alta. Este paso es importante: sin "
                     "colegio vinculado, el álbum queda a medias y no vas a tener alumnos ni mosaico."),
                    ("Mostrar la otra opción, «Darla de alta ahora mismo», con el mini formulario y «Dar de alta y "
                     "vincular».",
                     "Si todavía no lo cargaste, lo podés dar de alta acá mismo. Eso sí: tocá «Dar de alta y "
                     "vincular» antes de seguir."),
                    ("Marcar «Activar comisión para la escuela sobre ventas vía su canal». Escribir «10» en "
                     "«Porcentaje de comisión» y marcar «Preventa», «Ventas posteriores» y «Extras y canjes».",
                     "Si acordaste una comisión con el colegio, la activás acá: ponés el porcentaje y elegís sobre qué "
                     "ventas corre. La preventa, las ventas de después, y los extras."),
                    ("Bloque «Invitar administrador de escuela (opcional)». Tocar «Siguiente: cursos y alumnos».",
                     "Y si todavía no invitaste al colegio, también lo podés hacer desde acá. Seguimos."),
                ],
            },
            {
                "cod": "E08", "titulo": "Cursos, privacidad y crear el álbum", "dur": "3 min",
                "arranca": "Asistente del álbum, pasos «Cursos y alumnos», «Seguridad y privacidad» y «Listo»",
                "tomas": [
                    ("Paso «Cursos y alumnos»: select «Año lectivo», checkboxes de niveles, turnos y cursos, y "
                     "«Seleccionar todos los cursos».",
                     "En «Cursos y alumnos» elegís el año lectivo y qué cursos entran en este álbum. Si es todo el "
                     "colegio, tocás «Seleccionar todos los cursos»."),
                    ("Mostrar el aviso «No hay alumnos cargados para este año lectivo.» y el enlace «Ir a importar "
                     "padrón».",
                     "Si todavía no cargaste los alumnos, no pasa nada: lo hacemos en el próximo capítulo."),
                    ("Paso «Seguridad y privacidad»: elegir «Privado con identificación». Señalar «⚠️ Recomendado "
                     "para proteger la privacidad de menores de edad».",
                     "En privacidad, mi consejo es siempre el mismo: «Privado con identificación». Cada familia ve "
                     "solo las fotos de su hijo, después de sacarse una selfie. Son menores: cuidalos."),
                    ("Paso «Listo»: el resumen, aceptar «Términos y condiciones» y tocar «Revisar y crear».",
                     "Al final revisás el resumen, aceptás los términos y tocás «Revisar y crear». Ya tenés el álbum "
                     "del colegio."),
                ],
            },
            {
                "cod": "E09", "titulo": "Vincular un álbum que ya tenías", "dur": "1 min",
                "arranca": "/fotografo/escuelas/<id>, pestaña «Álbumes»",
                "tomas": [
                    ("Ficha del colegio, pestaña «Álbumes»: tocar «+ Vincular álbum existente», elegir en «Seleccionar "
                     "álbum» y tocar «Vincular».",
                     "Si el álbum ya lo habías creado antes, lo vinculás desde la ficha del colegio: pestaña "
                     "«Álbumes», «Vincular álbum existente», lo elegís y listo."),
                    ("Fila del álbum vinculado: «Año lectivo», «Fotos», «Preventa: Sin configurar» y los botones "
                     "«Abrir álbum» y «Desvincular».",
                     "Ahí ves el estado del álbum: cuántas fotos tiene y cómo está la preventa. Por ahora, cada "
                     "colegio tiene un solo álbum vinculado."),
                ],
            },
        ],
    },
    {
        "titulo": "Capítulo 4 · Los alumnos",
        "clases": [
            {
                "cod": "E10", "titulo": "Importar el listado de alumnos", "dur": "4 min",
                "arranca": "/fotografo/escuelas/<id>, «Gestión escolar» → «Importaciones»",
                "tomas": [
                    ("Ficha del colegio → «Gestión escolar» → sub-pestaña «Importaciones»: «Importar listado (CSV / "
                     "Excel)».",
                     "Ahora cargás los alumnos. Pedile al colegio el listado en Excel y entrá a «Gestión escolar», "
                     "«Importaciones». Ojo: para importar, el álbum ya tiene que estar vinculado."),
                    ("Select «Sesión fotográfica (álbum destino de la operación)» y «Ciclo lectivo (opcional)».",
                     "Elegís el álbum donde van esos alumnos y el ciclo lectivo. Si no tocás el ciclo, usa el año "
                     "actual del colegio."),
                    ("Mostrar las columnas del archivo: nivel, turno, curso, división, nombre, apellido, matrícula y "
                     "DNI. Ejemplo «Primaria, Mañana, 3ro, A, Juan, Pérez».",
                     "El archivo necesita estas columnas: nivel, turno, curso, división, nombre y apellido. La "
                     "matrícula y el DNI son opcionales, pero ayudan a no duplicar alumnos."),
                    ("Panel «Dato útil»: tocar «Copiar prompt para ChatGPT».",
                     "¿El Excel del colegio viene desordenado? Copiás este texto, se lo pegás a ChatGPT con el "
                     "listado, y te lo devuelve con el formato justo."),
                    ("Subir el archivo en «Archivo (.csv, .xlsx, .xls)» y tocar «Procesar importación». Mostrar "
                     "«Último resultado de esta importación» con los contadores.",
                     "Subís el archivo y tocás «Procesar importación». Al terminar te muestra cuántos alumnos entraron, "
                     "cuántos se actualizaron y si hubo filas con problemas."),
                ],
            },
            {
                "cod": "E11", "titulo": "Revisar alumnos y cursos", "dur": "3 min",
                "arranca": "/fotografo/escuelas/<id>, «Gestión escolar» → «Alumnos» y «Cursos y divisiones»",
                "tomas": [
                    ("Sub-pestaña «Alumnos»: la tabla con apellido y nombre, curso, división y turno. Buscar en "
                     "«Buscar alumno (nombre, DNI o matrícula)».",
                     "En «Alumnos» ves a todos los chicos, cada uno en su curso. Podés buscar por nombre, DNI o "
                     "matrícula."),
                    ("Señalar las insignias «Activo», «Pendiente», «Sin matrícula» y «Duplicado posible».",
                     "Fijate las marcas: si dice «Duplicado posible», hay dos alumnos muy parecidos. Revisalo antes "
                     "de abrir la venta, así ninguna familia elige al chico equivocado."),
                    ("Sub-pestaña «Cursos y divisiones»: el mapa con insignia «Automático».",
                     "En «Cursos y divisiones» están los cursos que salieron del listado, solos."),
                    ("Tocar «Crear curso manualmente», completar «Curso (ej. 1°, Sala 5)» y «División (ej. A, B)», y "
                     "«Guardar curso».",
                     "Si te falta uno, lo creás a mano: escribís el curso y la división y lo guardás."),
                ],
            },
            {
                "cod": "E12", "titulo": "Los alumnos dentro del álbum", "dur": "3 min",
                "arranca": "/dashboard/albums/<id>?tab=escuela",
                "tomas": [
                    ("Álbum → «Pedidos/Escuela» → «Escuela». Bloque de sincronización: tocar «Ver diferencias» y "
                     "después «Sincronizar ahora».",
                     "El álbum tiene su propia lista de alumnos, que se alimenta del listado del colegio. Si cambiaste "
                     "algo en el colegio, entrás a la pestaña «Escuela» del álbum, mirás las diferencias y "
                     "sincronizás."),
                    ("«Lista de alumnos»: tocar «Agregar alumno». Modal «Agregar alumno a mano» con Nombre, Apellido, "
                     "Nivel, Turno, Curso, División y DNI.",
                     "¿Llegó un chico nuevo a mitad de año? Lo agregás a mano desde acá, con su curso."),
                    ("«Importar o actualizar padrón institucional»: «Descargar plantilla CSV», «Pegar CSV aquí» e "
                     "«Importar».",
                     "Y si te mandan una lista nueva, la podés importar desde el mismo álbum. Acá solo acepta CSV: "
                     "bajate la plantilla para no equivocarte con las columnas."),
                ],
            },
            {
                "cod": "E13", "titulo": "Cómo elige la familia a su hijo", "dur": "3 min",
                "arranca": "/dashboard/albums/<id>?tab=escuela, «Configuración de preventa»",
                "tomas": [
                    ("Bloque «Configuración de preventa»: abrir el select «Modo de selección de alumno».",
                     "Este paso es clave y muchos se lo saltean: cómo indica la familia quién es su hijo cuando "
                     "compra. Lo elegís en «Modo de selección de alumno»."),
                    ("Recorrer las opciones: «Sin identificación de alumno», «Carga manual del alumno», «Selección "
                     "desde listado opcional» y «Selección desde listado obligatoria».",
                     "Tenés cuatro opciones. Sin identificación, no se pide nada. Carga manual, la familia escribe el "
                     "nombre. Y desde el listado, la familia elige a su hijo de la lista que cargaste: opcional u "
                     "obligatorio."),
                    ("Elegir «Selección desde listado obligatoria» y marcar «Permitir carga manual si no encuentra al "
                     "alumno en la lista».",
                     "Mi recomendación: listado obligatorio, y además permitir la carga manual si no lo encuentra. Así "
                     "cada pedido queda atado al chico correcto, y nadie se queda sin comprar."),
                    ("Tocar «Guardar configuración».",
                     "Guardás, y listo. Ojo: para usar el listado, tenés que tener los alumnos cargados."),
                ],
            },
        ],
    },
    {
        "titulo": "Capítulo 5 · La preventa",
        "clases": [
            {
                "cod": "E14", "titulo": "Qué es un pack de preventa", "dur": "2 min",
                "arranca": "/dashboard/albums/<id>?tab=venta, «Packs de preventa»",
                "tomas": [
                    ("Álbum → «Venta» → «Packs de preventa». Intro: «Estos packs se venden antes de publicar las "
                     "fotos. El cliente compra primero y elige las imágenes después.»",
                     "La preventa se arma con packs. Un pack es lo que la familia paga antes de la toma: por ejemplo, "
                     "una carpeta y dos fotos impresas. Paga ahora y elige las fotos después."),
                    ("Lista de packs con los grupos «Antes de subir fotos» y «Después de subir fotos».",
                     "Cada pack se vende en un momento: antes de subir las fotos, que es la preventa, o después, para "
                     "los que se olvidaron."),
                    ("Placa: ejemplo de tres packs, «Básico», «Completo» y «Familia».",
                     "Te recomiendo armar dos o tres opciones, de menor a mayor. La mayoría elige la del medio."),
                ],
            },
            {
                "cod": "E15", "titulo": "Crear un pack", "dur": "3 min",
                "arranca": "/dashboard/albums/<id>?tab=venta, «Packs de preventa» → «Crear pack»",
                "tomas": [
                    ("Tocar «Crear pack». Paso «Cómo crear»: «Crear desde un producto existente» o «Crear desde "
                     "cero». Elegir «Crear desde cero».",
                     "Tocás «Crear pack». Podés partir de un pack que ya tengas armado, o crearlo de cero. Vamos de "
                     "cero."),
                    ("Paso «Datos del pack»: «Nombre del pack *», «Cuándo se vende» → «Antes de subir fotos», "
                     "«Descripción (opcional)».",
                     "Le ponés un nombre que la familia entienda, elegís cuándo se vende y escribís en una línea qué "
                     "incluye."),
                    ("«Tu precio del pack ($) *» y la ayuda «Precio en preventa pública: $X (incluye comisión de "
                     "plataforma N%)». «Foto del pack (opcional)» → «Cargar imagen».",
                     "Ponés tu precio. Abajo ves cuánto va a pagar la familia, con la comisión de la plataforma "
                     "sumada. Y si querés, le cargás una foto de ejemplo: vende mucho más."),
                    ("Paso «Productos incluidos» (se ve en la próxima clase) y paso «Revisar y activar»: «Resumen del "
                     "pack», «Ver en la página de preventa →», «Activar pack al finalizar» y «Activar y cerrar».",
                     "Después cargás qué incluye, que lo vemos en la próxima clase, revisás el resumen y lo activás. "
                     "Si todavía no está listo, lo guardás como borrador."),
                ],
                "ojo": "El asistente no pide la «Fecha máxima de compra»: se carga después, al editar el pack (clase "
                       "E17).",
            },
            {
                "cod": "E16", "titulo": "Qué incluye cada pack", "dur": "4 min",
                "arranca": "Asistente del pack, paso «Productos incluidos» → «Nuevo producto incluido»",
                "tomas": [
                    ("«Nuevo producto incluido»: «Tipo de entrega *» con «Digital (archivos)» y «Físico (impresión / "
                     "envío)». Elegir «Físico».",
                     "Cada pack tiene uno o varios productos. Para cada uno elegís si es digital, los archivos, o "
                     "físico, algo que se imprime."),
                    ("«Cantidad incluida en el pack *» y «Producto base del laboratorio (opcional)».",
                     "Ponés cuántos incluye, por ejemplo dos fotos, y de qué producto de tu lista sale."),
                    ("«Política de plantilla»: «Sin plantilla», «Plantilla obligatoria» y «Plantilla opcional». "
                     "Elegir «Plantilla obligatoria» y una plantilla en «Plantilla *».",
                     "Si es una carpeta escolar, elegís «Plantilla obligatoria» y la plantilla del colegio. Así cada "
                     "carpeta sale armada sola, con el nombre y la foto del chico."),
                    ("«¿Cómo elige las fotos por cada unidad incluida?»: «1 foto por cada unidad incluida», «Varias "
                     "fotos fijas por unidad» y «Elige del álbum con más libertad».",
                     "Acá decidís cómo elige las fotos la familia: una por unidad, varias fijas por unidad, o con "
                     "libertad dentro del álbum."),
                    ("«Extras al canjear (opcional)» y «Precio por cada extra ($)». Tocar «Agregar producto».",
                     "Y si querés que pueda sumar más copias al elegir, activás los extras y ponés el precio de cada "
                     "una. Tocás «Agregar producto», y si hace falta, agregás otro."),
                ],
                "ojo": "Si la cantidad de fotos no coincide con los huecos de la plantilla aparece un aviso: mostrar "
                       "una combinación que coincida.",
            },
            {
                "cod": "E17", "titulo": "La fecha de cierre y los ajustes del pack", "dur": "3 min",
                "arranca": "Lista de packs → «Editar pack»",
                "tomas": [
                    ("Lista de packs: el aviso rojo «Falta la fecha máxima de compra…».",
                     "Si ves este aviso rojo, es porque al pack le falta la fecha de cierre. Es obligatoria para los "
                     "packs de preventa."),
                    ("Tocar «Editar pack». Completar «Fecha máxima de compra» y señalar la ayuda «cierra en esta fecha "
                     "o cuando subas la primera foto… lo que pase primero».",
                     "Tocás «Editar pack» y ponés la fecha máxima de compra. La preventa se cierra ese día, o cuando "
                     "subís la primera foto, lo que pase primero."),
                    ("«Válido desde (opcional)» y «Plazo para usar lo comprado (opcional)».",
                     "También podés poner desde cuándo se vende, y un plazo para que la familia elija sus fotos."),
                    ("Marcar «Recomendado» («uno solo por álbum») y dejar el pack publicado. Guardar.",
                     "Y marcás uno como recomendado: es el que se destaca en la página. Uno solo por álbum."),
                ],
            },
            {
                "cod": "E18", "titulo": "Administrar los packs y probar la compra", "dur": "3 min",
                "arranca": "/dashboard/albums/<id>?tab=venta, «Packs de preventa»",
                "tomas": [
                    ("Íconos de un pack: «Ver contenido del pack», «Editar pack», «Duplicar pack», «Compartir link del "
                     "pack» y «Eliminar pack». Tocar «Duplicar pack».",
                     "Cada pack tiene sus botones: ver qué incluye, editarlo, duplicarlo para armar otro parecido, "
                     "compartir su link y eliminarlo."),
                    ("Señalar el estado «Publicado» o «Borrador» y el filtro de la lista.",
                     "Solo los publicados se ven en la página de preventa. Un pack sin productos no se puede "
                     "publicar."),
                    ("Tocar «Probar como cliente». Se abre la compra en $0; terminarla y mostrar el pedido «DEMO».",
                     "Antes de compartir, probá la compra vos mismo con «Probar como cliente». Hacés el recorrido de "
                     "la familia sin pagar, y el pedido te queda marcado como demo."),
                ],
            },
            {
                "cod": "E19", "titulo": "La comisión del colegio", "dur": "3 min",
                "arranca": "/dashboard/albums/<id>?tab=venta, «Comisión escolar»",
                "tomas": [
                    ("Álbum → «Venta» → «Comisión escolar»: «Comisión para administradores de escuela». Marcar "
                     "«Activar comisión para ventas desde link de escuela».",
                     "La comisión del colegio también se puede ajustar desde el álbum, en «Comisión escolar»."),
                    ("«Porcentaje de comisión» y los tipos de venta. Señalar «Guardando…» y «Cambios guardados».",
                     "Cambiás el porcentaje o sobre qué ventas corre, y se guarda solo."),
                    ("Señalar la leyenda «La comisión es un acuerdo directo entre fotógrafo e institución. "
                     "ComprameLaFoto no gestiona ni paga estas comisiones.»",
                     "Importante: la comisión es un acuerdo entre vos y el colegio. ComprameLaFoto te la calcula, "
                     "pero no la paga: se la pagás vos, y lo registrás en la ficha del colegio, como vemos al final."),
                    ("Placa: «La comisión de preventa cuenta cuando la familia entra por el link del colegio».",
                     "Y para que una compra de preventa genere comisión, la familia tiene que entrar por el link que "
                     "comparte el colegio desde su panel."),
                ],
                "ojo": "Verificar antes de grabar: el curso escolar viejo (clases 7, 18 y 19) dice que Mercado Pago le "
                       "deposita sola su parte al colegio, y hoy la pantalla dice lo contrario. Además, «Copiar link "
                       "preventa» de la ficha del colegio copia el link sin la marca del colegio: esas compras no "
                       "generan comisión. Decidir si se arregla antes.",
            },
            {
                "cod": "E20", "titulo": "Compartir la preventa", "dur": "2 min",
                "arranca": "/dashboard/albums/<id>?tab=publicacion&pub=compartir",
                "tomas": [
                    ("Álbum → «Publicación» → «Compartir»: el enlace y el QR.",
                     "Con los packs listos, compartís la preventa. En «Publicación», «Compartir», tenés el enlace y "
                     "el QR del álbum."),
                    ("Placa: el colegio manda el link a los grupos de cada curso.",
                     "Lo ideal es que el colegio mande el link a los grupos de cada curso, desde su panel. Así la "
                     "comisión le queda registrada, y las familias confían más."),
                    ("Ficha del colegio → «Álbumes»: «Preventa: Activa (cierra …)».",
                     "En la ficha del colegio vas a ver la preventa activa y hasta cuándo cierra."),
                ],
            },
        ],
    },
    {
        "titulo": "Capítulo 6 · El diseño de las carpetas",
        "clases": [
            {
                "cod": "E21", "titulo": "Elegir la plantilla", "dur": "3 min",
                "arranca": "/dashboard/designs",
                "tomas": [
                    ("Menú «Escolar» → «Diseños escolares»: «Plantillas del sistema» con sus filtros.",
                     "La carpeta escolar sale de una plantilla: un molde que se arma solo con la foto y el nombre de "
                     "cada chico. Las encontrás en «Diseños escolares»."),
                    ("Tocar «Ver con fotos» en una plantilla y después «Usar y personalizar».",
                     "Mirás las del sistema con fotos de ejemplo, y cuando te gusta una, tocás «Usar y personalizar». "
                     "Queda en «Mis plantillas», lista para poner el logo y los colores del colegio."),
                    ("«Mis plantillas»: «Editar», «Duplicar» y «Eliminar».",
                     "Desde «Mis plantillas» la editás o la duplicás para otro colegio. Y esta es la que elegís en el "
                     "producto del pack."),
                ],
            },
            {
                "cod": "E22", "titulo": "Probar la carpeta con el listado real", "dur": "3 min",
                "arranca": "/fotografo/diseno/plantillas/v2/<id>/probar",
                "tomas": [
                    ("Pantalla «Probar “…” con fotos»: elegir «Álbum», «Escuela» y «Curso». Tocar «Siguiente ›».",
                     "Antes de abrir la venta, probá la plantilla con los nombres reales del colegio. Elegís el álbum, "
                     "el colegio y un curso."),
                    ("Tocar «Ver el diseño armado».",
                     "Y ves cómo queda la carpeta de verdad: con los nombres largos, con los apellidos dobles. Si "
                     "algo no entra, lo corregís ahora, no cuando ya está impresa."),
                    ("Tocar «Descargar PDF de prueba» y «Ver librito en 3D».",
                     "Podés bajar un PDF de prueba para mostrárselo al colegio, o verlo en 3D."),
                ],
            },
        ],
    },
    {
        "titulo": "Capítulo 7 · El día de la toma",
        "clases": [
            {
                "cod": "E23", "titulo": "El control de preventa del día de la toma", "dur": "3 min",
                "arranca": "/dashboard/albums/<id>?tab=operativo",
                "tomas": [
                    ("Álbum → «Pedidos/Escuela» → «Operativo escolar»: «Control de preventa escolar», la tabla con "
                     "Alumno, Curso, Quien compró y Qué compró.",
                     "El día de la toma, tu mejor herramienta es el «Operativo escolar». Ahí ves quién compró, para "
                     "qué chico y qué pack."),
                    ("Buscar «3º A» y filtrar «Sesión» → «Falta sesión».",
                     "Buscás por curso, por apellido o por quien compró, y filtrás los que todavía no tienen la foto."),
                    ("En una fila, tocar «Marcar fotos hechas». Después «Nota»: «vino con el hermano» y «Guardar "
                     "nota».",
                     "A medida que sacás, marcás «Fotos hechas». Y si pasa algo, le dejás una nota: que vino con el "
                     "hermano, que hay que repetir la toma."),
                    ("Tocar «Excel» y «PDF».",
                     "Y si preferís el papel, lo bajás en Excel o PDF, con los mismos filtros."),
                ],
            },
            {
                "cod": "E24", "titulo": "Subir las fotos y avisar a las familias", "dur": "3 min",
                "arranca": "/dashboard/albums/<id>?tab=contenido",
                "tomas": [
                    ("Álbum → «Contenido» → «Fotos»: subir todas las fotos juntas.",
                     "Después de la toma, subís todas las fotos juntas. No hace falta separarlas por chico: la selfie "
                     "de cada familia las encuentra."),
                    ("Tarjeta «¿De qué cursos son las fotos que vas a subir?»: tildar los cursos.",
                     "Mientras subís, marcás de qué cursos son las fotos."),
                    ("Tarjeta «Avisar a las familias por curso»: el estado «N familias esperan», y el botón «Avisar a N "
                     "cursos (N familias)».",
                     "Y cuando terminás un curso, avisás a las familias. Ojo: el aviso no sale solo. Tenés que tocar "
                     "«Avisar», curso por curso o todos juntos."),
                ],
            },
            {
                "cod": "E25", "titulo": "Fotos ocultas hasta la selfie", "dur": "2 min",
                "arranca": "/dashboard/albums/<id>?tab=configuracion",
                "tomas": [
                    ("Álbum → «Configuración»: «Fotos ocultas hasta selfie» marcado.",
                     "En la configuración del álbum confirmás que las fotos estén ocultas hasta la selfie. Así nadie "
                     "ve las fotos de otro chico."),
                    ("«Retener selfie (días, opcional)» en 0.",
                     "Y la selfie no se guarda: la dejás en cero. Usamos la cara solo para encontrar las fotos, y se "
                     "descarta."),
                ],
            },
        ],
    },
    {
        "titulo": "Capítulo 8 · La producción",
        "clases": [
            {
                "cod": "E26", "titulo": "La línea de pedidos escolares", "dur": "3 min",
                "arranca": "/fotografo/escuelas/pedidos",
                "tomas": [
                    ("Menú «Escolar» → «Pedidos escolares»: la barra de pasos «Por canjear, Revisar diseño, Cambios "
                     "pedidos, Para imprimir, En imprenta, Para entregar, Entregado».",
                     "Todos los pedidos del colegio pasan por esta línea, en siete pasos: por canjear, revisar diseño, "
                     "cambios pedidos, para imprimir, en imprenta, para entregar y entregado."),
                    ("Filtros «Escuela» y «Curso»; la tabla con Alumno, Curso, Adulto, Pagó y Qué hacer.",
                     "Filtrás por colegio y por curso, y en cada pedido la columna «Qué hacer» te dice el próximo "
                     "paso."),
                    ("Señalar los tipos «Tienda escolar», «Pack cobrado por fuera» y «DEMO», y el enlace «Fuera de la "
                     "línea: N con pago pendiente».",
                     "También ves qué tipo de pedido es, y aparte, los que todavía no pagaron."),
                    ("Botón para volver un pedido al paso anterior, con su confirmación.",
                     "Si moviste uno de más, lo volvés al paso anterior."),
                ],
            },
            {
                "cod": "E27", "titulo": "Los pedidos por canjear", "dur": "2 min",
                "arranca": "/fotografo/escuelas/pedidos?paso=POR_CANJEAR",
                "tomas": [
                    ("Paso «Por canjear»: familias que pagaron y todavía no eligieron sus fotos.",
                     "«Por canjear» son las familias que ya pagaron, pero todavía no eligieron sus fotos."),
                    ("Tocar «Avisar a las familias» y confirmar.",
                     "Les mandás un recordatorio con un toque: «Avisar a las familias»."),
                    ("«Reenviar link (N)» en un pack cobrado por fuera.",
                     "Y si vendiste un pack cobrado por fuera, desde acá le reenviás el link. El anterior deja de "
                     "andar."),
                ],
            },
            {
                "cod": "E28", "titulo": "Revisar los diseños de corrido", "dur": "4 min",
                "arranca": "/fotografo/escuelas/pedidos?paso=REVISAR_DISENO",
                "tomas": [
                    ("Paso «Revisar diseño»: por fila «Generar diseño» y «Abrir diseño».",
                     "Cuando la familia eligió, la carpeta se arma sola. Te queda revisarla antes de imprimir."),
                    ("Tocar «Revisar de corrido (N)». Pantalla de revisión con «Anterior», «Saltar», «Abrir editor», "
                     "«Pedir cambios» y «Aprobar».",
                     "Lo más rápido es «Revisar de corrido»: te muestra una carpeta atrás de otra. Aprobás, saltás, o "
                     "pedís cambios."),
                    ("Placa con los atajos: A aprueba, C pide cambios, E abre el editor, ← → mueven.",
                     "Y con el teclado vuela: la A aprueba, la C pide cambios, la E abre el editor, y las flechas "
                     "pasan."),
                    ("«Pedir cambios» → «¿Qué necesitás que haga la familia?». El pedido pasa a «Cambios pedidos».",
                     "Si pedís cambios, le explicás a la familia qué hacer, y el pedido queda en «Cambios pedidos» "
                     "hasta que lo corrija."),
                    ("Marcar varios y tocar «Aprobar seleccionados (N)».",
                     "También podés marcar varios y aprobarlos juntos. A la familia le llega un correo."),
                ],
            },
            {
                "cod": "E29", "titulo": "El mosaico y las carpetas de todo el curso", "dur": "4 min",
                "arranca": "/dashboard/albums/<id>?tab=mosaico",
                "tomas": [
                    ("Álbum → «Pedidos/Escuela» → «Mosaico»: la lista de cursos con su avance.",
                     "El mosaico es la hoja con todo el curso: cada chico con su foto y su nombre. Se arma en la "
                     "pestaña «Mosaico» del álbum."),
                    ("Un curso: «Alumnos» con «Elegir foto» y «Confirmar»; «Seño y directivos» con «Agregar persona».",
                     "Para cada chico elegís su foto, sumás a la seño y a los directivos, y confirmás."),
                    ("«Enlace para el colegio»: «Generar enlace para el colegio» y «Copiar».",
                     "Si querés que el colegio lo revise, le generás un enlace."),
                    ("Tocar «Cerrar el curso» → «Sí, cerrar el curso».",
                     "Cuando está completo, cerrás el curso. Las carpetas que llevan mosaico solo se aprueban con el "
                     "curso cerrado."),
                    ("«Carpetas de todo el curso»: «Plantilla», «Elegir la foto grupal» y «Armar las carpetas». "
                     "Después «Aprobar e imprimir las N pendientes».",
                     "Y si el colegio te encarga la carpeta para todos, la armás desde acá: elegís la plantilla y la "
                     "foto grupal, y se arma una por alumno."),
                ],
            },
        ],
    },
    {
        "titulo": "Capítulo 9 · Imprenta y entrega",
        "clases": [
            {
                "cod": "E30", "titulo": "Mandar a la imprenta por lotes", "dur": "4 min",
                "arranca": "/fotografo/escuelas/pedidos?paso=PARA_IMPRIMIR",
                "tomas": [
                    ("Paso «Para imprimir»: marcar los pedidos de un curso y tocar «Crear lote de impresión (N)».",
                     "Con los diseños aprobados, vas a «Para imprimir». Marcás los pedidos y creás un lote. Mi "
                     "consejo: un lote por curso, así después entregás más fácil."),
                    ("Botones «ZIP de PDF» y «ZIP de JPG». Placa con los topes: hasta 60 PDF o 30 JPG por ZIP.",
                     "Bajás el lote en PDF o en JPG, según lo que pida tu imprenta. Cada ZIP tiene un tope, por eso "
                     "conviene ir curso por curso."),
                    ("Por fila: «Descargar: PDF / JPG» y «Marcar en imprenta».",
                     "Y si necesitás uno solo, lo bajás desde su fila. Cuando lo mandás, tocás «Marcar en imprenta»."),
                ],
            },
            {
                "cod": "E31", "titulo": "En la imprenta", "dur": "2 min",
                "arranca": "/fotografo/escuelas/pedidos?paso=EN_IMPRENTA",
                "tomas": [
                    ("Paso «En imprenta»: el lote con sus descargas y «Marcar lote impreso».",
                     "En «En imprenta» ves cada lote. Cuando la imprenta te lo entrega, tocás «Marcar lote impreso»."),
                    ("«Marcar impresos los elegidos (N)».",
                     "Si te llegó una parte, marcás solo esos."),
                    ("Por fila: «Marcar en la escuela».",
                     "Y cuando dejás las carpetas en el colegio, lo marcás también."),
                ],
            },
            {
                "cod": "E32", "titulo": "Etiquetas con QR y entrega", "dur": "3 min",
                "arranca": "/fotografo/escuelas/pedidos?paso=PARA_ENTREGAR",
                "tomas": [
                    ("Paso «Para entregar»: tocar «Imprimir etiquetas (N)». PDF A4 con 24 etiquetas en el orden del "
                     "lote.",
                     "Para entregar, imprimís las etiquetas: una hoja A4 con veinticuatro, en el mismo orden del lote. "
                     "Una para cada sobre."),
                    ("Celular: escanear el QR de una etiqueta. Página con el alumno, «Librito», «Fotos que van en el "
                     "sobre» y «Marcar entregado».",
                     "Cada etiqueta tiene un QR. Lo escaneás y te dice de quién es el sobre y qué tiene que llevar "
                     "adentro. Cuando lo entregás, tocás «Marcar entregado»."),
                    ("La misma página vista por la familia: «Confirmar que lo recibí».",
                     "Y si la familia escanea el mismo QR, puede confirmar que lo recibió."),
                ],
            },
            {
                "cod": "E33", "titulo": "La pantalla de pedidos del estudio", "dur": "2 min",
                "arranca": "/fotografo/escuelas/pedidos/pantalla",
                "tomas": [
                    ("En «Pedidos escolares», tocar «Pantalla de pedidos». Se abre en otra pestaña; tocar «Pantalla "
                     "completa».",
                     "Si trabajás con un equipo, abrí la «Pantalla de pedidos» en el televisor del estudio: todos los "
                     "pedidos a la vista, por paso."),
                    ("Buscar «Pérez» en «Buscar por cualquier dato del pedido…».",
                     "Buscás cualquier pedido por cualquier dato."),
                    ("Arrastrar una tarjeta a la columna siguiente y confirmar «¿Pasar a «…»?».",
                     "Y movés los pedidos arrastrando la tarjeta de una columna a otra."),
                ],
            },
        ],
    },
    {
        "titulo": "Capítulo 10 · Cuentas y cierre",
        "clases": [
            {
                "cod": "E34", "titulo": "Ventas y comisión del colegio", "dur": "3 min",
                "arranca": "/fotografo/escuelas/<id>, pestaña «Comisiones y ventas»",
                "tomas": [
                    ("Ficha del colegio → «Comisiones y ventas»: «Total vendido», «Comisión pendiente», «Comisión "
                     "pagada».",
                     "Al final, entrás a «Comisiones y ventas» del colegio. Ves cuánto se vendió, cuánta comisión le "
                     "debés y cuánta ya le pagaste."),
                    ("Tabla «Movimientos por pedido» con los estados.",
                     "Abajo está cada pedido con su comisión."),
                    ("Un movimiento «Solicitado»: completar «Medio de pago» y «Comprobante o referencia», y tocar "
                     "«Marcar como pagado».",
                     "Cuando le pagás al colegio, cargás cómo le pagaste y el comprobante, y tocás «Marcar como "
                     "pagado». Así los dos tienen las cuentas claras."),
                ],
            },
            {
                "cod": "E35", "titulo": "Resumen y cierre del curso", "dur": "2 min",
                "arranca": "Placa con el recorrido",
                "tomas": [
                    ("Placa del recorrido completo.",
                     "Y eso es todo: diste de alta el colegio, creaste el álbum, cargaste los alumnos, armaste la "
                     "preventa, sacaste las fotos, revisaste, imprimiste y entregaste."),
                    ("Placa: «Tu checklist antes de abrir la venta»: colegio vinculado · alumnos cargados · modo de "
                     "selección · packs con fecha de cierre · plantilla probada · prueba como cliente.",
                     "Antes de abrir cada venta, repasá esta lista. Si está todo, la preventa funciona sola."),
                    ("Placa de cierre con el logo.",
                     "Ahora te toca a vos. Nos vemos en ComprameLaFoto."),
                ],
            },
        ],
    },
]

SHORTS = []

HALLAZGOS = [
    "Comisión del colegio: el curso escolar actual (clases 7, 18 y 19) dice que Mercado Pago le deposita sola su "
    "parte; la pantalla de «Comisión escolar» dice que ComprameLaFoto no la gestiona ni la paga, y el cobro dividido "
    "deja afuera los álbumes escolares. Este guion dice que la paga el fotógrafo. Confirmar.",
    "«Copiar link preventa» de la ficha del colegio copia el link sin la marca del colegio: las compras por ese link "
    "no generan comisión de preventa. Solo cuenta el link del panel del colegio.",
    "Para importar alumnos desde la ficha del colegio hace falta un álbum vinculado: por eso el curso crea el álbum "
    "antes de cargar los alumnos.",
    "El asistente de packs no pide la «Fecha máxima de compra», que es obligatoria en preventa: el pack queda con un "
    "aviso rojo hasta que se edita.",
    "En la ficha del colegio se ven textos de cosas que no existen: «Color institucional», «Institucional (pronto)», "
    "«Herencia desde la escuela» y toda la pestaña «Configuración y privacidad» (con texto técnico). Conviene "
    "ocultarlos antes de grabar.",
    "«Agregar alumno» en la ficha del colegio está deshabilitado: se agrega desde el álbum.",
    "Estados de administradores e invitaciones en inglés (PENDING, ACTIVE).",
    "El paso «Seguridad y privacidad» dice «Por ahora es sólo referencia», pero la opción sí se aplica.",
    "Pack cobrado por fuera: la imprenta y la entrega todavía no se registran.",
    "El diseño automático y la entrega con QR casi no se usaron de punta a punta: hacer un recorrido de prueba "
    "completo con la demo antes de filmar.",
    "Un solo álbum vinculado por colegio.",
]
