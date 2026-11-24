"""Guion del curso «Empezá a vender en ComprameLaFoto» (fotógrafos nuevos) y de sus shorts.

Cada clase tiene tomas: (lo que se ve en pantalla y qué toca el mouse, lo que se lee en voz alta).
Cada short tiene tres tomas: gancho, paso y cierre.
Escrito el 21/11/2026 leyendo las pantallas reales de apps/compramelafoto (los textos entre «» son los
de la pantalla). Reglas: «dinero», nunca «plata»; montos en pesos; el cobro dividido se explica como si
ya funcionara para todos; la presentación con nombre va solo en la clase 1.
"""

CURSO = [
    {
        "titulo": "Capítulo 1 · Tu cuenta",
        "clases": [
            {
                "cod": "C01", "titulo": "Bienvenida: creá tu cuenta de fotógrafo", "dur": "3 min",
                "arranca": "compramelafoto.com/registro",
                "tomas": [
                    ("Logo de ComprameLaFoto a pantalla completa y después la página «Crear cuenta», quieta.",
                     "Soy Daniel, fotógrafo de ComprameLaFoto. En este curso te acompaño desde cero: vas a crear tu "
                     "cuenta, conectar Mercado Pago, armar tu primer álbum, venderlo y entregar el pedido. Todo con "
                     "las pantallas reales, paso por paso."),
                    ("Señalar «¿Cómo vas a usar ComprameLaFoto?» y la opción «Soy fotógrafo/a», que ya viene marcada.",
                     "Arrancamos en la página de registro. Lo primero que te pregunta es cómo vas a usar la "
                     "plataforma. Dejá marcado «Soy fotógrafo»: es para publicar y vender tus fotos."),
                    ("Abrir «País» y elegir Argentina. Pasar el cursor por la casilla de novedades.",
                     "Elegí tu país. La casilla de novedades es opcional: si la marcás, te llegan consejos para "
                     "vender más, y te podés dar de baja cuando quieras."),
                    ("Completar «Nombre», «Apellido», «Email», «Contraseña» y «Repetir contraseña». Señalar los "
                     "requisitos de la contraseña.",
                     "Después cargás tu nombre, tu apellido, tu correo y una contraseña. Tiene que tener por lo "
                     "menos ocho caracteres, con letras y números."),
                    ("Marcar «Acepto los términos y la privacidad.» y señalar «Crear cuenta». Después señalar "
                     "«Continuar con Google».",
                     "Aceptás los términos y tocás «Crear cuenta». Si preferís, podés entrar directo con tu cuenta "
                     "de Google, con el botón de abajo: es más rápido y no tenés que inventar otra contraseña."),
                    ("Mostrar el correo «Verificá tu email en ComprameLaFoto» y tocar «Verificar email». Se ve "
                     "«Email verificado correctamente.» y después «Iniciar sesión».",
                     "Si te registraste con correo, te llega un mail para verificarlo. Tocás «Verificar email», "
                     "y listo: ya podés iniciar sesión. Ojo, ese enlace dura veinticuatro horas."),
                    ("Iniciar sesión. Se ve el «Inicio» del panel con la tarjeta «Mercado Pago sin conectar».",
                     "Este es tu panel. Fijate que ya te avisa lo que falta: conectar Mercado Pago. Antes de eso, "
                     "en el próximo video completamos tu perfil para que tus clientes sepan quién sos."),
                ],
                "ojo": "Hoy, después de registrarse, la pantalla de inicio de sesión no muestra un cartel de "
                       "«cuenta creada»: no lo señales.",
            },
            {
                "cod": "C02", "titulo": "Tu perfil y tu marca", "dur": "3 min",
                "arranca": "/fotografo/configuracion?tab=datos",
                "tomas": [
                    ("Menú lateral «Configuración» → «Perfil». Recorrer «Datos personales».",
                     "En este video dejamos tu perfil listo. Entrá a «Configuración» y después a «Perfil». "
                     "Arriba van tus datos: nombre, apellido y tu WhatsApp. El WhatsApp es importante, porque "
                     "es la forma más rápida en que un cliente te va a escribir."),
                    ("Bajar a «Datos de la empresa o marca»: «Nombre de la empresa / estudio», «Instagram», "
                     "«TikTok», «Facebook».",
                     "Más abajo cargás el nombre de tu estudio o de tu marca, y tus redes. Es lo que ven tus "
                     "clientes cuando compran tus fotos."),
                    ("Bajar a «Ubicación de trabajo» y tocar «Guardar cambios».",
                     "Al final, tu ciudad y hasta qué distancia viajás para trabajar. Tocás «Guardar cambios»."),
                    ("Pestaña «Marca y diseño». Marcar «Habilitar página pública personalizada» y escribir la "
                     "dirección (compramelafoto.com/tunombre).",
                     "Ahora pasamos a «Marca y diseño». Si marcás «Habilitar página pública personalizada», "
                     "elegís tu propia dirección, por ejemplo compramelafoto punto com barra tu nombre. Es tu "
                     "vidriera para mandar a cualquier cliente."),
                    ("En «Identidad visual», tocar «Subir logo» y elegir un PNG. Mostrar los colores. Tocar "
                     "«Guardar preferencias y marca».",
                     "En «Identidad visual» subís tu logo y elegís tus colores. Tu logo aparece en tus álbumes y "
                     "en los instructivos que vas a imprimir. Guardás, y tu cuenta ya tiene tu cara."),
                    ("Volver al «Inicio» y señalar «Conectar MP».",
                     "Ya tenemos la cuenta. Ahora viene el paso más importante para poder cobrar: conectar "
                     "Mercado Pago."),
                ],
            },
        ],
    },
    {
        "titulo": "Capítulo 2 · Mercado Pago",
        "clases": [
            {
                "cod": "C03", "titulo": "Conectar tu cuenta de Mercado Pago", "dur": "3 min",
                "arranca": "/fotografo/configuracion?tab=mercadopago",
                "tomas": [
                    ("Menú lateral «Ventas» → «Mercado Pago». Señalar el aviso «Este paso es obligatorio».",
                     "Sin Mercado Pago no se puede crear un álbum, ni subir fotos, ni vender. Por eso es "
                     "obligatorio. Lo encontrás en el menú «Ventas», en «Mercado Pago», o en el botón «Conectar "
                     "MP» del inicio."),
                    ("Señalar la recomendación sobre los plazos de acreditación y el enlace «Ver y configurar "
                     "plazos de acreditación».",
                     "Antes de conectar, un consejo: en tu Mercado Pago podés elegir en cuántos días se te "
                     "acredita cada cobro. En general, cuanto más rápido, más comisión te cobra Mercado Pago. "
                     "Revisalo y elegí lo que te convenga."),
                    ("Tocar «Conectar con Mercado Pago». Se abre la página de Mercado Pago: iniciar sesión y "
                     "autorizar.",
                     "Tocás «Conectar con Mercado Pago». Te lleva a la página de Mercado Pago, iniciás sesión con "
                     "tu cuenta y autorizás. Tranquilo: la contraseña la ponés en Mercado Pago, nunca en "
                     "ComprameLaFoto."),
                    ("Vuelta al panel con el mensaje «¡Conexión con Mercado Pago exitosa!». Ir otra vez a "
                     "«Ventas» → «Mercado Pago» y señalar «Conectado con Mercado Pago» y la fecha.",
                     "Volvés al panel y te avisa que la conexión salió bien. Si entrás otra vez a Mercado Pago, "
                     "ves tu cuenta conectada y desde cuándo."),
                    ("Mostrar (en una cuenta de prueba o con una captura) el aviso «Se venció tu conexión con "
                     "Mercado Pago» y el botón «Reconectar Mercado Pago».",
                     "Una cosa para tener en cuenta: Mercado Pago pide renovar el permiso cada seis meses. Si se "
                     "vence, el panel te avisa y nadie te puede comprar hasta que lo renueves. Tocás «Reconectar "
                     "Mercado Pago», y en un minuto está."),
                    ("Bajar hasta la tarjeta «Cobro dividido al instante».",
                     "Justo debajo hay algo que te recomiendo activar el mismo día: el cobro dividido. Te lo "
                     "explico en el próximo capítulo."),
                ],
            },
        ],
    },
    {
        "titulo": "Capítulo 3 · Cobro dividido",
        "clases": [
            {
                "cod": "C04", "titulo": "Qué es el cobro dividido", "dur": "2 min",
                "arranca": "/fotografo/configuracion?tab=mercadopago (tarjeta «Cobro dividido al instante»)",
                "tomas": [
                    ("Tarjeta «Cobro dividido al instante», quieta. Pasar el cursor por el texto.",
                     "El cobro dividido es simple: cuando alguien compra tus fotos, Mercado Pago reparte el pago "
                     "en ese mismo momento. Tu parte va directo a tu cuenta, sin esperar liquidaciones ni pedir "
                     "transferencias."),
                    ("Placa con tres casilleros: cliente paga → fotógrafo / organizador / ComprameLaFoto, cada "
                     "uno con su parte.",
                     "Si en la venta participa alguien más, como el club que organiza el partido o el colegio, "
                     "cada uno recibe lo suyo en su propia cuenta de Mercado Pago. Nadie le tiene que pasar "
                     "dinero a nadie."),
                    ("Volver a la tarjeta y señalar la nota del pie.",
                     "No cambian tus precios ni las comisiones: cambia cómo y cuándo te llega el dinero. Y si el "
                     "cliente paga con el dinero de su cuenta de Mercado Pago, la venta se cobra como siempre."),
                    ("Cerrar con la tarjeta en pantalla.",
                     "Para que funcione, cada parte tiene que autorizarlo una sola vez. En el próximo video te "
                     "cuento quién tiene que autorizar en cada tipo de venta."),
                ],
            },
            {
                "cod": "C05", "titulo": "Quién lo autoriza en cada tipo de venta", "dur": "3 min",
                "arranca": "Placas de explicación (sin pantalla del panel)",
                "tomas": [
                    ("Placa «Tu álbum propio»: fotógrafo.",
                     "Depende de quién participa en la venta. Si es tu álbum, de un evento o un partido que "
                     "cubriste vos solo, autorizás vos. Y si entraste a la plataforma recomendado por otro "
                     "fotógrafo, él también, para cobrar su parte."),
                    ("Placa «Evento con organizador»: fotógrafo + organizador (club, liga, escuela de danza, "
                     "empresa de turismo).",
                     "Si trabajás para un organizador que se lleva una comisión, como un club, una liga, una "
                     "escuela de danza o una empresa de turismo, autorizás vos y autoriza el organizador."),
                    ("Placa «Venta escolar»: fotógrafo + colegio.",
                     "En la venta escolar pasa lo mismo: si el colegio cobra una comisión, el colegio conecta su "
                     "Mercado Pago una vez y su parte le llega sola en cada compra."),
                    ("Placa «Evento con varios fotógrafos»: todos los fotógrafos del evento.",
                     "Si el evento lo cubren varios fotógrafos y el cliente paga todo junto en un solo carrito, "
                     "tienen que autorizar todos. Con que falte uno, cada álbum se cobra por separado."),
                    ("Placa «Impresiones con laboratorio»: el laboratorio no autoriza nada.",
                     "¿Y el laboratorio? No tiene que autorizar nada. Al laboratorio le pagás vos el lote de "
                     "impresiones, como siempre."),
                    ("Placa final: «Activalo siempre».",
                     "Mi consejo: activalo siempre, el primer día, aunque hoy vendas solo. Así, cuando un día "
                     "trabajes con un club o con un colegio, ninguna venta se frena por un permiso que faltaba."),
                ],
                "ojo": "Hoy el código deja afuera del cobro dividido la venta escolar, las impresiones y los "
                       "videos. Siguiendo la regla de los videotutoriales, la clase lo explica como va a "
                       "funcionar. Si se prefiere no adelantar lo escolar, sacar la toma 3.",
            },
            {
                "cod": "C06", "titulo": "Activar el cobro dividido paso a paso", "dur": "3 min",
                "arranca": "Panel con el cartel «Nuevos términos: cobro dividido con Mercado Pago»",
                "tomas": [
                    ("Cartel «Nuevos términos: cobro dividido con Mercado Pago». Señalar «Ver ejemplos: ¿cuándo "
                     "se usa?».",
                     "Al entrar al panel te aparece este cartel. Son dos pasos y los hacés una sola vez. Si tenés "
                     "dudas, acá tenés ejemplos de cuándo se usa."),
                    ("Paso «1. Aceptá el anexo de los términos»: tocar «Leer el texto completo», marcar «Leí y "
                     "acepto el anexo de cobro dividido con Mercado Pago.» y tocar «Aceptar».",
                     "Primero aceptás el anexo de los términos. Lo podés leer completo acá. Marcás la casilla y "
                     "tocás «Aceptar»."),
                    ("Paso «2. Autorizá el cobro dividido en Mercado Pago»: escribir el correo en «Correo de tu "
                     "cuenta de Mercado Pago» y tocar «Pedir invitación».",
                     "Después, el permiso en Mercado Pago. Esto lo tenés que hacer vos: nosotros no lo podemos "
                     "hacer por vos. Escribí el correo con el que entrás a Mercado Pago, que puede ser distinto "
                     "del de ComprameLaFoto, y tocá «Pedir invitación»."),
                    ("Se ve «Falta un paso: aceptá la invitación en Mercado Pago…». Tocar «Aceptar en Mercado "
                     "Pago», aceptar del lado de Mercado Pago y volver.",
                     "Tocás «Aceptar en Mercado Pago», confirmás allá, y volvés. Si no se abre, buscá en tu "
                     "correo el mail de Mercado Pago con la invitación."),
                    ("Tocar «Ya acepté, revisar». Se ve «Cobro dividido activo».",
                     "Tocás «Ya acepté, revisar» y listo: cobro dividido activo. Desde ahora, en cada venta, tu "
                     "parte llega en el momento. El cartel se va solo."),
                    ("Señalar «Ahora no» y el enlace «¿No podés completarlo? Escribinos».",
                     "Si no lo podés hacer en este momento, tocás «Ahora no» y lo hacés después, pero hay una "
                     "fecha límite: pasada esa fecha, el panel te lo va a pedir para seguir. Y si te trabás, "
                     "escribinos. Ahora sí: vamos a armar tu primer álbum."),
                ],
                "ojo": "El cartel y la tarjeta aparecen solo con las banderas del cobro dividido encendidas. "
                       "Antes de grabar, confirmar que se ven en la cuenta que se filma.",
            },
        ],
    },
    {
        "titulo": "Capítulo 4 · Tu primer álbum con el asistente",
        "clases": [
            {
                "cod": "C07", "titulo": "Abrir el asistente: tipo de álbum y datos", "dur": "3 min",
                "arranca": "/dashboard/albums",
                "tomas": [
                    ("«Mis Albums». Señalar el texto de ayuda y tocar «Crear álbum con asistente paso a paso».",
                     "Para crear un álbum, entrás a «Mis álbumes» y tocás «Crear álbum con asistente paso a "
                     "paso». Es el camino más fácil: te va preguntando todo, de a una cosa por vez."),
                    ("Ventana «Crear álbum con asistente». Recorrer la barra de pasos: «Tipo», «Datos», «Ventas "
                     "digitales», «Impresiones», «Seguridad y privacidad», «Listo».",
                     "Son seis pasos: el tipo, los datos, las ventas digitales, las impresiones, la seguridad, y "
                     "al final revisás y creás."),
                    ("Paso «Tipo de álbum»: pasar por «Evento / deporte», «Álbum simple» y «Evento colaborativo». "
                     "Elegir «Evento / deporte» y tocar «Siguiente».",
                     "Primero, el tipo. «Evento / deporte» es para carreras, partidos, shows o fiestas, donde "
                     "vendés las fotos después de subirlas. «Álbum simple» es para vender fotos sueltas, sin "
                     "vueltas. Y «Evento colaborativo», cuando trabajan varios fotógrafos. Elijo «Evento / "
                     "deporte»."),
                    ("Paso «Datos básicos»: escribir el «Título» (por ejemplo «Maratón de Rafaela · 15 de "
                     "noviembre»).",
                     "Ahora los datos. Un título claro, con el nombre del evento y la fecha, ayuda a que tus "
                     "clientes encuentren el álbum."),
                    ("En «Lugar · georeferenciado», buscar el lugar y elegir un resultado. Se marca en el mapa.",
                     "Después el lugar. Lo buscás por nombre y elegís el resultado, o tocás «Mi ubicación» si "
                     "estás ahí. Queda marcado en el mapa."),
                    ("Completar «Fecha del evento», «Hora de inicio» y «Hora de finalización». Tocar «Siguiente».",
                     "Y por último la fecha y el horario. Tocás «Siguiente»: ahora viene lo más importante, el "
                     "precio."),
                ],
            },
            {
                "cod": "C08", "titulo": "Ventas digitales: el precio de tus fotos", "dur": "3 min",
                "arranca": "Asistente, paso «Ventas digitales»",
                "tomas": [
                    ("Paso «Ventas digitales». Señalar el recuadro «Configuración recomendada».",
                     "En un evento, lo más común es vender las fotos digitales después del evento. Acá te deja "
                     "una recomendación: fotos digitales, y packs de cinco o diez fotos."),
                    ("Marcar la casilla «Vender fotos digitales».",
                     "Muy importante: marcá «Vender fotos digitales». Viene desmarcada, y si no la marcás el "
                     "álbum se crea sin nada para vender."),
                    ("Escribir el precio en «Precio por foto digital». Señalar el «Simulador orientativo».",
                     "Escribís el precio de cada foto, en pesos. Y mirá el simulador: la comisión de la "
                     "plataforma se suma arriba de tu precio. El cliente paga un poco más, y vos recibís tu "
                     "precio entero."),
                    ("Señalar «Mostrar mensaje de espera al público antes de tener fotos a la venta», marcada.",
                     "Esta otra casilla dejala marcada. Si alguien entra al álbum antes de que subas las fotos, "
                     "ve un mensaje de espera y puede dejar sus datos para que le avises."),
                    ("Tocar «Siguiente: impresiones».",
                     "Los descuentos por cantidad y los packs los cargás después, cuando el álbum ya esté "
                     "creado. Seguimos con las impresiones."),
                ],
            },
            {
                "cod": "C09", "titulo": "Impresiones: vender fotos en papel", "dur": "3 min",
                "arranca": "Asistente, paso «Impresiones»",
                "tomas": [
                    ("Paso «Impresiones». Señalar la casilla «Ofrecer impresiones físicas», desmarcada.",
                     "Si solo vas a vender digitales, este paso lo salteás: dejás la casilla sin marcar. Si "
                     "también querés vender fotos impresas, la marcás."),
                    ("Marcar la casilla. Mostrar «Origen de precios»: «Mi lista (fotógrafo)» y «Laboratorio "
                     "(precios del lab)».",
                     "Elegís de dónde salen los precios: de tu propia lista, o de la lista de un laboratorio. Si "
                     "elegís laboratorio, lo buscás por nombre."),
                    ("Escribir el «Margen de ganancia sobre el precio base (%)» y mirar el «Simulador "
                     "orientativo (1 impresión física)».",
                     "Encima del precio base ponés tu margen de ganancia, en porcentaje. El simulador te muestra "
                     "cuánto paga el cliente y cuánto te queda a vos."),
                    ("Mostrar «¿Quién retira en laboratorio?»: «Cliente» o «Yo (fotógrafo)».",
                     "Después elegís quién retira las copias del laboratorio: el cliente, o vos."),
                    ("Mostrar «Incluir versión digital con la impresa (con descuento opcional)». Tocar "
                     "«Siguiente: seguridad».",
                     "Y si querés, podés regalar o descontar la versión digital a quien compra la impresa. Es "
                     "un buen gancho de venta. Seguimos."),
                ],
                "ojo": "Si la cuenta no tiene productos activos, aparece «Todavía no hay productos activos en tu "
                       "lista». Grabar con una cuenta que ya tenga lista de precios cargada.",
            },
            {
                "cod": "C10", "titulo": "Seguridad y privacidad del álbum", "dur": "2 min",
                "arranca": "Asistente, paso «Seguridad y privacidad»",
                "tomas": [
                    ("Paso «Seguridad y privacidad». Pasar el cursor por «Público».",
                     "Acá decidís quién puede ver el álbum. «Público»: aparece en los listados y cualquiera ve "
                     "todas las fotos. Es lo más común para un partido o una carrera."),
                    ("Pasar el cursor por «No listado».",
                     "«No listado»: no aparece en ningún listado, solo entra quien tiene el enlace. Sirve para "
                     "una fiesta privada."),
                    ("Elegir «Privado con identificación». Se ve el recuadro «Recomendado para eventos con "
                     "menores de edad».",
                     "Y «Privado con identificación»: cada persona ve solo sus fotos, después de sacarse una "
                     "selfie. Es lo recomendado cuando hay chicos, como en un torneo infantil."),
                    ("Elegir la opción que va en el ejemplo y tocar «Revisar y crear».",
                     "Esto lo podés cambiar después, en la configuración del álbum. Tocás «Revisar y crear»."),
                ],
                "ojo": "No señalar la frase de ayuda «Por ahora es sólo referencia…»: está desactualizada (la "
                       "opción sí se guarda). Tampoco cargar correos en «No listado»: hoy no se envían.",
            },
            {
                "cod": "C11", "titulo": "Revisar y crear el álbum", "dur": "2 min",
                "arranca": "Asistente, paso «Listo»",
                "tomas": [
                    ("Paso final. Recorrer el resumen: tipo, título, lugar, fecha, fotos digitales, impresas, "
                     "mensaje de espera, seguridad.",
                     "Último paso: revisás todo. Tipo, título, lugar, fecha, si vendés digitales e impresas, y "
                     "la seguridad. Si algo está mal, volvés con «Atrás»."),
                    ("Señalar el recuadro «Después de crear vas a poder afinar».",
                     "Te avisa lo que vas a poder afinar después: los packs y los productos."),
                    ("En «Términos y condiciones», marcar la casilla y tocar «Crear álbum».",
                     "Aceptás los términos y tocás «Crear álbum»."),
                    ("Se abre la página del álbum, con la insignia de estado de venta y la pestaña «Resumen».",
                     "Y acá está tu álbum. Todavía no tiene fotos: eso es lo que hacemos en el próximo video."),
                ],
            },
        ],
    },
    {
        "titulo": "Capítulo 5 · Subir, publicar y difundir",
        "clases": [
            {
                "cod": "C12", "titulo": "Subir las fotos", "dur": "3 min",
                "arranca": "/dashboard/albums/<id>, pestaña «Contenido» → «Fotos»",
                "tomas": [
                    ("Pestaña «Resumen» con «Sugerencias de próximos pasos». Tocar «Subir fotos del evento».",
                     "El álbum te sugiere los próximos pasos. El primero: subir las fotos del evento."),
                    ("Zona de subida. Señalar «Elegir archivos» y «Subir carpeta completa».",
                     "Podés elegir fotos sueltas, arrastrarlas acá, o subir una carpeta completa. Si tu carpeta "
                     "tiene subcarpetas, por ejemplo una por categoría, se crean solas en el álbum."),
                    ("Elegir una carpeta. Se ve «Procesando N foto(s) en segundo plano…».",
                     "Mientras se procesan, podés seguir trabajando. La marca de agua se pone sola: no tenés que "
                     "hacer nada para proteger tus fotos."),
                    ("Mostrar las fotos ya cargadas en la grilla.",
                     "Dos consejos. Cada foto puede pesar hasta diez megas: si una se pasa, no sube ninguna, así "
                     "que exportá en un tamaño razonable. Y si subís desde el celular, hacelo con buena señal."),
                    ("Volver a «Resumen».",
                     "Con las fotos arriba, ya podés vender. Pero antes, te muestro cómo vender más."),
                ],
            },
            {
                "cod": "C13", "titulo": "Vender más: descuentos y packs", "dur": "3 min",
                "arranca": "/dashboard/albums/<id>, pestaña «Venta» → «Qué vendés»",
                "tomas": [
                    ("«Venta» → «Qué vendés». Tarjeta «Fotos digitales».",
                     "En la pestaña «Venta» ajustás todo lo que vendés. Acá podés cambiar el precio de la foto "
                     "digital cuando quieras."),
                    ("Completar «Descuento 5+ fotos (%)», «Descuento 10+ fotos (%)» y «Descuento 20+ fotos (%)». "
                     "Señalar la «Vista previa — precio para el cliente».",
                     "Y acá están los descuentos por cantidad: un porcentaje para cinco fotos o más, otro para "
                     "diez y otro para veinte. Así el cliente se lleva más fotos en lugar de una sola."),
                    ("Sub-pestaña «Packs de galería» → «Agregar pack». Mostrar los tipos y elegir «Todas mis "
                     "fotos».",
                     "Los packs son otra forma de vender más. El que mejor funciona en eventos es «Todas mis "
                     "fotos»: el cliente paga un precio fijo y se lleva todas en las que aparece."),
                    ("Completar «Nombre del pack» y «Precio del pack (ARS)» y tocar «Crear pack».",
                     "Le ponés nombre, precio, y tocás «Crear pack»."),
                    ("Señalar la lista de lo que falta: «Mercado Pago conectado», «Precio digital configurado», "
                     "«Términos aceptados».",
                     "Abajo tenés una lista con lo que falta para que la venta esté completa. Cuando todo está "
                     "en verde, el álbum dice «Venta activa»."),
                ],
            },
            {
                "cod": "C14", "titulo": "Selfie, dorsal y aviso de fotos nuevas", "dur": "3 min",
                "arranca": "/dashboard/albums/<id>, pestaña «Configuración» → «General»",
                "tomas": [
                    ("«Configuración» → «Privacidad y acceso». Señalar «Fotos ocultas hasta selfie».",
                     "En la configuración del álbum están las opciones de búsqueda. «Fotos ocultas hasta "
                     "selfie» hace que cada persona vea solo sus fotos, después de sacarse una selfie."),
                    ("Activar «Búsqueda por dorsal, patente o nombre». Señalar el aviso de costo.",
                     "Para un evento deportivo, activá la búsqueda por dorsal: el sistema lee los números de "
                     "cada foto, y el corredor se encuentra escribiendo el suyo. Ojo, leer cada foto tiene un "
                     "costo, por eso viene apagada."),
                    ("Señalar «Protección al ampliar fotos», encendida.",
                     "La protección al ampliar viene encendida: cuando alguien agranda una foto, la ve con marca "
                     "de agua."),
                    ("Señalar «Mensaje “fotos próximamente”» y tocar «Guardar configuración».",
                     "Y el mensaje de fotos próximamente: si el álbum todavía no tiene fotos, la gente deja su "
                     "correo para que le avises. Guardás la configuración."),
                    ("Ir a «Contenido» y mostrar la tabla «Interesados» con el botón de WhatsApp.",
                     "Esas personas aparecen acá, en «Interesados». Cuando subas las fotos, les podés escribir "
                     "por WhatsApp con un toque: son ventas casi seguras."),
                ],
                "ojo": "Con la búsqueda por dorsal recién activada, las fotos que ya estaban subidas pueden "
                       "tardar en leerse. Grabar con un álbum ya analizado.",
            },
            {
                "cod": "C15", "titulo": "Publicar y difundir tu álbum", "dur": "3 min",
                "arranca": "/dashboard/albums/<id>, pestaña «Publicación»",
                "tomas": [
                    ("«Publicación» → «Compartir». Tocar «Copiar enlace».",
                     "No hay un botón de publicar: tu álbum se publica cuando compartís el enlace. En "
                     "«Publicación», «Compartir», tocás «Copiar enlace» y lo pegás donde quieras: WhatsApp, "
                     "Instagram, el grupo del club."),
                    ("Tocar «Descargar QR».",
                     "También podés descargar el QR del álbum, para ponerlo en una historia o en una placa."),
                    ("Sub-pestaña «Instructivos». Tocar «Ver instructivo» y mostrarlo.",
                     "En «Instructivos» tenés una guía para tus clientes, con tu logo y el QR, que explica cómo "
                     "encontrar sus fotos y comprarlas. Se arma sola con la configuración del álbum."),
                    ("Tocar «WhatsApp» y «Descargar PDF».",
                     "La mandás por WhatsApp o la descargás en PDF."),
                    ("Mostrar «Cartel A4», «Cartel A5» y «Hoja de tarjetas A4».",
                     "Y para el día del evento: un cartel con el QR grande para colgar, y una hoja de tarjetas "
                     "para repartir en mano. Es lo que más vende: la gente escanea en el momento."),
                    ("Sub-pestaña «Visibilidad». Señalar «Visible hasta» y «Tiempo restante».",
                     "Por último, en «Visibilidad» ves hasta cuándo está visible el álbum. Ahora vamos a ver qué "
                     "hace tu cliente cuando abre el enlace."),
                ],
                "ojo": "Si «Compartir» dice «Compartir deshabilitado», falta un método de venta o Mercado Pago. "
                       "Grabar con la venta completa.",
            },
            {
                "cod": "C16", "titulo": "Cómo compra tu cliente", "dur": "3 min",
                "arranca": "/a/<slug> (vista del cliente, en celular)",
                "tomas": [
                    ("Página pública del álbum en el celular. Señalar «Encontrá tus fotos más rápido».",
                     "Así ve tu álbum el cliente. Arriba le ofrece encontrar sus fotos más rápido."),
                    ("Tocar «Buscar por selfie», aceptar el consentimiento, sacar la selfie. Se ve «Analizando...» "
                     "y aparecen las fotos.",
                     "Con una selfie, el sistema le trae todas las fotos en las que aparece. O, si activaste el "
                     "dorsal, escribe su número."),
                    ("Tocar «Seleccionar» en varias fotos. El botón de abajo pasa a «Comprar N fotos».",
                     "Elige las que quiere y toca «Comprar»."),
                    ("«Resumen del pedido». Completar «Tus datos»: nombre, email y WhatsApp.",
                     "Revisa el resumen y deja sus datos: nombre, correo y WhatsApp. No necesita crearse una "
                     "cuenta."),
                    ("Tocar «Confirmar pedido» → «Preparando pago…» → página de pago.",
                     "Confirma el pedido y paga con Mercado Pago o con tarjeta. Y en ese momento, el dinero se "
                     "reparte: tu parte va a tu cuenta."),
                    ("Pantalla «Pago aprobado» con «Ver mis fotos».",
                     "Listo: compra hecha. En el último capítulo vemos qué te llega a vos y cómo se entrega."),
                ],
                "ojo": "Para filmar sin cobrar de verdad, usar un álbum de la cuenta demo (tiene pago simulado).",
            },
        ],
    },
    {
        "titulo": "Capítulo 6 · Tu álbum en Instagram",
        "clases": [
            {
                "cod": "C17", "titulo": "Que ComprameLaFoto publique historias de tu álbum", "dur": "3 min",
                "arranca": "/fotografo/configuracion (pestaña «Perfil») y la sección «Configuración» de un álbum",
                "tomas": [
                    ("Instagram de ComprameLaFoto en el celular: una historia con el collage de fotos, el nombre del "
                     "álbum, la frase grande, la etiqueta del fotógrafo y «COMPRAMELAFOTO.COM».",
                     "ComprameLaFoto puede publicar historias de tu álbum en su Instagram, gratis. Es un collage con "
                     "algunas de tus fotos, el nombre del álbum y tu etiqueta, y la gente ve que las fotos están en "
                     "ComprameLaFoto. Así tu evento llega a mucha más gente."),
                    ("Configuración → «Perfil». Señalar el campo «Instagram» y escribir el usuario.",
                     "Primero, cargá tu Instagram en tu perfil. Es la cuenta que vamos a etiquetar en cada historia: "
                     "así la gente que ve las fotos llega a vos."),
                    ("Abrir un álbum, sección «Configuración» → «Privacidad y acceso». Señalar la casilla «Difundir "
                     "en las historias de Instagram de CompraMeLaFoto», ya marcada.",
                     "Después, en cada álbum, entrás a «Configuración», en «Privacidad y acceso». Esta casilla viene "
                     "marcada: todos tus álbumes ya entran. Y se guarda al instante, no hace falta tocar «Guardar»."),
                    ("Señalar el texto de ayuda: «Si el álbum tiene más de 50 fotos, publicamos 3 historias en días "
                     "distintos, cada una con 3 o 4 fotos del álbum y el nombre del álbum…».",
                     "Para entrar, el álbum tiene que tener más de cincuenta fotos. Si las tiene, publicamos tres "
                     "historias en días distintos, cada una con tres o cuatro fotos y una frase distinta: el primer "
                     "día avisa que las fotos ya están, el segundo invita a buscarse y el tercero, a no quedarse sin "
                     "ellas. Las armamos solas en los días siguientes a que creás el álbum: vos no tenés que hacer "
                     "nada más."),
                    ("En «Etiquetar también», escribir un usuario (por ejemplo el del organizador) y tocar "
                     "«Agregar». Mostrar la etiqueta con la «×».",
                     "Acá podés sumar otras cuentas para etiquetar: el organizador, el club, la empresa o los "
                     "sponsors del evento. Hasta veinte. A ellos les llega la notificación y pueden compartir la "
                     "historia, que es justo lo que querés."),
                    ("Marcar «Fotos ocultas hasta selfie» y mostrar que la casilla se apaga con «Solo los álbumes "
                     "públicos y sin selfie pueden aparecer en las historias». Volver a desmarcar.",
                     "Ojo: sólo entran los álbumes públicos y sin selfie. Si tu álbum es privado, no aparece en las "
                     "historias. Y si en algún álbum no querés que se publique, desmarcás la casilla y listo."),
                ],
                "ojo": "La casilla sólo aparece si la cuenta de Instagram de ComprameLaFoto está conectada. Filmar en "
                       "un álbum público, sin selfie. Para la primera toma, usar una historia real ya publicada o "
                       "una vista previa de /admin/social (no la pantalla de admin).",
            },
        ],
    },
    {
        "titulo": "Capítulo 7 · Pedidos y entrega digital",
        "clases": [
            {
                "cod": "C18", "titulo": "Te llegó una venta: la pantalla de pedidos", "dur": "3 min",
                "arranca": "/fotografo/pedidos",
                "tomas": [
                    ("Correo «Nuevo pedido #N en tu álbum…» con los datos del cliente y el enlace al panel.",
                     "Cuando alguien te compra, te llega un correo con el número de pedido, los datos del "
                     "cliente y el total. Tocás el enlace y vas directo al pedido."),
                    ("Menú «Pedidos». Recorrer las tarjetas «Total», «Pendientes», «Pagados», «Descargas», "
                     "«Impresión».",
                     "Todos tus pedidos están en «Pedidos». Arriba ves cuántos tenés, cuántos están pagados, "
                     "cuántos ya se descargaron y cuántos tenés que imprimir."),
                    ("Tocar los filtros «Pagados», «Digitales» e «Impresión».",
                     "Con los filtros ves solo lo que te interesa. Por ejemplo, «Impresión» te muestra lo que "
                     "tenés que imprimir o entregar."),
                    ("Escribir en el buscador «Buscar por cliente, email, WhatsApp o # pedido…».",
                     "Y si un cliente te escribe, lo buscás por nombre, correo, WhatsApp o número de pedido."),
                    ("Señalar las columnas «Estado» y «Monto». Tocar «Desglose».",
                     "En cada fila ves el estado y el monto. Con «Desglose» ves cuánto es tuyo y cuánto es la "
                     "comisión."),
                ],
                "ojo": "El texto del correo al fotógrafo sale de una plantilla que puede editar el admin. Mostrar "
                       "un correo real recibido, no uno armado.",
            },
            {
                "cod": "C19", "titulo": "La ficha del pedido", "dur": "2 min",
                "arranca": "/fotografo/pedidos (tocar un pedido pagado)",
                "tomas": [
                    ("Tocar un pedido. Se abre la ficha. Recorrer «Resumen»: «Estado pago», «Descarga», "
                     "«Impresión», «Retiro», «Monto».",
                     "Si tocás un pedido, se abre su ficha. En el resumen ves si está pagado, si ya está la "
                     "descarga, si lleva impresión y quién retira."),
                    ("Bloque «Cliente»: nombre, email, teléfono y «Abrir WhatsApp →».",
                     "Los datos del cliente se ven cuando el pago está acreditado. Desde acá le escribís por "
                     "WhatsApp con un toque."),
                    ("Bloque «Timeline»: «Pedido creado», «Pago acreditado», «Descarga disponible», «Cliente "
                     "descargó».",
                     "Y en la línea de tiempo ves todo lo que pasó: cuándo se creó, cuándo se pagó y si el "
                     "cliente ya descargó sus fotos."),
                    ("Señalar el bloque «Acciones».",
                     "Abajo están las acciones para entregar. Vamos con eso."),
                ],
            },
            {
                "cod": "C20", "titulo": "La entrega de las fotos digitales", "dur": "2 min",
                "arranca": "Correo del cliente y /descargas/<token>",
                "tomas": [
                    ("Correo del cliente «Tu pedido #N fue confirmado» con el botón «Ver mis fotos».",
                     "La entrega digital es automática: no tenés que hacer nada. Apenas se acredita el pago, al "
                     "cliente le llega un correo con el botón «Ver mis fotos»."),
                    ("Centro de descargas: «Tus fotografías ya están listas», los botones «Descargar» y "
                     "«Descargar ZIP», y «Disponible hasta».",
                     "Ahí baja sus fotos una por una, o todas juntas en un ZIP. El acceso dura un tiempo, que "
                     "ves en «Disponible hasta». Las fotos son suyas para siempre, así que conviene que las "
                     "guarde."),
                    ("Volver a la ficha del pedido. Señalar «Cliente descargó».",
                     "En tu ficha del pedido ves cuando el cliente ya descargó."),
                    ("Tocar «Copiar link digitales» (cambia a «Link copiado») y pegarlo en WhatsApp.",
                     "¿Y si te dice que no le llegó? Tocás «Copiar link digitales» y se lo mandás por WhatsApp. "
                     "También le podés pedir a DNX Bot que le reenvíe el correo."),
                ],
                "ojo": "No usar «Recordar descarga» en el video: abre tu correo con un texto que no lleva el "
                       "enlace.",
            },
        ],
    },
    {
        "titulo": "Capítulo 8 · Fotos impresas",
        "clases": [
            {
                "cod": "C21", "titulo": "Tus laboratorios", "dur": "3 min",
                "arranca": "/fotografo/impresiones/laboratorios (menú «Impresiones» → «Mis laboratorios»)",
                "tomas": [
                    ("Menú lateral «Impresiones» → «Mis laboratorios». Señalar el texto de ayuda.",
                     "Si vendés fotos impresas, este capítulo es para vos. Empezamos por cargar tus laboratorios: "
                     "son los que te imprimen las copias. Entrás a «Impresiones» y después a «Mis laboratorios»."),
                    ("Tocar «Agregar laboratorio». Mostrar el enlace «Elegir del directorio».",
                     "Tocás «Agregar laboratorio». Si tu laboratorio ya está en ComprameLaFoto, lo elegís del "
                     "directorio, donde aparece con su logo. Si no, lo cargás vos."),
                    ("Completar «Nombre», «Correo» y «WhatsApp (opcional)».",
                     "Ponés el nombre, el correo y, si querés, el WhatsApp. El correo es importante: ahí le llegan "
                     "los pedidos que le mandes."),
                    ("Marcar «Tus clientes retiran en este laboratorio». Aparecen «Dirección» y «Horario de retiro».",
                     "Si tus clientes pueden pasar a buscar sus copias por ese laboratorio, marcá esta casilla y "
                     "cargá la dirección y el horario. Eso es lo que va a ver tu cliente cuando compre."),
                    ("Señalar «Usarlo como predeterminado» y tocar «Guardar». En la lista, señalar «Predeterminado» "
                     "y «Punto de retiro».",
                     "Y si es el laboratorio con el que más trabajás, lo dejás como predeterminado: va a venir "
                     "elegido cada vez que mandes un pedido. Guardás, y queda en tu lista."),
                    ("Señalar «Hacer predeterminado», «Editar» y «Quitar» en otro laboratorio de la lista.",
                     "Podés tener varios laboratorios, cambiar el predeterminado cuando quieras y editarlos. En el "
                     "próximo video vemos cómo se ponen los precios de las impresiones."),
                ],
            },
            {
                "cod": "C22", "titulo": "Precios de impresión y quién entrega", "dur": "3 min",
                "arranca": "/fotografo/configuracion?tab=productos y la pestaña «Venta» del álbum",
                "tomas": [
                    ("Menú «Ventas» → «Mis Productos Impresos». Recorrer la tabla «Nombre», «Tamaño», «Acabado», "
                     "«Precio al Público (ARS)».",
                     "Hay dos formas de ponerle precio a una foto impresa. La primera es tu propia lista: en «Mis "
                     "productos impresos» cargás cada tamaño y acabado con el precio que paga tu cliente."),
                    ("Señalar «+ Agregar Producto» y «📥 Importar/Actualizar».",
                     "Los agregás de a uno o los importás todos juntos desde un Excel."),
                    ("En un álbum, pestaña «Venta» → tarjeta «Impresiones». Señalar «Origen de precios»: «Mi lista "
                     "de productos» y «Laboratorio».",
                     "Después, en cada álbum, elegís de dónde salen los precios: de tu lista o de un laboratorio. "
                     "Esa es la segunda forma: usar los precios del laboratorio y sumarles tu margen de ganancia."),
                    ("Elegir «Laboratorio», buscarlo y señalar «Margen de ganancia (%)».",
                     "Si elegís laboratorio, lo buscás por nombre y ponés tu margen. El cliente paga el precio del "
                     "laboratorio más tu ganancia."),
                    ("Señalar «Retiro / entrega»: «El cliente retira en el laboratorio» y «Yo entrego las fotos».",
                     "Y acá viene la decisión importante: quién le da las copias al cliente. Si elegís «El cliente "
                     "retira en el laboratorio», tu cliente pasa a buscarlas por ahí y vos no tenés que moverte. Si "
                     "elegís «Yo entrego las fotos», las copias vuelven a vos y las entregás vos."),
                    ("Volver a «Mi lista de productos» y señalar «Las impresiones se realizan a cargo del fotógrafo».",
                     "Si usás tu propia lista, las copias siempre las entregás vos. En el próximo video vemos qué "
                     "elige tu cliente cuando compra una foto impresa."),
                ],
                "ojo": "En «Configuración → Impresión», el «Laboratorio preferido» y el margen dicen «Próximamente»: "
                       "no señalarlos. Lo que manda en cada venta es lo que se elige en la pestaña «Venta» del álbum.",
            },
            {
                "cod": "C23", "titulo": "Cómo pide tu cliente las fotos impresas", "dur": "2 min",
                "arranca": "/a/<slug>/comprar (vista del cliente, en celular), en un álbum con impresiones",
                "tomas": [
                    ("Álbum público: elegir fotos y tocar «Comprar». Se abre «Configurá tu pedido».",
                     "Así lo ve tu cliente. Elige sus fotos y, al comprar, configura su pedido."),
                    ("En una foto, tocar «Impresa». Elegir «Producto», «Tamaño», «Acabado» y «Cantidad».",
                     "En cada foto elige si la quiere digital o impresa. Si la quiere impresa, elige el tamaño, el "
                     "acabado, brillo o mate, y cuántas copias. El precio se calcula solo."),
                    ("Señalar «Duplicar para pedir otro formato».",
                     "Y si quiere la misma foto en dos tamaños, la duplica."),
                    ("Tarjeta «📍 ¿Dónde querés retirar tus copias?» con los laboratorios, dirección y horario. "
                     "Elegir uno.",
                     "Si elegiste que retire en un laboratorio, acá elige dónde, con la dirección y el horario que "
                     "cargaste. Así ya sabe adónde ir."),
                    ("Señalar «Total de tu pedido» y seguir al resumen.",
                     "Después paga, igual que con las digitales. Y el pedido te aparece a vos, en el panel de "
                     "impresiones, listo para mandar a imprimir."),
                ],
                "ojo": "Filmar con un álbum que tenga impresiones activas y un laboratorio marcado como punto de "
                       "retiro. No tocar «Confirmar pedido».",
            },
            {
                "cod": "C24", "titulo": "La entrega de las fotos impresas", "dur": "4 min",
                "arranca": "/fotografo/impresiones",
                "tomas": [
                    ("Menú «Impresiones» → «Para imprimir y lotes». Recorrer las columnas «Para imprimir», «En "
                     "el laboratorio», «Listos para entregar», «Entregados».",
                     "Si vendiste fotos impresas, todo se maneja en «Impresiones». Los pedidos van pasando de "
                     "columna: para imprimir, en el laboratorio, listos para entregar y entregados."),
                    ("Elegir pedidos y tocar «Armar lote con N pedidos».",
                     "Elegís los pedidos que querés mandar juntos y armás un lote."),
                    ("Tocar «Enviar al laboratorio». Elegir «Lo retiro yo» o «Me lo envía el laboratorio» y "
                     "tocar «Enviar».",
                     "Tocás «Enviar al laboratorio» y elegís si lo retirás vos o te lo mandan. Al laboratorio le "
                     "llega un correo con el enlace para ver los pedidos y bajar las fotos."),
                    ("Señalar en la tarjeta del lote «abrió ✓ · descargó ✓» y los enlaces «Etiquetas», «Sobres» "
                     "y «Remito».",
                     "En la tarjeta del lote ves si el laboratorio ya lo abrió y si descargó las fotos. Y tenés "
                     "las etiquetas y los sobres listos para imprimir."),
                    ("Tocar «Recibí el lote». Los pedidos pasan a «Listos para entregar».",
                     "A medida que avanza, lo vas marcando. Cuando tenés las copias, tocás «Recibí el lote»."),
                    ("En un pedido, tocar «QR». Mostrar la página del sobre con «Listo para retirar (avisa al "
                     "cliente)».",
                     "Cada sobre lleva un QR. Si lo escaneás y tocás «Listo para retirar», al cliente le llega un "
                     "correo para que venga a buscar sus copias."),
                    ("Tocar «Entregado» y confirmar «¿Marcar entregado el pedido #N?». El pedido pasa a "
                     "«Entregados».",
                     "Y cuando se las das, tocás «Entregado». Ese pedido queda cerrado."),
                ],
                "ojo": "El panel de lotes se estrenó el 21/11/2026: hacer un recorrido de prueba antes de grabar.",
            },
            {
                "cod": "C25", "titulo": "Del lote al laboratorio, y el pago al laboratorio", "dur": "3 min",
                "arranca": "/fotografo/impresiones y la página del lote del laboratorio",
                "tomas": [
                    ("Panel «Impresiones», paso «Para imprimir». Señalar los grupos «Retiran en …» y «Sin retiro en "
                     "laboratorio».",
                     "Los pedidos de impresión siempre pasan por tu panel, aunque el cliente retire en el "
                     "laboratorio. Acá los ves agrupados según dónde se retiran."),
                    ("Marcar los pedidos de un mismo laboratorio y tocar «Armar lote con N pedidos».",
                     "Armás un lote por laboratorio: marcás los pedidos y tocás «Armar lote»."),
                    ("«Enviar al laboratorio»: señalar «Laboratorio» (bloqueado si el cliente retira ahí), «Mensaje "
                     "para el laboratorio», «¿Cómo te lo entregan?» y «Fecha prometida».",
                     "Al enviarlo, el laboratorio ya viene elegido. Le podés dejar un mensaje, elegir si lo retirás "
                     "vos o te lo envían, y poner la fecha en que lo necesitás."),
                    ("Mostrar el correo «Lote N de …» y la página del lote del laboratorio: «Descargar el ZIP», "
                     "«Copias por medida y acabado», «Lo empezamos», «Está listo».",
                     "Al laboratorio le llega un correo con un enlace. Ahí descarga las fotos ordenadas por medida y "
                     "acabado, y va marcando cómo avanza. No necesita tener cuenta."),
                    ("Señalar en la página del lote el aviso de «Está listo» y en el sobre «PAGADO — no cobrar al "
                     "cliente».",
                     "Cuando el laboratorio marca que está listo, a los clientes que retiran ahí les llega un correo "
                     "para que pasen. Y en cada sobre dice que ya está pago, para que no le cobren nada al cliente."),
                    ("En la tarjeta del lote, tocar «Pagado al laboratorio» y mostrar la confirmación.",
                     "Al laboratorio le pagás vos, por fuera de la plataforma, como siempre. Cuando le pagás, lo "
                     "marcás acá y te queda registrado. Así llevás el control de cada lote, de punta a punta."),
                ],
                "ojo": "La página del lote del laboratorio se abre con el enlace del correo: filmarla con un lote de "
                       "prueba de la cuenta demo.",
            },
        ],
    },
    {
        "titulo": "Capítulo 9 · Cierre",
        "clases": [
            {
                "cod": "C26", "titulo": "Cuánto ganaste y cierre del curso", "dur": "2 min",
                "arranca": "/fotografo/analytics",
                "tomas": [
                    ("«Analytics»: señalar «Neto» («Lo tuyo, sin la comisión»), «Pedidos pagos» y «Ticket "
                     "promedio».",
                     "Para ver cuánto ganaste, entrás a «Analytics». «Neto» es lo tuyo, sin la comisión. También "
                     "ves cuántos pedidos pagos tuviste y cuánto gasta en promedio cada cliente."),
                    ("Gráfico «Ventas por día». Filtrar por un álbum y por «Últimos 30 días».",
                     "Podés filtrar por álbum y por período, para ver qué evento te funcionó mejor."),
                    ("Mostrar la app de Mercado Pago con el dinero acreditado (captura propia).",
                     "Y el dinero lo ves en tu Mercado Pago. Con el cobro dividido, tu parte llega en el momento "
                     "de cada venta."),
                    ("Placa de cierre con el logo y el recorrido: cuenta → Mercado Pago → cobro dividido → "
                     "álbum → venta → entrega.",
                     "Y eso es todo el recorrido: creaste tu cuenta, conectaste Mercado Pago, activaste el cobro "
                     "dividido, armaste tu álbum, lo vendiste y entregaste el pedido. Ahora te toca a vos: subí "
                     "tu primer evento. Nos vemos en ComprameLaFoto."),
                ],
            },
        ],
    },
    {
        "titulo": "Capítulo 10 · Para tu laboratorio",
        "clases": [
            {
                "cod": "C27", "titulo": "Laboratorios: recibir el lote y bajar las fotos", "dur": "4 min",
                "arranca": "El correo «Lote N de …» y la página del lote (/lab/lote/<enlace>), del lado del laboratorio",
                "tomas": [
                    ("Placa: «Para tu laboratorio». Abajo: «Mandale este video a tu laboratorio».",
                     "Esta clase es para tu laboratorio. Si imprimís con un laboratorio, mandale este video: en "
                     "cinco minutos sabe todo lo que tiene que hacer."),
                    ("Correo «Lote 2 de … — 3 pedidos, 7 copias»: la lista «Copias por medida y acabado», el "
                     "mensaje del fotógrafo y el botón «Abrir el lote».",
                     "Cuando el fotógrafo te manda un lote, te llega un correo. Ya en el correo ves cuántos pedidos "
                     "son y cuántas copias de cada medida. Tocás «Abrir el lote». No necesitás cuenta ni "
                     "contraseña: el enlace ya te deja entrar."),
                    ("Página del lote, arriba: «Lote de impresión de …», «Estado», «Entrega», «Para el» y «Pedidos "
                     "y copias». Señalar la caja «Mensaje del fotógrafo».",
                     "Arriba tenés el resumen: de qué fotógrafo es, en qué estado está, para qué fecha lo necesita "
                     "y cuántos pedidos y copias son. En «Entrega» dice si lo retira el fotógrafo o si se lo envían "
                     "ustedes. Y si te dejó un mensaje, lo ves acá."),
                    ("Sección «Descargar las fotos»: tocar «Descargar el ZIP». Mostrar también un lote grande con "
                     "«Parte 1 de 2» y «Parte 2 de 2».",
                     "Para bajar las fotos, tocás «Descargar el ZIP». Si el lote es grande, viene en partes de "
                     "hasta quince pedidos: bajá todas las partes."),
                    ("Abrir el ZIP en el Finder: las carpetas «10x15 Brillo», «13x18 Mate»…, la carpeta «Control» y "
                     "el archivo «RESUMEN_PARA_LABORATORIO.txt».",
                     "Las fotos vienen ordenadas en carpetas, una por medida y acabado: todas las diez por quince "
                     "brillo juntas, todas las trece por dieciocho mate juntas. Así imprimís de corrido, sin abrir "
                     "pedido por pedido."),
                    ("Dentro de una carpeta: archivos como «6664 2x DSC_1234.jpg». Resaltar el número de pedido y "
                     "el «2x».",
                     "Fijate el nombre de cada foto: empieza con el número de pedido, y después dice cuántas copias "
                     "van. «Dos equis» son dos copias de esa foto. Así nunca te equivocás con la cantidad."),
                    ("Abrir «RESUMEN_PARA_LABORATORIO.txt»: las copias por carpeta y el «TOTAL».",
                     "Y para controlar, en el resumen tenés cuántas copias hay en cada carpeta y el total del lote. "
                     "Es el mismo número que ves en la página, en «Copias por medida y acabado»."),
                    ("Carpeta «Control»: el «REMITO.pdf» abierto, con una fila por pedido.",
                     "En la carpeta «Control» viene el remito: un pedido por renglón, con el nombre y lo que lleva. "
                     "Si alguna foto faltara, también lo vas a ver ahí."),
                ],
                "ojo": "Filmar con el lote 2 de la cuenta demo (enlace en la tabla EmailQueue). Descargar el ZIP y "
                       "abrirlo en el Finder para las tomas de carpetas; si hace falta, armar una placa con el "
                       "árbol de carpetas. No mostrar el enlace completo del lote en pantalla.",
            },
            {
                "cod": "C28", "titulo": "Laboratorios: etiquetas, clientes y entrega", "dur": "4 min",
                "arranca": "La página del lote del laboratorio, sección «Pedidos»",
                "tomas": [
                    ("Sección «Pedidos»: una fila con «Fotógrafo + Cliente», «Pedido #6664», el álbum y "
                     "«2× 13x18 BRILLO».",
                     "Abajo de todo están los pedidos, uno por uno. Cada pedido dice el nombre del fotógrafo y el "
                     "del cliente, el número de pedido, el evento y qué copias lleva. Con eso armás cada sobre."),
                    ("Señalar que no aparecen correo, teléfono ni importes del cliente.",
                     "Del cliente ves solo el nombre. Nunca vas a ver su correo, su teléfono ni cuánto pagó: esos "
                     "datos los cuida el fotógrafo."),
                    ("Una fila con la marca amarilla «RETIRA EL CLIENTE · PAGADO, no cobrar».",
                     "Fijate bien esta marca amarilla: «Retira el cliente». Quiere decir que ese cliente va a pasar "
                     "a buscar sus fotos por tu local. Y ya está pago: no le cobres nada. Los pedidos sin esta "
                     "marca van para el fotógrafo."),
                    ("Placa con un sobre del panel del fotógrafo: «Fotógrafo + Cliente», «RETIRA EL CLIENTE · "
                     "PAGADO, no cobrar», el laboratorio, «Pedido #… · Lote …», el contenido y el QR.",
                     "El fotógrafo imprime desde su panel una etiqueta para cada sobre, con los mismos datos y un "
                     "código QR. Si te las pasa, pegás cada una en su sobre. Si no, usás la lista de pedidos para "
                     "rotularlos."),
                    ("Sección «¿Cómo va?»: tocar «Lo empezamos» y confirmar. Después «Está listo» y el aviso «A los "
                     "clientes que retiran acá les llega un correo avisando que ya pueden pasar».",
                     "Mientras trabajás, vas avisando cómo va. Tocás «Lo empezamos» cuando arrancás, y «Está listo» "
                     "cuando terminás. Ojo: al tocar «Está listo», a los clientes que retiran en tu local les llega "
                     "un correo para que pasen. Tocalo solo cuando las copias estén listas de verdad."),
                    ("En un lote con «Entrega: Lo envían ustedes», mostrar el botón «Lo despachamos».",
                     "Si el fotógrafo eligió que se lo envíen, también te aparece «Lo despachamos»: lo tocás cuando "
                     "sale el envío. Si lo retira él, no hace falta."),
                    ("En el celular: escanear el QR de un sobre. Se abre la página del pedido; tocar «Marcar entregado».",
                     "Cuando el cliente viene a buscar sus fotos, escaneás el QR de su sobre con el mismo celular "
                     "donde abriste el lote, y tocás «Marcar entregado». Listo: el fotógrafo ve al instante que ese pedido "
                     "quedó entregado."),
                    ("Placa de cierre: «Abrir → Descargar → Imprimir → Está listo → Entregado».",
                     "Y eso es todo: abrís el lote, bajás las fotos, imprimís por carpeta, avisás que está listo y "
                     "entregás. Sin llamadas ni mensajes de ida y vuelta."),
                ],
                "ojo": "La marca «RETIRA EL CLIENTE» sale en el pedido #6664 del lote 2 de la demo (el laboratorio "
                       "«Laboratorio Centro» es punto de retiro). Para «Lo despachamos» hace falta un lote con «Me "
                       "lo envía el laboratorio». El QR del sobre se escanea en el mismo navegador que abrió el "
                       "lote: si no, la página no deja «Marcar entregado».",
            },
        ],
    },
]

# Shorts verticales: un video corto por cada configuración o acción. (gancho, paso, cierre)
SHORTS = [
    ("S01", "Creá tu cuenta en un minuto", "C01",
     ("Página de registro, «Soy fotógrafo/a».", "¿Querés vender tus fotos online? Arrancá por acá."),
     ("Completar los datos y tocar «Continuar con Google».",
      "Entrás a compramelafoto punto com, elegís «Soy fotógrafo», y te registrás con tu correo o directo con "
      "Google."),
     ("Panel «Inicio».", "En un minuto tenés tu panel listo. Lo que sigue: conectar Mercado Pago.")),
    ("S02", "Tu página con tu propio nombre", "C02",
     ("«Marca y diseño», casilla «Habilitar página pública personalizada».",
      "¿Te gustaría tener tu propia página para mandar a tus clientes?"),
     ("Marcar la casilla y escribir la dirección.",
      "En «Marca y diseño» activás la página pública y elegís tu dirección: compramelafoto punto com barra tu "
      "nombre."),
     ("Tocar «Guardar preferencias y marca».", "Guardás, y ya tenés tu vidriera. Mandala en tu bio de Instagram.")),
    ("S03", "Poné tu logo en tus álbumes", "C02",
     ("«Identidad visual», botón «Subir logo».", "Tus fotos, con tu marca. Así se hace."),
     ("Subir un PNG y elegir los colores.",
      "En «Marca y diseño», «Identidad visual», subís tu logo y elegís tus colores."),
     ("Instructivo del álbum con el logo.", "Tu logo aparece en tus álbumes y en los carteles que imprimís.")),
    ("S04", "Conectá Mercado Pago", "C03",
     ("Aviso «Este paso es obligatorio».", "Sin este paso no vendés ni una foto."),
     ("Tocar «Conectar con Mercado Pago», autorizar y volver.",
      "En «Ventas», «Mercado Pago», tocás «Conectar». Iniciás sesión en Mercado Pago, autorizás y volvés. La "
      "contraseña nunca la ponés en ComprameLaFoto."),
     ("«Conectado con Mercado Pago».", "Listo: ya podés crear álbumes y cobrar.")),
    ("S05", "¿Se venció tu Mercado Pago?", "C03",
     ("Aviso «Se venció tu conexión con Mercado Pago».", "Si ves este cartel, nadie te puede comprar."),
     ("Tocar «Reconectar Mercado Pago».",
      "Mercado Pago pide renovar el permiso cada seis meses. Tocás «Reconectar», autorizás, y volvés a vender."),
     ("«Conectado con Mercado Pago».", "Un minuto. Hacelo apenas lo veas.")),
    ("S06", "Cobrá cada venta al instante", "C04",
     ("Tarjeta «Cobro dividido al instante».", "¿Y si cada venta te llegara en el momento?"),
     ("Placa del reparto: cliente → fotógrafo / organizador / plataforma.",
      "Con el cobro dividido, Mercado Pago reparte el pago apenas el cliente compra: tu parte va directo a tu "
      "cuenta. Si trabajás con un club o un colegio, cada uno recibe lo suyo."),
     ("Tarjeta en pantalla.", "Sin liquidaciones, sin transferencias. Activalo en tu panel.")),
    ("S07", "¿Quién autoriza el cobro dividido?", "C05",
     ("Placas de los tipos de venta.", "Una duda que me hacen siempre: ¿quién tiene que autorizarlo?"),
     ("Pasar las placas: álbum propio, organizador, colegio, varios fotógrafos.",
      "Si el álbum es tuyo, vos. Si hay un club, una liga o un colegio que cobra comisión, también ellos. Si son "
      "varios fotógrafos en el mismo evento, todos."),
     ("Placa «Activalo siempre».", "Mi consejo: activalo siempre, así ninguna venta se frena.")),
    ("S08", "Activá el cobro dividido en dos pasos", "C06",
     ("Cartel «Nuevos términos: cobro dividido con Mercado Pago».", "Dos pasos y nunca más te preocupás."),
     ("Aceptar el anexo, pedir la invitación y aceptarla en Mercado Pago.",
      "Uno: aceptás el anexo. Dos: escribís el correo de tu Mercado Pago, pedís la invitación y la aceptás en "
      "Mercado Pago."),
     ("Tocar «Ya acepté, revisar»: «Cobro dividido activo».", "Tocás «Ya acepté, revisar» y queda activo.")),
    ("S09", "¿Qué tipo de álbum elegir?", "C07",
     ("Asistente, paso «Tipo de álbum».", "Evento, simple o colaborativo: ¿cuál te conviene?"),
     ("Pasar por las tres tarjetas.",
      "«Evento / deporte», para carreras, partidos o fiestas. «Álbum simple», para fotos sueltas. "
      "«Colaborativo», cuando trabajan varios fotógrafos."),
     ("Elegir «Evento / deporte».", "Elegilo bien: el asistente ajusta el resto según el tipo.")),
    ("S10", "El lugar del evento, en el mapa", "C07",
     ("«Lugar · georeferenciado».", "Que tus clientes encuentren el álbum de su evento."),
     ("Buscar el lugar, elegir el resultado y cargar fecha y horario.",
      "En los datos del álbum, buscás el lugar por nombre y queda marcado en el mapa. Después cargás la fecha y "
      "el horario."),
     ("Mapa con el marcador.", "Un título con el evento y la fecha, y listo.")),
    ("S11", "Cuánto cobrar cada foto", "C08",
     ("Paso «Ventas digitales», «Simulador orientativo».", "¿Cómo se suma la comisión al precio de tu foto?"),
     ("Marcar «Vender fotos digitales», escribir el precio y mirar el simulador.",
      "Marcás «Vender fotos digitales» y escribís tu precio. La comisión se suma arriba: el cliente paga un poco "
      "más y vos recibís tu precio entero."),
     ("Simulador con «Fotógrafo recibiría aprox.».", "Y no te olvides de marcar la casilla: viene desmarcada.")),
    ("S12", "Vendé también fotos impresas", "C09",
     ("Paso «Impresiones».", "La foto en papel también se vende online."),
     ("Marcar «Ofrecer impresiones físicas», elegir el origen de precios y el margen.",
      "Activás las impresiones, elegís tu lista o la de un laboratorio, y le ponés tu margen de ganancia."),
     ("«Incluir versión digital con la impresa».",
      "Truco: regalá la versión digital con la impresa. Vende más.")),
    ("S13", "Público, no listado o con selfie", "C10",
     ("Paso «Seguridad y privacidad».", "¿Quién puede ver las fotos de tu evento?"),
     ("Pasar por las tres opciones.",
      "Público: lo ve cualquiera. No listado: solo quien tiene el enlace. Privado con identificación: cada uno "
      "ve solo sus fotos, con una selfie."),
     ("Recuadro «Recomendado para eventos con menores de edad».", "Si hay chicos, elegí la selfie.")),
    ("S14", "Creá el álbum", "C11",
     ("Paso «Listo», el resumen.", "Último paso del asistente."),
     ("Revisar el resumen, aceptar los términos y tocar «Crear álbum».",
      "Revisás el resumen, aceptás los términos y tocás «Crear álbum»."),
     ("Página del álbum recién creado.", "Tu álbum ya existe. Ahora, a subir las fotos.")),
    ("S15", "Subí una carpeta entera de fotos", "C12",
     ("Zona de subida, «Subir carpeta completa».", "¿Mil fotos? Subilas de una."),
     ("Elegir la carpeta; se ve «Procesando N foto(s) en segundo plano…».",
      "Tocás «Subir carpeta completa». Las subcarpetas se crean solas y la marca de agua se pone sola."),
     ("Grilla con las fotos.", "Cuidado: hasta diez megas por foto.")),
    ("S16", "Descuentos por cantidad", "C13",
     ("«Venta» → «Qué vendés», los descuentos.", "Que en vez de una foto se lleven diez."),
     ("Completar «Descuento 5+», «10+» y «20+».",
      "En la pestaña «Venta» cargás un descuento para cinco fotos, otro para diez y otro para veinte."),
     ("«Vista previa — precio para el cliente».", "El cliente lo ve solo cuando elige sus fotos.")),
    ("S17", "El pack «Todas mis fotos»", "C13",
     ("«Packs de galería» → «Agregar pack».", "El pack que más vende en eventos."),
     ("Elegir «Todas mis fotos», ponerle nombre y precio, «Crear pack».",
      "«Todas mis fotos»: el cliente paga un precio fijo y se lleva todas en las que aparece."),
     ("El pack en la galería del cliente.", "Ponele un precio que tiente.")),
    ("S18", "Que el corredor se encuentre por su dorsal", "C14",
     ("«Búsqueda por dorsal, patente o nombre».", "¿Una carrera con mil corredores?"),
     ("Activar la búsqueda y guardar. Mostrar al cliente escribiendo su número.",
      "Activás la búsqueda por dorsal en la configuración del álbum. El sistema lee los números y el corredor "
      "escribe el suyo."),
     ("Resultados de la búsqueda.", "Viene apagada porque tiene costo: activala en carreras.")),
    ("S19", "Clientes que esperan tus fotos", "C14",
     ("Mensaje «fotos próximamente» en la página pública.", "Vendé antes de subir una sola foto."),
     ("Mostrar el formulario y después la tabla «Interesados».",
      "Con el mensaje de fotos próximamente, la gente deja sus datos. Aparecen en «Interesados»."),
     ("Botón de WhatsApp de un interesado.", "Cuando subís las fotos, les escribís con un toque.")),
    ("S20", "Compartí tu álbum: enlace y QR", "C15",
     ("«Publicación» → «Compartir».", "Tu álbum se publica cuando lo compartís."),
     ("Tocar «Copiar enlace» y «Descargar QR».",
      "En «Publicación», copiás el enlace y descargás el QR. Pegalo en WhatsApp, Instagram o el grupo del club."),
     ("QR en una historia.", "Cuanto antes lo compartas, más vendés.")),
    ("S21", "El cartel con QR para el evento", "C15",
     ("«Instructivos», botones de carteles.", "Lo que más vende: el QR en el evento."),
     ("Tocar «Cartel A4» y «Hoja de tarjetas A4».",
      "En «Instructivos» descargás un cartel con el QR grande para colgar y tarjetas para repartir en mano."),
     ("Cartel impreso.", "La gente escanea ahí mismo y busca sus fotos.")),
    ("S22", "Así compra tu cliente", "C16",
     ("Página pública en el celular.", "Mirá lo fácil que es comprar."),
     ("Selfie → fotos encontradas → «Comprar» → datos → pago.",
      "Se saca una selfie, aparecen sus fotos, elige, deja su nombre y paga. Sin crear una cuenta."),
     ("«Pago aprobado».", "Y las fotos le llegan solas.")),
    ("S23", "Te llegó una venta", "C18",
     ("Correo «Nuevo pedido».", "Ese correo que te alegra el día."),
     ("Tocar el enlace y abrir la ficha en «Pedidos».",
      "Cuando te compran, te llega un correo con el pedido. En «Pedidos» ves todos, con filtros y buscador."),
     ("«Desglose» del monto.", "Con «Desglose» ves cuánto es tuyo.")),
    ("S24", "¿Al cliente no le llegaron las fotos?", "C20",
     ("Ficha del pedido.", "«No me llegó el correo.» Lo resolvés en diez segundos."),
     ("Tocar «Copiar link digitales» y pegarlo en WhatsApp.",
      "Abrís el pedido, tocás «Copiar link digitales» y se lo mandás por WhatsApp."),
     ("Centro de descargas del cliente.", "También se lo podés pedir a DNX Bot.")),
    ("S25", "Mandá las impresiones al laboratorio", "C24",
     ("«Impresiones», columna «Para imprimir».", "Imprimir sin perder ningún pedido."),
     ("Armar el lote, «Enviar al laboratorio», elegir el retiro y «Enviar».",
      "Elegís los pedidos, armás el lote y lo mandás al laboratorio. Le llega un correo con todo para imprimir."),
     ("Tarjeta del lote con «abrió ✓ · descargó ✓».", "Y ves cuándo lo abrió y cuándo bajó las fotos.")),
    ("S26", "Entregá con el QR del sobre", "C24",
     ("Sobre con el QR.", "Cada sobre tiene su QR."),
     ("Escanear, tocar «Listo para retirar» y después «Entregado».",
      "Lo escaneás y tocás «Listo para retirar»: al cliente le llega un aviso. Cuando se lo das, tocás "
      "«Entregado»."),
     ("Columna «Entregados».", "Pedido cerrado.")),
    ("S27", "Cuánto ganaste este mes", "C26",
     ("«Analytics».", "¿Cuánto vendiste este mes?"),
     ("Señalar «Neto» y filtrar por álbum y por «Últimos 30 días».",
      "En «Analytics», «Neto» es lo tuyo, sin la comisión. Filtrás por álbum y por período."),
     ("Gráfico «Ventas por día».", "Y sabés qué evento te funcionó mejor.")),
    ("S28", "Cargá tu laboratorio", "C21",
     ("«Mis laboratorios».", "¿Quién te imprime las fotos?"),
     ("«Agregar laboratorio»: nombre, correo y «Tus clientes retiran en este laboratorio».",
      "En «Mis laboratorios» cargás tu laboratorio con su correo. Si tus clientes retiran ahí, marcás la casilla y "
      "ponés dirección y horario."),
     ("«Predeterminado».", "Dejalo como predeterminado y viene elegido en cada pedido.")),
    ("S29", "¿Quién le da las copias al cliente?", "C22",
     ("Tarjeta «Impresiones» del álbum.", "Imprimís, ¿y después quién entrega?"),
     ("Señalar «El cliente retira en el laboratorio» y «Yo entrego las fotos».",
      "En cada álbum elegís: o el cliente retira en el laboratorio, o las copias vuelven a vos y las entregás vos."),
     ("«Margen de ganancia (%)».", "Con los precios del laboratorio, vos le sumás tu ganancia.")),
    ("S30", "Tu cliente elige dónde retirar", "C23",
     ("«¿Dónde querés retirar tus copias?».", "El cliente sabe adónde ir antes de pagar."),
     ("Elegir tamaño, acabado y el laboratorio.",
      "Elige tamaño, acabado y cantidad, y el laboratorio donde va a retirar, con la dirección y el horario."),
     ("«Total de tu pedido».", "Paga, y el pedido te llega al panel.")),
    ("S31", "Mandá el lote y llevá la cuenta", "C25",
     ("Página del lote del laboratorio.", "Así recibe el laboratorio tus pedidos."),
     ("Correo «Lote N…», «Descargar el ZIP», «Está listo».",
      "Le llega un correo, baja las fotos ordenadas por medida y, cuando están listas, el cliente recibe el aviso."),
     ("«Pagado al laboratorio».", "Le pagás vos y lo marcás: cada lote, bajo control.")),
    ("S32", "Tu álbum en las historias de ComprameLaFoto", "C17",
     ("Historia de ComprameLaFoto con el collage y «COMPRAMELAFOTO.COM».", "¿Querés que tu evento llegue a más gente, gratis?"),
     ("Casilla «Difundir en las historias de Instagram de CompraMeLaFoto» y «Etiquetar también».",
      "Cargá tu Instagram en el perfil y dejá marcada esta casilla en el álbum. Publicamos tres historias con tus "
      "fotos y te etiquetamos. Sumá al organizador o a los sponsors para que la compartan."),
     ("«Solo los álbumes públicos y sin selfie…».", "Sólo para álbumes públicos y sin selfie.")),
]

# Cosas encontradas en el código que el guion esquiva (para decidir si se arreglan antes de grabar).
HALLAZGOS = [
    "En el asistente, «Vender fotos digitales» viene desmarcada: si no se marca, el álbum se crea sin venta.",
    "El paso «Seguridad y privacidad» dice «Por ahora es sólo referencia…», pero la opción sí se guarda.",
    "En «No listado», los correos de «Enviar el enlace por mail» no se envían ni se guardan.",
    "«Crear mi primer álbum» (lista vacía) abre la configuración avanzada, no el asistente.",
    "Al conectar Mercado Pago se vuelve a la pestaña «Perfil», no a «Mercado Pago».",
    "No hay botón para reenviar el enlace de descarga en pedidos comunes; «Recordar descarga» no lleva el enlace.",
    "Al marcar «Entregado» no se le avisa nada al cliente.",
    "El cobro dividido está detrás de banderas, apagado por defecto. Hoy no cubre venta escolar, impresiones ni "
    "videos: el guion lo explica como va a funcionar.",
    "La búsqueda por dorsal queda apagada en los álbumes creados con el asistente.",
    "En «Configuración → Impresión», el «Laboratorio preferido» (para que el cliente pida directo al laboratorio) "
    "y el margen están apagados con «Próximamente». Hoy el cliente solo elige dónde retirar, y el pedido siempre "
    "pasa por el panel del fotógrafo, que arma el lote y se lo manda al laboratorio.",
    "Lo que se elige en «Configuración de ventas» sobre quién entrega las impresiones no se usa en la compra: "
    "manda lo que se elige en la pestaña «Venta» de cada álbum.",
    "Al laboratorio se le paga por fuera de la plataforma: «Pagado al laboratorio» es solo un registro.",
    "Historias de Instagram: con 50 fotos o menos el álbum no entra. Se buscan álbumes creados hace entre 6 horas y "
    "3 días, se arman hasta 5 por corrida y salen como máximo 10 historias por día, así que en semanas cargadas "
    "pueden demorarse. El admin puede sacar una historia antes de que salga, desde /admin/social. Las fotos de "
    "la historia salen de los originales, sin marca de agua.",
    "En el directorio de «Mis laboratorios» aparecen también laboratorios invitados que todavía no tienen cuenta: "
    "el fotógrafo los puede cargar, pero no aparecen en la elección de laboratorio del álbum ni en la compra del "
    "cliente hasta que se registren.",
]
